import type { UserRole } from "@prisma/client";

export type CrudAction = "create" | "read" | "update" | "delete" | "manage";
export type PermissionResource = "products" | "customers" | "suppliers" | "payments" | "invoices" | "purchases" | "staff" | "reports" | "settings" | "assistant";

export const OWNER_ROLES: UserRole[] = ["ADMIN", "MANAGER"] as UserRole[];
export const ALL_ROLES: UserRole[] = ["ADMIN", "MANAGER", "STAFF"] as UserRole[];

const RULES: Record<PermissionResource, Partial<Record<CrudAction, UserRole[]>>> = {
  products: { create: OWNER_ROLES, read: ALL_ROLES, update: OWNER_ROLES, delete: OWNER_ROLES, manage: OWNER_ROLES },
  customers: { create: ALL_ROLES, read: ALL_ROLES, update: ALL_ROLES, delete: OWNER_ROLES, manage: OWNER_ROLES },
  suppliers: { create: OWNER_ROLES, read: OWNER_ROLES, update: OWNER_ROLES, delete: OWNER_ROLES, manage: OWNER_ROLES },
  payments: { create: ALL_ROLES, read: ALL_ROLES, update: OWNER_ROLES, delete: OWNER_ROLES, manage: OWNER_ROLES },
  invoices: { create: ALL_ROLES, read: ALL_ROLES, update: OWNER_ROLES, delete: OWNER_ROLES, manage: OWNER_ROLES },
  purchases: { create: OWNER_ROLES, read: OWNER_ROLES, update: OWNER_ROLES, delete: OWNER_ROLES, manage: OWNER_ROLES },
  staff: { create: OWNER_ROLES, read: OWNER_ROLES, update: OWNER_ROLES, delete: OWNER_ROLES, manage: OWNER_ROLES },
  reports: { read: OWNER_ROLES },
  settings: { read: OWNER_ROLES, update: OWNER_ROLES, manage: OWNER_ROLES },
  assistant: { create: ALL_ROLES, read: ALL_ROLES }
};

export function can(role: UserRole | string | undefined | null, resource: PermissionResource, action: CrudAction) {
  if (!role) return false;
  const allowed = RULES[resource]?.[action];
  return Boolean(allowed?.includes(role as UserRole));
}

export function isManagerOrAdmin(role: UserRole | string | undefined | null) {
  return role === "ADMIN" || role === "MANAGER";
}

export function isAdmin(role: UserRole | string | undefined | null) {
  return role === "ADMIN";
}

export function canUsePaymentDirection(role: UserRole | string | undefined | null, direction: "CUSTOMER_IN" | "SUPPLIER_OUT" | string) {
  if (!can(role, "payments", "create")) return false;
  if (direction === "SUPPLIER_OUT") return isManagerOrAdmin(role);
  return direction === "CUSTOMER_IN";
}

export function canReadSupplierCashflow(role: UserRole | string | undefined | null) {
  return isManagerOrAdmin(role);
}

export function canCreateStaffRole(actorRole: UserRole | string | undefined | null, targetRole: UserRole | string | undefined | null) {
  if (!can(actorRole, "staff", "create")) return false;
  if (actorRole === "ADMIN") return targetRole === "ADMIN" || targetRole === "MANAGER" || targetRole === "STAFF";
  if (actorRole === "MANAGER") return targetRole === "STAFF";
  return false;
}

export function canManageStaffMember(actorRole: UserRole | string | undefined | null, targetRole: UserRole | string | undefined | null, targetUserId?: string | null, actorUserId?: string | null) {
  if (!can(actorRole, "staff", "update")) return false;
  if (targetUserId && actorUserId && targetUserId === actorUserId) return false;
  if (actorRole === "ADMIN") return true;
  if (actorRole === "MANAGER") return targetRole === "STAFF";
  return false;
}

export function assertCan(role: UserRole | string | undefined | null, resource: PermissionResource, action: CrudAction) {
  return can(role, resource, action);
}
