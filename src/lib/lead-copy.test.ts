import { describe, expect, it } from "vitest";
import { buildCompleteLeadCopyText } from "@/lib/lead-copy";
import type { Lead } from "@/types";

describe("buildCompleteLeadCopyText", () => {
  it("copies the lead text fields without picture links", () => {
    const lead = {
      service_details: "Repair the kitchen sink",
      address: "123 Main Street",
      customer_schedule_requirements: "Friday morning",
      quote: "$250",
      payment_screenshot_url: "private/payment.png",
    } as Lead;

    const result = buildCompleteLeadCopyText(lead);

    expect(result).toBe(
      "Service Details: Repair the kitchen sink\n" +
        "Address: 123 Main Street\n" +
        "Schedule Requirement: Friday morning\n" +
        "Quote: $250",
    );
    expect(result).not.toContain("Pictures");
    expect(result).not.toContain("private/payment.png");
  });
});
