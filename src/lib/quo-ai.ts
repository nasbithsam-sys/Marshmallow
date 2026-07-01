import { z } from "zod";

export const QUO_AI_SECTIONS = [
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

export type QuoAiSection = (typeof QUO_AI_SECTIONS)[number];

export const QUO_AI_SECTION_LABELS: Record<QuoAiSection, string> = {
  needs_reply: "Needs Reply",
  new_interested_lead: "New Interested Leads",
  hot_lead: "Hot Leads",
  follow_up_due_today: "Follow-Up Due Today",
  follow_up_tomorrow: "Follow-Up Tomorrow",
  future_follow_up: "Future Follow-Ups",
  appointment_mentioned: "Appointment / Schedule Mentioned",
  waiting_for_customer: "Waiting for Customer",
  possible_dead: "Possible Dead Conversations",
  lost_found_other_tech: "Lost / Found Other Tech",
  urgent_complaint: "Urgent / Complaint",
  already_added_to_crm: "Already Added to CRM",
  not_a_lead_spam_wrong_number: "Not a Lead / Spam / Wrong Number",
  needs_human_review: "Needs Human Review",
};

export const QUO_AI_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const QUO_AI_RISK_LEVELS = ["safe", "moderate", "risky"] as const;
export const QUO_AI_CUSTOMER_STATES = [
  "new",
  "interested",
  "hot",
  "waiting",
  "scheduled",
  "lost",
  "not_lead",
  "spam",
  "unclear",
] as const;

export const AUTO_APPLY_CONFIDENCE = 0.9;
export const REVIEW_CONFIDENCE = 0.75;

export const aiEvidenceSchema = z.object({
  message_id: z.string(),
  quote: z.string().max(500),
  why_it_matters: z.string().max(500),
});

export const aiReminderSchema = z.object({
  type: z.enum(["follow_up", "call", "appointment", "quote", "other"]),
  due_at: z.string().datetime().nullable(),
  notify_one_day_before: z.boolean(),
  notify_same_day: z.boolean(),
  reason: z.string().max(500),
  source_message_id: z.string().nullable(),
});

export const aiRecommendedActionSchema = z.object({
  action: z.enum([
    "move_section",
    "create_lead",
    "link_lead",
    "create_reminder",
    "add_tag",
    "mark_waiting",
    "mark_possible_dead",
    "mark_lost",
    "flag_review",
  ]),
  safe_to_apply: z.boolean(),
  reason: z.string().max(500),
});

export const aiDecisionOutputSchema = z.object({
  section: z.enum(QUO_AI_SECTIONS),
  priority: z.enum(QUO_AI_PRIORITIES),
  customer_state: z.enum(QUO_AI_CUSTOMER_STATES),
  needs_human_reply: z.boolean(),
  should_create_lead: z.boolean(),
  should_link_existing_lead: z.boolean(),
  lead_confidence: z.number().min(0).max(1),
  suggested_lead_status: z.string().nullable(),
  suggested_lead_fields: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    service_type: z.string().nullable(),
    address: z.string().nullable(),
    scheduled_date: z.string().nullable(),
    notes: z.string().nullable(),
  }),
  tags: z.array(z.string().min(1).max(80)).max(20),
  reminders: z.array(aiReminderSchema).max(5),
  lost_reason: z.string().nullable(),
  dead_conversation: z.boolean(),
  risk_level: z.enum(QUO_AI_RISK_LEVELS),
  needs_human_review: z.boolean(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(aiEvidenceSchema).max(8),
  recommended_actions: z.array(aiRecommendedActionSchema).max(12),
  human_readable_summary: z.string().max(1000),
});

export type AiDecisionOutput = z.infer<typeof aiDecisionOutputSchema>;

const riskyActionNames = new Set(["create_lead", "mark_lost"]);
const visibilitySafeActionNames = new Set([
  "move_section",
  "create_reminder",
  "add_tag",
  "mark_waiting",
  "mark_possible_dead",
  "flag_review",
  "link_lead",
]);

export function validateAiDecisionOutput(value: unknown) {
  return aiDecisionOutputSchema.safeParse(value);
}

export function getSafeActionPlan(
  decision: Pick<AiDecisionOutput, "confidence" | "risk_level" | "recommended_actions">,
  thresholds = {
    autoApply: AUTO_APPLY_CONFIDENCE,
    review: REVIEW_CONFIDENCE,
  },
) {
  const applied: AiDecisionOutput["recommended_actions"] = [];
  const review: AiDecisionOutput["recommended_actions"] = [];
  const skipped: AiDecisionOutput["recommended_actions"] = [];

  for (const action of decision.recommended_actions) {
    if (!action.safe_to_apply || riskyActionNames.has(action.action) || decision.risk_level === "risky") {
      review.push(action);
      continue;
    }

    if (decision.confidence >= thresholds.autoApply) {
      applied.push(action);
      continue;
    }

    if (decision.confidence >= thresholds.review && visibilitySafeActionNames.has(action.action)) {
      applied.push(action);
      continue;
    }

    skipped.push(action);
  }

  return {
    applied,
    review,
    skipped,
    needsReview: decision.confidence < thresholds.review || review.length > 0,
  };
}

export function isLowValueMessage(text: string | null | undefined) {
  const normalized = (text ?? "").trim().toLowerCase();

  if (!normalized) return true;
  if (/^[^\p{L}\p{N}]+$/u.test(normalized)) return true;

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
