import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl border border-transparent text-sm font-medium whitespace-nowrap shadow-sm transition-[transform,box-shadow,background-color,border-color,color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary/95 text-primary-foreground shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_12px_28px_hsl(var(--primary)/0.24)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_1px_0_rgba(255,255,255,0.24)_inset,0_16px_34px_hsl(var(--primary)/0.28)] dark:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_18px_40px_rgba(37,99,235,0.28)]",
        secondary:
          "glass-chip border-white/30 bg-secondary/70 text-secondary-foreground hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_32px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_18px_36px_rgba(0,0,0,0.22)]",
        ghost:
          "text-foreground shadow-none hover:bg-muted/70 hover:text-foreground dark:hover:bg-muted/85",
        outline:
          "glass-chip border-white/40 bg-white/40 text-foreground hover:-translate-y-0.5 hover:border-primary/25 hover:bg-white/50 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)] dark:bg-white/5 dark:hover:bg-white/10 dark:hover:shadow-[0_18px_38px_rgba(0,0,0,0.26)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_12px_28px_hsl(var(--destructive)/0.22)] hover:-translate-y-0.5 hover:bg-destructive/90 hover:shadow-[0_16px_34px_hsl(var(--destructive)/0.26)]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10 rounded-xl"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        className: cn(classes, (children as React.ReactElement<any>).props.className)
      });
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
