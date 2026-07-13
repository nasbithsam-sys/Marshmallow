import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  hashJson,
  isLowValueMessage,
  jsonResponse,
  type QuoAiOpsCaseOutput,
  validateQuoAiOpsCaseOutput,
} from "../_shared/quo-ai.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type Priority = "low" | "medium" | "high" | "critical";
type BudgetMode = "normal" | "soft_cap" | "critical_only" | "stopped";

const reviewThreshold = () => envNumber("AI_CONFIDENCE_REVIEW_THRESHOLD", 0.85);

function envNumber(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function asPriority(value: unknown): Priority {
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "medium";
}

function clampBatchSize(value: unknown) {
  const requested = Number(value ?? envNumber("AI_JOB_BATCH_SIZE", 10));
  return Math.max(1, Math.min(Number.isFinite(requested) ? requested : 10, 50));
}

function parseJobIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
}

async function authorizeJob(req: Request, supabase: SupabaseClient) {
  const cronSecret = Deno.env.get("FUNCTION_CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret");

  if (cronSecret && requestSecret === cronSecret) return null;

  if (requestSecret) {
    const { data: setting } = await supabase
      .from("quo_ai_settings")
      .select("value")
      .eq("key", "cron_secret")
      .maybeSingle();
    const storedCronSecret = Array.isArray(setting?.value)
      ? setting.value.find((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
      : typeof setting?.value === "string"
        ? setting.value
        : setting?.value && typeof setting.value === "object" && typeof (setting.value as Record<string, unknown>).secret === "string"
          ? String((setting.value as Record<string, unknown>).secret)
          : null;

    if (storedCronSecret && requestSecret === storedCronSecret) return null;
  }

  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
  const apiKey = req.headers.get("apikey");

  if (serviceRoleKey && (bearerToken === serviceRoleKey || apiKey === serviceRoleKey)) return null;

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Admin token or valid x-cron-secret required" }, 401);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(bearerToken ?? "");

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

function chooseModel(kind: "fast" | "main" | "risk") {
  if (kind === "fast") {
    return Deno.env.get("AI_MODEL_FAST_CLASSIFIER") ?? Deno.env.get("OPENAI_MODEL_CHEAP") ?? "gpt-4o-mini";
  }
  if (kind === "risk") {
    return Deno.env.get("AI_MODEL_RISK_VERIFIER") ?? Deno.env.get("OPENAI_MODEL_REVIEW") ?? "gpt-4o";
  }
  return Deno.env.get("AI_MODEL_MAIN_REASONER") ?? Deno.env.get("OPENAI_MODEL_MAIN") ?? "gpt-4o-mini";
}

function usesMaxCompletionTokens(model: string) {
  const normalized = model.trim().toLowerCase();
  // All modern OpenAI models accept (and reasoning models REQUIRE) max_completion_tokens.
  // Prefer it for anything gpt-4o / gpt-4.1 / gpt-5 / o-series; fall back to max_tokens only for legacy.
  const modernFamilies = ["o1", "o3", "o4", "gpt-4o", "gpt-4.1", "gpt-5"];
  return modernFamilies.some((family) => normalized === family || normalized.startsWith(`${family}-`) || normalized.startsWith(`${family}.`));
}

function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const costTable: Record<string, { input: number; output: number }> = {
    "gpt-4o": { input: 0.0000025, output: 0.000010 },
    "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
    "gpt-5.5": { input: 0.000005, output: 0.00003 },
    "gpt-5.4-mini": { input: 0.00000075, output: 0.0000045 },
    "gpt-5.4-nano": { input: 0.0000002, output: 0.00000125 },
    "gpt-4.1": { input: 0.000002, output: 0.000008 },
    "gpt-4.1-mini": { input: 0.0000004, output: 0.0000016 },
    "gpt-4.1-nano": { input: 0.0000001, output: 0.0000004 },
  };
  const pricing = costTable[model] ?? costTable["gpt-4o-mini"];
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

function getBudgetMode(monthlySpend: number) {
  const softCap = envNumber("AI_MONTHLY_SOFT_CAP_USD", 180);
  const hardCap = envNumber("AI_MONTHLY_HARD_CAP_USD", envNumber("AI_MONTHLY_BUDGET_USD", 200));

  if (monthlySpend >= hardCap) return "stopped" as const;
  if (monthlySpend >= hardCap * 0.95) return "critical_only" as const;
  if (monthlySpend >= softCap || monthlySpend >= hardCap * 0.8) return "soft_cap" as const;
  return "normal" as const;
}

function shouldProcessAiJob({
  budgetMode,
  priority,
  isNewInbound,
  isRisky,
}: {
  budgetMode: BudgetMode;
  priority: Priority;
  isNewInbound: boolean;
  isRisky: boolean;
}) {
  if (budgetMode === "normal") return true;
  if (budgetMode === "soft_cap") return priority !== "low" || isNewInbound || isRisky;
  if (budgetMode === "critical_only") return priority === "critical" || isRisky || isNewInbound;
  return priority === "critical" && isRisky;
}

function isRealAiTag(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return normalized.length > 0 && normalized !== "needs human review" && normalized !== "human review";
}

function buildFallbackTag(output: QuoAiOpsCaseOutput) {
  if (output.waiting_on === "staff" || output.waiting_on === "manager") return "Customer Needs Reply";
  if (output.schedule_status === "requested" || output.schedule_status === "tentative" || output.schedule_status === "unconfirmed") return "Scheduling Needed";
  if (output.schedule_status === "confirmed") return "Job Scheduled";
  if (output.schedule_status === "reschedule_needed") return "Reschedule Needed";
  if (output.quote_status === "needed") return "Needs Quote";
  if (output.quote_status === "sent" || output.quote_status === "follow_up_due") return "Quote Sent Waiting Customer";
  if (output.payment_status === "pending" || output.payment_status === "dispute") return "Payment Follow Up";
  if (output.risk_level === "high" || output.risk_level === "critical") return "Manager Review";
  if (output.waiting_on === "customer") return "Waiting Customer Response";
  return output.current_status ? toStaffTag(output.current_status) : "AI Reviewed";
}

function toStaffTag(value: string) {
  const words = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().split(" ");
  return words.map((word) => word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : "").join(" ").trim() || "AI Reviewed";
}

async function getBudgetStatus(supabase: SupabaseClient) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [{ count: dailyCalls }, { data: dailyRows }, { data: monthlyRows }] = await Promise.all([
    supabase
      .from("quo_ai_cost_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today.toISOString()),
    supabase
      .from("quo_ai_cost_logs")
      .select("estimated_cost")
      .gte("created_at", today.toISOString()),
    supabase
      .from("quo_ai_cost_logs")
      .select("estimated_cost")
      .gte("created_at", monthStart.toISOString()),
  ]);

  const sumCost = (rows: Array<{ estimated_cost?: number | string | null }> | null) =>
    (rows ?? []).reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0);

  const monthlySpend = sumCost(monthlyRows as any);
  const dailySpend = sumCost(dailyRows as any);
  const dailyCallLimit = envNumber("AI_DAILY_CALL_LIMIT", 500);
  const dailyHardCapUsd = envNumber("AI_DAILY_HARD_CAP_USD", 2);
  const dailyLimitReached =
    (dailyCalls ?? 0) >= dailyCallLimit || (dailyHardCapUsd > 0 && dailySpend >= dailyHardCapUsd);
  const mode = dailyLimitReached ? "stopped" : getBudgetMode(monthlySpend);

  return {
    mode,
    dailyCalls: dailyCalls ?? 0,
    dailySpend,
    monthlySpend,
  };
}

function containsRiskText(text: string) {
  return /angry|cancel|refund|complaint|dispute|lawsuit|chargeback|bad review|emergency|asap|urgent|manager/i.test(text);
}

async function findExactLead(supabase: SupabaseClient, customerNumber: string | null) {
  if (!customerNumber) return null;
  const digits = customerNumber.replace(/\D/g, "");
  if (!digits) return null;

  // Server-side filter using the last 10 digits so older leads are found too.
  const last10 = digits.slice(-10);
  const { data } = await supabase
    .from("leads")
    .select("id, job_id, customer_name, customer_phone, status, service_type, scheduled_date, address")
    .ilike("customer_phone", `%${last10}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).find((lead: { customer_phone?: string | null }) => {
    const leadDigits = String(lead.customer_phone ?? "").replace(/\D/g, "");
    return leadDigits && leadDigits === digits;
  }) ?? null;
}

async function loadContext(supabase: SupabaseClient, job: { conversation_id: string; latest_message_id: string | null }) {
  const { data: conversation, error: conversationError } = await supabase
    .from("quo_conversations")
    .select("*, quo_phone_numbers(*)")
    .eq("id", job.conversation_id)
    .maybeSingle();
  if (conversationError || !conversation) throw new Error("Conversation not found.");

  const { data: messages, error: messagesError } = await supabase
    .from("quo_messages")
    .select("id, quo_message_id, sender, direction, text, media, status, message_time, created_at")
    .eq("conversation_id", job.conversation_id)
    .order("message_time", { ascending: false })
    .limit(14);
  if (messagesError) throw messagesError;

  const latestMessage =
    (job.latest_message_id ? messages?.find((message: { id: string }) => message.id === job.latest_message_id) : null) ??
    messages?.[0];
  if (!latestMessage) throw new Error("No messages found for conversation.");

  const linkedLeadPromise = conversation.linked_lead_id
    ? supabase
        .from("leads")
        .select("id, job_id, customer_name, customer_phone, status, service_type, scheduled_date, address")
        .eq("id", conversation.linked_lead_id)
        .maybeSingle()
    : findExactLead(supabase, conversation.customer_number);

  const [linkedLead, { data: opsState }, { data: openTasks }, { data: tags }, { data: feedback }] = await Promise.all([
    linkedLeadPromise,
    supabase.from("quo_ai_conversation_state").select("*").eq("conversation_id", job.conversation_id).maybeSingle(),
    supabase
      .from("quo_ai_tasks")
      .select("id, task_type, title, status, priority, due_at, reason")
      .eq("conversation_id", job.conversation_id)
      .in("status", ["open", "needs_review", "snoozed"])
      .order("updated_at", { ascending: false })
      .limit(25),
    supabase.from("quo_ai_tags").select("tag, confidence, reason").eq("conversation_id", job.conversation_id).eq("status", "active"),
    supabase
      .from("quo_ai_feedback")
      .select("feedback_type, user_note, corrected_json, created_at")
      .eq("conversation_id", job.conversation_id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    conversation,
    messages: (messages ?? []).slice().reverse(),
    latestMessage,
    linkedLead: linkedLead && typeof linkedLead === "object" && "data" in linkedLead ? linkedLead.data : linkedLead,
    opsState,
    openTasks: openTasks ?? [],
    tags: tags ?? [],
    feedback: feedback ?? [],
  };
}

function buildRuleCase(
  context: Awaited<ReturnType<typeof loadContext>>,
  reason: string,
  waitingOn: QuoAiOpsCaseOutput["waiting_on"],
  urgency: Priority,
) {
  const latestText = typeof context.latestMessage.text === "string" ? context.latestMessage.text : "";

  return {
    case_summary: reason,
    service_needed: context.linkedLead?.service_type ?? null,
    customer_issue: null,
    lead_stage: context.linkedLead?.status ?? "monitoring",
    customer_situation: {
      source: "rule_engine",
      latest_message: latestText.slice(0, 240),
      linked_lead_id: context.linkedLead?.id ?? null,
    },
    waiting_on: waitingOn,
    urgency_level: urgency,
    urgency_score: urgency === "critical" ? 95 : urgency === "high" ? 80 : urgency === "medium" ? 50 : 20,
    risk_level: urgency === "critical" ? "critical" : urgency === "high" ? "medium" : "low",
    sentiment: "unknown",
    current_status: "open",
    next_action: reason,
    next_action_due_at: null,
    assigned_role: urgency === "critical" ? "manager" : "customer_service",
    scheduled_for: null,
    schedule_status: "unknown",
    quote_status: "unknown",
    payment_status: "unknown",
    tags: [],
    tasks: waitingOn === "staff"
      ? [{
          task_type: "missed_reply",
          title: "Reply to customer",
          instructions: reason,
          reason,
          priority: urgency,
          due_at: null,
          assigned_role: urgency === "critical" ? "manager" : "customer_service",
          requires_human_review: urgency === "critical",
          evidence: [],
        }]
      : [],
    events: [],
    missing_information: [],
    evidence: [],
    confidence: 0.92,
    requires_human_review: urgency === "critical",
    human_review_reason: urgency === "critical" ? reason : null,
  } satisfies QuoAiOpsCaseOutput;
}

function inferRuleCase(context: Awaited<ReturnType<typeof loadContext>>) {
  const latestText = typeof context.latestMessage.text === "string" ? context.latestMessage.text : "";

  if (context.latestMessage.sender !== "customer") {
    return buildRuleCase(context, "Latest message is from staff, so the case is waiting on the customer.", "customer", "low");
  }

  if (isLowValueMessage(latestText) && context.opsState) {
    return buildRuleCase(context, "Customer sent a simple acknowledgement; keep the existing case state without spending AI.", "no_one", "low");
  }

  return null;
}

function buildCasePrompt(context: Awaited<ReturnType<typeof loadContext>>, jobType: string) {
  return [
    {
      role: "system",
      content:
        "You are a conservative internal Quo CRM operations assistant. Return JSON only. Do not write customer-facing replies. Do not promise technician availability, confirm appointments, cancel jobs, mark leads lost, change payment state, delete records, or make irreversible decisions.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Update persistent conversation case memory and create only internal tasks/reminders/tags/events that are safe.",
        job_type: jobType,
        business_rules: [
          "Use evidence from messages, previous AI state, open tasks, linked lead, and feedback.",
          "If confidence is below 0.85, require human review.",
          "Complaints, angry customers, cancellation risk, payment issues, uncertain scheduling, conflicting evidence, and customer-loss risk require human review.",
          "Prefer rule-based no-op if nothing meaningful changed.",
          "Tasks must be internal staff instructions, never automatic customer messages.",
          "ALWAYS emit exactly one primary situation tag in `tags[0]` that DESCRIBES THE SPECIFIC SCENARIO happening in this chat right now — NOT a generic fixed label. Never leave tags empty. Never return 'needs human review', 'AI Reviewed', or similar filler as the tag.",
          "To build the tag, first read the LAST 3-4 messages carefully to understand what is actually going on (who said what, what was asked, what was answered, what is still open). If those 3-4 messages are short, emoji-only, media-only, ambiguous, or lack context, KEEP READING earlier messages until the scenario is clear. Do not guess.",
          "The tag MUST be 3-5 words in Title Case, plain English, and specific to THIS conversation's scenario — for example capture the service, blocker, or what someone is waiting on (e.g. 'Waiting AC Quote Approval', 'Sent Pictures Awaiting Estimate', 'Rescheduling Water Heater Visit', 'Complaint About Late Tech', 'Customer Chose Other Company', 'Confirming Tomorrow 2PM Visit'). Do NOT pick from a fixed list; INVENT the phrase from the actual last messages.",
          "Never emit vague tags like 'Needs Reply', 'Follow Up', 'Waiting', 'Lead', 'Active', 'AI Reviewed', 'Update', 'General', 'Other', or a single generic word — those are rejected. The tag must name the concrete situation.",
          "ALSO set `current_status` to a short staff-scannable snake_case label consistent with the tag.",
          "If messages contain media without text, treat it as pictures/videos sent and reflect that in the tag when relevant (e.g. 'Customer Sent Damage Photos').",
          "`customer_situation` MUST be a JSON object (not a string, not an array). Include short keys like { summary, last_customer_message, last_staff_message, awaiting }.",
        ],
        required_json_schema: {
          case_summary: "short persistent case summary",
          service_needed: "string or null",
          customer_issue: "string or null",
          lead_stage: "short stage label",
          customer_situation: {},
          waiting_on: "staff | customer | technician | manager | no_one | unknown",
          urgency_level: "low | medium | high | critical",
          urgency_score: "0-100 number",
          risk_level: "low | medium | high | critical",
          sentiment: "positive | neutral | confused | angry | frustrated | unknown",
          current_status: "short status",
          next_action: "single safest internal next action",
          next_action_due_at: "ISO datetime or null",
          assigned_role: "admin | manager | customer_service | processor",
          scheduled_for: "ISO datetime or null",
          schedule_status: "none | requested | tentative | unconfirmed | confirmed | reschedule_needed | unknown",
          quote_status: "none | needed | sent | accepted | rejected | follow_up_due | unknown",
          payment_status: "none | pending | paid | dispute | unknown",
          tags: [{ tag: "primary current situation tag in plain English", confidence: 0.9, reason: "string", evidence: [] }],
          tasks: [{
            task_type: "missed_reply|hot_lead_follow_up|quote_follow_up|schedule_confirmation|complaint_follow_up|payment_follow_up|ghosting_follow_up|manager_escalation|other",
            title: "string",
            instructions: "internal instructions",
            reason: "string",
            priority: "low | medium | high | critical",
            due_at: "ISO datetime or null",
            assigned_role: "admin | manager | customer_service | processor",
            requires_human_review: false,
            evidence: [],
          }],
          events: [{ event_type: "schedule|quote|payment|complaint|risk", event_json: {}, confidence: 0.9, evidence: [] }],
          missing_information: [],
          evidence: [],
          confidence: 0.9,
          requires_human_review: false,
          human_review_reason: "string or null",
        },
        context: {
          conversation: context.conversation,
          recent_messages: context.messages,
          previous_case_state: context.opsState,
          open_tasks: context.openTasks,
          active_tags: context.tags,
          linked_lead: context.linkedLead,
          user_feedback: context.feedback,
          business_timezone: Deno.env.get("BUSINESS_TIMEZONE") ?? "America/New_York",
        },
      }),
    },
  ];
}

function buildVerifierPrompt(output: QuoAiOpsCaseOutput, context: Awaited<ReturnType<typeof loadContext>>) {
  return [
    {
      role: "system",
      content:
        "You are a strict risk verifier for a CRM AI assistant. Return the same JSON schema only. Make the case safer, not more aggressive.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Verify this case output for customer-loss risk, scheduling uncertainty, complaints, payment disputes, and unsupported claims. If evidence is weak, require human review and lower confidence.",
        proposed_output: output,
        recent_messages: context.messages,
        linked_lead: context.linkedLead,
        previous_case_state: context.opsState,
      }),
    },
  ];
}

async function callOpenAi(messages: Array<{ role: string; content: string }>, model: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const maxTokens = envNumber("AI_MAX_TOKENS_PER_CALL", 1200);
  const baseBody: Record<string, unknown> = {
    model,
    messages,
    response_format: { type: "json_object" },
  };

  const buildBody = (tokenParam: "max_tokens" | "max_completion_tokens") => {
    const body: Record<string, unknown> = { ...baseBody, [tokenParam]: maxTokens };
    if (tokenParam === "max_tokens") body.temperature = 0.1;
    return body;
  };

  const preferredTokenParam = usesMaxCompletionTokens(model) ? "max_completion_tokens" : "max_tokens";
  const fallbackTokenParam = preferredTokenParam === "max_tokens" ? "max_completion_tokens" : "max_tokens";

  const request = (tokenParam: "max_tokens" | "max_completion_tokens") =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildBody(tokenParam)),
    });

  let response = await request(preferredTokenParam);
  let data = await response.json();

  const errorMessage = typeof data?.error?.message === "string" ? data.error.message : "";
  if (!response.ok && /max_tokens|max_completion_tokens/i.test(errorMessage)) {
    response = await request(fallbackTokenParam);
    data = await response.json();
  }

  if (!response.ok) throw new Error(data?.error?.message ?? `OpenAI request failed with status ${response.status}`);

  const rawContent = data?.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string") throw new Error("OpenAI response did not include JSON content.");

  const inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(data?.usage?.completion_tokens ?? 0);

  return {
    output: JSON.parse(rawContent),
    usage: {
      inputTokens,
      outputTokens,
      estimatedCost: estimateCost(model, inputTokens, outputTokens),
    },
  };
}

function shouldVerify(output: QuoAiOpsCaseOutput, context: Awaited<ReturnType<typeof loadContext>>) {
  const text = context.messages.map((message: { text?: string | null }) => message.text ?? "").join(" ");
  return (
    output.risk_level === "high" ||
    output.risk_level === "critical" ||
    output.urgency_level === "critical" ||
    output.confidence < reviewThreshold() ||
    output.requires_human_review ||
    containsRiskText(text)
  );
}

async function logCost(
  supabase: SupabaseClient,
  jobId: string,
  conversationId: string,
  feature: string,
  model: string,
  usage: { inputTokens: number; outputTokens: number; estimatedCost: number },
) {
  await supabase.from("quo_ai_cost_logs").insert({
    conversation_id: conversationId,
    job_id: jobId,
    feature,
    model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost: usage.estimatedCost,
  });
}

async function saveOpsOutput(
  supabase: SupabaseClient,
  job: { id: string; conversation_id: string; latest_message_id: string | null },
  context: Awaited<ReturnType<typeof loadContext>>,
  output: QuoAiOpsCaseOutput,
) {
  const requiresReview = output.requires_human_review || output.confidence < reviewThreshold();
  const realTags = output.tags.filter((tag) => isRealAiTag(tag.tag));
  const tagsToSave = realTags.length > 0
    ? realTags
    : [{
        tag: buildFallbackTag(output),
        confidence: Math.max(0.5, Math.min(output.confidence, 0.95)),
        reason: "Fallback situation tag from validated AI case state.",
        evidence: output.evidence,
      }];

  await supabase.from("quo_ai_conversation_state").upsert(
    {
      conversation_id: job.conversation_id,
      customer_name: context.conversation.customer_name,
      customer_phone: context.conversation.customer_number,
      quo_phone_number_id: context.conversation.number_id,
      linked_lead_id: context.conversation.linked_lead_id ?? context.linkedLead?.id ?? null,
      ai_summary: output.case_summary,
      service_needed: output.service_needed,
      customer_issue: output.customer_issue,
      lead_stage: output.lead_stage,
      customer_situation: output.customer_situation,
      waiting_on: output.waiting_on,
      urgency_level: output.urgency_level,
      urgency_score: Math.round(output.urgency_score),
      sentiment: output.sentiment,
      risk_level: output.risk_level,
      current_status: output.current_status,
      next_action: output.next_action,
      next_action_due_at: output.next_action_due_at,
      assigned_role: output.assigned_role,
      scheduled_for: output.scheduled_for,
      schedule_status: output.schedule_status,
      quote_status: output.quote_status,
      payment_status: output.payment_status,
      missing_information: output.missing_information,
      evidence: output.evidence,
      confidence: output.confidence,
      requires_human_review: requiresReview,
      human_review_reason: requiresReview ? output.human_review_reason ?? "Low confidence or risky case." : null,
      last_ai_checked_at: new Date().toISOString(),
      last_message_id: job.latest_message_id ?? context.latestMessage.id,
    },
    { onConflict: "conversation_id" },
  );

  await supabase
    .from("quo_conversations")
    .update({
      current_priority: output.urgency_level === "critical" ? "urgent" : output.urgency_level,
      current_ai_section: requiresReview ? "needs_human_review" : output.waiting_on === "staff" || output.waiting_on === "manager" ? "needs_reply" : "waiting_for_customer",
      rolling_ai_summary: output.case_summary,
      last_ai_analyzed_at: new Date().toISOString(),
      ai_tags: tagsToSave.map((tag) => tag.tag),
    })
    .eq("id", job.conversation_id);

  for (const tag of tagsToSave.slice(0, 20)) {
    await supabase.from("quo_ai_tags").upsert(
      {
        conversation_id: job.conversation_id,
        tag: tag.tag.trim(),
        confidence: tag.confidence,
        reason: tag.reason,
        evidence: tag.evidence,
        created_by_ai: true,
        status: "active",
      },
      { onConflict: "conversation_id,tag" },
    );
  }

  for (const task of output.tasks.slice(0, 10)) {
    const { data: existing } = await supabase
      .from("quo_ai_tasks")
      .select("id")
      .eq("conversation_id", job.conversation_id)
      .eq("task_type", task.task_type)
      .in("status", ["open", "needs_review", "snoozed"])
      .limit(1)
      .maybeSingle();

    if (existing?.id) continue;

    await supabase.from("quo_ai_tasks").insert({
      conversation_id: job.conversation_id,
      linked_lead_id: context.conversation.linked_lead_id ?? context.linkedLead?.id ?? null,
      task_type: task.task_type,
      title: task.title,
      instructions: task.instructions,
      reason: task.reason,
      evidence: task.evidence,
      priority: task.priority,
      status: task.requires_human_review || requiresReview ? "needs_review" : "open",
      due_at: task.due_at,
      assigned_role: task.assigned_role,
      created_by_ai: true,
      requires_human_review: task.requires_human_review || requiresReview,
    });
  }

  for (const event of output.events.slice(0, 20)) {
    await supabase.from("quo_ai_events").insert({
      conversation_id: job.conversation_id,
      event_type: event.event_type,
      event_json: event.event_json,
      confidence: event.confidence,
      evidence: event.evidence,
    });
  }

  return tagsToSave.length;
}

async function createBudgetReviewTask(
  supabase: SupabaseClient,
  job: { conversation_id: string },
  context: Awaited<ReturnType<typeof loadContext>>,
  reason: string,
) {
  const { data: existing } = await supabase
    .from("quo_ai_tasks")
    .select("id")
    .eq("conversation_id", job.conversation_id)
    .eq("task_type", "manager_escalation")
    .in("status", ["open", "needs_review", "snoozed"])
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  await supabase.from("quo_ai_tasks").insert({
    conversation_id: job.conversation_id,
    linked_lead_id: context.conversation.linked_lead_id ?? context.linkedLead?.id ?? null,
    task_type: "manager_escalation",
    title: "Review Quo conversation",
    instructions: reason,
    reason,
    evidence: [],
    priority: "high",
    status: "needs_review",
    assigned_role: "manager",
    created_by_ai: false,
    requires_human_review: true,
  });
}

async function reapStaleJobs(supabase: SupabaseClient) {
  // Release jobs stuck in `running` (worker crash / timeout) so they can be retried.
  const staleCutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  await supabase
    .from("quo_ai_jobs")
    .update({ status: "pending", locked_at: null, locked_by: null, run_after: new Date().toISOString() })
    .eq("status", "running")
    .lt("locked_at", staleCutoff);
}

async function processPendingJobs(supabase: SupabaseClient, body: Record<string, unknown>) {
  const batchSize = clampBatchSize(body.batch_size);
  const requestedJobIds = parseJobIds(body.job_ids);
  const forceAi = body.force_ai === true || requestedJobIds.length > 0;
  const workerId = crypto.randomUUID();

  await reapStaleJobs(supabase);

  let jobsQuery = supabase
    .from("quo_ai_jobs")
    .select("*")
    .eq("status", "pending");

  if (requestedJobIds.length > 0) {
    // Specific job IDs requested — fetch them regardless of run_after
    jobsQuery = jobsQuery.in("id", requestedJobIds);
  } else if (forceAi) {
    // force_ai=true (manual run or webhook trigger) — skip run_after so debounced jobs run now
    // no run_after filter applied
  } else {
    jobsQuery = jobsQuery.lte("run_after", new Date().toISOString());
  }

  const { data: jobs, error: jobsError } = await jobsQuery
    .order("priority", { ascending: true })
    .order("run_after", { ascending: true })
    .limit(batchSize);

  if (jobsError) throw jobsError;
  if (!jobs?.length) {
    return { success: true, picked: 0, processed: 0, failed: 0, ai_calls: 0 };
  }

  const budget = await getBudgetStatus(supabase);
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  let aiCalls = 0;
  let tagged = 0;

  for (const job of jobs) {
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
      const context = await loadContext(supabase, lockedJob);
      const latestText = typeof context.latestMessage.text === "string" ? context.latestMessage.text : "";
      const priority = asPriority(lockedJob.priority);
      const isRisky = priority === "critical" || containsRiskText(latestText) || context.opsState?.risk_level === "high" || context.opsState?.risk_level === "critical";
      const isNewInbound = context.latestMessage.sender === "customer";
      const ruleCase = forceAi ? null : inferRuleCase(context);

      if (ruleCase) {
        tagged += await saveOpsOutput(supabase, lockedJob, context, ruleCase);
      } else if (Deno.env.get("AI_ENABLED") === "false") {
        await createBudgetReviewTask(supabase, lockedJob, context, "AI is disabled; conversation needs human review.");
        skipped += 1;
      } else if (budget.mode === "stopped") {
        await createBudgetReviewTask(
          supabase,
          lockedJob,
          context,
          "AI budget mode is stopped; manual AI tagging did not run.",
        );
        skipped += 1;
      } else if (!forceAi && !shouldProcessAiJob({ budgetMode: budget.mode, priority, isNewInbound, isRisky })) {
        await createBudgetReviewTask(
          supabase,
          lockedJob,
          context,
          `AI budget mode is ${budget.mode}; skipped non-critical AI and kept rule-based manager review.`,
        );
        skipped += 1;
      } else {
        const inputSnapshot = {
          job_type: lockedJob.job_type,
          latest_message_id: lockedJob.latest_message_id,
          context,
        };
        const inputHash = await hashJson(inputSnapshot);
        const primaryModel = isLowValueMessage(latestText) ? chooseModel("fast") : chooseModel("main");
        const primary = await callOpenAi(buildCasePrompt(context, lockedJob.job_type), primaryModel);
        aiCalls += 1;
        await logCost(supabase, lockedJob.id, lockedJob.conversation_id, "quo_case_analysis", primaryModel, primary.usage);

        const validated = validateQuoAiOpsCaseOutput(primary.output);
        if (!validated.ok) throw new Error(`AI output failed validation: ${validated.error}`);

        let output = validated.data;
        if (shouldVerify(output, context) && budget.mode !== "stopped") {
          const verifierModel = chooseModel("risk");
          const verified = await callOpenAi(buildVerifierPrompt(output, context), verifierModel);
          aiCalls += 1;
          await logCost(supabase, lockedJob.id, lockedJob.conversation_id, "quo_risk_verification", verifierModel, verified.usage);

          const verifiedOutput = validateQuoAiOpsCaseOutput(verified.output);
          if (!verifiedOutput.ok) throw new Error(`Risk verifier output failed validation: ${verifiedOutput.error}`);
          output = verifiedOutput.data;
        }

        tagged += await saveOpsOutput(supabase, lockedJob, context, output);

        await supabase
          .from("quo_ai_jobs")
          .update({ input_hash: inputHash })
          .eq("id", lockedJob.id);
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

  return {
    success: true,
    picked: jobs.length,
    processed,
    failed,
    skipped,
    tagged,
    ai_calls: aiCalls,
    budget_mode: budget.mode,
    monthly_spend: Number(budget.monthlySpend.toFixed(6)),
    daily_calls: budget.dailyCalls,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase service configuration." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authErrorResponse = await authorizeJob(req, supabase);
    if (authErrorResponse) return authErrorResponse;

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    if (body.wait_for_completion === true || parseJobIds(body.job_ids).length > 0) {
      const result = await processPendingJobs(supabase, body);
      return jsonResponse(result);
    }

    EdgeRuntime.waitUntil(
      processPendingJobs(supabase, body).catch((error) => {
        console.error("Background AI job processor failed", error);
      }),
    );

    return jsonResponse({ success: true, accepted: true }, 202);
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
