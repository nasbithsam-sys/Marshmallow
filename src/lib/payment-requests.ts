import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Lead, LeadStatus } from "@/types";
import { logActivity } from "@/lib/activity";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { updateLeadById } from "@/lib/lead-updates";

export const PAYMENT_REQUEST_STATUS: LeadStatus = "payment_requested" as LeadStatus;

export type PaymentRequestStatus = "pending" | "approved" | "rejected";

export interface LeadPaymentRequest {
  id: string;
  lead_id: string;
  previous_status: LeadStatus;
  requested_by: string;
  requested_by_role: AppRole;
  amount: number;
  screenshot_path: string | null;
  comment: string | null;
  status: PaymentRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string | null;
}

type CreateArgs = {
  lead: Lead;
  userId: string;
  requesterRole: AppRole;
  amount: number;
  comment?: string | null;
  screenshotFile?: File | null;
};

type ReviewArgs = {
  request: LeadPaymentRequest;
  lead: Lead;
  reviewerId: string;
  reviewerRole: AppRole;
  action: "approved" | "rejected";
  reviewNote?: string | null;
};

const table = () => (supabase.from as unknown as (t: string) => ReturnType<typeof supabase.from>)("lead_payment_requests");

export const canCreatePaymentRequest = (role?: AppRole | null) => role === "processor";

export const canReviewPaymentRequest = (role: AppRole | null | undefined, request?: LeadPaymentRequest | null) => {
  if (!request || request.status !== "pending") return false;
  return role === "admin";
};

export async function fetchPendingPaymentRequest(leadId: string): Promise<LeadPaymentRequest | null> {
  const { data, error } = await table()
    .select("*")
    .eq("lead_id", leadId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const request = data as unknown as LeadPaymentRequest;

  if (request.requested_by) {
    const { data: profile } = await supabase
      .from("profiles_public" as never)
      .select("full_name")
      .eq("id", request.requested_by)
      .maybeSingle();
    request.requester_name = (profile as { full_name?: string } | null)?.full_name || null;
  }

  return request;
}

export async function createPaymentRequest({
  lead,
  userId,
  requesterRole,
  amount,
  comment,
  screenshotFile,
}: CreateArgs): Promise<LeadPaymentRequest> {
  if (!canCreatePaymentRequest(requesterRole)) {
    throw new Error("Only Processors can request Paid approval");
  }
  if (!(amount > 0)) throw new Error("Amount is required");

  const { data: existing } = await table()
    .select("id")
    .eq("lead_id", lead.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) throw new Error("A pending Paid request already exists for this lead");

  let screenshotPath: string | null = null;
  if (screenshotFile) {
    const optimized = await optimizeImageForUpload(screenshotFile);
    const ext = optimized.name.split(".").pop() || "jpg";
    screenshotPath = `payment-requests/${lead.id}_${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("lead-photos").upload(screenshotPath, optimized);
    if (uploadError) throw uploadError;
  }

  const { data, error } = await table()
    .insert({
      lead_id: lead.id,
      previous_status: lead.status,
      requested_by: userId,
      requested_by_role: requesterRole,
      amount,
      screenshot_path: screenshotPath,
      comment: comment?.trim() || null,
      status: "pending",
    } as never)
    .select("*")
    .single();

  if (error) throw error;

  await updateLeadById(lead.id, {
    status: PAYMENT_REQUEST_STATUS,
    cs_tag: null,
    last_edited_by: userId,
    updated_at: new Date().toISOString(),
    last_edited_at: new Date().toISOString(),
  });

  // Notify admins
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");

  if (admins?.length) {
    await supabase.from("notifications").insert(
      admins.map((row: { user_id: string }) => ({
        user_id: row.user_id,
        title: "Paid approval request",
        message: `${lead.customer_name} needs Paid approval`,
        lead_id: lead.id,
        read: false,
      })),
    );
  }

  await logActivity(userId, "payment_requested", "lead", lead.id, {
    target_name: lead.job_id,
    customer_name: lead.customer_name,
    job_id: lead.job_id,
    requested_by_role: requesterRole,
    amount,
    comment: comment || null,
    screenshot_path: screenshotPath,
    status_from: lead.status,
    status_to: PAYMENT_REQUEST_STATUS,
  });

  return data as unknown as LeadPaymentRequest;
}

export async function reviewPaymentRequest({
  request,
  lead,
  reviewerId,
  reviewerRole,
  action,
  reviewNote,
}: ReviewArgs) {
  if (!canReviewPaymentRequest(reviewerRole, request)) {
    throw new Error("Only Admins can review Paid requests");
  }

  const now = new Date().toISOString();
  const { error: requestError } = await table()
    .update({
      status: action,
      reviewed_by: reviewerId,
      reviewed_at: now,
      review_note: reviewNote?.trim() || null,
    } as never)
    .eq("id", request.id);
  if (requestError) throw requestError;

  if (action === "approved") {
    await updateLeadById(lead.id, {
      status: "paid" as LeadStatus,
      amount: request.amount,
      payment_amount: request.amount,
      payment_screenshot_url: request.screenshot_path,
      cs_tag: null,
      last_edited_by: reviewerId,
      updated_at: now,
      last_edited_at: now,
    });
  } else {
    await updateLeadById(lead.id, {
      status: request.previous_status,
      last_edited_by: reviewerId,
      updated_at: now,
      last_edited_at: now,
    });
  }

  await logActivity(
    reviewerId,
    action === "approved" ? "payment_approved" : "payment_rejected",
    "lead",
    lead.id,
    {
      target_name: lead.job_id,
      customer_name: lead.customer_name,
      job_id: lead.job_id,
      requested_by_role: request.requested_by_role,
      amount: request.amount,
      review_note: reviewNote || null,
      status_to: action === "approved" ? "paid" : request.previous_status,
    },
  );
}
