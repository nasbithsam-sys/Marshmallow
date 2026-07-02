import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/quo-ai.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type JsonObject = Record<string, unknown>;

function envNumber(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
}

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

function mapPriority(priority: string | null | undefined) {
  if (priority === "urgent") return "critical";
  if (priority === "high" || priority === "medium" || priority === "low") return priority;
  return "medium";
}

function mapRisk(risk: string | null | undefined) {
  if (risk === "risky") return "high";
  if (risk === "moderate") return "medium";
  if (risk === "safe") return "low";
  if (risk === "critical" || risk === "high" || risk === "medium" || risk === "low") return risk;
  return "medium";
}

function inferWaitingOn(section: string | null | undefined) {
  if (section === "needs_reply" || section === "urgent_complaint" || section === "needs_human_review") return "staff";
  if (section === "waiting_for_customer" || section === "possible_dead") return "customer";
  return "unknown";
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function copyAnalyzerResultToOperationsTables(
  supabase: SupabaseClient,
  job: { id: string; conversation_id: string; latest_message_id: string | null },
) {
  const [{ data: conversation }, { data: state }, { data: decision }, { data: reminders }] = await Promise.all([
    supabase
      .from("quo_conversations")
      .select("*, quo_phone_numbers(*)")
      .eq("id", job.conversation_id)
      .maybeSingle(),
    supabase.from("ai_conversation_states").select("*").eq("conversation_id", job.conversation_id).maybeSingle(),
    supabase
      .from("ai_decisions")
      .select("*")
      .eq("conversation_id", job.conversation_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("ai_reminders")
      .select("*")
      .eq("conversation_id", job.conversation_id)
      .eq("status", "pending")
      .order("due_at", { ascending: true })
      .limit(20),
  ]);

  if (!conversation) throw new Error("Conversation missing after analysis.");

  const output = (decision?.output_json ?? {}) as JsonObject;
  const section = String(state?.section ?? conversation.current_ai_section ?? "needs_human_review");
  const confidence = Number(state?.confidence ?? decision?.confidence ?? 0);
  const requiresHumanReview =
    Boolean(state?.human_review_status === "pending") ||
    Boolean(decision?.needs_human_review) ||
    confidence < envNumber("AI_CONFIDENCE_REVIEW_THRESHOLD", 0.85);
  const evidence = state?.evidence ?? output.evidence ?? [];
  const tags = Array.isArray(output.tags) ? output.tags : conversation.ai_tags ?? [];
  const firstReminder = reminders?.[0] ?? null;
  const priority = mapPriority(String(state?.priority ?? conversation.current_priority ?? "medium"));

  await supabase.from("quo_ai_conversation_state").upsert(
    {
      conversation_id: job.conversation_id,
      customer_name: conversation.customer_name,
      customer_phone: conversation.customer_number,
      quo_phone_number_id: conversation.number_id,
      linked_lead_id: conversation.linked_lead_id,
      ai_summary: String(output.human_readable_summary ?? decision?.reason ?? conversation.rolling_ai_summary ?? ""),
      service_needed: output?.suggested_lead_fields && typeof output.suggested_lead_fields === "object"
        ? ((output.suggested_lead_fields as JsonObject).service_type as string | null)
        : null,
      customer_issue: section === "urgent_complaint" ? "Urgent or complaint risk detected" : null,
      lead_stage: section,
      customer_situation: tags.filter((tag: unknown): tag is string => typeof tag === "string"),
      waiting_on: inferWaitingOn(section),
      urgency_level: priority,
      urgency_score: priority === "critical" ? 95 : priority === "high" ? 80 : priority === "medium" ? 50 : 20,
      sentiment: section === "urgent_complaint" ? "frustrated" : "unknown",
      risk_level: mapRisk(String(state?.risk_level ?? decision?.risk_level ?? "moderate")),
      current_status: conversation.current_status ?? "open",
      next_action: String(output.next_action ?? output.human_readable_summary ?? decision?.reason ?? "Review the conversation."),
      next_action_due_at: firstReminder?.due_at ?? null,
      assigned_role: section === "urgent_complaint" ? "manager" : "customer_service",
      scheduled_for: output.scheduled_for ?? null,
      schedule_status: section === "appointment_mentioned" ? "unconfirmed" : "unknown",
      quote_status: section === "hot_lead" || section === "new_interested_lead" ? "needed" : "unknown",
      payment_status: "unknown",
      missing_information: output.missing_information ?? [],
      evidence,
      confidence,
      requires_human_review: requiresHumanReview,
      human_review_reason: requiresHumanReview ? String(decision?.reason ?? "Low confidence or risky AI decision.") : null,
      last_ai_checked_at: new Date().toISOString(),
      last_message_id: job.latest_message_id ?? decision?.latest_message_id ?? null,
    },
    { onConflict: "conversation_id" },
  );

  for (const tag of tags) {
    if (typeof tag !== "string" || !tag.trim()) continue;
    await supabase.from("quo_ai_tags").upsert(
      {
        conversation_id: job.conversation_id,
        tag: tag.trim(),
        confidence,
        reason: decision?.reason,
        evidence,
        created_by_ai: true,
        status: "active",
      },
      { onConflict: "conversation_id,tag" },
    );
  }

  const recommendedActions = safeArray(output.recommended_actions);
  for (const action of recommendedActions) {
    if (!action || typeof action !== "object") continue;
    const actionObject = action as JsonObject;
    const actionName = String(actionObject.action ?? "review");
    const title = actionName.replace(/_/g, " ");
    const existing = await supabase
      .from("quo_ai_tasks")
      .select("id")
      .eq("conversation_id", job.conversation_id)
      .eq("task_type", actionName)
      .in("status", ["open", "needs_review", "snoozed"])
      .limit(1)
      .maybeSingle();

    if (existing.data?.id) continue;

    await supabase.from("quo_ai_tasks").insert({
      conversation_id: job.conversation_id,
      linked_lead_id: conversation.linked_lead_id,
      task_type: actionName,
      title,
      instructions: String(actionObject.reason ?? output.human_readable_summary ?? "Review this conversation."),
      reason: String(actionObject.reason ?? decision?.reason ?? ""),
      evidence,
      priority,
      status: requiresHumanReview || actionName.includes("review") ? "needs_review" : "open",
      due_at: firstReminder?.due_at ?? null,
      assigned_role: section === "urgent_complaint" ? "manager" : "customer_service",
      created_by_ai: true,
      requires_human_review: requiresHumanReview,
    });
  }

  for (const reminder of reminders ?? []) {
    const existing = await supabase
      .from("quo_ai_tasks")
      .select("id")
      .eq("conversation_id", job.conversation_id)
      .eq("task_type", reminder.reminder_type)
      .eq("due_at", reminder.due_at)
      .in("status", ["open", "needs_review", "snoozed"])
      .limit(1)
      .maybeSingle();

    if (existing.data?.id) continue;

    await supabase.from("quo_ai_tasks").insert({
      conversation_id: job.conversation_id,
      linked_lead_id: conversation.linked_lead_id,
      task_type: reminder.reminder_type,
      title: reminder.reminder_type.replace(/_/g, " "),
      instructions: reminder.reason ?? "Follow up on this conversation.",
      reason: reminder.reason,
      evidence,
      priority,
      status: requiresHumanReview ? "needs_review" : "open",
      due_at: reminder.due_at,
      assigned_role: section === "urgent_complaint" ? "manager" : "customer_service",
      created_by_ai: true,
      requires_human_review: requiresHumanReview,
    });
  }

  if (decision?.estimated_cost_usd || decision?.prompt_tokens || decision?.completion_tokens) {
    await supabase.from("quo_ai_cost_logs").insert({
      conversation_id: job.conversation_id,
      job_id: job.id,
      feature: job.id ? "job_processing" : "conversation_analysis",
      model: decision.model_used ?? "rule-engine",
      input_tokens: decision.prompt_tokens ?? 0,
      output_tokens: decision.completion_tokens ?? 0,
      estimated_cost: decision.estimated_cost_usd ?? 0,
    });
  }
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

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batch_size ?? envNumber("AI_JOB_BATCH_SIZE", 10)), 25);
    const workerId = crypto.randomUUID();

    const { data: jobs, error: jobsError } = await supabase
      .from("quo_ai_jobs")
      .select("*")
      .eq("status", "pending")
      .lte("run_after", new Date().toISOString())
      .order("priority", { ascending: true })
      .order("run_after", { ascending: true })
      .limit(batchSize);

    if (jobsError) throw jobsError;

    let processed = 0;
    let failed = 0;

    for (const job of jobs ?? []) {
      const { data: lockedJob } = await supabase
        .from("quo_ai_jobs")
        .update({
          status: "running",
          locked_at: new Date().toISOString(),
          locked_by: workerId,
          attempts: Number(job.attempts ?? 0) + 1,
        })
        .eq("id", job.id)
        .eq("status", "pending")
        .select("*")
        .maybeSingle();

      if (!lockedJob) continue;

      try {
        if (lockedJob.job_type !== "daily_brief") {
          const { error: invokeError } = await supabase.functions.invoke("ai-analyze-conversation", {
            body: {
              conversation_id: lockedJob.conversation_id,
              latest_message_id: lockedJob.latest_message_id,
            },
          });
          if (invokeError) throw invokeError;

          await copyAnalyzerResultToOperationsTables(supabase, lockedJob);
        }

        await supabase
          .from("quo_ai_jobs")
          .update({
            status: "completed",
            locked_at: null,
            locked_by: null,
            error_message: null,
          })
          .eq("id", lockedJob.id);
        processed += 1;
      } catch (error) {
        const attempts = Number(lockedJob.attempts ?? 1);
        const maxAttempts = Number(lockedJob.max_attempts ?? 3);
        const shouldRetry = attempts < maxAttempts;

        await supabase
          .from("quo_ai_jobs")
          .update({
            status: shouldRetry ? "pending" : "failed",
            run_after: shouldRetry ? new Date(Date.now() + attempts * 60_000).toISOString() : lockedJob.run_after,
            locked_at: null,
            locked_by: null,
            error_message: error instanceof Error ? error.message : "Unknown job processing error",
          })
          .eq("id", lockedJob.id);
        failed += 1;
      }
    }

    return jsonResponse({
      success: true,
      picked: jobs?.length ?? 0,
      processed,
      failed,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown job processor error",
      },
      400,
    );
  }
});
