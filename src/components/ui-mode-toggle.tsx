"use client";

import { Layers3, Palette, Sparkles } from "lucide-react";
import {
  SHADCN_THEME_PRESETS,
  type ShadcnThemePreset,
  type UiMode,
  useTheme
} from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function UiModeToggle({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { mounted, uiMode, setUiMode, shadcnTheme, setShadcnTheme } = useTheme();
  const activeUiMode = mounted ? uiMode : "glass";
  const activePreset = mounted ? shadcnTheme : "original";

  return (
    <div
      className={cn(
        "theme-studio group flex shrink-0 items-center gap-2 rounded-2xl border border-white/35 bg-white/35 p-1 shadow-sm transition dark:border-white/10 dark:bg-white/5",
        compact && "gap-1 rounded-xl p-0.5",
        className
      )}
      title="ShopIQ shadcn/tweakcn theme studio"
    >
      <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary xl:flex">
        <Palette className="h-4 w-4" />
      </div>
      <label className="sr-only" htmlFor="shopiq-ui-mode-select">UI mode</label>
      <div className="relative">
        {activeUiMode === "glass" ? <Sparkles className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" /> : <Layers3 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />}
        <select
          id="shopiq-ui-mode-select"
          value={activeUiMode}
          onChange={(event) => setUiMode(event.target.value as UiMode)}
          className={cn("h-8 rounded-xl border border-white/30 bg-background/80 py-0 pl-7 pr-7 text-xs font-medium outline-none transition focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-background/60", compact ? "w-[92px]" : "w-[118px]")}
        >
          <option value="classic">Classic</option>
          <option value="glass">Liquid</option>
        </select>
      </div>
      <label className="sr-only" htmlFor="shopiq-theme-preset-select">shadcn theme preset</label>
      <select
        id="shopiq-theme-preset-select"
        value={activePreset}
        onChange={(event) => setShadcnTheme(event.target.value as ShadcnThemePreset)}
        className={cn("h-8 rounded-xl border border-white/30 bg-background/80 px-3 text-xs font-semibold outline-none transition focus:ring-2 focus:ring-primary/30 dark:border-white/10 dark:bg-background/60", compact ? "w-[112px]" : "w-[152px]")}
      >
        {SHADCN_THEME_PRESETS.map((preset) => <option key={preset.value} value={preset.value}>{compact ? preset.shortLabel : preset.label}</option>)}
      </select>
    </div>
  );
}
