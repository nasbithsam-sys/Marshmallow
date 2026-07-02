import { describe, expect, it } from "vitest";
import { getAiBudgetMode, getQuoAiModelPurpose, shouldProcessAiJob, shouldUseRiskVerifier } from "@/lib/quo-ai-ops";

describe("Quo AI budget mode", () => {
  it("uses normal mode below soft and 80 percent caps", () => {
    expect(getAiBudgetMode({ monthlySpend: 100, softCap: 180, hardCap: 200 })).toBe("normal");
  });

  it("uses soft cap mode at the configured soft cap", () => {
    expect(getAiBudgetMode({ monthlySpend: 180, softCap: 180, hardCap: 200 })).toBe("soft_cap");
  });

  it("uses critical-only mode at 95 percent of the hard cap", () => {
    expect(getAiBudgetMode({ monthlySpend: 190, softCap: 180, hardCap: 200 })).toBe("critical_only");
  });

  it("stops non-critical AI at the hard cap", () => {
    expect(getAiBudgetMode({ monthlySpend: 200, softCap: 180, hardCap: 200 })).toBe("stopped");
  });
});

describe("Quo AI model routing", () => {
  it("uses the risk verifier for high-risk or low-confidence cases only", () => {
    expect(
      shouldUseRiskVerifier({
        riskLevel: "high",
        urgencyLevel: "medium",
        confidence: 0.91,
        requiresHumanReview: false,
        hasRiskKeyword: false,
      }),
    ).toBe(true);

    expect(
      shouldUseRiskVerifier({
        riskLevel: "low",
        urgencyLevel: "medium",
        confidence: 0.92,
        requiresHumanReview: false,
        hasRiskKeyword: false,
      }),
    ).toBe(false);
  });

  it("documents model responsibilities without making the strongest model the default", () => {
    expect(getQuoAiModelPurpose("AI_MODEL_MAIN_REASONER")).toContain("persistent case-state");
    expect(getQuoAiModelPurpose("AI_MODEL_RISK_VERIFIER")).toContain("risky");
    expect(getQuoAiModelPurpose("AI_MODEL_FAST_CLASSIFIER")).toContain("cheap");
  });
});

describe("Quo AI job budget gating", () => {
  it("continues high-value jobs in soft cap mode", () => {
    expect(
      shouldProcessAiJob({
        budgetMode: "soft_cap",
        priority: "high",
        isNewInbound: false,
        isRisky: false,
      }),
    ).toBe(true);
  });

  it("blocks low priority old jobs in soft cap mode", () => {
    expect(
      shouldProcessAiJob({
        budgetMode: "soft_cap",
        priority: "low",
        isNewInbound: false,
        isRisky: false,
      }),
    ).toBe(false);
  });

  it("only allows critical risky jobs when stopped", () => {
    expect(
      shouldProcessAiJob({
        budgetMode: "stopped",
        priority: "critical",
        isNewInbound: false,
        isRisky: true,
      }),
    ).toBe(true);
    expect(
      shouldProcessAiJob({
        budgetMode: "stopped",
        priority: "high",
        isNewInbound: true,
        isRisky: false,
      }),
    ).toBe(false);
  });
});
