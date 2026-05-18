import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, conflict, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { clamp, money, nullableEmail, nullableText, requiredText } from "@/lib/validation";

const supplierUpdateSchema = z.object({
  name: requiredText("Supplier name").optional(),
  phone: nullableText(40),
  email: nullableEmail,
  address: nullableText(220),
  contactPerson: nullableText(120),
  paymentTerms: nullableText(120),
  ntn: nullableText(80),
  gstNumber: nullableText(80),
  leadTimeDays: z.coerce.number().int().min(0).nullable().optional(),
  supplierType: nullableText(100),
  balance: money.optional(),
  reliabilityScore: z.coerce.number().int().min(0).max(100).optional(),
  notes: nullableText(600)
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "update")) return forbidden();
    const raw = supplierUpdateSchema.parse(await request.json());
    const data = { ...raw, reliabilityScore: raw.reliabilityScore === undefined ? undefined : clamp(raw.reliabilityScore, 0, 100) };
    const result = await prisma.supplier.updateMany({ where: { id: params.id, shopId: user.shopId }, data });
    if (!result.count) return notFound("Supplier not found.");
    const supplier = await prisma.supplier.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { purchases: true, payments: true } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SUPPLIER_UPDATED", title: `Supplier updated: ${supplier?.name || params.id}` } });
    return NextResponse.json({ supplier });
  } catch (e) {
    return apiError(e, "Unable to update supplier.");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "delete")) return forbidden();
    const supplier = await prisma.supplier.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { purchases: { select: { id: true }, take: 1 }, payments: { select: { id: true }, take: 1 } } });
    if (!supplier) return notFound("Supplier not found.");
    if (supplier.purchases.length || supplier.payments.length) return conflict("This supplier has purchases or payments. Edit the supplier instead of deleting it.");
    await prisma.supplier.delete({ where: { id: params.id } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SUPPLIER_DELETED", title: `Supplier deleted: ${supplier.name}` } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Unable to delete supplier.");
  }
}
