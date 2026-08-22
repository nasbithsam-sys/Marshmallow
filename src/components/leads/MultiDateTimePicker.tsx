import React, { useState } from "react";
import { format } from "date-fns";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import BookingDateTimeDialog from "./BookingDateTimeDialog";
import { Badge } from "@/components/ui/badge";

interface MultiDateTimePickerProps {
  value: string | null;
  onChange: (val: string) => void;
  readOnly?: boolean;
}

export default function MultiDateTimePicker({ value, onChange, readOnly }: MultiDateTimePickerProps) {
  const [open, setOpen] = useState(false);

  // Parse existing string value into an array of lines
  const items = value ? value.split("\n").map(s => s.trim()).filter(Boolean) : [];

  const handleAdd = (isoString: string) => {
    // Format the date nicely, e.g., "Aug 25, 2026 at 10:00 AM"
    const formatted = format(new Date(isoString), "MMM d, yyyy 'at' h:mm a");
    const newItems = [...items, formatted];
    onChange(newItems.join("\n"));
  };

  const handleRemove = (index: number) => {
    if (readOnly) return;
    const newItems = [...items];
    newItems.splice(index, 1);
    onChange(newItems.join("\n"));
  };

  return (
    <div className="flex flex-col gap-2 border rounded-md p-2 bg-background min-h-[42px] max-h-32 overflow-y-auto">
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => (
          <Badge key={idx} variant="secondary" className="px-2 py-1 flex items-center gap-1.5 h-7">
            <span className="text-sm font-medium">{item}</span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                className="text-muted-foreground hover:text-foreground focus:outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </Badge>
        ))}
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="h-7 px-2 text-xs flex items-center gap-1 border-dashed"
          >
            <Plus className="h-3 w-3" /> Add Time
          </Button>
        )}
      </div>
      
      {!readOnly && (
        <BookingDateTimeDialog
          open={open}
          onOpenChange={setOpen}
          onConfirm={(iso) => {
            handleAdd(iso);
            setOpen(false);
          }}
          title="Add Schedule Requirement"
        />
      )}
    </div>
  );
}
