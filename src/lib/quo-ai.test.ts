import { describe, expect, it } from "vitest";
import {
  getSafeActionPlan,
  isLowValueMessage,
  validateAiDecisionOutput,
  type AiDecisionOutput,
} from "@/lib/quo-ai";

const baseDecision: AiDecisionOutput = {
  section: "needs_reply",
  priority: "high",
  customer_state: "waiting",
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
  tags: ["needs_reply"],
  reminders: [],
  lost_reason: null,
  dead_conversation: false,
  risk_level: "safe",
  needs_human_review: false,
  confidence: 0.92,
  evidence: [
    {
      message_id: "msg_1",
      quote: "Can someone call me?",
      why_it_matters: "Customer is waiting for a team response.",
    },
  ],
  recommended_actions: [
    {
      action: "move_section",
      safe_to_apply: true,
      reason: "Customer needs a reply.",
    },
  ],
  human_readable_summary: "Customer is waiting for a reply.",
};

describe("quo AI decision validation", () => {
  it("accepts a valid structured AI output", () => {
    const result = validateAiDecisionOutput(baseDecision);

    expect(result.success).toBe(true);
  });

  it("rejects unknown sections", () => {
    const result = validateAiDecisionOutput({
      ...baseDecision,
      section: "delete_customer",
    });

    expect(result.success).toBe(false);
  });
});

describe("quo AI safe action plan", () => {
  it("applies safe high-confidence visibility actions", () => {
    const plan = getSafeActionPlan(baseDecision);

    expect(plan.applied).toHaveLength(1);
    expect(plan.needsReview).toBe(false);
  });

  it("sends decisions below 0.85 confidence to human review", () => {
    const plan = getSafeActionPlan({
      ...baseDecision,
      confidence: 0.84,
    });

    expect(plan.applied).toHaveLength(0);
    expect(plan.needsReview).toBe(true);
  });

  it("does not auto-apply risky lead creation", () => {
    const plan = getSafeActionPlan({
      ...baseDecision,
      recommended_actions: [
        {
          action: "create_lead",
          safe_to_apply: true,
          reason: "Customer appears interested.",
        },
      ],
    });

    expect(plan.review).toHaveLength(1);
    expect(plan.needsReview).toBe(true);
  });
});

describe("low value message detection", () => {
  it("skips simple acknowledgements", () => {
    expect(isLowValueMessage("thanks")).toBe(true);
    expect(isLowValueMessage("How much for AC repair?")).toBe(false);
  });
});
