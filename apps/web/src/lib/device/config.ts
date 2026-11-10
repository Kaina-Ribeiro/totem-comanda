import "server-only";

import { coreApi } from "@/lib/core/client";
import { EtagCache } from "@/lib/core/etag-cache";
import { isCoreDownSimulated } from "@/lib/core/mock-scenarios";
import type { components } from "@/lib/core-api";

import { asDevice, DeviceAuthError } from "./session";

export type DeviceConfig = components["schemas"]["DeviceConfig"];

const configs = new EtagCache<DeviceConfig>();

/**
 * This device's configuration (OP-KIOSK-06). Sends the last ETag, so an
 * unchanged config costs a 304. Throws DeviceAuthError("CORE_UNAVAILABLE")
 * when the Core API cannot answer; callers retry (BR-KIOSK-02).
 */
export async function getDeviceConfig(): Promise<DeviceConfig> {
  if (await isCoreDownSimulated()) throw new DeviceAuthError("CORE_UNAVAILABLE");

  let config: DeviceConfig | undefined;
  try {
    config = await asDevice(async (headers, deviceId) => {
      const etag = configs.ifNoneMatch(deviceId);
      const result = await coreApi().GET("/v2/devices/me/config", {
        headers,
        params: { header: etag ? { "If-None-Match": etag } : {} },
      });
      return {
        response: result.response,
        config: configs.resolve(
          deviceId,
          result.response.status,
          result.response.headers.get("ETag"),
          result.data,
        ),
      };
    }).then((answer) => answer.config);
  } catch (error) {
    if (error instanceof DeviceAuthError) throw error;
    throw new DeviceAuthError("CORE_UNAVAILABLE");
  }

  if (!config) throw new DeviceAuthError("CORE_UNAVAILABLE");
  return config;
}

/**
 * Throws DeviceAuthError("WRONG_DEVICE") unless this browser is a `kind`
 * device. The contract has no such check, so the BFF keeps a kiosk out of the
 * kitchen and the other way round. The config costs a 304 once it is cached.
 */
export async function requireDeviceKind(kind: DeviceConfig["kind"]): Promise<void> {
  if ((await getDeviceConfig()).kind !== kind) throw new DeviceAuthError("WRONG_DEVICE");
}
