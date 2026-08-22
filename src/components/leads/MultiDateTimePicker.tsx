import React, { useState } from "react";
import { format } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import BookingDateTimeDialog from "./BookingDateTimeDialog";

interface MultiDateTimePickerProps {
  value: string | null;
  onChange: (val: string) => void;
  readOnly?: boolean;
}

export default function MultiDateTimePicker({ value, onChange, readOnly }: MultiDateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const handleAdd = (isoString: string) => {
    const formatted = format(new Date(isoString), "MMM d, yyyy 'at' h:mm a");
    const current = value ? value.trim() : "";
    const newVal = current ? `${current}\n${formatted}` : formatted;
    onChange(newVal);
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="min-h-[80px]"
        placeholder="Preferred times, availability..."
      />
      
      {!readOnly && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="h-8 text-xs flex items-center gap-1"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Add Date & Time
          </Button>
        </div>
      )}
      
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
