export type AiBudgetMode = "normal" | "soft_cap" | "critical_only" | "stopped";

export function getAiBudgetMode({
  monthlySpend,
  softCap = 180,
  hardCap = 200,
}: {
  monthlySpend: number;
  softCap?: number;
  hardCap?: number;
}): AiBudgetMode {
  if (monthlySpend >= hardCap) return "stopped";
  if (monthlySpend >= hardCap * 0.95) return "critical_only";
  if (monthlySpend >= softCap || monthlySpend >= hardCap * 0.8) return "soft_cap";
  return "normal";
}

export function shouldProcessAiJob({
  budgetMode,
  priority,
  isNewInbound,
  isRisky,
}: {
  budgetMode: AiBudgetMode;
  priority: "low" | "medium" | "high" | "critical";
  isNewInbound: boolean;
  isRisky: boolean;
}) {
  if (budgetMode === "normal") return true;
  if (budgetMode === "soft_cap") return priority !== "low" || isNewInbound || isRisky;
  if (budgetMode === "critical_only") return priority === "critical" || isRisky || isNewInbound;
  return priority === "critical" && isRisky;
}

export const QUO_AI_TASK_LABELS: Record<string, string> = {
  missed_reply: "Missed Reply",
  hot_lead_follow_up: "Hot Lead Follow-Up",
  quote_follow_up: "Quote Follow-Up",
  schedule_confirmation: "Schedule Confirmation",
  appointment_reminder: "Appointment Reminder",
  reschedule_follow_up: "Reschedule Follow-Up",
  complaint_follow_up: "Complaint Follow-Up",
  payment_follow_up: "Payment Follow-Up",
  ghosting_follow_up: "Ghosting Follow-Up",
  dead_lead_review: "Dead Lead Review",
  old_lead_reactivation: "Old Lead Reactivation",
  manager_escalation: "Manager Escalation",
};
