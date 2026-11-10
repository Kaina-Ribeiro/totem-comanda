import "server-only";

import { after } from "next/server";

import { problemCode } from "@/lib/core/client";
import { coreApiV2, type ProblemCodeV2, type ProblemV2 } from "@/lib/core/client-v2";
import { EtagCache } from "@/lib/core/etag-cache";
import { isCoreDownSimulated } from "@/lib/core/mock-scenarios";
import type { components } from "@/lib/core-api-v2";
import { asDevice, DeviceAuthError, type DeviceAuthHeaders } from "@/lib/device/session";

import type { Language } from "./strings";

// The kiosk's way to Core v2 (pilot, COM-146). The device token comes from the
// shared device session (Core and the mock accept it on /v1 and /v2); the
// kitchen keeps using lib/kiosk/core.ts on /v1 until phase 4 (COM-148).

type Schemas = components["schemas"];
export type MenuResponse = Schemas["MenuResponse"];
export type KioskConfig = Schemas["DeviceConfig"];

/** What a kiosk Server Action returns: data, or a stable code to switch on. */
export type Result<T> = { ok: true; data: T } | { ok: false; code: ResultCode; detail?: string };
export type ResultCode = ProblemCodeV2 | "CORE_UNAVAILABLE" | "DEVICE_UNAVAILABLE";

export const success = <T>(data: T): Result<T> => ({ ok: true, data });

/** Maps a failed Core answer, or a thrown error, to a Result code. */
export function failure(error: unknown, status?: number): Result<never> {
  if (error instanceof DeviceAuthError) {
    return {
      ok: false,
      code: error.code === "CORE_UNAVAILABLE" ? "CORE_UNAVAILABLE" : "DEVICE_UNAVAILABLE",
    };
  }
  const code = problemCode(error) as ProblemCodeV2 | undefined;
  if (code) {
    const detail = (error as ProblemV2).detail;
    return { ok: false, code, ...(detail ? { detail } : {}) };
  }
  if (status === 401) return { ok: false, code: "UNAUTHORIZED" };
  return { ok: false, code: "CORE_UNAVAILABLE" };
}

/** Runs a device call and turns any outcome into a Result. 204 answers carry no data. */
export async function deviceCall<T>(
  call: (headers: DeviceAuthHeaders) => Promise<{ response: Response; data?: T; error?: unknown }>,
): Promise<Result<T>> {
  try {
    const result = await asDevice(call);
    if (result.response.ok) return success((result.data ?? null) as T);
    return failure(result.error, result.response.status);
  } catch (error) {
    return failure(error);
  }
}

const configs = new EtagCache<KioskConfig>();

/**
 * This device's v2 configuration (store, pace, terminal). Sends the last
 * ETag, so an unchanged config costs a 304. Throws DeviceAuthError when Core
 * cannot answer or the device cannot sign in, like the shared getDeviceConfig.
 */
export async function getKioskConfig(): Promise<KioskConfig> {
  if (await isCoreDownSimulated()) throw new DeviceAuthError("CORE_UNAVAILABLE");
  let config: KioskConfig | undefined;
  try {
    config = await asDevice(async (headers, deviceId) => {
      const etag = configs.ifNoneMatch(deviceId);
      const result = await coreApiV2().GET("/v2/devices/me/config", {
        headers,
        params: { header: etag ? { "If-None-Match": etag } : {} },
      });
      const value = configs.resolve(deviceId, result.response.status, result.response.headers.get("ETag"), result.data);
      return { response: result.response, value };
    }).then((answer) => answer.value);
  } catch (error) {
    if (error instanceof DeviceAuthError) throw error;
    throw new DeviceAuthError("CORE_UNAVAILABLE");
  }
  if (!config) throw new DeviceAuthError("CORE_UNAVAILABLE");
  return config;
}

/**
 * Null for a kiosk; otherwise the Result to return before any Core call. The
 * contract has no such check, so without it a kitchen tablet could pay (COM-109).
 */
export async function notKiosk(): Promise<Result<never> | null> {
  try {
    if ((await getKioskConfig()).kind !== "KIOSK") throw new DeviceAuthError("WRONG_DEVICE");
    return null;
  } catch (error) {
    return failure(error);
  }
}

/** deviceCall for kiosk-only operations. */
export async function kioskCall<T>(call: Parameters<typeof deviceCall<T>>[0]): Promise<Result<T>> {
  return (await notKiosk()) ?? deviceCall(call);
}

const menus = new EtagCache<MenuResponse>();

/** The active menu in `language`, loaded once per journey; an unchanged menu costs a 304. */
export async function loadActiveMenu(language: Language): Promise<Result<MenuResponse>> {
  try {
    const answer = await asDevice(async (headers, deviceId) => {
      const key = `${deviceId}:${language}`;
      const etag = menus.ifNoneMatch(key);
      const result = await coreApiV2().GET("/v2/menus/active", {
        headers,
        params: { query: { language }, header: etag ? { "If-None-Match": etag } : {} },
      });
      const menu = menus.resolve(key, result.response.status, result.response.headers.get("ETag"), result.data);
      return { response: result.response, menu, error: result.error };
    });
    if (answer.menu) return success(answer.menu);
    return failure(answer.error, answer.response.status);
  } catch (error) {
    return failure(error);
  }
}

/** The owner's string overrides for `language`; empty on any failure (the bundle wins). */
export async function loadLanguagePack(language: Language): Promise<Record<string, string>> {
  const result = await deviceCall((headers) =>
    coreApiV2().GET("/v2/languages/{code}", { headers, params: { path: { code: language } } }),
  );
  return result.ok ? result.data.strings : {};
}

/** Fire-and-forget device report after the response is sent. */
export function reportKeyAction(report: Schemas["DeviceKeyActionReport"]): void {
  after(async () => {
    const result = await deviceCall((headers) => coreApiV2().POST("/v2/devices/status", { headers, body: report }));
    if (!result.ok && result.code !== "CORE_UNAVAILABLE") console.warn(`Key action report: ${result.code}`);
  });
}
