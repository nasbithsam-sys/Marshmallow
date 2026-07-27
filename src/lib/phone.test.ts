import { describe, expect, it } from "vitest";

import { formatUSPhone, normalizePhoneE164 } from "@/lib/phone";

describe("formatUSPhone", () => {
  it("formats a 10-digit US phone number", () => {
    expect(formatUSPhone("3055550123")).toBe("(305) 555-0123");
  });

  it("drops a leading US country code from 11 pasted digits", () => {
    expect(formatUSPhone("13055550123")).toBe("(305) 555-0123");
  });

  it("strips unsupported characters and ignores digits after 10", () => {
    expect(formatUSPhone("305-555-0123abc999")).toBe("(305) 555-0123");
  });
});

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
