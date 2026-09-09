import { describe, expect, it } from "vitest";
import { isLeadPinnedForUser, compareLeadDisplayPriority } from "@/lib/constants";
import type { LeadStatus } from "@/types";

const CS_USER = "cs-user-1";
const OTHER_USER = "cs-user-2";

const baseLead = {
  status: "needs_quote" as LeadStatus,
  created_at: "2026-09-01T10:00:00.000Z",
  created_by: CS_USER,
  cs_tag: null as string | null,
};

describe("incomplete details tag", () => {
  it("does not pin the lead for the CS who created it", () => {
    const lead = { ...baseLead, cs_tag: "incomplete_details" };
    expect(isLeadPinnedForUser(lead, CS_USER, "customer_service")).toBe(false);
  });

  it("does not pin the lead for CS Admins", () => {
    const lead = { ...baseLead, cs_tag: "incomplete_details" };
    expect(isLeadPinnedForUser(lead, OTHER_USER, "cs_admin")).toBe(false);
  });

  it("leaves ordering alone - a newer lead still sorts first", () => {
    const tagged = { ...baseLead, cs_tag: "incomplete_details", created_at: "2026-09-01T10:00:00.000Z" };
    const newer = { ...baseLead, created_at: "2026-09-05T10:00:00.000Z" };

    const sorted = [tagged, newer].sort((a, b) =>
      compareLeadDisplayPriority(a, b, CS_USER, "customer_service"),
    );

    expect(sorted[0]).toBe(newer);
  });
});

describe("statuses that do pin", () => {
  it("pins an Activate Customer lead for the CS who created it", () => {
    const lead = { ...baseLead, status: "activate_customer" as LeadStatus };
    expect(isLeadPinnedForUser(lead, CS_USER, "customer_service")).toBe(true);
  });

  it("does not pin an ordinary lead", () => {
    expect(isLeadPinnedForUser(baseLead, CS_USER, "customer_service")).toBe(false);
  });
});
