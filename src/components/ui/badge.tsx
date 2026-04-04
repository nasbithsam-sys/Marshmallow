import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
<<<<<<< HEAD
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[-0.01em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-primary/12 bg-primary/[0.10] text-primary shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.38)] hover:bg-primary/[0.16]",
        secondary: "border-border/55 bg-[hsl(var(--background)/0.86)] text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-destructive/18 bg-destructive/[0.10] text-destructive shadow-[0_10px_24px_-18px_hsl(var(--destructive)/0.32)] hover:bg-destructive/[0.16]",
        outline: "border-border/55 bg-[hsl(var(--background)/0.78)] text-foreground",
=======
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
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
