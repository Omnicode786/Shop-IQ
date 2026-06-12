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
  openingBalance: money.optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
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
    const { openingBalance, ...customerData } = data;
    if (customerData.phone) {
      const existingPhone = await prisma.customer.findFirst({ where: { shopId: user.shopId, phone: customerData.phone } });
      if (existingPhone) return NextResponse.json({ error: "A customer with this phone number already exists." }, { status: 400 });
    }
    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({ data: { shopId: user.shopId, ...customerData, balance: openingBalance || 0 } });
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "CUSTOMER_CREATED", title: `Customer added: ${created.name}` } });
      if (openingBalance && openingBalance !== 0) {
        await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "CUSTOMER_OPENING_BALANCE", title: `Opening balance set for ${created.name}`, details: `Amount: PKR ${openingBalance}` } });
      }
      return created;
    });
    return NextResponse.json({ customer });
  } catch (e) {
    return apiError(e, "Unable to create customer.");
  }
}
