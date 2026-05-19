"use client";

import { useEffect, useMemo, useState } from "react";
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
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  X
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
  const [open, setOpen] = useState(false);
  const current = activeItem(nav, currentPath);
  const CurrentIcon = iconFor(current);
  const quickItems = useMemo(() => {
    const preferred = ["dashboard", "billing", "products", "assistant"];
    const selected = preferred
      .map((key) => nav.find((item) => `${item.href} ${item.label}`.toLowerCase().includes(key)))
      .filter(Boolean) as NavItem[];
    return Array.from(new Map([current, ...selected, ...nav.slice(0, 4)].map((item) => [item.href, item])).values()).slice(0, 4);
  }, [current, nav]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [currentPath]);

  return (
    <>
      <div className="shopiq-mobile-dock fixed inset-x-3 z-40 lg:hidden" aria-label="Mobile navigation">
        <button type="button" className="mobile-menu-trigger" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls="shopiq-mobile-sidebar">
          <span className="mobile-menu-trigger-icon">
            <Menu className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="mobile-menu-trigger-kicker">Menu</span>
            <span className="mobile-menu-trigger-label">{shortLabel(current.label)}</span>
          </span>
        </button>
        <div className="mobile-dock-quick" aria-label="Quick destinations">
          {quickItems.slice(0, 3).map((item) => {
            const active = isActive(item, currentPath);
            const Icon = iconFor(item);
            return (
              <Link key={item.href} href={item.href} aria-label={item.label} title={item.label} className={cn("mobile-dock-link", active && "is-active")}>
                <Icon className="size-4" />
              </Link>
            );
          })}
        </div>
      </div>

      <div className={cn("mobile-sidebar-layer fixed inset-0 z-50 lg:hidden", open && "is-open")} aria-hidden={!open}>
        <button type="button" className="mobile-sidebar-backdrop" aria-label="Close navigation" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
        <aside id="shopiq-mobile-sidebar" role="dialog" aria-modal="true" aria-label="ShopIQ mobile navigation" className="mobile-sidebar-panel">
          <div className="mobile-sidebar-top">
            <div className="mobile-sidebar-brand">
              <span className="mobile-sidebar-mark">
                <Image src="/favicon.png" alt="ShopIQ" width={512} height={512} priority className="h-full w-full object-contain" />
              </span>
              <span className="min-w-0">
                <span className="mobile-sidebar-kicker">ShopIQ workspace</span>
                <span className="mobile-sidebar-title">{shortLabel(current.label)}</span>
              </span>
            </div>
            <button type="button" className="mobile-sidebar-close" onClick={() => setOpen(false)} aria-label="Close navigation">
              <X className="size-5" />
            </button>
          </div>

          <div className="mobile-sidebar-current">
            <div className="mobile-sidebar-current-icon">
              <CurrentIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <p>Now viewing</p>
              <strong>{current.label}</strong>
            </div>
          </div>

          <nav className="mobile-sidebar-nav" aria-label="Workspace destinations">
            {nav.map((item, index) => {
              const active = isActive(item, currentPath);
              const Icon = iconFor(item);

              return (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("mobile-sidebar-link", active && "is-active")} style={{ ["--item-delay" as string]: `${index * 24}ms` }}>
                  <span className="mobile-sidebar-link-icon">
                    <Icon className="size-5" />
                  </span>
                  <span className="truncate">{item.label}</span>
                  {active ? <span className="mobile-sidebar-active-dot" /> : null}
                </Link>
              );
            })}
          </nav>

          <div className="mobile-sidebar-quick">
            <p>Quick go to</p>
            <div>
              {quickItems.map((item) => {
                const active = isActive(item, currentPath);
                const Icon = iconFor(item);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("mobile-sidebar-quick-link", active && "is-active")} aria-label={item.label} title={item.label}>
                    <Icon className="size-4" />
                    <span>{shortLabel(item.label)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
