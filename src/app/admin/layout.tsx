import type { ReactNode } from "react";
import { AppShell } from "@/components/workspace/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { workspaceHeading, workspaceNav } from "@/lib/workspace";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <AppShell nav={workspaceNav(user?.role)} heading={workspaceHeading(user?.role)} user={user}>
      {children}
    </AppShell>
  );
}
