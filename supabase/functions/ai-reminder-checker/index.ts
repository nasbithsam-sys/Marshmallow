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

    const now = new Date().toISOString();
    const { data: dueTasks, error: dueError } = await supabase
      .from("quo_ai_tasks")
      .select("id, conversation_id, priority, due_at, status")
      .in("status", ["open", "snoozed"])
      .not("due_at", "is", null)
      .lte("due_at", now)
      .limit(100);

    if (dueError) throw dueError;

    let markedNeedsReview = 0;
    let reopenedSnoozed = 0;

    for (const task of dueTasks ?? []) {
      const nextStatus = task.status === "snoozed" ? "open" : "needs_review";
      const { error } = await supabase
        .from("quo_ai_tasks")
        .update({
          status: nextStatus,
          requires_human_review: true,
          snoozed_until: null,
        })
        .eq("id", task.id);

      if (!error) {
        if (nextStatus === "open") reopenedSnoozed += 1;
        else markedNeedsReview += 1;
      }
    }

    return jsonResponse({
      success: true,
      checked: dueTasks?.length ?? 0,
      marked_needs_review: markedNeedsReview,
      reopened_snoozed: reopenedSnoozed,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown reminder checker error",
      },
      400,
    );
  }
});
