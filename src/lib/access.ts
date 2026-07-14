import type { AppRole, NavigationPermission, LeadStatus } from "@/types";
import { ALL_LEAD_STATUSES, ALL_NAV_ITEMS, type NavItem } from "@/lib/constants";

const DEFAULT_NAV_ACCESS: Record<AppRole, Set<NavItem>> = {
  admin: new Set(ALL_NAV_ITEMS),
  processor: new Set(["leads", "schedule", "cancellation_requests"]),
  customer_service: new Set(["leads", "schedule"]),
  opr: new Set(["leads"]),
  cs_admin: new Set(["leads", "schedule"]),
};

export const canAccessCancellationRequests = (role: AppRole | null | undefined) =>
  role === "admin" || role === "processor";

export function getDefaultNavAccess(role: AppRole): Set<NavItem> {
  return new Set(DEFAULT_NAV_ACCESS[role]);
}

export function canAccessNavItem(
  role: AppRole | null | undefined,
  navItem: string,
  permissions: NavigationPermission[] = [],
): boolean {
  if (!role) {
    return false;
  }

  if (!ALL_NAV_ITEMS.includes(navItem as NavItem)) {
    return false;
  }

  if (role === "admin") {
    return true;
  }

  if (navItem === "quo_monitor") {
    return false;
  }

  if (navItem === "payment_requests") {
    // Admin-only page
    return false;
  }

  if (navItem === "crm_updates") {
    // Admin-only page
    return false;
  }


  if (navItem === "cancellation_requests" && canAccessCancellationRequests(role)) {
    return true;
  }

  const override = permissions.find((permission) => permission.nav_section === navItem);
  if (override) {
    return override.allowed;
  }

  return getDefaultNavAccess(role).has(navItem as NavItem);
}

export function getDefaultVisibleStatuses(role: AppRole | null | undefined): Set<LeadStatus> {
  if (!role) {
    return new Set();
  }
  if (role === "opr") {
    return new Set<LeadStatus>(["urgent_job", "partial_paid"]);
  }

  return new Set(ALL_LEAD_STATUSES);
}
