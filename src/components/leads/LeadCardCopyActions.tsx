import { Check, Clipboard, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AppRole, Lead } from "@/types";

interface Props {
  lead: Lead;
  role?: AppRole | null;
}

const formatSchedule = (lead: Lead) => {
  const date = lead.scheduled_date || "TBD";
  const start = lead.scheduled_time_start || "";
  const end = lead.scheduled_time_end || "";
  const time = start && end ? `${start} - ${end}` : start || end;
  return time ? `${date}, ${time}` : date;
};

const copyText = async (label: string, value?: string | null) => {
  const text = (value ?? "").trim();
  if (!text) {
    toast.error(`${label} is empty`);
    return false;
  }

  await navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
  return true;
};

export default function LeadCardCopyActions({ lead, role }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const canCompleteCopy = role === "admin" || role === "processor";

  const fields = [
    { key: "number", label: "Number", value: lead.customer_phone },
    { key: "address", label: "Address", value: lead.address },
    { key: "service", label: "Service", value: lead.service_details || lead.service_type },
    { key: "schedule", label: "Schedule", value: formatSchedule(lead) },
    { key: "quote", label: "Quote", value: lead.quote },
  ];

  const handleCopy = async (key: string, label: string, value?: string | null) => {
    if (await copyText(label, value)) {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1200);
    }
  };

  const handleCompleteCopy = async () => {
    const text = [
      `Service Details: ${lead.service_details || lead.service_type || ""}`,
      `Address: ${lead.address || ""}`,
      `Schedule Requirement: ${lead.customer_schedule_requirements || formatSchedule(lead)}`,
      `Quote: ${lead.quote || ""}`,
    ].join("\n");

    if (await copyText("Complete details", text)) {
      setCopiedKey("complete");
      window.setTimeout(() => setCopiedKey(null), 1200);
    }
  };

  return (
    <div className="space-y-2 px-4 pt-3">
      <div className="crm-lead-card-inner rounded-[18px] p-2 shadow-[0_16px_24px_-22px_rgba(59,130,246,0.14)] dark:shadow-none">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
          <Copy className="h-3 w-3" />
          Copy Fields
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fields.map((field) => (
            <Button
              key={field.key}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full px-2.5 text-[11px]"
              onClick={() => handleCopy(field.key, field.label, field.value)}
            >
              {copiedKey === field.key ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
              {field.label}
            </Button>
          ))}
        </div>

        {canCompleteCopy && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2 h-8 w-full rounded-[14px] text-[11px] font-semibold"
            onClick={handleCompleteCopy}
          >
            {copiedKey === "complete" ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Clipboard className="mr-1.5 h-3.5 w-3.5" />}
            Complete Copy Details
          </Button>
        )}
      </div>
    </div>
  );
}
