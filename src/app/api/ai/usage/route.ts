import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGeminiUsageSnapshot } from "@/lib/ai";
import { apiError, forbidden, unauthorized } from "@/lib/api-response";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    if (!can(user.role, "assistant", "read")) return forbidden();
    return NextResponse.json(getGeminiUsageSnapshot(), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return apiError(error, "Unable to load AI usage right now.");
  }
}
