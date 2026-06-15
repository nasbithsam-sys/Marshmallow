import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Lead } from "@/types";
import { buildCompleteLeadCopyText, copyTextToClipboard } from "@/lib/lead-copy";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface CompleteLeadCopyButtonProps {
  lead: Lead;
  className?: string;
}

export default function CompleteLeadCopyButton({ lead, className }: CompleteLeadCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const text = buildCompleteLeadCopyText(lead);
    if (!text) {
      toast.error("No service details, address, schedule requirement, or quote available to copy");
      return;
    }

    await copyTextToClipboard(text);
    setCopied(true);
    toast.success("Complete lead details copied");
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5 text-[12px] font-semibold", className)}
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Complete Copy"}
    </Button>
  );
}
