import { ReactNode } from "react";
import { MobileNav, Sidebar } from "@/components/workspace/sidebar";
import { Topbar } from "@/components/workspace/topbar";

export function AppShell({ nav, heading, currentPath, user, children }: { nav: Array<{ href: string; label: string }>; heading: string; currentPath?: string; user: { name: string; role: string } | null; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-x-hidden bg-background transition-colors duration-300">
      <Sidebar nav={nav} heading={heading} currentPath={currentPath} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Topbar user={user} />
        <main className="flex-1 overflow-x-hidden">
          <div className="page-enter mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-5 lg:px-8 lg:pb-7 lg:pt-7">{children}</div>
        </main>
      </div>
      <MobileNav nav={nav} currentPath={currentPath} />
    </div>
  );
}
