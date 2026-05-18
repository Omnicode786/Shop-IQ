import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { clamp, money, optionalEmail, optionalText, requiredText } from "@/lib/validation";

const supplierSchema = z.object({
  name: requiredText("Supplier name"),
  phone: optionalText(40),
  email: optionalEmail,
  address: optionalText(220),
  contactPerson: optionalText(120),
  paymentTerms: optionalText(120),
  ntn: optionalText(80),
  gstNumber: optionalText(80),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  supplierType: optionalText(100),
  balance: money.optional(),
  reliabilityScore: z.coerce.number().int().min(0).max(100).default(80),
  notes: optionalText(600)
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "read")) return forbidden();
    const suppliers = await prisma.supplier.findMany({ where: { shopId: user.shopId }, include: { purchases: true, payments: true }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ suppliers });
  } catch (e) {
    return apiError(e, "Unable to load suppliers.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "create")) return forbidden();
    const data = supplierSchema.parse(await request.json());
    const supplier = await prisma.supplier.create({ data: { shopId: user.shopId, ...data, reliabilityScore: clamp(data.reliabilityScore, 0, 100) } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SUPPLIER_CREATED", title: `Supplier added: ${supplier.name}` } });
    return NextResponse.json({ supplier });
  } catch (e) {
    return apiError(e, "Unable to create supplier.");
  }
}
