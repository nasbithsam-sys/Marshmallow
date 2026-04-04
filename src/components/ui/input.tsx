import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-input/75 bg-[hsl(var(--card)/0.74)] px-4 py-2.5 text-[14px] text-foreground shadow-[0_10px_24px_-20px_rgba(37,99,235,0.18)] ring-offset-background transition-[border-color,box-shadow,background-color] duration-180 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/72 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 focus-visible:border-primary/40 focus-visible:bg-[hsl(var(--background)/0.88)] focus-visible:shadow-[0_16px_30px_-24px_rgba(37,99,235,0.22)] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
