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

describe("incomplete details pinning", () => {
  it("pins the lead for the CS who created it", () => {
    const lead = { ...baseLead, cs_tag: "incomplete_details" };
    expect(isLeadPinnedForUser(lead, CS_USER, "customer_service")).toBe(true);
  });

  it("pins the lead for CS Admins", () => {
    const lead = { ...baseLead, cs_tag: "incomplete_details" };
    expect(isLeadPinnedForUser(lead, OTHER_USER, "cs_admin")).toBe(true);
  });

  it("does not pin it for anyone else", () => {
    const lead = { ...baseLead, cs_tag: "incomplete_details" };
    expect(isLeadPinnedForUser(lead, OTHER_USER, "customer_service")).toBe(false);
    expect(isLeadPinnedForUser(lead, OTHER_USER, "processor")).toBe(false);
  });

  it("only pins when the tag is set", () => {
    expect(isLeadPinnedForUser(baseLead, CS_USER, "customer_service")).toBe(false);
  });

  it("sorts a tagged lead above an untagged one for its creator", () => {
    const tagged = { ...baseLead, cs_tag: "incomplete_details", created_at: "2026-09-01T10:00:00.000Z" };
    const newer = { ...baseLead, created_at: "2026-09-05T10:00:00.000Z" };

    const sorted = [newer, tagged].sort((a, b) =>
      compareLeadDisplayPriority(a, b, CS_USER, "customer_service"),
    );

    expect(sorted[0]).toBe(tagged);
  });
});
