import { describe, expect, it } from "vitest";
import { formatSheetPhone } from "@/lib/google-sheets";

describe("the sheet's phone column", () => {
  it("carries the cell phone", () => {
    expect(formatSheetPhone({ customer_phone: "3055550123" })).toBe("(305) 555-0123");
  });

  it("keeps the cell phone when both numbers exist", () => {
    expect(formatSheetPhone({ customer_phone: "3055550123", customer_landline: "2125550100" })).toBe(
      "(305) 555-0123",
    );
  });

  it("falls back to the landline, marked, when there is no cell", () => {
    expect(formatSheetPhone({ customer_phone: "", customer_landline: "2125550100" })).toBe(
      "(212) 555-0100 (Landline)",
    );
  });

  it("is blank when there is no number at all", () => {
    expect(formatSheetPhone({ customer_phone: "", customer_landline: null })).toBe("");
  });
});
