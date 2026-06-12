import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { clamp, money, optionalEmail, optionalText, requiredText } from "@/lib/validation";

const supplierSchema = z.object({
  name: requiredText("Supplier name"),
  phone: optionalText(40),
  email: optionalEmail,
  address: optionalText(220),
  contactPerson: optionalText(120),
  paymentTerms: optionalText(120),
  ntn: optionalText(80),
  gstNumber: optionalText(80),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
  supplierType: optionalText(100),
  openingBalance: money.optional(),
  reliabilityScore: z.coerce.number().int().min(0).max(100).default(80),
  notes: optionalText(600),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "read")) return forbidden();
    const suppliers = await prisma.supplier.findMany({ where: { shopId: user.shopId }, include: { _count: { select: { purchases: true } } }, orderBy: { name: "asc" } });
    return NextResponse.json({ suppliers });
  } catch (e) {
    return apiError(e, "Unable to load suppliers.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "suppliers", "create")) return forbidden();
    const data = supplierSchema.parse(await request.json());
    const { openingBalance, ...supplierData } = data;
    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({ data: { shopId: user.shopId, ...supplierData, balance: openingBalance || 0, reliabilityScore: clamp(data.reliabilityScore, 0, 100) } });
      await tx.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SUPPLIER_CREATED", title: `Supplier added: ${created.name}` } });
      if (openingBalance && openingBalance > 0) {
        await tx.activityLog.create({
          data: {
            shopId: user.shopId,
            userId: user.id,
            type: "SUPPLIER_OPENING_BALANCE",
            title: `Opening payable set for ${created.name}`,
            details: `Amount: PKR ${openingBalance.toLocaleString()}`,
            metadata: { supplierId: created.id, openingBalance }
          }
        });
      }
      return created;
    });
    return NextResponse.json({ supplier });
  } catch (e) {
    return apiError(e, "Unable to create supplier.");
  }
}
