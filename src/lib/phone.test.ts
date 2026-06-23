import { describe, expect, it } from "vitest";

import { normalizePhoneE164 } from "@/lib/phone";

describe("normalizePhoneE164", () => {
  it("normalizes a 10-digit US number to E.164", () => {
    expect(normalizePhoneE164("(555) 123-4567")).toBe("+15551234567");
  });

  it("keeps an existing E.164 number", () => {
    expect(normalizePhoneE164("+92 300 1234567")).toBe("+923001234567");
  });

  it("returns null when the country code cannot be inferred safely", () => {
    expect(normalizePhoneE164("12345")).toBeNull();
  });
});
