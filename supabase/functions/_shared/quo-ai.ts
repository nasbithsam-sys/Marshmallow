export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-quo-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const aiSections = [
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
] as const;

export const leadStatuses = [
  "waiting_complete_details",
  "urgent_job",
  "quote_sent_waiting",
  "post_visit_quote_sent_waiting",
  "activate_customer",
  "quote_sent_need_follow_up",
  "needs_quote",
  "tech_making_quote",
  "waiting_customer_response",
  "need_tech",
  "scheduled",
  "job_in_progress",
  "needs_reschedule",
  "job_done",
  "payment_pending",
  "cancelled",
  "paid",
  "partial_paid",
] as const;

const allowedPriorities = new Set(["low", "medium", "high", "urgent"]);
const allowedRiskLevels = new Set(["safe", "moderate", "risky"]);
const allowedCustomerStates = new Set([
  "new",
  "interested",
  "hot",
  "waiting",
  "scheduled",
  "lost",
  "not_lead",
  "spam",
  "unclear",
]);
const allowedActions = new Set([
  "move_section",
  "create_lead",
  "link_lead",
  "create_reminder",
  "add_tag",
  "mark_waiting",
  "mark_possible_dead",
  "mark_lost",
  "flag_review",
]);
const allowedReminderTypes = new Set([
  "follow_up",
  "call",
  "appointment",
  "quote",
  "other",
]);

export type JsonObject = Record<string, unknown>;

export type NormalizedQuoMessage = {
  id: string;
  conversationId: string;
  phoneNumberId: string | null;
  direction: "inbound" | "outbound";
  sender: "customer" | "agent";
  from: string | null;
  to: string[];
  text: string;
  media: unknown[];
  status: string | null;
  createdAt: string;
};

export type NormalizedQuoConversation = {
  id: string;
  customerName: string | null;
  customerNumber: string | null;
  phoneNumberId: string | null;
  phoneNumberDisplay: string | null;
  phoneNumberName: string | null;
};

export type AiDecisionOutput = {
  section: string;
  priority: string;
  customer_state: string;
  needs_human_reply: boolean;
  should_create_lead: boolean;
  should_link_existing_lead: boolean;
  lead_confidence: number;
  suggested_lead_status: string | null;
  suggested_lead_fields: {
    name: string | null;
    phone: string | null;
    service_type: string | null;
    address: string | null;
    scheduled_date: string | null;
    notes: string | null;
  };
  tags: string[];
  reminders: Array<{
    type: string;
    due_at: string | null;
    notify_one_day_before: boolean;
    notify_same_day: boolean;
    reason: string;
    source_message_id: string | null;
  }>;
  lost_reason: string | null;
  dead_conversation: boolean;
  risk_level: string;
  needs_human_review: boolean;
  confidence: number;
  evidence: Array<{
    message_id: string;
    quote: string;
    why_it_matters: string;
  }>;
  recommended_actions: Array<{
    action: string;
    safe_to_apply: boolean;
    reason: string;
  }>;
  human_readable_summary: string;
};

export function jsonResponse(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function normalizePhone(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\+[1-9]\d{1,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && /^[1-9]/.test(digits)) {
    return `+${digits}`;
  }

  return trimmed;
}

export function isLowValueMessage(text: string | null | undefined) {
  const normalized = (text ?? "").trim().toLowerCase();
  if (!normalized) return true;

  return [
    "ok",
    "okay",
    "k",
    "thanks",
    "thank you",
    "yes",
    "no",
    "yep",
    "nope",
  ].includes(normalized);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeQuoPayload(payload: JsonObject) {
  const data = (payload.data && typeof payload.data === "object" ? payload.data : payload) as JsonObject;
  const message = ((data.message && typeof data.message === "object" ? data.message : data) ?? {}) as JsonObject;
  const conversation = ((data.conversation && typeof data.conversation === "object"
    ? data.conversation
    : payload.conversation && typeof payload.conversation === "object"
      ? payload.conversation
      : {}) ?? {}) as JsonObject;

  const messageId = asString(message.id);
  const conversationId =
    asString(conversation.id) ?? asString(message.conversationId) ?? asString(message.conversation_id);

  if (!messageId || !conversationId) {
    throw new Error("Invalid Quo payload: missing message id or conversation id.");
  }

  const rawDirection = asString(message.direction)?.toLowerCase();
  const direction = rawDirection === "outbound" || rawDirection === "outgoing" ? "outbound" : "inbound";
  const sender = direction === "inbound" ? "customer" : "agent";

  const contact = (conversation.contact && typeof conversation.contact === "object"
    ? conversation.contact
    : {}) as JsonObject;
  const phoneNumbers = Array.isArray(contact.phoneNumbers) ? contact.phoneNumbers : [];
  const firstPhone = phoneNumbers[0] && typeof phoneNumbers[0] === "object" ? phoneNumbers[0] as JsonObject : {};

  const to = arrayOfStrings(message.to);
  const from = asString(message.from);
  const customerNumber = normalizePhone(asString(firstPhone.value) ?? (direction === "inbound" ? from : to[0]));
  const phoneNumberId =
    asString(message.phoneNumberId) ??
    asString(message.phone_number_id) ??
    asString(conversation.phoneNumberId) ??
    null;

  const normalizedMessage: NormalizedQuoMessage = {
    id: messageId,
    conversationId,
    phoneNumberId,
    direction,
    sender,
    from: normalizePhone(from),
    to: to.map((item) => normalizePhone(item) ?? item),
    text: asString(message.text) ?? "",
    media: Array.isArray(message.media) ? message.media : [],
    status: asString(message.status),
    createdAt: asString(message.createdAt) ?? asString(message.created_at) ?? new Date().toISOString(),
  };

  const normalizedConversation: NormalizedQuoConversation = {
    id: conversationId,
    customerName: asString(contact.name) ?? asString(conversation.name),
    customerNumber,
    phoneNumberId,
    phoneNumberDisplay:
      asString(message.phoneNumber) ??
      asString(conversation.phoneNumber) ??
      (direction === "inbound" ? normalizedMessage.to[0] ?? null : normalizedMessage.from),
    phoneNumberName: asString(conversation.phoneNumberName) ?? asString(message.phoneNumberName),
  };

  return { message: normalizedMessage, conversation: normalizedConversation };
}

export async function hashJson(value: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifySignature(rawBody: string, signature: string | null, secret: string | undefined) {
  if (!secret) return false;
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const normalized = signature.replace(/^sha256=/, "").trim().toLowerCase();

  return expected === normalized;
}

export function validateAiDecision(value: unknown): { ok: true; data: AiDecisionOutput } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "AI output must be an object." };
  const data = value as Partial<AiDecisionOutput>;

  if (!aiSections.includes(data.section as typeof aiSections[number])) return { ok: false, error: "Invalid section." };
  if (!allowedPriorities.has(String(data.priority))) return { ok: false, error: "Invalid priority." };
  if (!allowedRiskLevels.has(String(data.risk_level))) return { ok: false, error: "Invalid risk level." };
  if (!allowedCustomerStates.has(String(data.customer_state))) return { ok: false, error: "Invalid customer state." };
  if (typeof data.confidence !== "number" || data.confidence < 0 || data.confidence > 1) {
    return { ok: false, error: "Invalid confidence." };
  }
  if (!Array.isArray(data.recommended_actions)) return { ok: false, error: "Missing recommended actions." };
  if (data.recommended_actions.some((action) => !allowedActions.has(String(action.action)))) {
    return { ok: false, error: "Invalid recommended action." };
  }
  if (!Array.isArray(data.reminders)) return { ok: false, error: "Missing reminders array." };
  if (data.reminders.some((reminder) => !allowedReminderTypes.has(String(reminder.type)))) {
    return { ok: false, error: "Invalid reminder type." };
  }

  return { ok: true, data: data as AiDecisionOutput };
}

export function getSafeActionPlan(
  decision: AiDecisionOutput,
  autoApplyThreshold: number,
  reviewThreshold: number,
) {
  const riskyActions = new Set(["create_lead", "mark_lost"]);
  const applied = [];
  const review = [];
  const skipped = [];

  for (const action of decision.recommended_actions) {
    if (!action.safe_to_apply || riskyActions.has(action.action) || decision.risk_level === "risky") {
      review.push(action);
    } else if (decision.confidence >= autoApplyThreshold) {
      applied.push(action);
    } else if (decision.confidence >= reviewThreshold && action.action !== "create_lead") {
      applied.push(action);
    } else {
      skipped.push(action);
    }
  }

  return {
    applied,
    review,
    skipped,
    needsReview: decision.needs_human_review || decision.confidence < reviewThreshold || review.length > 0,
  };
}
