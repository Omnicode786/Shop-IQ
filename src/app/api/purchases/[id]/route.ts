import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, badRequest, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { syncAutomaticPurchasePayment } from "@/lib/supplier-payment-workflow";
import { money, nullableId, nullableText } from "@/lib/validation";

const purchaseUpdateSchema = z.object({
  supplierId: nullableId,
  status: z.enum(["ORDERED", "RECEIVED", "PARTIAL", "CANCELLED"]).optional(),
  total: money.optional(),
  paidAmount: money.optional(),
  purchaseDate: z.coerce.date().optional(),
  notes: nullableText(600)
});

async function cancelPurchase(user: { id: string; shopId: string }, purchaseId: string) {
  const existing = await prisma.purchase.findFirst({ where: { id: purchaseId, shopId: user.shopId }, include: { items: true, payments: true } });
  if (!existing) return notFound("Purchase not found.");
  if (existing.status === "CANCELLED") return NextResponse.json({ ok: true });
  if (Number(existing.paidAmount || 0) > 0 || existing.payments.length > 0) {
    return badRequest("Cannot cancel a purchase with supplier payments. Reverse or settle the supplier payment records first.");
  }
  const products = await prisma.product.findMany({ where: { shopId: user.shopId, id: { in: existing.items.map((item) => item.productId) } }, select: { id: true, name: true, stockQty: true, costPrice: true } });
  const productMap = new Map(products.map((product) => [product.id, product]));
  const demand = new Map<string, number>();
  for (const item of existing.items) demand.set(item.productId, (demand.get(item.productId) || 0) + item.quantity);
  for (const [productId, required] of demand) {
    const product = productMap.get(productId);
    if (product && product.stockQty < required) return badRequest(`Cannot cancel this purchase because ${product.name} has only ${product.stockQty} units in stock.`);
  }
  await prisma.$transaction(async (tx) => {
    if (existing.supplierId && Number(existing.dueAmount) > 0) await tx.supplier.update({ where: { id: existing.supplierId }, data: { balance: { decrement: Number(existing.dueAmount) } } });
    const runningStock = new Map(products.map((product) => [product.id, product.stockQty]));
    const productCostMap = new Map(products.map((product) => [product.id, Number(product.costPrice || 0)]));
    for (const item of existing.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      const beforeQty = runningStock.get(item.productId) ?? product.stockQty;
      const beforeCost = productCostMap.get(item.productId) ?? Number(product.costPrice || 0);
      const afterQty = beforeQty - item.quantity;
      runningStock.set(item.productId, afterQty);

      let revertedCost = beforeCost;
      if (afterQty > 0) {
        const itemUnitCost = Number(item.unitCost || 0);
        revertedCost = ((beforeQty * beforeCost) - (item.quantity * itemUnitCost)) / afterQty;
        if (revertedCost < 0) revertedCost = 0;
      }

      await tx.product.update({ 
        where: { id: item.productId }, 
        data: { 
          stockQty: { decrement: item.quantity },
          costPrice: revertedCost
        } 
      });
      await tx.stockMovement.create({ data: { shopId: user.shopId, productId: item.productId, userId: user.id, type: "RETURN_OUT", quantity: -item.quantity, beforeQty, afterQty, reference: existing.purchaseNo, notes: "Purchase cancellation stock reversal" } });
    }
    await tx.purchase.update({ where: { id: existing.id }, data: { status: "CANCELLED", paidAmount: 0, dueAmount: 0 } });
    await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PURCHASE_CANCELLED", title: `Purchase ${existing.purchaseNo} cancelled` } });
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "purchases", "update")) return forbidden();
    const existing = await prisma.purchase.findFirst({ where: { id: params.id, shopId: user.shopId } });
    const data = purchaseUpdateSchema.parse(await request.json());
    if (!existing) return notFound("Purchase not found.");
    if (data.status === "CANCELLED") return cancelPurchase(user, params.id);
    if (existing.status === "CANCELLED") return badRequest("Cancelled purchases cannot be edited.");
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, shopId: user.shopId, status: "ACTIVE" }, select: { id: true } });
      if (!supplier) return notFound("Supplier not found.");
    }
    const nextTotal = Number(data.total ?? existing.total);
    const requestedPaid = Number(data.paidAmount ?? existing.paidAmount);
    if (requestedPaid > nextTotal) return badRequest("Paid amount cannot exceed purchase total.");
    const nextPaid = requestedPaid;
    const nextDue = Math.max(nextTotal - nextPaid, 0);
    const nextSupplierId = data.supplierId !== undefined ? data.supplierId || null : existing.supplierId;
    if (!nextSupplierId) return badRequest("A purchase must stay linked to a supplier so payables and supplier payments remain traceable.");
    const updateData = { ...data, supplierId: nextSupplierId, subtotal: nextTotal, total: nextTotal, paidAmount: nextPaid, dueAmount: nextDue };
    const purchase = await prisma.$transaction(async (tx) => {
      if (existing.supplierId && Number(existing.dueAmount) > 0) await tx.supplier.update({ where: { id: existing.supplierId }, data: { balance: { decrement: Number(existing.dueAmount) } } });
      if (nextSupplierId && nextDue > 0 && updateData.status !== "CANCELLED") await tx.supplier.update({ where: { id: nextSupplierId }, data: { balance: { increment: nextDue } } });
      const updated = await tx.purchase.update({ where: { id: existing.id }, data: updateData, include: { supplier: true, items: { include: { product: true } } } });
      await syncAutomaticPurchasePayment(tx, {
        shopId: user.shopId,
        purchase: updated,
        amount: nextPaid,
        purchasePaidAmount: nextPaid,
        method: "CASH",
        createdById: user.id
      });
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PURCHASE_UPDATED", title: `Purchase ${updated.purchaseNo} updated` } });
      return updated;
    });
    return NextResponse.json({ purchase });
  } catch (e) {
    return apiError(e, "Unable to update purchase.");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "purchases", "delete")) return forbidden();
    return cancelPurchase(user, params.id);
  } catch (e) {
    return apiError(e, "Unable to cancel purchase.");
  }
}
