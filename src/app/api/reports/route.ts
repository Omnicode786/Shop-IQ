import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";
import { getDashboardSnapshot } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "reports", "read")) return forbidden();
    return NextResponse.json(await getDashboardSnapshot(user.shopId, user.role));
  } catch (error) {
    return apiError(error, "Unable to load reports right now.");
  }
}
