import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { intQty, money, nullableId, nullableText, optionalText, requiredText } from "@/lib/validation";
import { z } from "zod";

const productUpdateSchema = z.object({
  name: requiredText("Product name").optional(),
  sku: optionalText(80),
  barcode: nullableText(80),
  brand: nullableText(120),
  description: nullableText(600),
  imageUrl: nullableText(500),
  unit: optionalText(40),
  costPrice: money.optional(),
  salePrice: money.optional(),
  taxRate: money.optional(),
  discountRate: money.optional(),
  stockQty: intQty.optional(),
  reorderLevel: intQty.optional(),
  reorderQuantity: intQty.optional(),
  location: nullableText(120),
  aisle: nullableText(120),
  shelf: nullableText(80),
  productType: nullableText(80),
  isPerishable: z.coerce.boolean().optional(),
  batchNo: nullableText(80),
  manufactureDate: z.coerce.date().nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  categoryId: nullableId,
  supplierId: nullableId,
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "products", "update")) return forbidden();
    const data = productUpdateSchema.parse(await request.json());
    const existing = await prisma.product.findFirst({ where: { id: params.id, shopId: user.shopId } });
    if (!existing) return notFound("Product not found.");
    if (data.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: data.categoryId, shopId: user.shopId }, select: { id: true } });
      if (!category) return notFound("Selected category was not found.");
    }
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, shopId: user.shopId }, select: { id: true } });
      if (!supplier) return notFound("Selected supplier was not found.");
    }
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({ where: { id: existing.id }, data, include: { category: true, supplier: true } });
      if (data.stockQty !== undefined && data.stockQty !== existing.stockQty) {
        const delta = data.stockQty - existing.stockQty;
        await tx.stockMovement.create({ data: { shopId: user.shopId, productId: existing.id, userId: user.id, type: "ADJUSTMENT", quantity: delta, beforeQty: existing.stockQty, afterQty: data.stockQty, reference: "PRODUCT_EDIT", notes: "Manual stock adjustment from inventory editor." } });
      }
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PRODUCT_UPDATED", title: `Product updated: ${updated.name}` } });
      return updated;
    });
    return NextResponse.json({ product });
  } catch (e) {
    return apiError(e, "Unable to update product.");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "products", "delete")) return forbidden();
    const product = await prisma.product.findFirst({ where: { id: params.id, shopId: user.shopId }, select: { id: true, name: true } });
    if (!product) return notFound("Product not found.");
    await prisma.product.update({ where: { id: product.id }, data: { status: "ARCHIVED" } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PRODUCT_ARCHIVED", title: `Product archived: ${product.name}` } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Unable to archive product.");
  }
}
