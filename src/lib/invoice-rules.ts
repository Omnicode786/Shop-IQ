export const WALK_IN_PAYMENT_REQUIRED_MESSAGE =
  "Walk-in customers must pay the full invoice amount on spot. Select or create a customer to allow credit or dues.";

export function walkInInvoiceHasDue(customerId: string | null | undefined, total: number, paidAmount: number, status?: string | null) {
  if (customerId) return false;
  if (status === "CANCELLED") return false;
  return Math.max(total - paidAmount, 0) > 0 || (status ? status !== "PAID" : false);
}

export function amountInputValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
