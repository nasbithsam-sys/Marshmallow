import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logActivity } from "@/lib/activity";

interface ActivateCustomerNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  customerName: string;
  jobId: string;
  currentStatus: string;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function ActivateCustomerNoteDialog({
  open,
  onOpenChange,
  leadId,
  customerName,
  jobId,
  currentStatus,
  onSuccess,
  onCancel,
}: ActivateCustomerNoteDialogProps) {
  const { user, profile } = useAuth();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !saving) {
      setNote("");
      onCancel?.();
    }
    onOpenChange(nextOpen);
  };

  const handleActivate = async (withNote: boolean) => {
    if (!user) return;
    setSaving(true);

    try {
      const currentUserName = profile?.full_name || user.email || "Unknown user";
      const trimmedNote = note.trim();

      // 1. Update lead status to activate_customer
      const statusUpdate: Record<string, unknown> = {
        status: "activate_customer",
        cs_tag: null, // clear schedule tags when changing status
        last_edited_by: user.id,
        last_edited_by_name: currentUserName,
        updated_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      };

      if (withNote && trimmedNote) {
        statusUpdate.cs_notes = trimmedNote;
      }

      const { error: leadError } = await supabase
        .from("leads")
        .update(statusUpdate as never)
        .eq("id", leadId);

      if (leadError) throw leadError;

      // 2. Insert into lead_notes with note_type: "cs"
      if (withNote && trimmedNote) {
        const { error: noteError } = await supabase.from("lead_notes").insert({
          lead_id: leadId,
          user_id: user.id,
          user_name: currentUserName,
          note_type: "cs",
          content: trimmedNote,
        });

        if (noteError) {
          console.warn("Failed to insert into lead_notes:", noteError.message);
        }
      }

      // 3. Log activity
      await logActivity(user.id, "status_changed", "lead", leadId, {
        target_name: jobId,
        customer_name: customerName,
        job_id: jobId,
        status_from: currentStatus,
        status_to: "activate_customer",
        changes: {
          status: {
            before: currentStatus,
            after: "activate_customer",
          },
          ...(withNote && trimmedNote ? { cs_notes: { after: trimmedNote } } : {}),
        },
      });

      toast.success(
        withNote && trimmedNote
          ? "Status updated to Activate Customer & CS note added"
          : "Status updated to Activate Customer"
      );

      setNote("");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] rounded-[24px] border-emerald-500/25 bg-background/95 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Activate Customer — Add Note
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {customerName} <span className="font-mono opacity-80">({jobId})</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <p className="flex items-start gap-1.5 leading-relaxed font-medium">
              <MessageSquare className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                Mention any instructions or notes below. This note will appear in the <strong>CS Notes</strong> thread for CS &amp; CS Admins, and the lead card will stay pinned and blinking until the status changes.
              </span>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="activate-note" className="text-xs font-semibold text-foreground/90">
              Note for CS &amp; CS Admin <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="activate-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Customer is ready, please follow up for scheduling preference..."
              className="min-h-[110px] resize-none text-xs leading-relaxed focus-visible:ring-emerald-500/40 rounded-xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleActivate(true);
                }
              }}
            />
            <p className="text-[10px] text-muted-foreground text-right">Press Ctrl+Enter to save</p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-1.5 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleClose(false)}
            disabled={saving}
            className="rounded-xl text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleActivate(false)}
            disabled={saving}
            className="rounded-xl text-xs border-border/80 hover:bg-muted"
          >
            Activate Without Note
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleActivate(true)}
            disabled={saving}
            className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Save Note &amp; Activate</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
