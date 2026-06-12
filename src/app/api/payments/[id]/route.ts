import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, badRequest, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can, canUsePaymentDirection } from "@/lib/permissions";
import { WALK_IN_PAYMENT_REQUIRED_MESSAGE } from "@/lib/invoice-rules";
import { applyPaymentEffect, isDuplicatePaymentReferenceError, isPaymentValidationError, paymentInclude, resolvePaymentLinks } from "@/lib/payment-ledger";
import { isAutomaticInvoicePayment } from "@/lib/payment-workflow";
import { prisma } from "@/lib/prisma";
import { isAutomaticPurchasePayment } from "@/lib/supplier-payment-workflow";
import { nullableId, nullableText, positiveMoney } from "@/lib/validation";

const paymentUpdateSchema = z.object({
  direction: z.enum(["CUSTOMER_IN", "SUPPLIER_OUT"]).optional(),
  method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"]).optional(),
  amount: positiveMoney.optional(),
  customerId: nullableId,
  invoiceId: nullableId,
  supplierId: nullableId,
  purchaseId: nullableId,
  paidAt: z.coerce.date().optional(),
  reference: nullableText(120),
  notes: nullableText(600)
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "payments", "update")) return forbidden();
    const existing = await prisma.payment.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { invoice: { select: { invoiceNo: true } }, purchase: { select: { purchaseNo: true } } } });
    if (!existing) return notFound("Payment not found.");
    if (existing.status === "VOIDED") return badRequest("Voided payments are locked for audit history and cannot be edited.");
    if (isAutomaticInvoicePayment(existing, existing.invoice?.invoiceNo)) return badRequest("Automatic invoice payments are controlled by the invoice. Edit the invoice paid amount instead.");
    if (isAutomaticPurchasePayment(existing, existing.purchase?.purchaseNo)) return badRequest("Automatic purchase payments are controlled by the purchase. Edit the purchase paid amount instead.");
    const data = paymentUpdateSchema.parse(await request.json());
    const next = {
      direction: data.direction ?? existing.direction,
      method: data.method ?? existing.method,
      amount: data.amount ?? Number(existing.amount),
      customerId: data.customerId !== undefined ? data.customerId || null : existing.customerId,
      invoiceId: data.invoiceId !== undefined ? data.invoiceId || null : existing.invoiceId,
      supplierId: data.supplierId !== undefined ? data.supplierId || null : existing.supplierId,
      purchaseId: data.purchaseId !== undefined ? data.purchaseId || null : existing.purchaseId,
      paidAt: data.paidAt ?? existing.paidAt,
      reference: data.reference !== undefined ? data.reference : existing.reference,
      notes: data.notes !== undefined ? data.notes : existing.notes
    };
    if (!canUsePaymentDirection(user.role, next.direction)) return forbidden("Your role cannot record that payment direction.");
    
    let payment;
    let lastError: Error | null = null;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        payment = await prisma.$transaction(
          async (tx) => {
            await applyPaymentEffect(tx, user.shopId, existing, -1);
            const resolved = await resolvePaymentLinks(tx, user.shopId, next);
            if (resolved.error || !resolved.payment) throw new Error(resolved.error);
            const updated = await tx.payment.update({ where: { id: existing.id }, data: resolved.payment, include: paymentInclude });
            await applyPaymentEffect(tx, user.shopId, updated, 1);
            await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "PAYMENT_UPDATED", title: "Payment updated" } });
            return updated;
          },
          { timeout: 10000, maxWait: 5000 }
        );
        return NextResponse.json({ payment });
      } catch (e) {
        lastError = e as Error;
        if (attempt < maxRetries && lastError instanceof Error && (lastError.message.includes("Transaction") || lastError.message.includes("connection"))) {
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * attempt, 3000)));
          continue;
        }
        throw lastError;
      }
    }
    
    throw lastError || new Error("Payment update failed after retries");
  } catch (e) {
    if (isDuplicatePaymentReferenceError(e)) return badRequest("A payment with this reference already exists. Use a unique reference for this payment.");
    if (e instanceof Error && (e.message === WALK_IN_PAYMENT_REQUIRED_MESSAGE || isPaymentValidationError(e.message))) return badRequest(e.message);
    if (e instanceof Error && (e.message.includes("Database transaction failed") || e.message.includes("Transaction"))) return apiError(e, "Payment update failed. The database was temporarily unavailable. Please try again.");
    return apiError(e, "Unable to update payment.");
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "payments", "delete")) return forbidden();
    const payment = await prisma.payment.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { invoice: { select: { invoiceNo: true } }, purchase: { select: { purchaseNo: true } } } });
    if (!payment) return notFound("Payment not found.");
    if (payment.status === "VOIDED") return NextResponse.json({ ok: true });
    if (isAutomaticInvoicePayment(payment, payment.invoice?.invoiceNo)) return badRequest("Automatic invoice payments are controlled by the invoice. Edit the invoice paid amount instead.");
    if (isAutomaticPurchasePayment(payment, payment.purchase?.purchaseNo)) return badRequest("Automatic purchase payments are controlled by the purchase. Edit the purchase paid amount instead.");

    let requestedReason = "Payment voided from the payments module.";
    try {
      const body = await request.json();
      if (typeof body?.reason === "string" && body.reason.trim()) requestedReason = body.reason.trim().slice(0, 600);
    } catch {
      requestedReason = "Payment voided from the payments module.";
    }

    await prisma.$transaction(async (tx) => {
      await applyPaymentEffect(tx, user.shopId, payment, -1);
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidedById: user.id,
          voidReason: requestedReason
        }
      });
      await tx.activityLog.create({
        data: {
          shopId: user.shopId,
          userId: user.id,
          type: "PAYMENT_VOIDED",
          title: "Payment voided",
          details: `${payment.reference || payment.id} was voided and its ledger effect was reversed.`
        }
      });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && (e.message === WALK_IN_PAYMENT_REQUIRED_MESSAGE || isPaymentValidationError(e.message))) return badRequest(e.message);
    return apiError(e, "Unable to delete payment.");
  }
}
