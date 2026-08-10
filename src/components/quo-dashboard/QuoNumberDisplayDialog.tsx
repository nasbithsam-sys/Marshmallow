import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile, RotateCcw, Save } from "lucide-react";
import { getQuoNumberName } from "@/lib/quo-dashboard";
import type { QuoNumberDisplayMap } from "@/lib/quo-number-display";

const EMOJI_PRESETS = [
  "📞", "📱", "🧰", "🔧", "🚪", "🎨", "🧹", "🚚", "🛠️", "🏠",
  "🔥", "❄️", "💧", "⚡", "🌴", "🎄", "🛁", "🧊", "⭐", "🚨",
  "🟢", "🔵", "🟣", "🟡", "🔴", "⚪", "💼", "🏆", "📌", "✅",
];

export interface QuoNumberOption {
  id: string;
  number: string;
  name: string | null;
  label: string | null;
  display_number: string | null;
  chatCount?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numbers: QuoNumberOption[];
  displayMap: QuoNumberDisplayMap;
  onSave: (map: QuoNumberDisplayMap) => void;
  isSaving?: boolean;
}

export default function QuoNumberDisplayDialog({
  open,
  onOpenChange,
  numbers,
  displayMap,
  onSave,
  isSaving,
}: Props) {
  const [draft, setDraft] = useState<QuoNumberDisplayMap>(displayMap);

  useEffect(() => {
    if (open) setDraft(displayMap);
  }, [open, displayMap]);

  const setField = (id: string, field: "label" | "emoji", value: string) => {
    setDraft((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const reset = (id: string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Quo number display</DialogTitle>
          <DialogDescription className="text-xs">
            Rename any number and add an emoji. These names are used across the QUO dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
          {numbers.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No QUO numbers found yet.
            </p>
          )}

          {numbers.map((num) => {
            const entry = draft[num.id] || {};
            const fallback = getQuoNumberName(num);

            return (
              <div
                key={num.id}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-2"
              >
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-base"
                      title="Pick emoji"
                    >
                      {entry.emoji || <Smile className="h-4 w-4 text-muted-foreground" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[260px] p-2">
                    <div className="grid grid-cols-8 gap-1">
                      {EMOJI_PRESETS.map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          onClick={() => setField(num.id, "emoji", emo)}
                          className="rounded-md p-1 text-base hover:bg-muted"
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 border-t pt-2">
                      <Input
                        value={entry.emoji || ""}
                        onChange={(e) => setField(num.id, "emoji", e.target.value.slice(0, 4))}
                        placeholder="Custom"
                        className="h-7 text-xs"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setField(num.id, "emoji", "")}
                      >
                        Clear
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <div className="min-w-0 flex-1">
                  <Input
                    value={entry.label ?? ""}
                    onChange={(e) => setField(num.id, "label", e.target.value)}
                    placeholder={fallback}
                    className="h-9 text-xs"
                  />
                  <span className="mt-0.5 block truncate text-[10px] font-mono text-muted-foreground">
                    {num.number}
                    {typeof num.chatCount === "number" ? ` · ${num.chatCount} chats` : ""}
                  </span>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => reset(num.id)}
                  className="h-8 shrink-0 gap-1 text-xs text-muted-foreground"
                  title="Reset to default name"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" className="gap-1.5" disabled={isSaving} onClick={() => onSave(draft)}>
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save names"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
