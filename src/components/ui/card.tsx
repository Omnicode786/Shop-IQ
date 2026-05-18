"use client";

import * as React from "react";
import { useLiquidBorderGlow } from "@/hooks/use-liquid-border-glow";
import { cn } from "@/lib/utils";

export function Card({
  className,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const {
    ref,
    resetLiquidBorderGlow,
    updateLiquidBorderGlow
  } = useLiquidBorderGlow<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "surface-card liquid-border-glow min-w-0 text-card-foreground",
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
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 flex-col gap-2 p-6", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold tracking-tight", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 items-center p-6 pt-0", className)} {...props} />;
}
