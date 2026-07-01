import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getSafeActionPlan,
  hashJson,
  isLowValueMessage,
  jsonResponse,
  leadStatuses,
  normalizePhone,
  validateAiDecision,
  type AiDecisionOutput,
} from "../_shared/quo-ai.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type JsonObject = Record<string, unknown>;

const businessRules = [
  "Never auto-reply to customers.",
  "Never delete, hide, or permanently close a conversation.",
  "Low confidence must go to needs_human_review.",
  "Possible dead conversations must stay visible.",
  "Lost/found other tech requires clear evidence, otherwise review.",
  "Do not invent missing lead fields.",
  "One decision should include section, priority, tags, reminders, lead linking, and review needs.",
];

function envNumber(name: string, fallback: number) {
  const value = Number(Deno.env.get(name));
  return Number.isFinite(value) ? value : fallback;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const costTable: Record<string, { input: number; output: number }> = {
    "gpt-4.1": { input: 0.000002, output: 0.000008 },
    "gpt-4.1-mini": { input: 0.0000004, output: 0.0000016 },
    "gpt-4.1-nano": { input: 0.0000001, output: 0.0000004 },
    "gpt-4o": { input: 0.0000025, output: 0.00001 },
    "gpt-4o-mini": { input: 0.00000015, output: 0.0000006 },
  };
  const pricing = costTable[model] ?? costTable["gpt-4.1-mini"];
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

async function budgetAllowsAi(supabase: SupabaseClient) {
  const dailyLimit = envNumber("AI_DAILY_CALL_LIMIT", 500);
  const monthlyBudget = envNumber("AI_MONTHLY_BUDGET_USD", 200);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [{ count: dailyCount }, { data: monthlyRows }] = await Promise.all([
    supabase
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("skipped", false)
      .gte("created_at", today.toISOString()),
    supabase
      .from("ai_usage_logs")
      .select("estimated_cost_usd")
      .eq("skipped", false)
      .gte("created_at", monthStart.toISOString()),
  ]);

  const monthlyCost = (monthlyRows ?? []).reduce(
    (sum: number, row: { estimated_cost_usd?: number | string | null }) =>
      sum + Number(row.estimated_cost_usd ?? 0),
    0,
  );

  return {
    allowed: (dailyCount ?? 0) < dailyLimit && monthlyCost < monthlyBudget,
    dailyCount: dailyCount ?? 0,
    monthlyCost,
  };
}

async function logSkippedAi(
  supabase: SupabaseClient,
  conversationId: string,
  model: string,
  reason: string,
) {
  await supabase.from("ai_usage_logs").insert({
    conversation_id: conversationId,
    model_used: model,
    skipped: true,
    skip_reason: reason,
    call_type: "conversation_analysis",
  });
}

function buildRuleDecision(reason: string, section: AiDecisionOutput["section"], priority: AiDecisionOutput["priority"]) {
  return {
    section,
    priority,
    customer_state: section === "needs_reply" ? "waiting" : "unclear",
    needs_human_reply: section === "needs_reply",
    should_create_lead: false,
    should_link_existing_lead: false,
    lead_confidence: 0,
    suggested_lead_status: null,
    suggested_lead_fields: {
      name: null,
      phone: null,
      service_type: null,
      address: null,
      scheduled_date: null,
      notes: null,
    },
    tags: [],
    reminders: [],
    lost_reason: null,
    dead_conversation: false,
    risk_level: "safe",
    needs_human_review: false,
    confidence: 0.92,
    evidence: [],
    recommended_actions: [
      {
        action: "move_section",
        safe_to_apply: true,
        reason,
      },
    ],
    human_readable_summary: reason,
  } satisfies AiDecisionOutput;
}

function inferRuleDecision(latestMessage: JsonObject, messages: JsonObject[], conversation: JsonObject) {
  const latestText = typeof latestMessage.text === "string" ? latestMessage.text : "";
  const latestSender = latestMessage.sender;
  const hasLinkedLead = Boolean(conversation.linked_lead_id);

  if (latestSender !== "customer") {
    return buildRuleDecision("Latest message is from the team, so the conversation is waiting for the customer.", "waiting_for_customer", "low");
  }

  if (isLowValueMessage(latestText) && hasLinkedLead) {
    return buildRuleDecision("Latest customer message is a simple acknowledgement on an already linked lead.", "already_added_to_crm", "low");
  }

  const customerMessages = messages.filter((message) => message.sender === "customer");
  const agentMessages = messages.filter((message) => message.sender === "agent");
  const latestCustomerTime = customerMessages[0]?.message_time ? new Date(String(customerMessages[0].message_time)).getTime() : 0;
  const latestAgentTime = agentMessages[0]?.message_time ? new Date(String(agentMessages[0].message_time)).getTime() : 0;
  const minutesSinceCustomer = latestCustomerTime ? (Date.now() - latestCustomerTime) / 60000 : 0;

  if (latestCustomerTime > latestAgentTime && minutesSinceCustomer >= 30) {
    return buildRuleDecision("Customer replied after the last team message and has waited at least 30 minutes.", "needs_reply", "high");
  }

  return null;
}

function chooseModel(decisionHint: string | null) {
  if (decisionHint === "risky") return Deno.env.get("OPENAI_MODEL_REVIEW") ?? Deno.env.get("OPENAI_MODEL_MAIN") ?? "gpt-4.1";
  if (decisionHint === "cheap") return Deno.env.get("OPENAI_MODEL_CHEAP") ?? Deno.env.get("OPENAI_MODEL_MAIN") ?? "gpt-4.1-mini";
  return Deno.env.get("OPENAI_MODEL_MAIN") ?? "gpt-4.1-mini";
}

function buildPrompt(input: JsonObject) {
  return [
    {
      role: "system",
      content:
        "You are a conservative CRM conversation assistant for Quo messages. Return JSON only. Do not suggest auto-replies. Prefer human review over risky guesses.",
    },
    {
      role: "user",
      content: JSON.stringify({
        task: "Decide the safest useful CRM action for this conversation right now.",
        allowed_sections: [
          "needs_reply",
          "new_interested_lead",
          "hot_lead",
          "follow_up_due_today",
          "follow_up_tomorrow",
          "future_follow_up",
          "appointment_mentioned",
          "waiting_for_customer",
          "possible_dead",
          "lost_found_other_tech",
          "urgent_complaint",
          "already_added_to_crm",
          "not_a_lead_spam_wrong_number",
          "needs_human_review",
        ],
        allowed_lead_statuses: leadStatuses,
        business_rules: businessRules,
        required_schema: {
          section: "one allowed section",
          priority: "low | medium | high | urgent",
          customer_state: "new | interested | hot | waiting | scheduled | lost | not_lead | spam | unclear",
          needs_human_reply: true,
          should_create_lead: false,
          should_link_existing_lead: false,
          lead_confidence: 0,
          suggested_lead_status: null,
          suggested_lead_fields: {
            name: null,
            phone: null,
            service_type: null,
            address: null,
            scheduled_date: null,
            notes: null,
          },
          tags: [],
          reminders: [],
          lost_reason: null,
          dead_conversation: false,
          risk_level: "safe | moderate | risky",
          needs_human_review: false,
          confidence: 0,
          evidence: [],
          recommended_actions: [],
          human_readable_summary: "short explanation",
        },
        input,
      }),
    },
  ];
}

async function callOpenAi(inputSnapshot: JsonObject, model: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const maxTokens = envNumber("AI_MAX_TOKENS_PER_CALL", 1200);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: buildPrompt(inputSnapshot),
      temperature: 0.1,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `OpenAI request failed with status ${response.status}`);
  }

  const rawContent = data?.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string") {
    throw new Error("OpenAI response did not include JSON content.");
  }

  const output = JSON.parse(rawContent);
  const inputTokens = Number(data?.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(data?.usage?.completion_tokens ?? 0);

  return {
    output,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCost: estimateCost(model, inputTokens, outputTokens),
    },
  };
}

async function findExactLead(supabase: SupabaseClient, customerNumber: string | null) {
  const normalized = normalizePhone(customerNumber);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");

  const { data } = await supabase
    .from("leads")
    .select("id, customer_name, customer_phone, status, service_type, scheduled_date")
    .order("created_at", { ascending: false })
    .limit(250);

  return (data ?? []).find((lead: { customer_phone?: string | null }) => {
    const leadDigits = normalizePhone(lead.customer_phone)?.replace(/\D/g, "");
    return leadDigits && leadDigits === digits;
  }) ?? null;
}

async function loadContext(supabase: SupabaseClient, conversationId: string, latestMessageId?: string | null) {
  const { data: conversation, error: conversationError } = await supabase
    .from("quo_conversations")
    .select("*, quo_phone_numbers(*)")
    .eq("id", conversationId)
    .single();
  if (conversationError || !conversation) throw new Error("Conversation not found.");

  const { data: messages } = await supabase
    .from("quo_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("message_time", { ascending: false })
    .limit(10);

  const latestMessage =
    (latestMessageId ? messages?.find((message: { id: string }) => message.id === latestMessageId) : null) ??
    messages?.[0];

  if (!latestMessage) throw new Error("No messages found for conversation.");

  const [lead, reminders, state, feedback] = await Promise.all([
    conversation.linked_lead_id
      ? supabase
          .from("leads")
          .select("id, job_id, customer_name, customer_phone, status, service_type, scheduled_date, cs_tag")
          .eq("id", conversation.linked_lead_id)
          .maybeSingle()
      : findExactLead(supabase, conversation.customer_number),
    supabase
      .from("ai_reminders")
      .select("id, reminder_type, due_at, status, reason")
      .eq("conversation_id", conversationId)
      .order("due_at", { ascending: true })
      .limit(10),
    supabase.from("ai_conversation_states").select("*").eq("conversation_id", conversationId).maybeSingle(),
    supabase
      .from("ai_audit_logs")
      .select("action, details, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    conversation,
    messages: messages ?? [],
    latestMessage,
    linkedLead: lead && typeof lead === "object" && "data" in lead ? lead.data : lead,
    reminders: reminders.data ?? [],
    currentState: state.data ?? null,
    feedback: feedback.data ?? [],
  };
}

async function saveDecision(
  supabase: SupabaseClient,
  conversationId: string,
  latestMessageId: string,
  inputSnapshot: JsonObject,
  inputHash: string,
  decision: AiDecisionOutput,
  model: string,
  usage: { inputTokens: number; outputTokens: number; estimatedCost: number },
  appliedActions: unknown[],
  skippedActions: unknown[],
) {
  const { data: existingDecision } = await supabase
    .from("ai_decisions")
    .select("id, output_json")
    .eq("conversation_id", conversationId)
    .eq("input_hash", inputHash)
    .maybeSingle();

  if (existingDecision) return existingDecision.id as string;

  const { data: decisionRow, error } = await supabase
    .from("ai_decisions")
    .insert({
      conversation_id: conversationId,
      latest_message_id: latestMessageId,
      input_snapshot: inputSnapshot,
      input_hash: inputHash,
      output_json: decision,
      model_used: model,
      confidence: decision.confidence,
      risk_level: decision.risk_level,
      applied_actions: appliedActions,
      skipped_actions: skippedActions,
      needs_human_review: decision.needs_human_review,
      reason: decision.human_readable_summary,
      evidence_message_ids: decision.evidence.map((item) => item.message_id),
      prompt_tokens: usage.inputTokens,
      completion_tokens: usage.outputTokens,
      estimated_cost_usd: usage.estimatedCost,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase.from("ai_usage_logs").insert({
    conversation_id: conversationId,
    decision_id: decisionRow.id,
    model_used: model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    estimated_cost_usd: usage.estimatedCost,
    call_type: "conversation_analysis",
  });

  return decisionRow.id as string;
}

async function applyDecision(
  supabase: SupabaseClient,
  context: Awaited<ReturnType<typeof loadContext>>,
  decision: AiDecisionOutput,
  decisionId: string,
  actionPlan: ReturnType<typeof getSafeActionPlan>,
) {
  const now = new Date().toISOString();
  const shouldReview = actionPlan.needsReview || decision.section === "needs_human_review";

  await supabase.from("ai_conversation_states").upsert(
    {
      conversation_id: context.conversation.id,
      section: shouldReview ? "needs_human_review" : decision.section,
      priority: decision.priority,
      customer_state: decision.customer_state,
      lead_state: decision.suggested_lead_status,
      needs_reply: decision.needs_human_reply,
      should_create_lead: decision.should_create_lead,
      should_link_lead: decision.should_link_existing_lead,
      should_create_reminder: decision.reminders.some((reminder) => reminder.due_at),
      is_possible_dead: decision.dead_conversation || decision.section === "possible_dead",
      is_lost: decision.section === "lost_found_other_tech",
      lost_reason: decision.lost_reason,
      confidence: decision.confidence,
      risk_level: decision.risk_level,
      evidence: decision.evidence,
      latest_decision_id: decisionId,
      human_review_status: shouldReview ? "pending" : "not_needed",
      updated_at: now,
    },
    { onConflict: "conversation_id" },
  );

  await supabase
    .from("quo_conversations")
    .update({
      current_ai_section: shouldReview ? "needs_human_review" : decision.section,
      current_priority: decision.priority,
      rolling_ai_summary: decision.human_readable_summary,
      last_ai_analyzed_at: now,
      ai_tags: decision.tags,
    })
    .eq("id", context.conversation.id);

  for (const reminder of decision.reminders) {
    if (!reminder.due_at || !actionPlan.applied.some((action) => action.action === "create_reminder")) continue;

    await supabase.from("ai_reminders").insert({
      conversation_id: context.conversation.id,
      lead_id: context.conversation.linked_lead_id ?? context.linkedLead?.id ?? null,
      reminder_type: reminder.type,
      due_at: reminder.due_at,
      notify_one_day_before: reminder.notify_one_day_before,
      notify_same_day: reminder.notify_same_day,
      reason: reminder.reason,
      source_message_id: reminder.source_message_id,
      created_by_ai: true,
    });
  }

  if (context.linkedLead?.id && actionPlan.applied.some((action) => action.action === "link_lead")) {
    await supabase.from("ai_lead_links").upsert(
      {
        conversation_id: context.conversation.id,
        lead_id: context.linkedLead.id,
        match_type: "exact_phone",
        confidence: 1,
        created_by_ai: true,
      },
      { onConflict: "conversation_id,lead_id" },
    );
    await supabase
      .from("quo_conversations")
      .update({ linked_lead_id: context.linkedLead.id })
      .eq("id", context.conversation.id);
  }

  const canCreateLead =
    !context.linkedLead &&
    decision.should_create_lead &&
    decision.risk_level === "safe" &&
    decision.confidence >= 0.95 &&
    decision.lead_confidence >= 0.95 &&
    decision.suggested_lead_fields.name &&
    decision.suggested_lead_fields.phone &&
    decision.suggested_lead_fields.service_type;

  if (canCreateLead) {
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (adminRole?.user_id) {
      const jobId = `AI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const leadStatus = leadStatuses.includes(decision.suggested_lead_status as typeof leadStatuses[number])
        ? decision.suggested_lead_status
        : "waiting_complete_details";

      const { data: createdLead } = await supabase
        .from("leads")
        .insert({
          job_id: jobId,
          customer_name: decision.suggested_lead_fields.name,
          customer_phone: decision.suggested_lead_fields.phone,
          service_type: decision.suggested_lead_fields.service_type,
          address: decision.suggested_lead_fields.address,
          scheduled_date: decision.suggested_lead_fields.scheduled_date,
          general_notes: decision.suggested_lead_fields.notes,
          direction: "incoming",
          status: leadStatus,
          created_by: adminRole.user_id,
          number_name: context.conversation.quo_phone_numbers?.name ?? null,
        })
        .select("id")
        .single();

      if (createdLead?.id) {
        await supabase
          .from("quo_conversations")
          .update({ linked_lead_id: createdLead.id })
          .eq("id", context.conversation.id);
        await supabase.from("ai_lead_links").insert({
          conversation_id: context.conversation.id,
          lead_id: createdLead.id,
          match_type: "ai_suggested",
          confidence: decision.lead_confidence,
          created_by_ai: true,
        });
      }
    }
  }

  if (shouldReview) {
    await supabase.from("ai_review_queue").insert({
      conversation_id: context.conversation.id,
      decision_id: decisionId,
      review_type: "decision",
      reason: decision.human_readable_summary || "AI decision requires human review.",
      suggested_action: {
        output: decision,
        review_actions: actionPlan.review,
        skipped_actions: actionPlan.skipped,
      },
      status: "pending",
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

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

    const { conversation_id, latest_message_id } = await req.json();
    if (!conversation_id) return jsonResponse({ error: "conversation_id is required." }, 400);

    const context = await loadContext(supabase, conversation_id, latest_message_id);
    const exactLead = await findExactLead(supabase, context.conversation.customer_number);
    if (exactLead?.id && !context.conversation.linked_lead_id) {
      context.linkedLead = exactLead;
    }

    const inputSnapshot = {
      latest_message: context.latestMessage,
      recent_messages: context.messages.slice().reverse(),
      rolling_summary: context.conversation.rolling_ai_summary,
      current_section: context.conversation.current_ai_section,
      current_priority: context.conversation.current_priority,
      linked_lead: context.linkedLead,
      reminders: context.reminders,
      quo_number: context.conversation.quo_phone_numbers,
      feedback: context.feedback,
      business_timezone: Deno.env.get("BUSINESS_TIMEZONE") ?? "America/New_York",
    };
    const inputHash = await hashJson(inputSnapshot);
    const model = chooseModel(isLowValueMessage(context.latestMessage.text) ? "cheap" : null);

    const { data: cached } = await supabase
      .from("ai_decisions")
      .select("id, output_json")
      .eq("conversation_id", conversation_id)
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (cached?.output_json) {
      const validated = validateAiDecision(cached.output_json);
      if (validated.ok) {
        const actionPlan = getSafeActionPlan(
          validated.data,
          envNumber("AI_CONFIDENCE_AUTO_APPLY_THRESHOLD", 0.9),
          envNumber("AI_CONFIDENCE_REVIEW_THRESHOLD", 0.75),
        );
        await applyDecision(supabase, context, validated.data, cached.id, actionPlan);
        return jsonResponse({ success: true, cached: true, decision_id: cached.id });
      }
    }

    const ruleDecision = inferRuleDecision(context.latestMessage, context.messages, context.conversation);
    const aiEnabled = Deno.env.get("AI_ENABLED") !== "false";

    let decision: AiDecisionOutput;
    let usage = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 };

    if (ruleDecision && (!aiEnabled || isLowValueMessage(context.latestMessage.text))) {
      decision = ruleDecision;
      await logSkippedAi(supabase, conversation_id, model, "Rule engine handled the conversation.");
    } else {
      const budget = await budgetAllowsAi(supabase);
      if (!aiEnabled || !budget.allowed) {
        decision =
          ruleDecision ??
          buildRuleDecision("AI is disabled or budget guard is active; sending conversation to human review.", "needs_human_review", "medium");
        await logSkippedAi(supabase, conversation_id, model, aiEnabled ? "AI budget guard blocked non-critical analysis." : "AI_ENABLED=false");
      } else {
        const aiResponse = await callOpenAi(inputSnapshot, model);
        const validated = validateAiDecision(aiResponse.output);
        if (!validated.ok) {
          decision = buildRuleDecision(`AI output failed validation: ${validated.error}`, "needs_human_review", "medium");
        } else {
          decision = validated.data;
        }
        usage = aiResponse.usage;
      }
    }

    const actionPlan = getSafeActionPlan(
      decision,
      envNumber("AI_CONFIDENCE_AUTO_APPLY_THRESHOLD", 0.9),
      envNumber("AI_CONFIDENCE_REVIEW_THRESHOLD", 0.75),
    );
    const decisionId = await saveDecision(
      supabase,
      conversation_id,
      context.latestMessage.id,
      inputSnapshot,
      inputHash,
      decision,
      model,
      usage,
      actionPlan.applied,
      [...actionPlan.review, ...actionPlan.skipped],
    );

    await applyDecision(supabase, context, decision, decisionId, actionPlan);

    return jsonResponse({
      success: true,
      decision_id: decisionId,
      section: decision.section,
      confidence: decision.confidence,
      needs_human_review: actionPlan.needsReview,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown analyzer error",
      },
      400,
    );
  }
});
