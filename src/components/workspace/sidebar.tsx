"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  CreditCard,
  FileBarChart,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string };

const railBars = [44, 72, 56, 86, 64, 78];

function iconFor(item: NavItem): LucideIcon {
  const text = `${item.href} ${item.label}`.toLowerCase();
  if (text.includes("dashboard")) return BarChart3;
  if (text.includes("product") || text.includes("inventory")) return Package;
  if (text.includes("billing") || text.includes("invoice")) return ReceiptText;
  if (text.includes("customer")) return Users;
  if (text.includes("supplier") || text.includes("purchase")) return Truck;
  if (text.includes("payment")) return CreditCard;
  if (text.includes("report")) return FileBarChart;
  if (text.includes("assistant") || text.includes("ai")) return Bot;
  if (text.includes("staff")) return UserCog;
  if (text.includes("setting")) return Settings;
  return ShoppingCart;
}

function shortLabel(label: string) {
  return label.replace("AI Assistant", "AI").replace("Inventory", "Stock");
}

function isActive(item: NavItem, currentPath?: string) {
  return currentPath === item.href || currentPath?.startsWith(`${item.href}/`);
}

function activeItem(nav: NavItem[], currentPath?: string) {
  return nav.find((item) => isActive(item, currentPath)) || nav[0];
}

export function Sidebar({ nav, heading, currentPath }: { nav: NavItem[]; heading: string; currentPath?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const current = activeItem(nav, currentPath);
  const CurrentIcon = iconFor(current);

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
    <aside className={cn("app-sidebar shopiq-sidebar sticky top-0 hidden h-screen shrink-0 p-4 transition-[width] duration-300 lg:flex", collapsed ? "w-[112px]" : "w-[360px]")}>
      <div className={cn("sidebar-shell nav-surface", collapsed && "is-collapsed")}>
        <div className="sidebar-rail" aria-label="Primary workspace shortcuts">
          <Link href="/" className="sidebar-mark" aria-label="ShopIQ home">
            <Image src="/favicon.png" alt="ShopIQ" width={512} height={512} priority className="h-full w-full object-contain" />
          </Link>

          <div className="sidebar-rail-links">
            {nav.slice(0, 8).map((item) => {
              const active = isActive(item, currentPath);
              const Icon = iconFor(item);

              return (
                <Link key={item.href} href={item.href} title={item.label} className={cn("sidebar-rail-link", active && "is-active")}>
                  <Icon className="size-5" />
                </Link>
              );
            })}
          </div>

          <div className="sidebar-rail-bottom">
            <Button variant="ghost" size="icon" className="sidebar-icon-button" onClick={() => setCollapsed((value) => !value)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
            <button type="button" onClick={logout} disabled={loggingOut} className="sidebar-logout-icon" title="Logout">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>

        {!collapsed ? (
          <div className="sidebar-panel">
            <div className="sidebar-brand">
              <div className="sidebar-brand-logo" aria-label="ShopIQ retail operating system">
                <Image src="/logo.png" alt="ShopIQ" width={1086} height={304} priority className="h-full w-full object-contain" />
              </div>
              <div className="sidebar-live-dot" aria-hidden="true" />
            </div>

            <div className="sidebar-pulse-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-white/42">Now viewing</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 text-white">
                      <CurrentIcon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-5 tracking-normal text-white">{current.label}</p>
                      <p className="truncate text-xs text-white/44">{heading}</p>
                    </div>
                  </div>
                </div>
                <span className="sidebar-status-pill">Live</span>
              </div>
              <div className="sidebar-mini-bars" aria-hidden="true">
                {railBars.map((height, index) => (
                  <span key={`${height}-${index}`} style={{ height: `${height}%`, animationDelay: `${index * 42}ms` }} />
                ))}
              </div>
            </div>

            <nav className="sidebar-nav-list" aria-label={heading}>
              {nav.map((item) => {
                const active = isActive(item, currentPath);
                const Icon = iconFor(item);

                return (
                  <Link key={item.href} href={item.href} className={cn("sidebar-nav-item", active && "is-active")}>
                    <span className="sidebar-nav-icon">
                      <Icon className="size-5" />
                    </span>
                    <span className="truncate">{item.label}</span>
                    {active ? <span className="sidebar-nav-indicator" /> : null}
                  </Link>
                );
              })}
            </nav>

            <div className="sidebar-footer-card">
              <p className="text-xs font-medium text-white/76">{loggingOut ? "Closing workspace..." : "Role based control"}</p>
              <p className="mt-1 text-xs leading-5 text-white/42">Every module respects your access level and keeps records protected.</p>
              <button type="button" onClick={logout} disabled={loggingOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.08] px-3 py-2.5 text-sm text-white/72 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-70">
                <LogOut className="size-4" />
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function MobileNav({ nav, currentPath }: { nav: NavItem[]; currentPath?: string }) {
  return (
    <nav className="shopiq-mobile-nav fixed inset-x-3 bottom-3 z-40 flex gap-1.5 overflow-x-auto rounded-[1.5rem] border p-2 lg:hidden" aria-label="Mobile navigation">
      {nav.map((item) => {
        const active = isActive(item, currentPath);
        const Icon = iconFor(item);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            title={item.label}
            className={cn(
              "mobile-nav-link flex h-12 flex-none items-center justify-center gap-2 rounded-2xl px-3 text-[11px] font-medium transition",
              active ? "is-active min-w-[5.4rem] bg-primary text-primary-foreground shadow-sm" : "min-w-12 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {active ? <span className="hidden max-w-14 truncate min-[360px]:inline">{shortLabel(item.label)}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
