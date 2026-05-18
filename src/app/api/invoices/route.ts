import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, badRequest, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { money, optionalId, optionalText, positiveIntQty } from "@/lib/validation";

const invoiceItemSchema = z.object({
  productId: z.string().min(1),
  quantity: positiveIntQty,
  unitPrice: money.optional()
});

const invoiceSchema = z.object({
  customerId: optionalId,
  invoiceNo: optionalText(80),
  discount: money,
  tax: money,
  loyaltyDiscount: money,
  paidAmount: money,
  dueDate: z.coerce.date().optional(),
  cashierCounter: optionalText(80),
  channel: optionalText(80),
  promoCode: optionalText(80),
  receiptNo: optionalText(100),
  paymentBreakdown: z.record(z.any()).optional(),
  notes: optionalText(600),
  items: z.array(invoiceItemSchema).min(1, "Add at least one item.")
});

function invoiceStatus(total: number, paid: number) {
  return paid >= total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "invoices", "read")) return forbidden();
    const invoices = await prisma.invoice.findMany({ where: { shopId: user.shopId }, include: { customer: true, items: { include: { product: true } } }, orderBy: { invoiceDate: "desc" }, take: 150 });
    return NextResponse.json({ invoices });
  } catch (e) {
    return apiError(e, "Unable to load invoices.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "invoices", "create")) return forbidden();
    const data = invoiceSchema.parse(await request.json());
    if (data.customerId) {
      const customer = await prisma.customer.findFirst({ where: { id: data.customerId, shopId: user.shopId }, select: { id: true } });
      if (!customer) return notFound("Customer not found.");
    }
    const products = await prisma.product.findMany({ where: { shopId: user.shopId, id: { in: data.items.map((item) => item.productId) }, status: "ACTIVE" } });
    const productMap = new Map(products.map((product) => [product.id, product]));
    const demand = new Map<string, number>();
    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) return notFound("One of the selected products was not found.");
      demand.set(item.productId, (demand.get(item.productId) || 0) + item.quantity);
    }
    for (const [productId, quantity] of demand) {
      const product = productMap.get(productId)!;
      if (product.stockQty < quantity) return badRequest(`${product.name} has only ${product.stockQty} in stock.`);
    }
    const subtotal = data.items.reduce((sum, item) => {
      const product = productMap.get(item.productId)!;
      return sum + item.quantity * Number(item.unitPrice ?? product.salePrice);
    }, 0);
    const total = Math.max(subtotal - data.discount - data.loyaltyDiscount + data.tax, 0);
    const paid = Math.min(data.paidAmount, total);
    const due = Math.max(total - paid, 0);
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          shopId: user.shopId,
          customerId: data.customerId || null,
          createdById: user.id,
          invoiceNo: data.invoiceNo || `INV-${Date.now()}`,
          subtotal,
          discount: data.discount,
          tax: data.tax,
          loyaltyDiscount: data.loyaltyDiscount,
          total,
          paidAmount: paid,
          dueAmount: due,
          status: invoiceStatus(total, paid),
          dueDate: data.dueDate,
          cashierCounter: data.cashierCounter,
          channel: data.channel,
          promoCode: data.promoCode,
          receiptNo: data.receiptNo,
          paymentBreakdown: data.paymentBreakdown,
          notes: data.notes,
          items: {
            create: data.items.map((item) => {
              const product = productMap.get(item.productId)!;
              const unitPrice = Number(item.unitPrice ?? product.salePrice);
              return { productId: product.id, quantity: item.quantity, unitPrice, costPrice: product.costPrice, total: item.quantity * unitPrice };
            })
          }
        },
        include: { customer: true, items: { include: { product: true } } }
      });
      const runningStock = new Map(products.map((product) => [product.id, product.stockQty]));
      for (const item of data.items) {
        const beforeQty = runningStock.get(item.productId)!;
        const afterQty = beforeQty - item.quantity;
        runningStock.set(item.productId, afterQty);
        await tx.product.update({ where: { id: item.productId }, data: { stockQty: { decrement: item.quantity } } });
        await tx.stockMovement.create({ data: { shopId: user.shopId, productId: item.productId, userId: user.id, type: "SALE", quantity: -item.quantity, beforeQty, afterQty, reference: inv.invoiceNo, notes: "Invoice sale" } });
      }
      if (data.customerId && due > 0) await tx.customer.update({ where: { id: data.customerId }, data: { balance: { increment: due } } });
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "INVOICE_CREATED", title: `Invoice ${inv.invoiceNo} created`, details: `PKR ${total.toLocaleString()}` } });
      return inv;
    });
    return NextResponse.json({ invoice });
  } catch (e) {
    return apiError(e, "Unable to create invoice.");
  }
}
