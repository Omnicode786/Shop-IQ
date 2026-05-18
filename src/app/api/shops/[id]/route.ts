import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, notFound, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { optionalText, requiredText } from "@/lib/validation";

const shopUpdateSchema = z.object({
  name: requiredText("Shop name"),
  city: requiredText("City"),
  address: optionalText(240),
  phone: optionalText(40),
  currency: requiredText("Currency", 12)
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "settings", "update")) return forbidden();
    if (params.id !== user.shopId) return notFound("Shop not found.");
    const data = shopUpdateSchema.parse(await request.json());
    const shop = await prisma.shop.update({ where: { id: user.shopId }, data });
    await prisma.activityLog.create({ data: { shopId: user.shopId, userId: user.id, type: "SHOP_UPDATED", title: `Shop settings updated: ${shop.name}` } });
    return NextResponse.json({ shop });
  } catch (error) {
    return apiError(error, "Unable to update shop settings.");
  }
}
