import type { PaymentMethod, PurchaseStatus } from "@prisma/client";
import { moneyLabel } from "@/lib/payment-workflow";

export const AUTO_PURCHASE_PAYMENT_MARKER = "AUTO_PURCHASE_PAYMENT";

export function automaticPurchasePaymentReference(purchaseNo: string) {
  return `AUTO-${purchaseNo}`;
}

export function isAutomaticPurchasePayment(payment: { reference?: string | null; notes?: string | null }, purchaseNo?: string | null) {
  return Boolean(payment.notes?.includes(AUTO_PURCHASE_PAYMENT_MARKER) || (purchaseNo && payment.reference === automaticPurchasePaymentReference(purchaseNo)));
}

export function purchaseItemsSummary(items: Array<{ quantity?: number | null; product?: { name?: string | null } | null }>) {
  if (!items.length) return "No item summary available";
  const visible = items.slice(0, 4).map((item) => `${item.product?.name || "Product"} x${Number(item.quantity || 0)}`);
  const remaining = items.length - visible.length;
  return remaining > 0 ? `${visible.join(", ")} +${remaining} more` : visible.join(", ");
}

export function supplierPaymentNotes({
  automatic,
  supplierName,
  purchaseId,
  purchaseNo,
  amount,
  method,
  productsSummary,
  status,
  remainingBalance,
  userNotes
}: {
  automatic: boolean;
  supplierName?: string | null;
  purchaseId: string;
  purchaseNo: string;
  amount: number;
  method: PaymentMethod;
  productsSummary: string;
  status: PurchaseStatus;
  remainingBalance: number;
  userNotes?: string | null;
}) {
  const lines = [
    automatic ? AUTO_PURCHASE_PAYMENT_MARKER : "MANUAL_SUPPLIER_PAYMENT",
    `Supplier: ${supplierName || "Supplier"}`,
    `Purchase: ${purchaseNo} (${purchaseId})`,
    `Paid amount: ${moneyLabel(amount)}`,
    `Method: ${method.replace(/_/g, " ")}`,
    `Items: ${productsSummary}`,
    `Purchase status: ${status}`,
    `Remaining payable after payment: ${moneyLabel(remainingBalance)}`
  ];
  if (userNotes?.trim()) lines.push(`User notes: ${userNotes.trim()}`);
  return lines.join("\n");
}

export async function syncAutomaticPurchasePayment(
  tx: any,
  {
    shopId,
    purchase,
    amount,
    purchasePaidAmount,
    method,
    createdById
  }: {
    shopId: string;
    purchase: {
      id: string;
      purchaseNo: string;
      supplierId?: string | null;
      supplier?: { name?: string | null } | null;
      total: unknown;
      status: PurchaseStatus;
      items?: Array<{ quantity?: number | null; product?: { name?: string | null } | null }>;
    };
    amount: number;
    purchasePaidAmount?: number;
    method?: PaymentMethod;
    createdById: string;
  }
) {
  const reference = automaticPurchasePaymentReference(purchase.purchaseNo);
  const existing = await tx.payment.findFirst({
    where: {
      shopId,
      purchaseId: purchase.id,
      direction: "SUPPLIER_OUT",
      OR: [{ reference }, { notes: { contains: AUTO_PURCHASE_PAYMENT_MARKER } }]
    },
    orderBy: { createdAt: "asc" }
  });
  const normalizedAmount = Math.max(0, Math.min(amount, Number(purchase.total || 0)));
  if (normalizedAmount <= 0 || !purchase.supplierId) {
    if (existing) {
      await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedById: createdById,
          voidReason: !purchase.supplierId
            ? "Automatic purchase payment voided because the purchase has no supplier."
            : "Automatic purchase payment voided because the purchase paid amount is zero."
        }
      });
    }
    return null;
  }

  const paidForBalance = Math.max(normalizedAmount, purchasePaidAmount ?? normalizedAmount);
  const remainingBalance = Math.max(Number(purchase.total || 0) - paidForBalance, 0);
  const nextMethod = method || "CASH";
  const notes = supplierPaymentNotes({
    automatic: true,
    supplierName: purchase.supplier?.name,
    purchaseId: purchase.id,
    purchaseNo: purchase.purchaseNo,
    amount: normalizedAmount,
    method: nextMethod,
    productsSummary: purchaseItemsSummary(purchase.items || []),
    status: purchase.status,
    remainingBalance
  });
  const data = {
    customerId: null,
    invoiceId: null,
    supplierId: purchase.supplierId,
    purchaseId: purchase.id,
    direction: "SUPPLIER_OUT" as const,
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
    return existing.id;
  }

  const created = await tx.payment.create({ data: { shopId, createdById, ...data } });
  return created.id;
}
