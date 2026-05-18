import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, badRequest, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can, canCreateStaffRole, canManageStaffMember } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { nullableText, requiredText } from "@/lib/validation";

const selectUser = { id: true, name: true, email: true, role: true, status: true, designation: true, phone: true, cnic: true, shift: true, branchArea: true, joiningDate: true, permissions: true, createdAt: true } as const;

const staffUpdateSchema = z.object({
  name: requiredText("Name").optional(),
  email: z.string().trim().email().toLowerCase().optional(),
  password: z.preprocess((value) => (String(value || "").trim() ? value : undefined), z.string().min(8).optional()),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]).optional(),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).optional(),
  designation: nullableText(120),
  phone: nullableText(40),
  cnic: nullableText(20),
  shift: nullableText(80),
  branchArea: nullableText(120),
  joiningDate: z.coerce.date().nullable().optional(),
  permissions: z.record(z.any()).nullable().optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "staff", "update")) return forbidden();
    const target = await prisma.user.findFirst({ where: { id: params.id, shopId: user.shopId } });
    if (!target) return notFound("Team member not found.");
    const data = staffUpdateSchema.parse(await request.json());
    if (!canManageStaffMember(user.role, target.role, target.id, user.id)) return forbidden("You cannot manage this team member.");
    if (data.role !== undefined && !canCreateStaffRole(user.role, data.role)) return forbidden("You cannot assign that role.");
    const updateData: Record<string, unknown> = { ...data };
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }
    delete updateData.password;
    const staff = await prisma.user.update({ where: { id: params.id }, data: updateData, select: selectUser });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "STAFF_UPDATED", title: `Team member updated: ${staff.name}` } });
    return NextResponse.json({ staff });
  } catch (e) {
    return apiError(e, "Unable to update team member.");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "staff", "delete")) return forbidden();
    if (user.id === params.id) return badRequest("You cannot suspend your own account.");
    const target = await prisma.user.findFirst({ where: { id: params.id, shopId: user.shopId } });
    if (!target) return notFound("Team member not found.");
    if (!canManageStaffMember(user.role, target.role, target.id, user.id)) return forbidden("You cannot suspend this team member.");
    const staff = await prisma.user.update({ where: { id: params.id }, data: { status: "SUSPENDED" }, select: selectUser });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "STAFF_SUSPENDED", title: `Team member suspended: ${staff.name}` } });
    return NextResponse.json({ staff });
  } catch (e) {
    return apiError(e, "Unable to suspend team member.");
  }
}
