import type { LeadStatus, AppRole, Lead, Profile, ActivityLog, NavigationPermission } from "@/types";

export type { LeadStatus, AppRole, Lead, Profile, ActivityLog, NavigationPermission };

export const STATUS_LABELS: Record<LeadStatus, string> = {
  waiting_complete_details: "Waiting Complete Details",
  urgent_job: "Urgent Job",
  quote_sent_waiting: "Quote Sent - Waiting",
  post_visit_quote_sent_waiting: "Post Visit-Quote Sent-Waiting",
  activate_customer: "Activate Customer",
  ready_to_schedule: "Ready To Schedule",
  quote_sent_need_follow_up: "Quote Sent - Need Follow Up",
  needs_quote: "Needs Quote",
  tech_making_quote: "Tech Making Quote",
  waiting_customer_response: "Waiting Customer Response",
  need_tech: "Need Tech",
  scheduled: "Scheduled",
  job_in_progress: "Job in Progress",
  needs_reschedule: "Needs Reschedule",
  job_done: "Job Done",
  payment_pending: "Payment Pending",
  cancelled: "Cancelled",
  paid: "Paid",
};

export const STATUS_COLORS: Record<LeadStatus, string> = {
  waiting_complete_details: "bg-amber-100 text-amber-800 border-amber-200",
  urgent_job: "bg-red-100 text-red-800 border-red-200",
  quote_sent_waiting: "bg-blue-100 text-blue-800 border-blue-200",
  post_visit_quote_sent_waiting: "bg-slate-100 text-slate-800 border-slate-200",
  activate_customer: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ready_to_schedule: "bg-indigo-100 text-indigo-800 border-indigo-200",
  quote_sent_need_follow_up: "bg-orange-100 text-orange-800 border-orange-200",
  needs_quote: "bg-purple-100 text-purple-800 border-purple-200",
  tech_making_quote: "bg-violet-100 text-violet-800 border-violet-200",
  waiting_customer_response: "bg-yellow-100 text-yellow-800 border-yellow-200",
  need_tech: "bg-indigo-100 text-indigo-800 border-indigo-200",
  scheduled: "bg-cyan-100 text-cyan-800 border-cyan-200",
  job_in_progress: "bg-sky-100 text-sky-800 border-sky-200",
  needs_reschedule: "bg-rose-100 text-rose-800 border-rose-200",
  job_done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  payment_pending: "bg-lime-100 text-lime-800 border-lime-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  paid: "bg-green-100 text-green-800 border-green-200",
};

export const STATUS_DOT_COLORS: Record<LeadStatus, string> = {
  waiting_complete_details: "bg-amber-400",
  urgent_job: "bg-red-500",
  quote_sent_waiting: "bg-blue-400",
  post_visit_quote_sent_waiting: "bg-slate-400",
  activate_customer: "bg-emerald-500",
  ready_to_schedule: "bg-indigo-500",
  quote_sent_need_follow_up: "bg-orange-400",
  needs_quote: "bg-purple-400",
  tech_making_quote: "bg-violet-400",
  waiting_customer_response: "bg-yellow-400",
  need_tech: "bg-indigo-400",
  scheduled: "bg-cyan-400",
  job_in_progress: "bg-sky-400",
  needs_reschedule: "bg-rose-400",
  job_done: "bg-emerald-400",
  payment_pending: "bg-lime-400",
  cancelled: "bg-gray-400",
  paid: "bg-green-500",
};

export const ALL_LEAD_STATUSES: LeadStatus[] = [
  "waiting_complete_details",
  "urgent_job",
  "quote_sent_waiting",
  "post_visit_quote_sent_waiting",
  "activate_customer",
  "ready_to_schedule",
  "quote_sent_need_follow_up",
  "needs_quote",
  "tech_making_quote",
  "waiting_customer_response",
  "need_tech",
  "scheduled",
  "job_in_progress",
  "needs_reschedule",
  "job_done",
  "payment_pending",
  "cancelled",
  "paid",
];

export const ALL_NAV_ITEMS = ["leads", "calls", "analytics", "settings", "activity_logs", "schedule", "areas"] as const;
export type NavItem = (typeof ALL_NAV_ITEMS)[number];

const LEAD_PRIORITY_RANK: Partial<Record<LeadStatus, number>> = {
  urgent_job: 0,
  need_tech: 1,
  cancelled: 99,
};

function getLeadCreatedAtTime(lead: Pick<Lead, "created_at">) {
  const timestamp = new Date(lead.created_at).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function compareLeadDisplayPriority(
  a: Pick<Lead, "status" | "created_at">,
  b: Pick<Lead, "status" | "created_at">,
) {
  const rankA = LEAD_PRIORITY_RANK[a.status] ?? 10;
  const rankB = LEAD_PRIORITY_RANK[b.status] ?? 10;

  if (rankA !== rankB) return rankA - rankB;

  return getLeadCreatedAtTime(b) - getLeadCreatedAtTime(a);
}

const STATUS_CHANGE_ACCESS: Record<AppRole, LeadStatus[]> = {
  admin: ALL_LEAD_STATUSES,
  customer_service: [
    "need_tech",
    "urgent_job",
    "waiting_customer_response",
    "waiting_complete_details",
    "quote_sent_waiting",
    "ready_to_schedule",
    "quote_sent_need_follow_up",
    "needs_quote",
    "needs_reschedule",
  ],
  processor: [
    "post_visit_quote_sent_waiting",
    "activate_customer",
    "ready_to_schedule",
    "tech_making_quote",
    "scheduled",
    "job_in_progress",
    "paid",
    "payment_pending",
    "job_done",
    "needs_reschedule",
  ],
  no_role: [],
  opr: [],
};

export function getChangeableStatuses(role?: string | null): LeadStatus[] {
  return STATUS_CHANGE_ACCESS[(role as AppRole) || "no_role"] ?? [];
}

export function canChangeStatus(role: string | null | undefined, status: LeadStatus): boolean {
  return getChangeableStatuses(role).includes(status);
}
