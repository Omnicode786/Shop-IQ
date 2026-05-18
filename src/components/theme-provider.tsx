"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

export type ThemeSetting = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";
export type UiMode = "classic" | "glass";
export type ShadcnThemePreset =
  | "original"
  | "tweakcn-claude"
  | "tweakcn-supabase"
  | "tweakcn-claymorphism"
  | "tweakcn-brutalist";

const THEME_STORAGE_KEY = "shopiq-theme";
const UI_MODE_STORAGE_KEY = "shopiq-ui-mode";
const SHADCN_THEME_STORAGE_KEY = "shopiq-shadcn-theme";
const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export const SHADCN_THEME_PRESETS: Array<{
  value: ShadcnThemePreset;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  { value: "original", label: "Original ShopIQ", shortLabel: "Original", description: "The default clean MIZAN-style ShopIQ interface." },
  { value: "tweakcn-claude", label: "TweakCN Claude", shortLabel: "Claude", description: "Warm editorial surfaces, amber accents, and softer reading panels." },
  { value: "tweakcn-supabase", label: "TweakCN Supabase", shortLabel: "Supabase", description: "Crisp green SaaS surfaces inspired by modern developer dashboards." },
  { value: "tweakcn-claymorphism", label: "TweakCN Claymorphism", shortLabel: "Clay", description: "Large pill shapes, pastel panels, and tactile soft shadows." },
  { value: "tweakcn-brutalist", label: "TweakCN Brutalist", shortLabel: "Brutal", description: "Bold borders, hard shadows, and high-contrast operating panels." }
];

type ThemeContextValue = {
  mounted: boolean;
  theme: ThemeSetting;
  resolvedTheme: ResolvedTheme;
  uiMode: UiMode;
  shadcnTheme: ShadcnThemePreset;
  setTheme: (theme: ThemeSetting) => void;
  toggleTheme: () => void;
  setUiMode: (mode: UiMode) => void;
  toggleUiMode: () => void;
  setShadcnTheme: (theme: ShadcnThemePreset) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: ThemeSetting, prefersDark: boolean): ResolvedTheme {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

function applyUiMode(mode: UiMode) {
  document.documentElement.dataset.uiMode = mode;
}

function applyShadcnTheme(theme: ShadcnThemePreset) {
  document.documentElement.dataset.shadcnTheme = theme;
}

function isThemePreset(value: string | null): value is ShadcnThemePreset {
  return SHADCN_THEME_PRESETS.some((preset) => preset.value === value);
}

function getStoredTheme(): ThemeSetting {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
}

function getStoredUiMode(): UiMode {
  const storedMode = window.localStorage.getItem(UI_MODE_STORAGE_KEY);
  return storedMode === "classic" ? "classic" : "glass";
}

function getStoredShadcnTheme(): ShadcnThemePreset {
  const storedTheme = window.localStorage.getItem(SHADCN_THEME_STORAGE_KEY);
  return isThemePreset(storedTheme) ? storedTheme : "original";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<ThemeSetting>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [uiMode, setUiModeState] = useState<UiMode>("glass");
  const [shadcnTheme, setShadcnThemeState] = useState<ShadcnThemePreset>("original");

  useEffect(() => {
    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
    const storedTheme = getStoredTheme();
    const storedUiMode = getStoredUiMode();
    const storedShadcnTheme = getStoredShadcnTheme();
    const nextResolvedTheme = resolveTheme(storedTheme, mediaQuery.matches);

    setThemeState(storedTheme);
    setResolvedTheme(nextResolvedTheme);
    setUiModeState(storedUiMode);
    setShadcnThemeState(storedShadcnTheme);
    applyTheme(nextResolvedTheme);
    applyUiMode(storedUiMode);
    applyShadcnTheme(storedShadcnTheme);
    setMounted(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        const nextTheme = event.newValue === "light" || event.newValue === "dark" || event.newValue === "system" ? event.newValue : "system";
        const nextThemeResolved = resolveTheme(nextTheme, mediaQuery.matches);
        setThemeState(nextTheme);
        setResolvedTheme(nextThemeResolved);
        applyTheme(nextThemeResolved);
      }
      if (event.key === UI_MODE_STORAGE_KEY) {
        const nextUiMode = event.newValue === "classic" ? "classic" : "glass";
        setUiModeState(nextUiMode);
        applyUiMode(nextUiMode);
      }
      if (event.key === SHADCN_THEME_STORAGE_KEY) {
        const nextPreset = isThemePreset(event.newValue) ? event.newValue : "original";
        setShadcnThemeState(nextPreset);
        applyShadcnTheme(nextPreset);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
    const onMediaChange = (event: MediaQueryListEvent) => {
      if (theme !== "system") return;
      const nextResolvedTheme = resolveTheme("system", event.matches);
      setResolvedTheme(nextResolvedTheme);
      applyTheme(nextResolvedTheme);
    };
    mediaQuery.addEventListener("change", onMediaChange);
    return () => mediaQuery.removeEventListener("change", onMediaChange);
  }, [mounted, theme]);

  const setTheme = useCallback((nextTheme: ThemeSetting) => {
    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
    const nextResolvedTheme = resolveTheme(nextTheme, mediaQuery.matches);
    setThemeState(nextTheme);
    setResolvedTheme(nextResolvedTheme);
    if (nextTheme === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextResolvedTheme);
  }, []);

  const toggleTheme = useCallback(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"), [resolvedTheme, setTheme]);

  const setUiMode = useCallback((nextUiMode: UiMode) => {
    setUiModeState(nextUiMode);
    window.localStorage.setItem(UI_MODE_STORAGE_KEY, nextUiMode);
    applyUiMode(nextUiMode);
  }, []);

  const toggleUiMode = useCallback(() => setUiMode(uiMode === "glass" ? "classic" : "glass"), [setUiMode, uiMode]);

  const setShadcnTheme = useCallback((nextTheme: ShadcnThemePreset) => {
    setShadcnThemeState(nextTheme);
    window.localStorage.setItem(SHADCN_THEME_STORAGE_KEY, nextTheme);
    applyShadcnTheme(nextTheme);
  }, []);

  const value = useMemo(
    () => ({ mounted, theme, resolvedTheme, uiMode, shadcnTheme, setTheme, toggleTheme, setUiMode, toggleUiMode, setShadcnTheme }),
    [mounted, theme, resolvedTheme, uiMode, shadcnTheme, setTheme, toggleTheme, setUiMode, toggleUiMode, setShadcnTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}

export { THEME_STORAGE_KEY, UI_MODE_STORAGE_KEY, SHADCN_THEME_STORAGE_KEY };
