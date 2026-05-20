import { ReactNode } from "react";
import { MobileNav, Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";

export function AppShell({ nav, heading, currentPath, user, children }: { nav: Array<{ href: string; label: string }>; heading: string; currentPath?: string; user: { name: string; role: string } | null; children: ReactNode }) {
  return (
    <div className="app-shell-root relative flex h-dvh min-h-dvh overflow-hidden bg-background transition-colors duration-300">
      <Sidebar nav={nav} heading={heading} currentPath={currentPath} />
      <div className="app-shell-content flex h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar user={user} />
        <main className="app-main-scroll flex-1 overflow-y-auto overflow-x-hidden">
          <div className="page-enter mx-auto flex min-h-full w-full max-w-[1440px] flex-1 flex-col px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-7 lg:pt-6">{children}</div>
        </main>
      </div>
      <MobileNav nav={nav} currentPath={currentPath} />
    </div>
  );
}
