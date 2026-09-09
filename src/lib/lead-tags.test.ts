import { describe, expect, it } from "vitest";
import { getAssignableLeadTags, canAssignLeadTag, isScheduleTag } from "@/lib/lead-tags";

describe("lead tag role access", () => {
  it("allows CS and Admin to add Booked", () => {
    expect(getAssignableLeadTags("customer_service")).toContain("booked");
    expect(getAssignableLeadTags("admin")).toContain("booked");
    expect(getAssignableLeadTags("processor")).not.toContain("booked");
  });

  it("allows Processor, CS, and Admin to add Ready to schedule", () => {
    expect(getAssignableLeadTags("processor")).toEqual([
      "ready_to_schedule",
      "waiting_schedule_confirmation",
      "incomplete_details",
    ]);
    expect(getAssignableLeadTags("admin")).toContain("ready_to_schedule");
    expect(getAssignableLeadTags("customer_service")).toContain("ready_to_schedule");
  });
});

describe("incomplete details tag access", () => {
  it("is available to Processors and Admins", () => {
    expect(canAssignLeadTag("processor", "incomplete_details")).toBe(true);
    expect(canAssignLeadTag("admin", "incomplete_details")).toBe(true);
  });

  it("is available to anyone flagged as a Quotation Master", () => {
    expect(canAssignLeadTag("customer_service", "incomplete_details", { isQuotationMaster: true })).toBe(true);
  });

  it("is not available to CS Admins, plain CS, or Operators", () => {
    // CS Admins receive the Incomplete details alert; they do not raise it.
    expect(canAssignLeadTag("cs_admin", "incomplete_details")).toBe(false);
    expect(canAssignLeadTag("customer_service", "incomplete_details")).toBe(false);
    expect(canAssignLeadTag("opr", "incomplete_details")).toBe(false);
    expect(canAssignLeadTag("opr", "incomplete_details", { isQuotationMaster: true })).toBe(false);
  });

  it("is not listed twice when a role already carries it", () => {
    const tags = getAssignableLeadTags("admin", { isQuotationMaster: true });
    expect(tags.filter((t) => t === "incomplete_details")).toHaveLength(1);
  });

  it("is not a scheduling tag, so Operators do not pick it up", () => {
    expect(isScheduleTag("incomplete_details")).toBe(false);
    expect(isScheduleTag("booked")).toBe(true);
    expect(isScheduleTag(null)).toBe(false);
  });
});
