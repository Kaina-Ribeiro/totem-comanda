import { type NextRequest, NextResponse } from "next/server";

// Kept in sync with src/lib/device/credentials.ts (the proxy stays free of
// server-only modules).
const DEVICE_COOKIE = "comanda_device";
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;
// Kept in sync with src/lib/admin/session.ts.
const OWNER_COOKIE = "comanda_owner";
const ADMIN_LOGIN = "/admin/login";

/**
 * Optimistic check for device areas: no device cookie means this browser was
 * never provisioned, so send it to /setup. The cookie's content is verified
 * later, when the BFF uses it. Each visit renews the cookie's lifetime.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin")) return adminGate(request);

  const sealed = request.cookies.get(DEVICE_COOKIE)?.value;
  if (!sealed) {
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const response = NextResponse.next();
  response.cookies.set(DEVICE_COOKIE, sealed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
  return response;
}

/**
 * Optimistic check for the back office: no owner cookie means not signed in.
 * The token itself is checked when the BFF uses it (a 401 also lands on login).
 */
function adminGate(request: NextRequest) {
  const signedIn = request.cookies.has(OWNER_COOKIE);
  const atLogin = request.nextUrl.pathname === ADMIN_LOGIN;
  if (!signedIn && !atLogin) return NextResponse.redirect(new URL(ADMIN_LOGIN, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/kiosk/:path*", "/kitchen/:path*", "/admin/:path*", "/admin"],
};
