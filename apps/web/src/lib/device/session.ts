import "server-only";

import { connection } from "next/server";

import { coreApi, problemCode } from "@/lib/core/client";

import { type DeviceCredentials, getDeviceCredentials } from "./credentials";
import { DeviceTokenCache, type IssuedToken } from "./token-cache";

export type DeviceAuthErrorCode =
  | "NOT_PROVISIONED"
  | "INVALID_CREDENTIALS"
  | "DEVICE_DISABLED"
  /** A kiosk calling kitchen operations, or a kitchen screen calling kiosk ones. */
  | "WRONG_DEVICE"
  | "CORE_UNAVAILABLE";

export class DeviceAuthError extends Error {
  constructor(readonly code: DeviceAuthErrorCode) {
    super(`Device authentication failed: ${code}`);
    this.name = "DeviceAuthError";
  }
}

/** Exchanges the device id and secret for a short-lived token (`POST /v2/devices/auth`). */
export async function authenticateDevice(credentials: DeviceCredentials): Promise<IssuedToken> {
  let result;
  try {
    result = await coreApi().POST("/v2/devices/auth", { body: credentials });
  } catch {
    throw new DeviceAuthError("CORE_UNAVAILABLE");
  }
  if (result.data) return result.data;

  const code = problemCode(result.error);
  if (code === "DEVICE_DISABLED") throw new DeviceAuthError("DEVICE_DISABLED");
  if (code === "INVALID_CREDENTIALS" || result.response.status === 401) {
    throw new DeviceAuthError("INVALID_CREDENTIALS");
  }
  throw new DeviceAuthError("CORE_UNAVAILABLE");
}

// One cache per server process. Not kept on globalThis: after a dev hot reload
// it would hold the old authenticateDevice, whose errors fail `instanceof`.
const tokens = new DeviceTokenCache(authenticateDevice);

/** Drops every cached token, so the next call authenticates again (used by /dev/mock). */
export function forgetDeviceTokens(): void {
  tokens.clear();
}

export type DeviceAuthHeaders = { Authorization: string };

/**
 * Runs a Core API call as this browser's device. Adds the bearer token, and on
 * a 401 drops the token, authenticates again and repeats the call once.
 * Throws DeviceAuthError when the device is not provisioned, disabled or its
 * credentials are wrong.
 */
export async function asDevice<R extends { response: Response }>(
  call: (headers: DeviceAuthHeaders, deviceId: string) => Promise<R>,
): Promise<R> {
  // Device calls are per request: never part of a prerendered shell.
  await connection();
  const credentials = await getDeviceCredentials();
  if (!credentials) throw new DeviceAuthError("NOT_PROVISIONED");

  const headers = async () => ({ Authorization: `Bearer ${await tokens.get(credentials)}` });
  const first = await call(await headers(), credentials.deviceId);
  if (first.response.status !== 401) return first;

  tokens.invalidate(credentials);
  return call(await headers(), credentials.deviceId);
}
