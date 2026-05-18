import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "glass-subtle flex h-10 w-full rounded-2xl px-4 py-2 text-sm text-foreground outline-none ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/90 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/70 dark:bg-input/80",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
