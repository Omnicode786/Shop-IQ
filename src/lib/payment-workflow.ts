import type { InvoiceStatus, PaymentMethod } from "@prisma/client";

export const AUTO_INVOICE_PAYMENT_MARKER = "AUTO_INVOICE_PAYMENT";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"];

export function invoiceStatusFromPaid(total: number, paidAmount: number): InvoiceStatus {
  return paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";
}

export function moneyLabel(value: unknown) {
  return `PKR ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function automaticInvoicePaymentReference(invoiceNo: string) {
  return `AUTO-${invoiceNo}`;
}

export function isAutomaticInvoicePayment(payment: { reference?: string | null; notes?: string | null }, invoiceNo?: string | null) {
  return Boolean(payment.notes?.includes(AUTO_INVOICE_PAYMENT_MARKER) || (invoiceNo && payment.reference === automaticInvoicePaymentReference(invoiceNo)));
}

export function paymentMethodFromBreakdown(paymentBreakdown: unknown): PaymentMethod {
  if (!paymentBreakdown || typeof paymentBreakdown !== "object" || Array.isArray(paymentBreakdown)) return "CASH";
  const method = Object.keys(paymentBreakdown).find((key) => PAYMENT_METHODS.includes(key as PaymentMethod));
  return (method as PaymentMethod | undefined) || "CASH";
}

export function invoiceItemsSummary(items: Array<{ quantity?: number | null; product?: { name?: string | null } | null }>) {
  if (!items.length) return "No item summary available";
  const visible = items.slice(0, 4).map((item) => `${item.product?.name || "Product"} x${Number(item.quantity || 0)}`);
  const remaining = items.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")} +${remaining} more` : visible.join(", ");
}

export function invoicePaymentNotes({
  automatic,
  customerName,
  invoiceId,
  invoiceNo,
  amount,
  method,
  productsSummary,
  status,
  remainingBalance,
  userNotes
}: {
  automatic: boolean;
  customerName?: string | null;
  invoiceId: string;
  invoiceNo: string;
  amount: number;
  method: PaymentMethod;
  productsSummary: string;
  status: InvoiceStatus;
  remainingBalance: number;
  userNotes?: string | null;
}) {
  const lines = [
    automatic ? AUTO_INVOICE_PAYMENT_MARKER : "MANUAL_INVOICE_PAYMENT",
    `Customer: ${customerName || "Walk-in"}`,
    `Invoice: ${invoiceNo} (${invoiceId})`,
    `Paid amount: ${moneyLabel(amount)}`,
    `Method: ${method.replace(/_/g, " ")}`,
    `Products: ${productsSummary}`,
    `Payment status: ${status}`,
    `Remaining balance after payment: ${moneyLabel(remainingBalance)}`
  ];
  if (userNotes?.trim()) lines.push(`User notes: ${userNotes.trim()}`);
  return lines.join("\n");
}

export async function syncAutomaticInvoicePayment(
  tx: any,
  {
    shopId,
    invoice,
    amount,
    invoicePaidAmount,
    method,
    createdById
  }: {
    shopId: string;
    invoice: {
      id: string;
      invoiceNo: string;
      customerId?: string | null;
      customer?: { name?: string | null } | null;
      total: unknown;
      paymentBreakdown?: unknown;
      items?: Array<{ quantity?: number | null; product?: { name?: string | null } | null }>;
    };
    amount: number;
    invoicePaidAmount?: number;
    method?: PaymentMethod;
    createdById: string;
  }
) {
  const reference = automaticInvoicePaymentReference(invoice.invoiceNo);
  const existing = await tx.payment.findFirst({
    where: {
      shopId,
      invoiceId: invoice.id,
      direction: "CUSTOMER_IN",
      OR: [{ reference }, { notes: { contains: AUTO_INVOICE_PAYMENT_MARKER } }]
    },
    orderBy: { createdAt: "asc" }
  });
  const normalizedAmount = Math.max(0, Math.min(amount, Number(invoice.total || 0)));
  if (normalizedAmount <= 0) {
    if (existing) {
      await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedById: createdById,
          voidReason: "Automatic invoice payment voided because the invoice paid amount is zero."
        }
      });
    }
    await tx.payment.updateMany({ where: { shopId, invoiceId: invoice.id, direction: "CUSTOMER_IN" }, data: { customerId: invoice.customerId || null } });
    return null;
  }

  const paidForStatus = Math.max(normalizedAmount, invoicePaidAmount ?? normalizedAmount);
  const status = invoiceStatusFromPaid(Number(invoice.total || 0), paidForStatus);
  const remainingBalance = Math.max(Number(invoice.total || 0) - paidForStatus, 0);
  const nextMethod = method || paymentMethodFromBreakdown(invoice.paymentBreakdown);
  const notes = invoicePaymentNotes({
    automatic: true,
    customerName: invoice.customer?.name,
    invoiceId: invoice.id,
    invoiceNo: invoice.invoiceNo,
    amount: normalizedAmount,
    method: nextMethod,
    productsSummary: invoiceItemsSummary(invoice.items || []),
    status,
    remainingBalance
  });
  const data = {
    customerId: invoice.customerId || null,
    supplierId: null,
    invoiceId: invoice.id,
    purchaseId: null,
    direction: "CUSTOMER_IN" as const,
    method: nextMethod,
    status: "ACTIVE" as const,
    amount: normalizedAmount,
    reference,
    notes,
    voidedAt: null,
    voidedById: null,
    voidReason: null
  };

  if (existing) {
    await tx.payment.update({ where: { id: existing.id }, data });
    await tx.payment.updateMany({ where: { shopId, invoiceId: invoice.id, direction: "CUSTOMER_IN", NOT: { id: existing.id } }, data: { customerId: invoice.customerId || null } });
    return existing.id;
  }

  const created = await tx.payment.create({ data: { shopId, createdById, ...data } });
  await tx.payment.updateMany({ where: { shopId, invoiceId: invoice.id, direction: "CUSTOMER_IN", NOT: { id: created.id } }, data: { customerId: invoice.customerId || null } });
  return created.id;
}
