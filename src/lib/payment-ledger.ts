import type { PaymentMethod } from "@prisma/client";
import { randomUUID } from "crypto";
import { WALK_IN_PAYMENT_REQUIRED_MESSAGE, walkInInvoiceHasDue } from "@/lib/invoice-rules";
import { invoiceItemsSummary, invoicePaymentNotes, invoiceStatusFromPaid, moneyLabel } from "@/lib/payment-workflow";
import { purchaseItemsSummary, supplierPaymentNotes } from "@/lib/supplier-payment-workflow";

export const paymentInclude = {
  customer: true,
  invoice: true,
  supplier: true,
  purchase: { include: { supplier: true, items: { include: { product: true } } } }
} as const;

export type PaymentDraft = {
  direction: "CUSTOMER_IN" | "SUPPLIER_OUT";
  method: PaymentMethod;
  amount: number;
  customerId?: string | null;
  invoiceId?: string | null;
  supplierId?: string | null;
  purchaseId?: string | null;
  paidAt?: Date;
  reference?: string | null;
  notes?: string | null;
};

export function isPaymentValidationError(message: string) {
  return [
    "Invoice payments must use customer-in direction.",
    "Supplier payments must use supplier-out direction.",
    "Customer payments cannot be linked to supplier purchases.",
    "Supplier payments cannot be linked to customer invoices.",
    "Invoice not found.",
    "Purchase not found.",
    "The selected invoice controls the customer.",
    "The selected purchase controls the supplier.",
    "This invoice is already fully paid.",
    "This purchase is already fully paid.",
    "Payment amount cannot exceed",
    "Customer not found.",
    "Supplier not found.",
    "Customer payments need a customer or invoice.",
    "Supplier payments need a purchase.",
    "Selected purchase has no supplier.",
    "Supplier payable balance is lower than this payment.",
    "Automatic invoice payments are controlled by the invoice.",
    "Automatic purchase payments are controlled by the purchase."
  ].some((text) => message.includes(text));
}

export function generatedPaymentReference(base: string) {
  const safeBase = (base || "PAYMENT").replace(/[^A-Z0-9-]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`.toUpperCase();
  return `${safeBase || "PAYMENT"}-PAY-${suffix}`.slice(0, 120);
}

export function isDuplicatePaymentReferenceError(error: unknown) {
  const prismaError = error as { code?: string; meta?: { target?: unknown } } | null;
  if (prismaError?.code !== "P2002") return false;
  return String(prismaError.meta?.target || "").includes("reference");
}

export async function resolvePaymentLinks(db: any, shopId: string, payment: PaymentDraft) {
  const next = {
    ...payment,
    amount: Number(payment.amount),
    customerId: payment.customerId || null,
    invoiceId: payment.invoiceId || null,
    supplierId: payment.supplierId || null,
    purchaseId: payment.purchaseId || null
  };

  if (next.direction === "CUSTOMER_IN") {
    if (next.supplierId || next.purchaseId) return { error: "Customer payments cannot be linked to supplier purchases." };
    if (next.invoiceId) {
      const invoice = await db.invoice.findFirst({ where: { id: next.invoiceId, shopId, status: { not: "CANCELLED" } }, include: { customer: true, items: { include: { product: true } } } });
      if (!invoice) return { error: "Invoice not found." };
      if (next.customerId && next.customerId !== invoice.customerId) return { error: "The selected invoice controls the customer. Clear the invoice to choose a different customer." };
      const remainingBalance = Number(invoice.dueAmount || 0);
      if (remainingBalance <= 0) return { error: "This invoice is already fully paid." };
      if (Number(next.amount) > remainingBalance) return { error: `Payment amount cannot exceed the remaining invoice balance of ${moneyLabel(remainingBalance)}.` };
      const paidAfter = Number(invoice.paidAmount || 0) + Number(next.amount);
      const statusAfter = invoiceStatusFromPaid(Number(invoice.total || 0), paidAfter);
      next.customerId = invoice.customerId || null;
      next.reference = next.reference || generatedPaymentReference(invoice.invoiceNo);
      next.notes = invoicePaymentNotes({
        automatic: false,
        customerName: invoice.customer?.name,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        amount: Number(next.amount),
        method: next.method,
        productsSummary: invoiceItemsSummary(invoice.items || []),
        status: statusAfter,
        remainingBalance: Math.max(Number(invoice.total || 0) - paidAfter, 0),
        userNotes: next.notes
      });
    }
    if (next.customerId) {
      const customer = await db.customer.findFirst({ where: { id: next.customerId, shopId }, select: { id: true } });
      if (!customer) return { error: "Customer not found." };
    }
    if (!next.customerId && !next.invoiceId) return { error: "Customer payments need a customer or invoice." };
    next.supplierId = null;
    next.purchaseId = null;
    return { payment: next };
  }

  if (next.direction === "SUPPLIER_OUT") {
    if (next.customerId || next.invoiceId) return { error: "Supplier payments cannot be linked to customer invoices." };
    if (!next.purchaseId) return { error: "Supplier payments need a purchase so the payable can close correctly." };
    const purchase = await db.purchase.findFirst({
      where: { id: next.purchaseId, shopId, status: { not: "CANCELLED" } },
      include: { supplier: true, items: { include: { product: true } } }
    });
    if (!purchase) return { error: "Purchase not found." };
    if (!purchase.supplierId) return { error: "Selected purchase has no supplier." };
    if (next.supplierId && next.supplierId !== purchase.supplierId) return { error: "The selected purchase controls the supplier. Clear the purchase to choose a different supplier." };
    const remainingBalance = Number(purchase.dueAmount || 0);
    if (remainingBalance <= 0) return { error: "This purchase is already fully paid." };
    if (Number(next.amount) > remainingBalance) return { error: `Payment amount cannot exceed the remaining purchase payable of ${moneyLabel(remainingBalance)}.` };
    const paidAfter = Number(purchase.paidAmount || 0) + Number(next.amount);
    next.supplierId = purchase.supplierId;
    next.reference = next.reference || generatedPaymentReference(purchase.purchaseNo);
    next.notes = supplierPaymentNotes({
      automatic: false,
      supplierName: purchase.supplier?.name,
      purchaseId: purchase.id,
      purchaseNo: purchase.purchaseNo,
      amount: Number(next.amount),
      method: next.method,
      productsSummary: purchaseItemsSummary(purchase.items || []),
      status: purchase.status,
      remainingBalance: Math.max(Number(purchase.total || 0) - paidAfter, 0),
      userNotes: next.notes
    });
    next.customerId = null;
    next.invoiceId = null;
    return { payment: next };
  }

  return { error: "Unsupported payment direction." };
}

export async function applyPaymentEffect(tx: any, shopId: string, payment: { direction: string; amount: unknown; customerId?: string | null; invoiceId?: string | null; supplierId?: string | null; purchaseId?: string | null }, sign: 1 | -1) {
  const amount = Number(payment.amount);

  if (payment.direction === "CUSTOMER_IN") {
    let customerId = payment.customerId || null;
    if (payment.invoiceId) {
      const invoice = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (invoice && invoice.shopId === shopId) {
        customerId = customerId || invoice.customerId;
        if (sign === 1 && amount > Number(invoice.dueAmount || 0)) throw new Error(`Payment amount cannot exceed the remaining invoice balance of ${moneyLabel(invoice.dueAmount)}.`);
        const paidAmount = Math.max(Number(invoice.paidAmount) + sign * amount, 0);
        const dueAmount = Math.max(Number(invoice.total) - paidAmount, 0);
        const status = invoiceStatusFromPaid(Number(invoice.total), paidAmount);
        if (walkInInvoiceHasDue(invoice.customerId, Number(invoice.total), paidAmount, status)) throw new Error(WALK_IN_PAYMENT_REQUIRED_MESSAGE);
        await tx.invoice.update({ where: { id: invoice.id }, data: { paidAmount, dueAmount, status } });
      }
    }
    if (customerId) {
      await tx.customer.update({ where: { id: customerId }, data: { balance: sign === 1 ? { decrement: amount } : { increment: amount } } });
    }
    return;
  }

  if (payment.direction === "SUPPLIER_OUT") {
    if (!payment.purchaseId || !payment.supplierId) throw new Error("Supplier payments need a purchase.");
    const purchases = await tx.$queryRaw<Array<{ id: string; supplierId: string | null; total: unknown; paidAmount: unknown; dueAmount: unknown; status: string }>>`
      SELECT "id", "supplierId", "total", "paidAmount", "dueAmount", "status"
      FROM "Purchase"
      WHERE "id" = ${payment.purchaseId} AND "shopId" = ${shopId}
      FOR UPDATE
    `;
    const purchase = purchases[0];
    if (!purchase || purchase.status === "CANCELLED") throw new Error("Purchase not found.");
    if (!purchase.supplierId || purchase.supplierId !== payment.supplierId) throw new Error("The selected purchase controls the supplier.");

    const suppliers = await tx.$queryRaw<Array<{ id: string; balance: unknown }>>`
      SELECT "id", "balance"
      FROM "Supplier"
      WHERE "id" = ${payment.supplierId} AND "shopId" = ${shopId}
      FOR UPDATE
    `;
    const supplier = suppliers[0];
    if (!supplier) throw new Error("Supplier not found.");

    if (sign === 1) {
      if (amount > Number(purchase.dueAmount || 0)) throw new Error(`Payment amount cannot exceed the remaining purchase payable of ${moneyLabel(purchase.dueAmount)}.`);
      if (amount > Number(supplier.balance || 0)) throw new Error(`Supplier payable balance is lower than this payment. Current payable is ${moneyLabel(supplier.balance)}.`);
    } else if (amount > Number(purchase.paidAmount || 0)) {
      throw new Error(`Cannot reverse more than the paid purchase amount of ${moneyLabel(purchase.paidAmount)}.`);
    }

    const paidAmount = Math.max(Number(purchase.paidAmount || 0) + sign * amount, 0);
    const dueAmount = Math.max(Number(purchase.total || 0) - paidAmount, 0);
    await tx.purchase.update({ where: { id: purchase.id }, data: { paidAmount, dueAmount } });
    await tx.supplier.update({ where: { id: payment.supplierId }, data: { balance: sign === 1 ? { decrement: amount } : { increment: amount } } });
    return;
  }

  throw new Error("Unsupported payment direction.");
}
