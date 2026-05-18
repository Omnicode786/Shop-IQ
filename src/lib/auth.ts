import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, getExpiredSessionCookieOptions, getSessionCookieOptions, signSessionToken, verifySessionToken, type SessionPayload } from "@/lib/session";

export async function createSession(payload: SessionPayload) {
  const token = await signSessionToken(payload);
  cookies().set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return token;
}

export function destroySession() {
  cookies().set(SESSION_COOKIE_NAME, "", getExpiredSessionCookieOptions());
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.sub }, include: { shop: true } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
