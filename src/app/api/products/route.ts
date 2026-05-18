import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { intQty, money, optionalId, optionalText, requiredText } from "@/lib/validation";
import { z } from "zod";

const productSchema = z.object({
  name: requiredText("Product name"),
  sku: optionalText(80),
  barcode: optionalText(80),
  brand: optionalText(120),
  description: optionalText(600),
  imageUrl: optionalText(500),
  unit: optionalText(40).default("pcs"),
  costPrice: money,
  salePrice: money,
  taxRate: money,
  discountRate: money,
  stockQty: intQty,
  reorderLevel: intQty.default(5),
  reorderQuantity: intQty.default(10),
  location: optionalText(120),
  aisle: optionalText(120),
  shelf: optionalText(80),
  productType: optionalText(80),
  isPerishable: z.coerce.boolean().default(false),
  batchNo: optionalText(80),
  manufactureDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  categoryId: optionalId,
  supplierId: optionalId
});

export async function GET() {
  try {
    const user = await getCurrentUser(); if (!user) return unauthorized();
    if (!can(user.role, "products", "read")) return forbidden();
    const products = await prisma.product.findMany({ where: { shopId: user.shopId }, include: { category: true, supplier: true }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ products });
  } catch (error) {
    return apiError(error, "Unable to load products.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "products", "create")) return forbidden();
    const data = productSchema.parse(await request.json());
    if (data.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: data.categoryId, shopId: user.shopId }, select: { id: true } });
      if (!category) return NextResponse.json({ error: "Selected category was not found." }, { status: 404 });
    }
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({ where: { id: data.supplierId, shopId: user.shopId }, select: { id: true } });
      if (!supplier) return NextResponse.json({ error: "Selected supplier was not found." }, { status: 404 });
    }
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          shopId: user.shopId,
          sku: data.sku || `SKU-${Date.now()}`,
          barcode: data.barcode,
          name: data.name,
          brand: data.brand,
          description: data.description,
          imageUrl: data.imageUrl,
          unit: data.unit || "pcs",
          costPrice: data.costPrice,
          salePrice: data.salePrice,
          taxRate: data.taxRate,
          discountRate: data.discountRate,
          stockQty: data.stockQty,
          reorderLevel: data.reorderLevel,
          reorderQuantity: data.reorderQuantity || Math.max(data.reorderLevel * 3, 10),
          location: data.location,
          aisle: data.aisle,
          shelf: data.shelf,
          productType: data.productType,
          isPerishable: data.isPerishable,
          batchNo: data.batchNo,
          manufactureDate: data.manufactureDate,
          expiryDate: data.expiryDate,
          categoryId: data.categoryId,
          supplierId: data.supplierId
        },
        include: { category: true, supplier: true }
      });
      if (created.stockQty > 0) {
        await tx.stockMovement.create({ data: { shopId: user.shopId, productId: created.id, userId: user.id, type: "OPENING", quantity: created.stockQty, beforeQty: 0, afterQty: created.stockQty, reference: "OPENING", notes: "Opening stock entered during product creation." } });
      }
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PRODUCT_CREATED", title: `Product added: ${created.name}`, details: `${created.stockQty} ${created.unit} in stock` } });
      return created;
    });
    return NextResponse.json({ product });
  } catch (error) { return apiError(error, "Unable to create product."); }
}
