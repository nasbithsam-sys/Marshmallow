import { describe, expect, it } from "vitest";
import { getAssignableLeadTags } from "@/lib/lead-tags";

describe("lead tag role access", () => {
  it("allows CS and Admin to add Booked", () => {
    expect(getAssignableLeadTags("customer_service")).toContain("booked");
    expect(getAssignableLeadTags("admin")).toContain("booked");
    expect(getAssignableLeadTags("processor")).not.toContain("booked");
  });

  it("allows Processor, CS, and Admin to add Ready to schedule", () => {
    expect(getAssignableLeadTags("processor")).toEqual(["ready_to_schedule", "waiting_schedule_confirmation"]);
    expect(getAssignableLeadTags("admin")).toContain("ready_to_schedule");
    expect(getAssignableLeadTags("customer_service")).toContain("ready_to_schedule");
  });
});
