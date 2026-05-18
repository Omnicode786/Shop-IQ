import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { money, optionalId, optionalText, positiveIntQty, positiveMoney } from "@/lib/validation";

const purchaseItemSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveIntQty,
  unitCost: positiveMoney
});

const purchaseSchema = z.object({
  supplierId: optionalId,
  purchaseNo: optionalText(80),
  paidAmount: money,
  purchaseDate: z.coerce.date().optional(),
  notes: optionalText(600),
  items: z.array(purchaseItemSchema).min(1, "Add at least one item.")
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "purchases", "read")) return forbidden();
    const purchases = await prisma.purchase.findMany({ where: { shopId: user.shopId }, include: { supplier: true, items: { include: { product: true } } }, orderBy: { purchaseDate: "desc" }, take: 150 });
    return NextResponse.json({ purchases });
  } catch (e) {
    return apiError(e, "Unable to load purchases.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "purchases", "create")) return forbidden();
    const data = purchaseSchema.parse(await request.json());
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, shopId: user.shopId }, select: { id: true } });
      if (!supplier) return notFound("Supplier not found.");
    }
    const products = await prisma.product.findMany({ where: { shopId: user.shopId, id: { in: data.items.map((item) => item.productId) } } });
    const productMap = new Map(products.map((product) => [product.id, product]));
    for (const item of data.items) if (!productMap.has(item.productId)) return notFound("One of the selected products was not found.");
    const total = data.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
    const paid = Math.min(data.paidAmount, total);
    const due = Math.max(total - paid, 0);
    const purchase = await prisma.$transaction(async (tx) => {
      const pur = await tx.purchase.create({
        data: {
          shopId: user.shopId,
          supplierId: data.supplierId || null,
          createdById: user.id,
          purchaseNo: data.purchaseNo || `PUR-${Date.now()}`,
          subtotal: total,
          total,
          paidAmount: paid,
          dueAmount: due,
          status: "RECEIVED",
          purchaseDate: data.purchaseDate,
          notes: data.notes,
          items: { create: data.items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.unitCost, total: item.quantity * item.unitCost })) }
        },
        include: { supplier: true, items: { include: { product: true } } }
      });
      const runningStock = new Map(products.map((product) => [product.id, product.stockQty]));
      for (const item of data.items) {
        const beforeQty = runningStock.get(item.productId)!;
        const afterQty = beforeQty + item.quantity;
        runningStock.set(item.productId, afterQty);
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: item.quantity }, costPrice: item.unitCost } });
        await tx.stockMovement.create({ data: { shopId: user.shopId, productId: item.productId, userId: user.id, type: "PURCHASE", quantity: item.quantity, beforeQty, afterQty, reference: pur.purchaseNo, notes: "Purchase received" } });
      }
      if (data.supplierId && due > 0) await tx.supplier.update({ where: { id: data.supplierId }, data: { balance: { increment: due } } });
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PURCHASE_CREATED", title: `Purchase ${pur.purchaseNo} received`, details: `PKR ${total.toLocaleString()}` } });
      return pur;
    });
    return NextResponse.json({ purchase });
  } catch (e) {
    return apiError(e, "Unable to create purchase.");
  }
}
