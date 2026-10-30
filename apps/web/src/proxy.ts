import { type NextRequest, NextResponse } from "next/server";

// Kept in sync with src/lib/device/credentials.ts (the proxy stays free of
// server-only modules).
const DEVICE_COOKIE = "comanda_device";
const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * Optimistic check for device areas: no device cookie means this browser was
 * never provisioned, so send it to /setup. The cookie's content is verified
 * later, when the BFF uses it. Each visit renews the cookie's lifetime.
 */
export function proxy(request: NextRequest) {
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

export const config = {
  matcher: ["/kiosk/:path*", "/kitchen/:path*"],
};
