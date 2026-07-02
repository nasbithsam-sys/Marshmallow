import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/quo-ai.ts";

type SupabaseClient = ReturnType<typeof createClient>;

async function authorizeJob(req: Request, supabase: SupabaseClient) {
  const cronSecret = Deno.env.get("FUNCTION_CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret");

  if (cronSecret && requestSecret === cronSecret) return null;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Admin token or valid x-cron-secret required" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: roleData, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) return jsonResponse({ error: "Could not verify role" }, 500);
  if (roleData?.role !== "admin") return jsonResponse({ error: "Admin access required" }, 403);

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service configuration." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authErrorResponse = await authorizeJob(req, supabase);
    if (authErrorResponse) return authErrorResponse;

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const [
      { data: urgentStates },
      { data: overdueTasks },
      { data: reviewTasks },
      { data: hotLeadTasks },
      { data: costRows },
      { data: failedJobs },
    ] = await Promise.all([
      supabase
        .from("quo_ai_conversation_state")
        .select("conversation_id, customer_name, customer_phone, ai_summary, next_action, urgency_level, risk_level")
        .in("urgency_level", ["high", "critical"])
        .order("updated_at", { ascending: false })
        .limit(25),
      supabase
        .from("quo_ai_tasks")
        .select("id, conversation_id, task_type, title, priority, due_at, assigned_role")
        .in("status", ["open", "needs_review"])
        .not("due_at", "is", null)
        .lt("due_at", now)
        .order("due_at", { ascending: true })
        .limit(50),
      supabase
        .from("quo_ai_tasks")
        .select("id, conversation_id, task_type, title, priority, due_at, assigned_role")
        .eq("requires_human_review", true)
        .in("status", ["open", "needs_review"])
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("quo_ai_tasks")
        .select("id, conversation_id, task_type, title, priority, due_at, assigned_role")
        .in("task_type", ["hot_lead_follow_up", "quote_follow_up", "create_lead"])
        .in("status", ["open", "needs_review"])
        .order("updated_at", { ascending: false })
        .limit(50),
      supabase
        .from("quo_ai_cost_logs")
        .select("estimated_cost, model, feature")
        .gte("created_at", `${today}T00:00:00.000Z`),
      supabase
        .from("quo_ai_jobs")
        .select("id, conversation_id, job_type, error_message, attempts")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(25),
    ]);

    const todaySpend = (costRows ?? []).reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0);
    const metrics = {
      urgent_count: urgentStates?.length ?? 0,
      overdue_tasks: overdueTasks?.length ?? 0,
      needs_review: reviewTasks?.length ?? 0,
      hot_leads: hotLeadTasks?.length ?? 0,
      failed_jobs: failedJobs?.length ?? 0,
      estimated_ai_spend_today: Number(todaySpend.toFixed(6)),
    };
    const urgentItems = [
      ...(urgentStates ?? []).map((item) => ({ type: "urgent_case", ...item })),
      ...(overdueTasks ?? []).slice(0, 10).map((item) => ({ type: "overdue_task", ...item })),
      ...(reviewTasks ?? []).slice(0, 10).map((item) => ({ type: "needs_review", ...item })),
      ...(failedJobs ?? []).slice(0, 5).map((item) => ({ type: "failed_job", ...item })),
    ];
    const summary = [
      `${metrics.urgent_count} urgent/high-priority conversations need attention.`,
      `${metrics.overdue_tasks} AI tasks are overdue.`,
      `${metrics.needs_review} items require human review.`,
      `${metrics.hot_leads} hot lead or quote follow-ups are open.`,
      `$${metrics.estimated_ai_spend_today} estimated AI spend today.`,
    ].join(" ");

    const { data: brief, error: briefError } = await supabase
      .from("quo_ai_daily_briefs")
      .upsert(
        {
          brief_date: today,
          summary,
          metrics,
          urgent_items: urgentItems,
          generated_by_ai: false,
          model: "rule-summary",
        },
        { onConflict: "brief_date" },
      )
      .select("id")
      .single();

    if (briefError) throw briefError;

    return jsonResponse({
      success: true,
      brief_id: brief.id,
      metrics,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown daily brief error",
      },
      400,
    );
  }
});
