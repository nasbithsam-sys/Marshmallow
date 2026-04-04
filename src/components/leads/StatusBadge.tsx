import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/types";
import { cn } from "@/lib/utils";
<<<<<<< HEAD
=======
import { motion } from "framer-motion";
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
import { Sparkles } from "lucide-react";

interface StatusBadgeProps {
  status: LeadStatus;
  size?: "sm" | "md";
}

const dotColorMap: Record<string, string> = {
  "status-red": "bg-[hsl(var(--status-red))]",
  "status-amber": "bg-[hsl(var(--status-amber))]",
  "status-blue": "bg-primary",
  "status-green": "bg-[hsl(var(--status-green))]",
  "status-muted": "bg-muted-foreground/40",
};

const bgColorMap: Record<string, string> = {
  "status-red":
<<<<<<< HEAD
    "bg-[linear-gradient(180deg,hsl(var(--status-red)/0.16),hsl(var(--status-red)/0.09))] text-[hsl(var(--status-red))] border-[hsl(var(--status-red)/0.20)] shadow-[0_10px_24px_-18px_hsl(var(--status-red)/0.55)] dark:bg-[hsl(var(--status-red)/0.18)] dark:border-[hsl(var(--status-red)/0.26)] dark:text-[hsl(var(--status-red))]",
  "status-amber":
    "bg-[linear-gradient(180deg,hsl(var(--status-amber)/0.16),hsl(var(--status-amber)/0.08))] text-[hsl(var(--status-amber))] border-[hsl(var(--status-amber)/0.18)] shadow-[0_10px_24px_-18px_hsl(var(--status-amber)/0.5)] dark:bg-[hsl(var(--status-amber)/0.18)] dark:border-[hsl(var(--status-amber)/0.26)] dark:text-[hsl(var(--status-amber))]",
  "status-blue":
    "bg-[linear-gradient(180deg,hsl(var(--primary)/0.14),hsl(196_100%_70%/0.06))] text-primary border-primary/18 shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.55)] dark:bg-primary/[0.18] dark:border-primary/28 dark:text-[hsl(210_100%_88%)]",
  "status-green":
    "bg-[linear-gradient(180deg,hsl(var(--status-green)/0.16),hsl(var(--status-green)/0.08))] text-[hsl(var(--status-green))] border-[hsl(var(--status-green)/0.18)] shadow-[0_10px_24px_-18px_hsl(var(--status-green)/0.5)] dark:bg-[hsl(var(--status-green)/0.18)] dark:border-[hsl(var(--status-green)/0.26)] dark:text-[hsl(var(--status-green))]",
  "status-muted":
    "bg-[linear-gradient(180deg,hsl(var(--background)/0.94),hsl(var(--muted)/0.84))] text-muted-foreground border-border shadow-[0_10px_24px_-20px_rgba(56,189,248,0.16)] dark:bg-[hsl(223_18%_20%/0.92)] dark:border-[hsl(217_18%_30%/0.92)] dark:text-[hsl(220_18%_82%)]",
=======
    "bg-[hsl(var(--status-red)/0.10)] text-[hsl(var(--status-red))] border-[hsl(var(--status-red)/0.14)] shadow-[0_8px_24px_-18px_hsl(var(--status-red)/0.55)]",
  "status-amber":
    "bg-[hsl(var(--status-amber)/0.10)] text-[hsl(var(--status-amber))] border-[hsl(var(--status-amber)/0.14)] shadow-[0_8px_24px_-18px_hsl(var(--status-amber)/0.5)]",
  "status-blue": "bg-primary/[0.08] text-primary border-primary/12 shadow-[0_8px_24px_-18px_hsl(var(--primary)/0.55)]",
  "status-green":
    "bg-[hsl(var(--status-green)/0.10)] text-[hsl(var(--status-green))] border-[hsl(var(--status-green)/0.14)] shadow-[0_8px_24px_-18px_hsl(var(--status-green)/0.5)]",
  "status-muted": "bg-muted/70 text-muted-foreground border-border shadow-[0_8px_24px_-20px_rgba(0,0,0,0.18)]",
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
};

const StatusBadge = ({ status, size = "md" }: StatusBadgeProps) => {
  const config = LEAD_STATUS_CONFIG[status];
  if (!config) return null;

  const isUrgent = status === "urgent_job";

  return (
<<<<<<< HEAD
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-[-0.01em] backdrop-blur-[6px] transition-colors duration-150",
=======
    <motion.span
      initial={{ opacity: 0.96, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16 }}
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-[-0.01em] backdrop-blur-[2px] transition-all duration-200",
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
        bgColorMap[config.color] ?? bgColorMap["status-muted"],
        size === "sm" ? "gap-1.5 px-2.5 py-1 text-[10px]" : "gap-2 px-3 py-1.5 text-[11px]",
        isUrgent && "ring-1 ring-[hsl(var(--status-red)/0.18)]",
      )}
    >
      {isUrgent && size === "md" ? (
        <Sparkles className="h-3 w-3 shrink-0 text-[hsl(var(--status-red))]" />
      ) : (
        <span
          className={cn(
            "shrink-0 rounded-full",
            dotColorMap[config.color] ?? dotColorMap["status-muted"],
            size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
<<<<<<< HEAD
            isUrgent && "shadow-[0_0_10px_hsl(var(--status-red)/0.38)]",
=======
            isUrgent && "status-pulse shadow-[0_0_10px_hsl(var(--status-red)/0.55)]",
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
          )}
        />
      )}

      <span className="whitespace-nowrap leading-none">{config.label}</span>
<<<<<<< HEAD
    </span>
=======
    </motion.span>
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  );
};

export default StatusBadge;
