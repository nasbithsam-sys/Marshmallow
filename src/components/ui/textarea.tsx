import * as React from "react";

import { cn } from "@/lib/utils";

<<<<<<< HEAD
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
=======
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
<<<<<<< HEAD
        "flex min-h-[110px] w-full rounded-xl border border-input/90 bg-[hsl(var(--card)/0.88)] px-4 py-3 text-[14px] text-foreground shadow-premium-xs ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-0 focus-visible:border-primary/45 focus-visible:bg-[hsl(var(--background)/0.96)] focus-visible:shadow-premium-sm disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[linear-gradient(180deg,hsl(var(--card)/0.94),hsl(var(--muted)/0.26))]",
=======
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
