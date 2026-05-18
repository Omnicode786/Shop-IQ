"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Search } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UiModeToggle } from "@/components/ui-mode-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-surface";
import { Input } from "@/components/ui/input";
import { isAdminRole } from "@/lib/workspace";

export function Topbar({ user }: { user: { name: string; role: string } | null }) {
  const displayUser = user || { name: "ShopIQ user", role: "USER" };
  const canViewReports = isAdminRole(displayUser.role);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="app-topbar sticky top-0 z-30 px-3 py-2 sm:px-5 lg:px-8">
      <GlassSurface className="nav-surface mx-auto w-full max-w-[1600px]" height={64} borderRadius={28} borderWidth={0.14} borderGlow refractive backgroundOpacity={0.045} brightness={50} opacity={0.52} blur={11} displace={0.46} distortionScale={-190} redOffset={0} greenOffset={10} blueOffset={22} mixBlendMode="screen" saturation={1.34} innerClassName="flex h-full min-w-0 items-center gap-2.5 px-3 py-2 sm:gap-3 sm:px-4">
        <div className="topbar-search relative hidden max-w-xl flex-1 md:block">
          <Search className="topbar-search-icon pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="topbar-search-input h-10 border-white/30 bg-white/35 pl-10 shadow-none dark:bg-white/5" placeholder="Search inventory, bills, customers, suppliers..." />
        </div>
        <div className="topbar-actions ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
          <UiModeToggle compact className="hidden min-[540px]:flex xl:hidden" />
          <UiModeToggle className="hidden xl:flex" />
          <ThemeToggle />
          {canViewReports ? (
            <Button variant="outline" size="icon" asChild className="shrink-0">
              <Link href="/admin/reports" title="Reports">
                <Bell className="size-4" />
              </Link>
            </Button>
          ) : null}
          <div className="glass-subtle flex min-w-0 items-center gap-2.5 rounded-2xl px-2.5 py-1.5 transition-colors duration-300">
            <Avatar name={displayUser.name} className="size-8 text-xs" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-medium">{displayUser.name}</p>
              <p className="text-xs capitalize text-muted-foreground">{displayUser.role.toLowerCase()}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={logout} disabled={loggingOut} title="Logout">
            <LogOut className="size-4" />
          </Button>
        </div>
      </GlassSurface>
    </div>
  );
}
