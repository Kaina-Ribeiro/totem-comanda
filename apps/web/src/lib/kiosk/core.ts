import "server-only";

import { after } from "next/server";

import { coreApi, type Problem, problemCode, type ProblemCode } from "@/lib/core/client";
import { EtagCache } from "@/lib/core/etag-cache";
import type { components } from "@/lib/core-api";
import { getDeviceConfig } from "@/lib/device/config";
import { asDevice, DeviceAuthError, type DeviceAuthHeaders } from "@/lib/device/session";

import { readMenu } from "./menu-graph";
import { menuPhotos } from "./photos";
import type { Language } from "./strings";
import { photoWarmer } from "./warm-photos";

// The kiosk's way to the Core API (pilot, COM-146). The device token comes
// from the shared device session (lib/device/session.ts).

type Schemas = components["schemas"];
export type MenuResponse = Schemas["MenuResponse"];
export type KioskConfig = Schemas["DeviceConfig"];

/** What a kiosk Server Action returns: data, or a stable code to switch on. */
export type Result<T> = { ok: true; data: T } | { ok: false; code: ResultCode; detail?: string };
export type ResultCode = ProblemCode | "CORE_UNAVAILABLE" | "DEVICE_UNAVAILABLE";

export const success = <T>(data: T): Result<T> => ({ ok: true, data });

/** Maps a failed Core answer, or a thrown error, to a Result code. */
export function failure(error: unknown, status?: number): Result<never> {
  if (error instanceof DeviceAuthError) {
    return {
      ok: false,
      code: error.code === "CORE_UNAVAILABLE" ? "CORE_UNAVAILABLE" : "DEVICE_UNAVAILABLE",
    };
  }
  const code = problemCode(error) as ProblemCode | undefined;
  if (code) {
    const detail = (error as Problem).detail;
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

/** This device's configuration (store, pace, terminal): the shared, ETag-cached getDeviceConfig. */
export const getKioskConfig: () => Promise<KioskConfig> = getDeviceConfig;

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
      const result = await coreApi().GET("/v2/menus/active", {
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
    coreApi().GET("/v2/languages/{code}", { headers, params: { path: { code: language } } }),
  );
  return result.ok ? result.data.strings : {};
}

/**
 * Resizes the active menu's photos in the background when it is time: on the
 * first kiosk render after the server starts, then every ten minutes. The
 * optimizer's work is then done before a guest opens the menu (COM-173).
 * Production only. The menu is read here, during the render, because that
 * needs the device cookie; only the resizing runs after the response.
 */
export async function warmMenuPhotos(language: Language): Promise<void> {
  if (process.env.NODE_ENV !== "production" || !photoWarmer.due(Date.now())) return;
  const menu = await loadActiveMenu(language);
  if (!menu.ok) {
    photoWarmer.retry();
    return;
  }
  const urls = menuPhotos(readMenu(menu.data));
  after(async () => {
    const started = Date.now();
    const count = await photoWarmer.warm(urls);
    if (count > 0) console.info(`Photo warm-up: ${count} variants in ${Date.now() - started} ms`);
  });
}

/** Fire-and-forget device report after the response is sent. */
export function reportKeyAction(report: Schemas["DeviceKeyActionReport"]): void {
  after(async () => {
    const result = await deviceCall((headers) => coreApi().POST("/v2/devices/status", { headers, body: report }));
    if (!result.ok && result.code !== "CORE_UNAVAILABLE") console.warn(`Key action report: ${result.code}`);
  });
}
