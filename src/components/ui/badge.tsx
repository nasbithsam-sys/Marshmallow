import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/12 bg-primary/[0.10] text-primary shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.38)] hover:bg-primary/[0.16]",
        secondary: "border-border/55 bg-[hsl(var(--background)/0.86)] text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-destructive/18 bg-destructive/[0.10] text-destructive shadow-[0_10px_24px_-18px_hsl(var(--destructive)/0.32)] hover:bg-destructive/[0.16]",
        outline: "border-border/55 bg-[hsl(var(--background)/0.78)] text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
