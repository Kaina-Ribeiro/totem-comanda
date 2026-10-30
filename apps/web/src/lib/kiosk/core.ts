import "server-only";

import { after } from "next/server";

import { coreApi, problemCode, type ProblemCode } from "@/lib/core/client";
import { EtagCache } from "@/lib/core/etag-cache";
import type { components } from "@/lib/core-api";
import { asDevice, DeviceAuthError, type DeviceAuthHeaders } from "@/lib/device/session";

import type { Language } from "./strings";

type Schemas = components["schemas"];
export type Menu = Schemas["Menu"];

/** What a kiosk Server Action returns: data, or a stable code to switch on. */
export type Result<T> = { ok: true; data: T } | { ok: false; code: ResultCode; detail?: string };
export type ResultCode = ProblemCode | "CORE_UNAVAILABLE" | "DEVICE_UNAVAILABLE";

export const success = <T>(data: T): Result<T> => ({ ok: true, data });

/** Maps a failed Core API answer, or a thrown error, to a Result code. */
export function failure(error: unknown, status?: number): Result<never> {
  if (error instanceof DeviceAuthError) {
    return {
      ok: false,
      code: error.code === "CORE_UNAVAILABLE" ? "CORE_UNAVAILABLE" : "DEVICE_UNAVAILABLE",
    };
  }
  const code = problemCode(error);
  if (code) {
    const detail = (error as Schemas["Problem"]).detail;
    return { ok: false, code, ...(detail ? { detail } : {}) };
  }
  if (status === 401) return { ok: false, code: "UNAUTHORIZED" };
  return { ok: false, code: "CORE_UNAVAILABLE" };
}

/** Runs a device call and turns any outcome into a Result. */
export async function deviceCall<T>(
  call: (
    headers: DeviceAuthHeaders,
    deviceId: string,
  ) => Promise<{ response: Response; data?: T; error?: unknown }>,
): Promise<Result<T>> {
  try {
    const result = await asDevice(call);
    // 204 answers carry no data.
    if (result.response.ok) return success(result.data as T);
    return failure(result.error, result.response.status);
  } catch (error) {
    return failure(error);
  }
}

const menus = new EtagCache<Menu>();

/**
 * The active menu in `language` (OP-START-04), loaded once per journey. Sends
 * the last ETag per device and language, so an unchanged menu costs a 304.
 */
export async function loadActiveMenu(language: Language): Promise<Result<Menu>> {
  try {
    const answer = await asDevice(async (headers, deviceId) => {
      const key = `${deviceId}:${language}`;
      const etag = menus.ifNoneMatch(key);
      const result = await coreApi().GET("/v1/menus/active", {
        headers,
        params: { query: { language }, header: etag ? { "If-None-Match": etag } : {} },
      });
      const menu = menus.resolve(
        key,
        result.response.status,
        result.response.headers.get("ETag"),
        result.data,
      );
      return { response: result.response, menu, error: result.error };
    });
    if (answer.menu) return success(answer.menu);
    return failure(answer.error, answer.response.status);
  } catch (error) {
    return failure(error);
  }
}

/** The owner's string overrides for `language`; empty on any failure (bundle wins). */
export async function loadLanguagePack(language: Language): Promise<Record<string, string>> {
  const result = await deviceCall((headers) =>
    coreApi().GET("/v1/languages/{code}", { headers, params: { path: { code: language } } }),
  );
  return result.ok ? result.data.strings : {};
}

/** Fire-and-forget device report after the response is sent (OP-KIOSK-04). */
export function reportKeyAction(report: Schemas["DeviceKeyActionReport"]): void {
  after(async () => {
    const result = await deviceCall((headers) =>
      coreApi().POST("/v1/devices/status", { headers, body: report }),
    );
    if (!result.ok && result.code !== "CORE_UNAVAILABLE")
      console.warn(`Key action report: ${result.code}`);
  });
}
