import { describe, expect, it } from "vitest";
import { canAccessNavItem, getDefaultNavAccess } from "@/lib/access";
import type { NavigationPermission } from "@/types";

describe("cancellation request navigation access", () => {
  it.each(["admin", "processor"] as const)("is always visible to %s", (role) => {
    const deniedOverride = [{ nav_section: "cancellation_requests", allowed: false }] as NavigationPermission[];

    expect(getDefaultNavAccess(role).has("cancellation_requests")).toBe(true);
    expect(canAccessNavItem(role, "cancellation_requests", deniedOverride)).toBe(true);
  });

  it("remains hidden from roles outside the requested audience", () => {
    expect(canAccessNavItem("customer_service", "cancellation_requests")).toBe(false);
    expect(canAccessNavItem("opr", "cancellation_requests")).toBe(false);
    expect(canAccessNavItem(null, "cancellation_requests")).toBe(false);
  });
});

describe("quo monitor navigation access", () => {
  it("is visible to admin by default", () => {
    expect(getDefaultNavAccess("admin").has("quo_monitor")).toBe(true);
    expect(canAccessNavItem("admin", "quo_monitor")).toBe(true);
  });

  it.each(["processor", "customer_service", "opr"] as const)("is hidden from %s", (role) => {
    expect(getDefaultNavAccess(role).has("quo_monitor")).toBe(false);
    expect(canAccessNavItem(role, "quo_monitor")).toBe(false);
  });

  it("denies navigation entirely when the user has no valid role", () => {
    expect(canAccessNavItem(null, "quo_monitor")).toBe(false);
    expect(canAccessNavItem(null, "leads")).toBe(false);
  });

  it("ignores non-admin navigation overrides for quo monitor", () => {
    const allowedOverride = [{ nav_section: "quo_monitor", allowed: true }] as NavigationPermission[];

    expect(canAccessNavItem("processor", "quo_monitor", allowedOverride)).toBe(false);
    expect(canAccessNavItem("customer_service", "quo_monitor", allowedOverride)).toBe(false);
  });
});
