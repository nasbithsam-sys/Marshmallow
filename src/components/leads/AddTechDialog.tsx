import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUSPhone } from "@/lib/phone";
import { buildTechEntry } from "@/lib/lead-techs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The number this tech will be given, shown so it is obvious before saving. */
  techNumber: number;
  saving?: boolean;
  /** Receives the finished line, e.g. "Tech 1: John - (305) 555-0123 - he is available". */
  onAdd: (entry: string) => void;
}

/**
 * Three fields rather than a template dropped into the message box: name, number and a short
 * note, written out as one readable line.
 */
export default function AddTechDialog({ open, onOpenChange, techNumber, saving, onAdd }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  // Start clean every time it opens.
  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setNote("");
    }
  }, [open]);

  const canAdd = name.trim().length > 0 && !saving;
  const preview = buildTechEntry(techNumber, { name: name || "Name", phone, note });

  const submit = () => {
    if (!canAdd) return;
    onAdd(buildTechEntry(techNumber, { name, phone, note }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">Add tech {techNumber}</DialogTitle>
          <DialogDescription className="text-xs">
            Added to the processor notes as one line.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tech-name" className="text-[12px]">
              Name
            </Label>
            <Input
              id="tech-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-9 rounded-xl text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tech-number" className="text-[12px]">
              Number
            </Label>
            <Input
              id="tech-number"
              value={phone}
              // Formatted as it is typed, so it always reads (000) 000-0000.
              onChange={(e) => setPhone(formatUSPhone(e.target.value))}
              placeholder="(000) 000-0000"
              inputMode="tel"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-9 rounded-xl text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tech-note" className="text-[12px]">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="tech-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="he is available"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-9 rounded-xl text-[13px]"
            />
          </div>

          <p className="truncate rounded-lg bg-muted/40 px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
            {preview}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canAdd}>
            {saving ? "Adding..." : "Add tech"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
