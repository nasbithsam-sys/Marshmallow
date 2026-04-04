import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
<<<<<<< HEAD
  <div
    ref={ref}
    className={cn(
      "glass rounded-2xl border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--card)/0.82)] text-card-foreground shadow-[0_16px_34px_-26px_rgba(37,99,235,0.16)] transition-[box-shadow,border-color,background-color] duration-200 dark:bg-[linear-gradient(180deg,hsl(var(--card)/0.92),hsl(var(--muted)/0.34))]",
      className,
    )}
    {...props}
  />
=======
  <div ref={ref} className={cn("rounded-xl border border-border/60 bg-card text-card-foreground shadow-premium-sm transition-all duration-300", className)} {...props} />
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
<<<<<<< HEAD
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-[-0.02em]", className)} {...props} />
=======
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
