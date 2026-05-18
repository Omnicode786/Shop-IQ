import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "glass-subtle min-h-[120px] w-full rounded-2xl px-4 py-3 text-sm leading-6 text-foreground outline-none ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/90 focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/70 dark:bg-input/80",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
