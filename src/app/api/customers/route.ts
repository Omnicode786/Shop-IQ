import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { money, optionalEmail, optionalText, requiredText } from "@/lib/validation";

const customerSchema = z.object({
  name: requiredText("Customer name"),
  phone: optionalText(40),
  email: optionalEmail,
  address: optionalText(220),
  loyaltyCardNo: optionalText(80),
  customerType: optionalText(80),
  area: optionalText(120),
  city: optionalText(120),
  whatsapp: optionalText(40),
  loyaltyPoints: z.coerce.number().int().min(0).default(0),
  lastVisitAt: z.coerce.date().optional(),
  preferredPaymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "JAZZCASH", "EASYPAISA", "CHEQUE", "OTHER"]).optional(),
  creditLimit: money,
  balance: money.optional(),
  notes: optionalText(600)
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "customers", "read")) return forbidden();
    const customers = await prisma.customer.findMany({ where: { shopId: user.shopId }, include: { invoices: true, payments: true }, orderBy: { updatedAt: "desc" } });
    return NextResponse.json({ customers });
  } catch (error) {
    return apiError(error, "Unable to load customers.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "customers", "create")) return forbidden();
    const data = customerSchema.parse(await request.json());
    const customer = await prisma.customer.create({ data: { shopId: user.shopId, ...data } });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "CUSTOMER_CREATED", title: `Customer added: ${customer.name}` } });
    return NextResponse.json({ customer });
  } catch (e) {
    return apiError(e, "Unable to create customer.");
  }
}
