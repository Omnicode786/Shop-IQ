import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, notFound, unauthorized, badRequest } from "@/lib/api-response";
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
  packUnit: nullableText(40),
  packSize: z.coerce.number().int().min(1).optional().nullable(),
  costPrice: money.optional(),
  latestPurchaseCost: money.optional(),
  salePrice: money.optional(),
  taxRate: money.optional(),
  discountRate: money.optional(),
  stockQty: intQty.optional(),
  physicalCount: z.coerce.number().int().min(0).optional(),
  stockAdjustmentReason: optionalText(100),
  stockAdjustmentNote: optionalText(600),
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
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, shopId: user.shopId, status: "ACTIVE" }, select: { id: true } });
      if (!supplier) return notFound("Selected supplier was not found.");
    }
    
    if (data.barcode && data.barcode !== existing.barcode) {
      const existingBarcode = await prisma.product.findFirst({ where: { shopId: user.shopId, barcode: data.barcode, id: { not: existing.id } } });
      if (existingBarcode) return badRequest("A product with this barcode already exists.");
    }
    
    if (data.stockQty !== undefined && data.stockQty !== existing.stockQty) {
      if (!data.stockAdjustmentReason) {
        return badRequest("A stock adjustment reason is required when manually changing stock.");
      }
      if (data.stockAdjustmentReason === "Other" && !data.stockAdjustmentNote) {
        return badRequest("Please provide a note for the 'Other' adjustment reason.");
      }
    }

    const futureStock = data.physicalCount !== undefined ? data.physicalCount : data.stockQty !== undefined ? data.stockQty : existing.stockQty;
    if (data.status === "ARCHIVED" && existing.status !== "ARCHIVED" && futureStock > 0) {
      return badRequest("Cannot archive a product that still has stock. Please write off the stock first.");
    }

    const { stockAdjustmentReason, stockAdjustmentNote, physicalCount, ...updateData } = data;
    if (updateData.isPerishable === false) {
      updateData.batchNo = null;
      updateData.manufactureDate = null;
      updateData.expiryDate = null;
    }
    const product = await prisma.$transaction(async (tx) => {
      // If physicalCount is provided, it overrides stockQty for cycle counts
      if (physicalCount !== undefined && physicalCount !== existing.stockQty) {
        updateData.stockQty = physicalCount;
      }
      let updated;
      if (updateData.status === "ARCHIVED" && existing.status !== "ARCHIVED") {
        const archiveResult = await tx.product.updateMany({ where: { id: existing.id, shopId: user.shopId, stockQty: 0 }, data: updateData });
        if (!archiveResult.count) throw new Error("ARCHIVE_STOCK_REMAINING");
        updated = await tx.product.findUniqueOrThrow({ where: { id: existing.id }, include: { category: true, supplier: true } });
      } else {
        updated = await tx.product.update({ where: { id: existing.id }, data: updateData, include: { category: true, supplier: true } });
      }
      
      if (physicalCount !== undefined && physicalCount !== existing.stockQty) {
        const delta = physicalCount - existing.stockQty;
        await tx.stockMovement.create({ data: { shopId: user.shopId, productId: existing.id, userId: user.id, type: "CYCLE_COUNT", quantity: delta, beforeQty: existing.stockQty, afterQty: physicalCount, reference: "CYCLE_COUNT", notes: "Stock updated via Cycle Count." } });
        await tx.activityLog.create({ 
          data: { 
            shopId: user.shopId, 
            userId: user.id, 
            type: "CYCLE_COUNT_LOGGED", 
            title: `Cycle count recorded for ${updated.name}`, 
            details: `Physical count: ${physicalCount} (Diff: ${delta > 0 ? '+' : ''}${delta})`,
            metadata: { beforeQty: existing.stockQty, afterQty: physicalCount, delta } 
          } 
        });
      } else if (data.stockQty !== undefined && data.stockQty !== existing.stockQty) {
        const delta = data.stockQty - existing.stockQty;
        const notes = `Reason: ${stockAdjustmentReason}` + (stockAdjustmentNote ? ` - Note: ${stockAdjustmentNote}` : "");
        await tx.stockMovement.create({ data: { shopId: user.shopId, productId: existing.id, userId: user.id, type: "ADJUSTMENT", quantity: delta, beforeQty: existing.stockQty, afterQty: data.stockQty, reference: "PRODUCT_EDIT", notes } });
        await tx.activityLog.create({ 
          data: { 
            shopId: user.shopId, 
            userId: user.id, 
            type: "STOCK_ADJUSTMENT", 
            title: `Stock manually adjusted for ${updated.name}`, 
            details: `${stockAdjustmentReason} (Diff: ${delta > 0 ? '+' : ''}${delta})`,
            metadata: { reason: stockAdjustmentReason, note: stockAdjustmentNote, beforeQty: existing.stockQty, afterQty: data.stockQty, delta } 
          } 
        });
      }
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PRODUCT_UPDATED", title: `Product updated: ${updated.name}` } });
      return updated;
    });
    return NextResponse.json({ product });
  } catch (e) {
    if (e instanceof Error && e.message === "ARCHIVE_STOCK_REMAINING") {
      return badRequest("Cannot archive a product that still has stock. Please write off the stock first.");
    }
    return apiError(e, "Unable to update product.");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "products", "delete")) return forbidden();
    const product = await prisma.product.findFirst({ where: { id: params.id, shopId: user.shopId }, select: { id: true, name: true, stockQty: true } });
    if (!product) return notFound("Product not found.");
    if (product.stockQty > 0) {
      return badRequest("Cannot archive a product that still has stock. Please write off the stock first.");
    }
    const result = await prisma.product.updateMany({ where: { id: product.id, shopId: user.shopId, stockQty: 0 }, data: { status: "ARCHIVED" } });
    if (!result.count) {
      return badRequest("Cannot archive a product that still has stock. Please write off the stock first.");
    }
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PRODUCT_ARCHIVED", title: `Product archived: ${product.name}` } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Unable to archive product.");
  }
}
