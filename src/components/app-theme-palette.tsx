"use client";
import { Palette } from "lucide-react";
import { useTheme, SHADCN_THEME_PRESETS, type ShadcnThemePreset } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
export function AppThemePalette({ className }: { className?: string }) {
  const { mounted, shadcnTheme, setShadcnTheme } = useTheme();
  return <label className={cn("glass-chip flex h-10 shrink-0 items-center gap-2 rounded-2xl px-3 text-sm", className)} title="Switch shadcn/tweakcn theme preset"><Palette className="h-4 w-4 text-primary" /><span className="hidden xl:inline text-muted-foreground">Theme</span><select value={mounted ? shadcnTheme : "original"} onChange={(event) => setShadcnTheme(event.target.value as ShadcnThemePreset)} className="max-w-[145px] bg-transparent text-sm font-medium outline-none sm:max-w-[180px]" aria-label="Application theme palette">{SHADCN_THEME_PRESETS.map((option) => <option key={option.value} value={option.value}>{option.shortLabel}</option>)}</select></label>;
}
