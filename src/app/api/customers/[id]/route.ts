import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, conflict, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { money, nullableEmail, nullableText, requiredText } from "@/lib/validation";

const customerUpdateSchema = z.object({
  name: requiredText("Customer name").optional(),
  phone: nullableText(40),
  email: nullableEmail,
  address: nullableText(220),
  loyaltyCardNo: nullableText(80),
  customerType: nullableText(80),
  area: nullableText(120),
  city: nullableText(120),
  whatsapp: nullableText(40),
  loyaltyPoints: z.coerce.number().int().min(0).optional(),
  lastVisitAt: z.coerce.date().nullable().optional(),
  preferredPaymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"]).nullable().optional(),
  creditLimit: money.optional(),
  balance: money.optional(),
  notes: nullableText(600)
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "customers", "update")) return forbidden();
    const data = customerUpdateSchema.parse(await request.json());
    const customer = await prisma.customer.updateMany({ where: { id: params.id, shopId: user.shopId }, data });
    if (!customer.count) return notFound("Customer not found.");
    const updated = await prisma.customer.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { invoices: true, payments: true } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "CUSTOMER_UPDATED", title: `Customer updated: ${updated?.name || params.id}` } });
    return NextResponse.json({ customer: updated });
  } catch (e) {
    return apiError(e, "Unable to update customer.");
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "customers", "delete")) return forbidden();
    const customer = await prisma.customer.findFirst({ where: { id: params.id, shopId: user.shopId }, include: { invoices: { select: { id: true }, take: 1 }, payments: { select: { id: true }, take: 1 } } });
    if (!customer) return notFound("Customer not found.");
    if (customer.invoices.length || customer.payments.length) return conflict("This customer has invoices or payments. Archive the relationship in notes or edit the account instead.");
    await prisma.customer.delete({ where: { id: params.id } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "CUSTOMER_DELETED", title: `Customer deleted: ${customer.name}` } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Unable to delete customer.");
  }
}
