import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppRole, LeadCancellationRequest } from "@/types";
import { canReviewCancellationRequest } from "@/lib/cancellation-requests";

interface CancellationRequestPanelProps {
  request: LeadCancellationRequest | null;
  role: AppRole;
  loading?: boolean;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
}

const roleLabel: Record<string, string> = {
  customer_service: "CS",
  processor: "Processor",
  admin: "Admin",
};

export default function CancellationRequestPanel({
  request,
  role,
  loading = false,
  onApprove,
  onReject,
}: CancellationRequestPanelProps) {
  if (!request) return null;

  const canReview = canReviewCancellationRequest(role, request);
  const approverText = request.requested_by_role === "processor" ? "Waiting for Admin approval" : "Waiting for Processor/Admin approval";

  return (
    <div className="mx-4 mt-3 rounded-[22px] border border-destructive/20 bg-destructive/[0.055] p-3.5 text-[12px] shadow-[0_18px_30px_-25px_rgba(239,68,68,0.22)] dark:bg-destructive/[0.10]">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-semibold text-foreground">Cancellation request pending</p>
            <p className="mt-0.5 text-muted-foreground">
              Requested by {request.requester_name || roleLabel[request.requested_by_role] || request.requested_by_role}
              {request.requester_name ? ` (${roleLabel[request.requested_by_role] || request.requested_by_role})` : ""}
            </p>
          </div>

          <div className="rounded-2xl border border-destructive/15 bg-background/65 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Comment</p>
            <p className="mt-1 whitespace-pre-wrap leading-5 text-foreground/88">{request.comment}</p>
            {request.proof && (
              <>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Proof</p>
                <p className="mt-1 break-words leading-5 text-foreground/88">{request.proof}</p>
              </>
            )}
          </div>

          {canReview ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="sm" className="h-8 flex-1 gap-1.5 rounded-xl text-[11px]" onClick={onApprove} disabled={loading}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve cancel
              </Button>
              <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 rounded-xl text-[11px]" onClick={onReject} disabled={loading}>
                <XCircle className="h-3.5 w-3.5" />
                Reject request
              </Button>
            </div>
          ) : (
            <p className="rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 text-[11px] font-medium text-muted-foreground">
              {approverText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
