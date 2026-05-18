import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getExpiredSessionCookieOptions, verifySessionToken } from "@/lib/session";

const protectedPrefixes = ["/admin", "/staff", "/settings"];

function isProtected(path: string) {
  return protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function dashboard(role: string) {
  return role === "ADMIN" || role === "MANAGER" ? "/admin/dashboard" : "/staff/dashboard";
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const path = req.nextUrl.pathname;

  if (isProtected(path) && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    const res = NextResponse.redirect(url);
    res.cookies.set(SESSION_COOKIE_NAME, "", getExpiredSessionCookieOptions());
    return res;
  }

  if (session && (path === "/login" || path === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = dashboard(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (session && path.startsWith("/admin") && session.role !== "ADMIN" && session.role !== "MANAGER") {
    const url = req.nextUrl.clone();
    url.pathname = dashboard(session.role);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  if (isProtected(path)) res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}

export const config = { matcher: ["/admin/:path*", "/staff/:path*", "/settings/:path*", "/login", "/signup"] };
