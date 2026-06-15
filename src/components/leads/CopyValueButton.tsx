import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/lead-copy";
import { toast } from "sonner";

interface CopyValueButtonProps {
  value?: string | null;
  label?: string;
  className?: string;
}

export default function CopyValueButton({ value, label = "detail", className }: CopyValueButtonProps) {
  const [copied, setCopied] = useState(false);
  const safeValue = String(value || "").trim();

  if (!safeValue) return null;

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    await copyTextToClipboard(safeValue);
    setCopied(true);
    toast.success(`${label} copied`);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
      onClick={handleCopy}
      className={cn(
        "h-7 w-7 shrink-0 rounded-xl border border-primary/10 bg-primary/[0.04] text-primary/70 hover:bg-primary/[0.10] hover:text-primary",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
