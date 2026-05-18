import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { apiError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const { shopName, name, email, password } = await request.json();
    if (!shopName || !name || !email || !password || String(password).length < 8) return NextResponse.json({ error: "Please provide shop, name, email and 8+ character password." }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (existing) return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    const hash = await bcrypt.hash(String(password), 12);
    const shop = await prisma.shop.create({ data: { name: String(shopName), city: "Karachi", users: { create: { name: String(name), email: String(email).toLowerCase(), passwordHash: hash, role: "ADMIN" } } }, include: { users: true } });
    const user = shop.users[0];
    await createSession({ sub: user.id, shopId: shop.id, role: user.role, name: user.name, email: user.email });
    return NextResponse.json({ ok: true, redirectTo: "/admin/dashboard" });
  } catch (error) { return apiError(error, "Unable to create workspace right now."); }
}
