"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { useTheme } from "@/components/theme-provider";
import {
  resetLiquidBorderGlow as resetLiquidBorderGlowStyle,
  updateLiquidBorderGlow
} from "@/lib/liquid-border-glow";

export function useLiquidBorderGlow<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  const { mounted, resolvedTheme, uiMode } = useTheme();
  const isDarkMode = mounted ? resolvedTheme === "dark" : false;
  const isGlassMode = mounted ? uiMode === "glass" : false;

  const resetLiquidBorderGlow = useCallback(() => {
    const element = ref.current;
    if (!element) return;

    resetLiquidBorderGlowStyle(element, isDarkMode);
  }, [isDarkMode]);

  const updateLiquidBorderGlowFromPointer = useCallback(
    (event: PointerEvent<T>) => {
      const element = ref.current;
      if (!enabled || !isGlassMode || !element) return;

      updateLiquidBorderGlow(element, event.clientX, event.clientY, isDarkMode);
    },
    [enabled, isDarkMode, isGlassMode]
  );

  useEffect(() => {
    if (enabled) {
      resetLiquidBorderGlow();
    }
  }, [enabled, isDarkMode, isGlassMode, resetLiquidBorderGlow]);

  return {
    ref,
    resetLiquidBorderGlow,
    updateLiquidBorderGlow: updateLiquidBorderGlowFromPointer
  };
}
