import type { AppRole, NavigationPermission, LeadStatus } from "@/types";
import { ALL_LEAD_STATUSES, ALL_NAV_ITEMS, type NavItem } from "@/lib/constants";

const DEFAULT_NAV_ACCESS: Record<AppRole, Set<NavItem>> = {
  admin: new Set(ALL_NAV_ITEMS),
  processor: new Set(["leads", "schedule", "cancellation_requests", "analytics", "areas", "activity_logs"]),
  customer_service: new Set(["leads", "schedule", "calls"]),
  opr: new Set(["leads"]),
  no_role: new Set(),
};

export function getDefaultNavAccess(role: AppRole): Set<NavItem> {
  return new Set(DEFAULT_NAV_ACCESS[role]);
}

export function canAccessNavItem(
  role: AppRole,
  navItem: string,
  permissions: NavigationPermission[] = [],
): boolean {
  if (!ALL_NAV_ITEMS.includes(navItem as NavItem)) {
    return false;
  }

  if (role === "admin") {
    return true;
  }

  const override = permissions.find((permission) => permission.nav_section === navItem);
  if (override) {
    return override.allowed;
  }

  return getDefaultNavAccess(role).has(navItem as NavItem);
}

export function getDefaultVisibleStatuses(role: AppRole): Set<LeadStatus> {
  if (role === "no_role") {
    return new Set();
  }
  if (role === "opr") {
    return new Set<LeadStatus>(["urgent_job"]);
  }

  return new Set(ALL_LEAD_STATUSES);
}
