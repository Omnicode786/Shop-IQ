import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, badRequest, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { WALK_IN_PAYMENT_REQUIRED_MESSAGE, walkInInvoiceHasDue } from "@/lib/invoice-rules";
import { decrementStockForSale, InsufficientStockError, lockActiveProductsForSale, SaleProductNotFoundError } from "@/lib/invoice-stock";
import { invoiceStatusFromPaid, syncAutomaticInvoicePayment } from "@/lib/payment-workflow";
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
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"]).default("CASH"),
  dueDate: z.coerce.date().optional(),
  cashierCounter: optionalText(80),
  channel: optionalText(80),
  promoCode: optionalText(80),
  receiptNo: optionalText(100),
  paymentBreakdown: z.record(z.any()).optional(),
  notes: optionalText(600),
  items: z.array(invoiceItemSchema).min(1, "Add at least one item.")
});

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
    const invoice = await prisma.$transaction(async (tx) => {
      const saleLines = data.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
      const productMap = await lockActiveProductsForSale(tx, user.shopId, saleLines);
      const subtotal = data.items.reduce((sum, item) => {
        const product = productMap.get(item.productId)!;
        return sum + item.quantity * Number(item.unitPrice ?? product.salePrice);
      }, 0);
      const total = Math.max(subtotal - data.discount - data.loyaltyDiscount + data.tax, 0);
      const paid = Math.min(data.paidAmount, total);
      const due = Math.max(total - paid, 0);
      const paymentBreakdown = data.paymentBreakdown || (paid > 0 ? { [data.paymentMethod]: paid } : undefined);
      if (walkInInvoiceHasDue(data.customerId, total, paid)) throw new Error("WALK_IN_PAYMENT_REQUIRED");

      let customer: { id: string; balance: unknown; creditLimit: unknown } | null = null;
      if (data.customerId) {
        const customers = await tx.$queryRaw<Array<{ id: string; balance: unknown; creditLimit: unknown }>>`
          SELECT "id", "balance", "creditLimit"
          FROM "Customer"
          WHERE "id" = ${data.customerId} AND "shopId" = ${user.shopId}
          FOR UPDATE
        `;
        customer = customers[0] || null;
        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
      }

      if (due > 0 && customer && Number(customer.creditLimit) > 0) {
        if (Number(customer.balance) + due > Number(customer.creditLimit)) {
          throw new Error(`CREDIT_LIMIT_EXCEEDED: Credit limit exceeded. The customer's balance is PKR ${Number(customer.balance).toLocaleString()} and their credit limit is PKR ${Number(customer.creditLimit).toLocaleString()}.`);
        }
      }

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
          status: invoiceStatusFromPaid(total, paid),
          dueDate: data.dueDate,
          cashierCounter: data.cashierCounter,
          channel: data.channel,
          promoCode: data.promoCode,
          receiptNo: data.receiptNo,
          paymentBreakdown,
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
      if (paid > 0) {
        await syncAutomaticInvoicePayment(tx, {
          shopId: user.shopId,
          invoice: inv,
          amount: paid,
          invoicePaidAmount: paid,
          method: data.paymentMethod,
          createdById: user.id
        });
      }
      await decrementStockForSale(tx, { shopId: user.shopId, userId: user.id, invoiceNo: inv.invoiceNo, lines: saleLines, products: productMap, notes: "Invoice sale" });
      if (data.customerId && due > 0) await tx.customer.update({ where: { id: data.customerId }, data: { balance: { increment: due } } });
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "INVOICE_CREATED", title: `Invoice ${inv.invoiceNo} created`, details: `PKR ${total.toLocaleString()}` } });
      return inv;
    });
    return NextResponse.json({ invoice });
  } catch (e) {
    if (e instanceof SaleProductNotFoundError) return notFound(e.message);
    if (e instanceof InsufficientStockError) return badRequest(e.message);
    if (e instanceof Error && e.message === "CUSTOMER_NOT_FOUND") return notFound("Customer not found.");
    if (e instanceof Error && e.message === "WALK_IN_PAYMENT_REQUIRED") return badRequest(WALK_IN_PAYMENT_REQUIRED_MESSAGE);
    if (e instanceof Error && e.message.startsWith("CREDIT_LIMIT_EXCEEDED:")) return badRequest(e.message.replace("CREDIT_LIMIT_EXCEEDED:", "").trim());
    return apiError(e, "Unable to create invoice.");
  }
}
