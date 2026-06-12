import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, conflict, forbidden, notFound, unauthorized, badRequest } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { money, nullableEmail, nullableText, requiredText, optionalText } from "@/lib/validation";

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
  balanceAdjustment: money.optional(),
  balanceAdjustmentReason: optionalText(100),
  balanceAdjustmentNote: optionalText(600),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  notes: nullableText(600)
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "customers", "update")) return forbidden();
    const data = customerUpdateSchema.parse(await request.json());
    
    if (data.balanceAdjustment && data.balanceAdjustment !== 0 && !data.balanceAdjustmentReason) {
      return badRequest("A reason is required when adjusting the balance.");
    }
    
    const { balanceAdjustment, balanceAdjustmentReason, balanceAdjustmentNote, ...updateData } = data;
    
    if (updateData.phone) {
      const existingPhone = await prisma.customer.findFirst({ where: { shopId: user.shopId, phone: updateData.phone, id: { not: params.id } } });
      if (existingPhone) return NextResponse.json({ error: "A customer with this phone number already exists." }, { status: 400 });
    }
    
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findFirst({ where: { id: params.id, shopId: user.shopId } });
      if (!existing) throw new Error("NOT_FOUND");
      
      const customer = await tx.customer.update({ 
        where: { id: params.id }, 
        data: { 
          ...updateData,
          ...(balanceAdjustment && balanceAdjustment !== 0 ? { balance: { increment: balanceAdjustment } } : {})
        },
        include: { invoices: true, payments: true } 
      });
      
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "CUSTOMER_UPDATED", title: `Customer updated: ${customer.name}` } });
      
      if (balanceAdjustment && balanceAdjustment !== 0) {
        await tx.activityLog.create({ 
          data: { 
            shopId: user.shopId, 
            userId: user.id, 
            type: "CUSTOMER_BALANCE_ADJUSTMENT", 
            title: `Balance adjusted for ${customer.name}`, 
            details: `${balanceAdjustmentReason} (Diff: ${balanceAdjustment > 0 ? '+' : ''}${balanceAdjustment})`,
            metadata: { reason: balanceAdjustmentReason, note: balanceAdjustmentNote, delta: balanceAdjustment, beforeBalance: existing.balance, afterBalance: customer.balance }
          } 
        });
      }
      return customer;
    });

    return NextResponse.json({ customer: updated });
  } catch (e: any) {
    if (e.message === "NOT_FOUND") return notFound("Customer not found.");
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
