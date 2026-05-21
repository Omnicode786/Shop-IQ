"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check, Layers3, Monitor, MoonStar, Palette, Sparkles, SunMedium } from "lucide-react";
import {
  SHADCN_THEME_PRESETS,
  type ShadcnThemePreset,
  type ThemeSetting,
  type UiMode,
  useTheme
} from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SettingsTab = "profile" | "appearance";

const displayModes: Array<{
  value: ThemeSetting;
  label: string;
  description: string;
  icon: typeof Monitor;
}> = [
  { value: "system", label: "System", description: "Follow the device setting automatically.", icon: Monitor },
  { value: "light", label: "Light", description: "Use ShopIQ's clean daylight interface.", icon: SunMedium },
  { value: "dark", label: "Dark", description: "Use the darker command-center interface.", icon: MoonStar }
];

const uiModes: Array<{
  value: UiMode;
  label: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  { value: "glass", label: "Liquid glass", description: "Soft glass surfaces with the premium ShopIQ glow.", icon: Sparkles },
  { value: "classic", label: "Classic", description: "A simpler SaaS surface system with less glass.", icon: Layers3 }
];

export function SettingsTabs({ profilePanel }: { profilePanel: ReactNode }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const tabs = useMemo(
    () => [
      { value: "profile" as const, label: "Profile", description: "Shop identity" },
      { value: "appearance" as const, label: "Appearance", description: "Themes and modes" }
    ],
    []
  );

  return (
    <div className="space-y-5">
      <div className="surface-card liquid-border-glow flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex min-h-14 flex-1 items-center justify-between rounded-2xl px-4 py-3 text-left transition",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[0_14px_34px_hsl(var(--primary)/0.22)]"
                  : "text-muted-foreground hover:bg-muted/55 hover:text-foreground"
              )}
              aria-pressed={isActive}
            >
              <span>
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className={cn("mt-0.5 block text-xs", isActive ? "text-primary-foreground/75" : "text-muted-foreground")}>
                  {tab.description}
                </span>
              </span>
              {isActive ? <Check className="size-4" /> : null}
            </button>
          );
        })}
      </div>

      {activeTab === "profile" ? profilePanel : <AppearanceSettingsPanel />}
    </div>
  );
}

export function AppearanceSettingsPanel() {
  const { mounted, theme, resolvedTheme, uiMode, shadcnTheme, setTheme, setUiMode, setShadcnTheme } = useTheme();
  const activeTheme = mounted ? theme : "system";
  const activeResolvedTheme = mounted ? resolvedTheme : "light";
  const activeUiMode = mounted ? uiMode : "glass";
  const activePreset = mounted ? shadcnTheme : "original";

  return (
    <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Theme controls now live here, with the same saved preferences used across the whole workspace.
              </CardDescription>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Palette className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold">Color mode</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Current surface resolves to {activeResolvedTheme} mode.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {displayModes.map((mode) => (
                <ThemeChoice
                  key={mode.value}
                  icon={mode.icon}
                  label={mode.label}
                  description={mode.description}
                  active={activeTheme === mode.value}
                  onClick={() => setTheme(mode.value)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-semibold">UI mode</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Switch between the classic ShopIQ interface and liquid glass mode.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {uiModes.map((mode) => (
                <ThemeChoice
                  key={mode.value}
                  icon={mode.icon}
                  label={mode.label}
                  description={mode.description}
                  active={activeUiMode === mode.value}
                  onClick={() => setUiMode(mode.value)}
                />
              ))}
            </div>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Theme preset</CardTitle>
          <CardDescription>
            Pick the same ShopIQ and TweakCN palettes that were previously available from the navbar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {SHADCN_THEME_PRESETS.map((preset) => (
              <PresetChoice
                key={preset.value}
                preset={preset}
                active={activePreset === preset.value}
                onClick={() => setShadcnTheme(preset.value)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ThemeChoice({
  icon: Icon,
  label,
  description,
  active,
  onClick
}: {
  icon: typeof Monitor;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      className={cn("h-auto justify-start whitespace-normal rounded-2xl px-4 py-4 text-left", active && "shadow-[0_14px_32px_hsl(var(--primary)/0.22)]")}
      onClick={onClick}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className={cn("mt-1 block text-xs leading-5", active ? "text-primary-foreground/75" : "text-muted-foreground")}>
          {description}
        </span>
      </span>
    </Button>
  );
}

function PresetChoice({
  preset,
  active,
  onClick
}: {
  preset: (typeof SHADCN_THEME_PRESETS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group min-h-28 rounded-2xl border p-4 text-left transition",
        active
          ? "border-primary/45 bg-primary/10 shadow-[0_16px_36px_hsl(var(--primary)/0.14)]"
          : "border-border/70 bg-background/45 hover:border-primary/30 hover:bg-muted/40"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{preset.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{preset.description}</p>
        </div>
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border transition",
            active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/45 text-transparent"
          )}
        >
          <Check className="size-3.5" />
        </span>
      </div>
      <ThemeSwatches preset={preset.value} />
    </button>
  );
}

function ThemeSwatches({ preset }: { preset: ShadcnThemePreset }) {
  const swatches: Record<ShadcnThemePreset, string[]> = {
    original: ["bg-slate-950", "bg-blue-500", "bg-cyan-400", "bg-orange-500", "bg-white"],
    "tweakcn-claude": ["bg-stone-900", "bg-orange-500", "bg-amber-200", "bg-orange-100"],
    "tweakcn-supabase": ["bg-emerald-950", "bg-emerald-500", "bg-teal-200", "bg-white"],
    "tweakcn-claymorphism": ["bg-violet-950", "bg-violet-500", "bg-pink-200", "bg-white"],
    "tweakcn-brutalist": ["bg-black", "bg-yellow-400", "bg-sky-400", "bg-white"]
  };

  return (
    <div className="mt-4 flex items-center gap-1.5">
      {swatches[preset].map((swatch, index) => (
        <span key={`${preset}-${index}`} className={cn("h-2.5 flex-1 rounded-full", swatch)} />
      ))}
    </div>
  );
}
