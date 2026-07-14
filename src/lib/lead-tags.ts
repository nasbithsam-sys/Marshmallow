import type { AppRole, CsTag } from "@/types";

const TAGS_BY_ROLE: Record<AppRole, CsTag[]> = {
  admin: ["ready_to_schedule", "confirmation_sent", "waiting_schedule_confirmation", "booked"],
  customer_service: ["ready_to_schedule", "confirmation_sent", "waiting_schedule_confirmation", "booked"],
  processor: ["ready_to_schedule", "waiting_schedule_confirmation"],
  opr: [],
  cs_admin: ["ready_to_schedule", "confirmation_sent", "waiting_schedule_confirmation", "booked"],
};

export function getAssignableLeadTags(role: AppRole | null | undefined): CsTag[] {
  if (!role) return [];
  return TAGS_BY_ROLE[role] ?? [];
}

export function canAssignLeadTag(role: AppRole | null | undefined, tag: CsTag): boolean {
  return getAssignableLeadTags(role).includes(tag);
}
