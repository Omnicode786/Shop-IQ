import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider, THEME_STORAGE_KEY, UI_MODE_STORAGE_KEY, SHADCN_THEME_STORAGE_KEY } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "ShopIQ",
  description: "AI-powered inventory and shop operating system",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    shortcut: ["/favicon.png"],
    apple: [{ url: "/apple-icon.png", type: "image/png" }]
  }
};

function ThemeScript() {
  const code = `(() => {try{const r=document.documentElement;const storedTheme=localStorage.getItem('${THEME_STORAGE_KEY}');const t=storedTheme==='light'||storedTheme==='dark'||storedTheme==='system'?storedTheme:'system';const storedMode=localStorage.getItem('${UI_MODE_STORAGE_KEY}');const m=storedMode==='classic'||storedMode==='glass'?storedMode:'glass';const storedPreset=localStorage.getItem('${SHADCN_THEME_STORAGE_KEY}');const presets=['original','tweakcn-claude','tweakcn-supabase','tweakcn-claymorphism','tweakcn-brutalist'];const p=presets.includes(storedPreset)?storedPreset:'original';const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);r.classList.toggle('dark',d);r.dataset.theme=d?'dark':'light';r.dataset.uiMode=m;r.dataset.shadcnTheme=p;r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><ThemeScript /></head><body><ThemeProvider>{children}</ThemeProvider></body></html>;
}
