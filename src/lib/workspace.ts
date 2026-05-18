import type { UserRole } from "@prisma/client";
import { ADMIN_NAV, STAFF_NAV } from "@/lib/constants";

type WorkspaceModule = "dashboard" | "products" | "billing" | "customers" | "suppliers" | "payments" | "purchases" | "reports" | "assistant" | "staff" | "settings";

export function isAdminRole(role: UserRole | string | undefined | null) {
  return role === "ADMIN" || role === "MANAGER";
}

export function dashboardForRole(role: UserRole | string | undefined | null) {
  return isAdminRole(role) ? "/admin/dashboard" : "/staff/dashboard";
}

export function workspaceNav(role: UserRole | string | undefined | null) {
  return isAdminRole(role) ? ADMIN_NAV : STAFF_NAV;
}

export function workspaceHeading(role: UserRole | string | undefined | null) {
  return isAdminRole(role) ? "Shop Owner Workspace" : "Staff Workspace";
}

export function workspacePath(role: UserRole | string | undefined | null, module: WorkspaceModule) {
  const base = isAdminRole(role) ? "/admin" : "/staff";
  return `${base}/${module}`;
}
