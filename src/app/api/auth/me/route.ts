import { getCurrentUser } from "@/lib/auth";
import { apiError, unauthorized } from "@/lib/api-response";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, shop: user.shop } });
  } catch (error) {
    return apiError(error, "Unable to load your session.");
  }
}
