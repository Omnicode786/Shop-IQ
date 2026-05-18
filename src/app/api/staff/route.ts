import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { can, canCreateStaffRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { optionalText, requiredText } from "@/lib/validation";

const selectUser = { id: true, name: true, email: true, role: true, status: true, designation: true, phone: true, cnic: true, shift: true, branchArea: true, joiningDate: true, permissions: true, createdAt: true } as const;

const staffSchema = z.object({
  name: requiredText("Name"),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters.").default("demo12345"),
  role: z.enum(["ADMIN", "MANAGER", "STAFF"]).default("STAFF"),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).default("ACTIVE"),
  designation: optionalText(120),
  phone: optionalText(40),
  cnic: optionalText(20),
  shift: optionalText(80),
  branchArea: optionalText(120),
  joiningDate: z.coerce.date().optional(),
  permissions: z.record(z.any()).optional()
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "staff", "read")) return forbidden();
    const staff = await prisma.user.findMany({ where: { shopId: user.shopId }, orderBy: { createdAt: "desc" }, select: selectUser });
    return NextResponse.json({ staff });
  } catch (e) {
    return apiError(e, "Unable to load staff.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "staff", "create")) return forbidden();
    const data = staffSchema.parse(await request.json());
    if (!canCreateStaffRole(user.role, data.role)) return forbidden("You cannot create a member with that role.");
    const passwordHash = await bcrypt.hash(data.password, 12);
    const staff = await prisma.user.create({ data: { shopId: user.shopId, name: data.name, email: data.email, passwordHash, role: data.role, status: data.status, designation: data.designation, phone: data.phone, cnic: data.cnic, shift: data.shift, branchArea: data.branchArea, joiningDate: data.joiningDate, permissions: data.permissions }, select: selectUser });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "STAFF_CREATED", title: `Team member added: ${staff.name}`, details: `${staff.role} access created` } });
    return NextResponse.json({ staff });
  } catch (e) {
    return apiError(e, "Unable to create staff member.");
  }
}
