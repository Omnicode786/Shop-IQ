import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = {
  sub: string;
  shopId: string;
  role: "ADMIN" | "MANAGER" | "STAFF";
  name: string;
  email: string;
};

export const SESSION_COOKIE_NAME = "shopiq_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ISSUER = "shopiq";
const AUDIENCE = "shopiq-app";
const DEV_SECRET = "shopiq-dev-secret-change-before-production";

function secret() {
  const value = process.env.JWT_SECRET || DEV_SECRET;
  if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || value.length < 32 || value.includes("replace"))) {
    throw new Error("JWT_SECRET must be a strong production value.");
  }
  return new TextEncoder().encode(value);
}

export function getSessionCookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}

export function getExpiredSessionCookieOptions() {
  return { ...getSessionCookieOptions(0), expires: new Date(0) };
}

export async function signSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE });
    if (typeof payload.sub !== "string" || typeof payload.shopId !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") return null;
    if (payload.role !== "ADMIN" && payload.role !== "MANAGER" && payload.role !== "STAFF") return null;
    return { sub: payload.sub, shopId: payload.shopId, role: payload.role, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
