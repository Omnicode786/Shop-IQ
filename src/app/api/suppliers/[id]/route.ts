import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, badRequest, forbidden, notFound, unauthorized } from "@/lib/api-response";
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
  balanceAdjustment: money.optional(),
  balanceAdjustmentReason: nullableText(120),
  balanceAdjustmentNote: nullableText(600),
  reliabilityScore: z.coerce.number().int().min(0).max(100).optional(),
  notes: nullableText(600),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
}).refine((value) => !value.balanceAdjustment || value.balanceAdjustment === 0 || Boolean(value.balanceAdjustmentReason), {
  message: "A reason is required when adjusting the supplier balance.",
  path: ["balanceAdjustmentReason"]
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "update")) return forbidden();
    const raw = supplierUpdateSchema.parse(await request.json());
    const { balanceAdjustment, balanceAdjustmentReason, balanceAdjustmentNote, ...changes } = raw;
    const data = { ...changes, reliabilityScore: raw.reliabilityScore === undefined ? undefined : clamp(raw.reliabilityScore, 0, 100) };
    const supplier = await prisma.$transaction(async (tx) => {
      const existing = await tx.supplier.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { _count: { select: { purchases: true, payments: true } } } });
      if (!existing) throw new Error("SUPPLIER_NOT_FOUND");
      const updated = await tx.supplier.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(balanceAdjustment && balanceAdjustment !== 0 ? { balance: { increment: balanceAdjustment } } : {})
        },
        include: { _count: { select: { purchases: true, payments: true } } }
      });
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SUPPLIER_UPDATED", title: `Supplier updated: ${updated.name}` } });
      if (balanceAdjustment && balanceAdjustment !== 0) {
        await tx.activityLog.create({
          data: {
            shopId: user.shopId,
            userId: user.id,
            type: "SUPPLIER_BALANCE_ADJUSTMENT",
            title: `Payable adjusted for ${updated.name}`,
            details: `${balanceAdjustmentReason} (Diff: ${balanceAdjustment > 0 ? "+" : ""}${balanceAdjustment})`,
            metadata: { reason: balanceAdjustmentReason, note: balanceAdjustmentNote, delta: balanceAdjustment, beforeBalance: existing.balance, afterBalance: updated.balance }
          }
        });
      }
      return updated;
    });
    return NextResponse.json({ supplier });
  } catch (e) {
    if (e instanceof Error && e.message === "SUPPLIER_NOT_FOUND") return notFound("Supplier not found.");
    return apiError(e, "Unable to update supplier.");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "delete")) return forbidden();
    const supplier = await prisma.supplier.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { _count: { select: { products: true, purchases: true, payments: true } } } });
    if (!supplier) return notFound("Supplier not found.");
    if (supplier._count.purchases > 0 || supplier._count.payments > 0 || supplier._count.products > 0) {
      const updated = await prisma.supplier.update({ where: { id: supplier.id }, data: { status: "INACTIVE" } });
      await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SUPPLIER_DEACTIVATED", title: `Supplier made inactive: ${updated.name}` } });
      return NextResponse.json({ ok: true, supplier: updated });
    }
    await prisma.supplier.delete({ where: { id: params.id } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SUPPLIER_DELETED", title: `Supplier deleted: ${supplier.name}` } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Unable to delete supplier.");
  }
}
