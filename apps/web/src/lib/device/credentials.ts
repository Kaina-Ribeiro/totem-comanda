import "server-only";

import { cookies } from "next/headers";

import { type DeviceCredentials, sealCredentials, unsealCredentials } from "./seal";

export type { DeviceCredentials };

export const DEVICE_COOKIE = "comanda_device";
/** Chromium caps cookie lifetime at 400 days; proxy.ts renews it on every visit. */
export const DEVICE_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

function cookieKey(): string {
  const key = process.env.DEVICE_COOKIE_SECRET;
  if (!key) throw new Error("DEVICE_COOKIE_SECRET is not set (see apps/web/.env.example)");
  return key;
}

/**
 * Where this browser's device id and secret live. OPEN QUESTION (GAB-13,
 * docs/data-model-and-api.md "Where the device secret lives"): for now they
 * are typed once at /setup and kept encrypted in an HttpOnly cookie. Any other
 * answer only changes this function and saveDeviceCredentials.
 */
export async function getDeviceCredentials(): Promise<DeviceCredentials | null> {
  const sealed = (await cookies()).get(DEVICE_COOKIE)?.value;
  return sealed ? unsealCredentials(sealed, cookieKey()) : null;
}

/** Stores the credentials for this browser. Server Actions and Route Handlers only. */
export async function saveDeviceCredentials(credentials: DeviceCredentials): Promise<void> {
  (await cookies()).set(DEVICE_COOKIE, sealCredentials(credentials, cookieKey()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
}
