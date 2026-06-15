import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CancellationRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (comment: string, proof: string) => void | Promise<void>;
  loading?: boolean;
  requesterLabel?: string;
}

export default function CancellationRequestDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  requesterLabel = "your manager",
}: CancellationRequestDialogProps) {
  const [comment, setComment] = useState("");
  const [proof, setProof] = useState("");

  useEffect(() => {
    if (!open) {
      setComment("");
      setProof("");
    }
  }, [open]);

  const handleSubmit = async () => {
    await onSubmit(comment, proof);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request cancellation</DialogTitle>
          <DialogDescription>
            This lead will move to Cancellation Request first. {requesterLabel} can approve or reject it after checking your comment and proof.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-comment">Cancellation comment *</Label>
            <Textarea
              id="cancel-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Explain why this lead should be cancelled..."
              rows={4}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-proof">Proof / reference / link</Label>
            <Input
              id="cancel-proof"
              value={proof}
              onChange={(event) => setProof(event.target.value)}
              placeholder="Paste proof, note, screenshot link, or reference..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !comment.trim()}>
            {loading ? "Requesting..." : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
