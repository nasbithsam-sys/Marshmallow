import type { AppRole, CsTag } from "@/types";

const TAGS_BY_ROLE: Record<AppRole, CsTag[]> = {
  admin: ["ready_to_schedule", "confirmation_sent", "waiting_schedule_confirmation", "booked"],
  customer_service: ["ready_to_schedule", "confirmation_sent", "waiting_schedule_confirmation", "booked"],
  processor: ["ready_to_schedule", "waiting_schedule_confirmation"],
  opr: [],
  no_role: [],
};

export function getAssignableLeadTags(role: AppRole): CsTag[] {
  return TAGS_BY_ROLE[role] ?? [];
}

export function canAssignLeadTag(role: AppRole, tag: CsTag): boolean {
  return getAssignableLeadTags(role).includes(tag);
}
