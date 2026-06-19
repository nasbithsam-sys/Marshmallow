import { describe, expect, it } from "vitest";
import { canAccessNavItem, getDefaultNavAccess } from "@/lib/access";
import type { NavigationPermission } from "@/types";

describe("cancellation request navigation access", () => {
  it.each(["admin", "processor", "customer_service"] as const)("is always visible to %s", (role) => {
    const deniedOverride = [{ nav_section: "cancellation_requests", allowed: false }] as NavigationPermission[];

    expect(getDefaultNavAccess(role).has("cancellation_requests")).toBe(true);
    expect(canAccessNavItem(role, "cancellation_requests", deniedOverride)).toBe(true);
  });

  it("remains hidden from roles outside the requested audience", () => {
    expect(canAccessNavItem("opr", "cancellation_requests")).toBe(false);
    expect(canAccessNavItem("no_role", "cancellation_requests")).toBe(false);
  });
});
