import type { AppRole, CsTag } from "@/types";

const TAGS_BY_ROLE: Record<AppRole, CsTag[]> = {
  admin: ["confirmation_sent", "waiting_schedule_confirmation", "booked", "ready_to_schedule"],
  customer_service: ["confirmation_sent", "waiting_schedule_confirmation", "booked"],
  processor: ["ready_to_schedule"],
  opr: [],
  no_role: [],
};

export function getAssignableLeadTags(role: AppRole): CsTag[] {
  return TAGS_BY_ROLE[role] ?? [];
}

export function canAssignLeadTag(role: AppRole, tag: CsTag): boolean {
  return getAssignableLeadTags(role).includes(tag);
}
