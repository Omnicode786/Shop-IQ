"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { useLiquidBorderGlow } from "@/hooks/use-liquid-border-glow";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex max-w-full min-w-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-3 py-1 text-center text-[11px] font-medium leading-4 tracking-[0.01em] shadow-sm transition-[background-color,border-color,color,box-shadow]",
  {
    variants: {
      variant: {
        default: "glass-chip border-primary/20 bg-primary/10 text-primary dark:border-primary/20 dark:bg-primary/15",
        secondary: "glass-chip border-white/30 bg-secondary/80 text-secondary-foreground dark:bg-secondary/40",
        outline: "glass-chip border-white/30 bg-background/50 text-foreground dark:bg-card/40",
        success: "glass-chip border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        warning: "glass-chip border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        destructive: "glass-chip border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function isEmptyNode(node: React.ReactNode): boolean {
  if (node === null || node === undefined || typeof node === "boolean") return true;
  if (typeof node === "string") return node.trim().length === 0;
  if (typeof node === "number") return false;
  if (Array.isArray(node)) return node.every(isEmptyNode);
  return false;
}

function nodeTitle(node: React.ReactNode) {
  if (typeof node === "string" || typeof node === "number") return String(node).trim();
  return undefined;
}

export function Badge({
  className,
  variant,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  title,
  children,
  ...props
}: BadgeProps) {
  const {
    ref,
    resetLiquidBorderGlow,
    updateLiquidBorderGlow
  } = useLiquidBorderGlow<HTMLDivElement>();
  const derivedTitle = title ?? nodeTitle(children);

  if (isEmptyNode(children)) return null;

  return (
    <div
      ref={ref}
      title={derivedTitle || undefined}
      className={cn(
        badgeVariants({ variant }),
        "liquid-border-glow text-wrap-safe whitespace-normal",
        className
      )}
      onPointerMove={(event) => {
        updateLiquidBorderGlow(event);
        onPointerMove?.(event);
      }}
      onPointerEnter={(event) => {
        updateLiquidBorderGlow(event);
        onPointerEnter?.(event);
      }}
      onPointerLeave={(event) => {
        resetLiquidBorderGlow();
        onPointerLeave?.(event);
      }}
      {...props}
    >
      <span className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap">{children}</span>
    </div>
  );
}
