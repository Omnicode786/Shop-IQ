import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, badRequest, forbidden, unauthorized } from "@/lib/api-response";
import { can, canUsePaymentDirection } from "@/lib/permissions";
import { WALK_IN_PAYMENT_REQUIRED_MESSAGE } from "@/lib/invoice-rules";
import { applyPaymentEffect, isDuplicatePaymentReferenceError, isPaymentValidationError, paymentInclude, resolvePaymentLinks } from "@/lib/payment-ledger";
import { prisma } from "@/lib/prisma";
import { optionalId, optionalText, positiveMoney } from "@/lib/validation";

const paymentSchema = z.object({
  direction: z.enum(["CUSTOMER_IN", "SUPPLIER_OUT"]).default("CUSTOMER_IN"),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"]).default("CASH"),
  amount: positiveMoney,
  customerId: optionalId,
  invoiceId: optionalId,
  supplierId: optionalId,
  purchaseId: optionalId,
  paidAt: z.coerce.date().optional(),
  reference: optionalText(120),
  notes: optionalText(600)
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "payments", "read")) return forbidden();
    const payments = await prisma.payment.findMany({ where: { shopId: user.shopId }, include: paymentInclude, orderBy: { paidAt: "desc" }, take: 150 });
    return NextResponse.json({ payments });
  } catch (e) {
    return apiError(e, "Unable to load payments.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "payments", "create")) return forbidden();
    const parsed = paymentSchema.parse(await request.json());
    if (!canUsePaymentDirection(user.role, parsed.direction)) return forbidden("Your role cannot record that payment direction.");
    
    let payment;
    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        payment = await prisma.$transaction(
          async (tx) => {
            const resolved = await resolvePaymentLinks(tx, user.shopId, parsed);
            if (resolved.error || !resolved.payment) throw new Error(resolved.error);
            const created = await tx.payment.create({ data: { shopId: user.shopId, createdById: user.id, ...resolved.payment }, include: paymentInclude });
            await applyPaymentEffect(tx, user.shopId, created, 1);
            await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PAYMENT_RECORDED", title: "Payment recorded", details: `PKR ${Number(created.amount).toLocaleString()} via ${created.method}` } });
            return created;
          },
          { timeout: 10000, maxWait: 5000 }
        );
        return NextResponse.json({ payment });
      } catch (e) {
        lastError = e as Error;
        if (attempt < maxRetries && lastError instanceof Error && (lastError.message.includes("Transaction") || lastError.message.includes("connection"))) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 3000)));
          continue;
        }
        throw lastError;
      }
    }
    
    throw lastError || new Error("Payment processing failed after retries");
  } catch (e) {
    if (isDuplicatePaymentReferenceError(e)) return badRequest("A payment with this reference already exists. Use a unique reference for this payment.");
    if (e instanceof Error && (e.message === WALK_IN_PAYMENT_REQUIRED_MESSAGE || isPaymentValidationError(e.message))) return badRequest(e.message);
    if (e instanceof Error && (e.message.includes("Database transaction failed") || e.message.includes("Transaction"))) return apiError(e, "Payment processing failed. The database was temporarily unavailable. Please try again.");
    return apiError(e, "Unable to record payment.");
  }
}
