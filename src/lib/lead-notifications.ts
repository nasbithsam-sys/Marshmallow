import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/types";

/**
 * Single place where lead status alerts (Urgent Job / Need Tech / Job in Progress /
 * Quote Updated) are dispatched.
 *
 * Delivery goes through the `dispatch_lead_status_notification` RPC, which keeps at most one
 * unread alert per (user, lead, title) — re-flagging the same lead refreshes the existing row
 * instead of stacking another popup. If that migration has not been applied yet the helper
 * falls back to the previous direct insert so alerts still go out.
 */

const ALERT_ROLES: AppRole[] = ["admin", "processor", "customer_service", "cs_admin", "opr"];
const REMINDER_ROLES: AppRole[] = ["admin", "processor"];

export type LeadNotificationStatus = "urgent_job" | "need_tech" | "job_in_progress" | "quote_updated";

interface DispatchParams {
  leadId: string;
  leadName: string;
  status: string;
  /** Included in the Job in Progress reminder text when present. */
  expectedCompletionDate?: string | null;
  /** Quote Updated also notifies whoever requested the quote. */
  quoteRequestedBy?: string | null;
  /** New leads get "requires attention" wording rather than "changed to". */
  isNewLead?: boolean;
}

function isNotificationStatus(status: string): status is LeadNotificationStatus {
  return (
    status === "urgent_job" ||
    status === "need_tech" ||
    status === "job_in_progress" ||
    status === "quote_updated"
  );
}

/** Titles are matched by the popups with `ilike`, so these strings are load-bearing. */
function buildContent(params: DispatchParams, status: LeadNotificationStatus) {
  const { leadName, expectedCompletionDate, isNewLead } = params;

  if (status === "quote_updated") {
    return {
      title: "[Alert] Quote Updated",
      message: `Quote for lead "${leadName}" has been updated`,
    };
  }

  if (status === "job_in_progress") {
    return {
      title: "[Reminder] Job in Progress",
      message: expectedCompletionDate
        ? `Lead "${leadName}" is In Progress. Expected completion: ${expectedCompletionDate}`
        : `Lead "${leadName}" changed to Job in Progress`,
    };
  }

  const statusLabel = status === "urgent_job" ? "Urgent Job" : "Need Tech";
  return {
    title: `[Alert] ${statusLabel}`,
    message: isNewLead
      ? `New lead "${leadName}" requires attention - marked as ${statusLabel}`
      : `Lead "${leadName}" changed to ${statusLabel}`,
  };
}

async function resolveRecipients(
  status: LeadNotificationStatus,
  quoteRequestedBy?: string | null,
): Promise<string[]> {
  const recipients = new Set<string>();

  if (status === "quote_updated") {
    if (quoteRequestedBy) recipients.add(quoteRequestedBy);

    const { data: csAdmins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "cs_admin");

    csAdmins?.forEach((r: { user_id: string }) => recipients.add(r.user_id));
    return [...recipients];
  }

  const targetRoles = status === "job_in_progress" ? REMINDER_ROLES : ALERT_ROLES;
  const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", targetRoles);

  roles?.forEach((r: { user_id: string }) => recipients.add(r.user_id));
  return [...recipients];
}

/** Postgres/PostgREST codes meaning the RPC is not deployed on this project yet. */
function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42883" || error.code === "PGRST202") return true;
  return Boolean(error.message && /Could not find the function|does not exist/i.test(error.message));
}

async function deliver(leadId: string, title: string, message: string, userIds: string[]) {
  if (userIds.length === 0) return;

  const { error } = await supabase.rpc("dispatch_lead_status_notification" as never, {
    p_lead_id: leadId,
    p_title: title,
    p_message: message,
    p_user_ids: userIds,
  } as never);

  if (!error) return;

  if (!isMissingFunction(error)) throw error;

  // Migration not applied yet — deliver the old way rather than dropping the alert.
  await supabase.from("notifications").insert(
    userIds.map((userId) => ({
      user_id: userId,
      title,
      message,
      lead_id: leadId,
      read: false,
    })),
  );
}

/**
 * Sends the alert for a lead status change. Safe to call for any status — anything without an
 * alert attached is ignored. Never throws: notification delivery must not fail a lead save.
 */
export async function dispatchLeadStatusNotification(params: DispatchParams): Promise<void> {
  try {
    if (!isNotificationStatus(params.status)) return;

    const recipients = await resolveRecipients(params.status, params.quoteRequestedBy);
    if (recipients.length === 0) return;

    const { title, message } = buildContent(params, params.status);
    await deliver(params.leadId, title, message, recipients);
  } catch (err) {
    console.warn("Failed to dispatch lead status notification:", err);
  }
}

export const INCOMPLETE_DETAILS_TITLE = "[Alert] Incomplete Details";

/**
 * Fired when a Processor / Admin / Quotation Master tags a lead as Incomplete details.
 * Goes to the CS who created the lead (whose card it also pins) and to every CS Admin.
 */
export async function dispatchIncompleteDetailsNotification(params: {
  leadId: string;
  leadName: string;
  createdBy?: string | null;
}): Promise<void> {
  try {
    const recipients = new Set<string>();
    if (params.createdBy) recipients.add(params.createdBy);

    const { data: csAdmins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "cs_admin");

    csAdmins?.forEach((r: { user_id: string }) => recipients.add(r.user_id));
    if (recipients.size === 0) return;

    await deliver(
      params.leadId,
      INCOMPLETE_DETAILS_TITLE,
      `Lead "${params.leadName}" is missing details - please complete the lead information`,
      [...recipients],
    );
  } catch (err) {
    console.warn("Failed to dispatch incomplete details notification:", err);
  }
}
