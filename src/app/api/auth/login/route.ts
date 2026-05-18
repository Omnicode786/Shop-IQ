import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/api-response";
import { dashboardForRole } from "@/lib/workspace";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await prisma.user.findUnique({ where: { email: String(email || "").toLowerCase() }, include: { shop: true } });
    if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(String(password || ""), user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
    }
    await createSession({ sub: user.id, shopId: user.shopId, role: user.role, name: user.name, email: user.email });
    return NextResponse.json({ ok: true, redirectTo: dashboardForRole(user.role) });
  } catch (error) { return apiError(error, "Unable to login right now."); }
}
