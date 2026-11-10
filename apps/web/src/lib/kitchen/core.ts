import "server-only";

import { problemCode } from "@/lib/core/client";
import { coreApiV2, coreApiV2Url } from "@/lib/core/client-v2";
import type { components } from "@/lib/core-api-v2";
import { type DeviceConfig, requireDeviceKind } from "@/lib/device/config";
import { deviceCall, failure, type Result, success } from "@/lib/kiosk/core-v2";

import type { KitchenOrder } from "./order";

// The kitchen's way to Core v2 (pilot, COM-148). The device token comes from
// the shared device session, which Core and the mock accept on /v1 and /v2.

type Schemas = components["schemas"];
export type { KitchenOrder };
export type { Result };
export type KitchenStatus = Schemas["KitchenStatusUpdate"]["status"];
export type StorePace = Schemas["StorePace"];
export type CancelReason = Schemas["OrderCancelRequest"]["reason"];
export type Availability = Schemas["LightMenuResponse"];

/** deviceCall for operations that only one kind of device may run. */
export async function deviceCallAs<T>(
  kind: DeviceConfig["kind"],
  call: Parameters<typeof deviceCall<T>>[0],
): Promise<Result<T>> {
  try {
    await requireDeviceKind(kind);
  } catch (error) {
    return failure(error);
  }
  return deviceCall(call);
}

/**
 * `open`: paid orders not yet collected, oldest first. `collected`: today's
 * collected orders, newest hand-over first ("Retirados hoje", plan G-K7).
 */
export function listKitchenOrders(
  status: "open" | "collected" = "open",
): Promise<Result<KitchenOrder[]>> {
  return deviceCallAs("KITCHEN", (headers) =>
    coreApiV2().GET("/v2/kitchen/orders", { headers, params: { query: { status } } }),
  );
}

/**
 * Where the BFF opens the kitchen event stream. Prism's proxy buffers whole
 * responses, so an SSE stream never gets through it; CORE_STREAM_URL points
 * past it in development (the mock's own port). Falls back to CORE_API_V2_URL.
 */
export function kitchenStreamUrl(): string {
  return `${process.env.CORE_STREAM_URL ?? coreApiV2Url()}/v2/kitchen/stream`;
}

/** The store's pace (Normal, Movimentado, Pausado), as the kitchen sees it. */
export function getKitchenPace(): Promise<Result<StorePace>> {
  return deviceCallAs("KITCHEN", (headers) => coreApiV2().GET("/v2/kitchen/pace", { headers }));
}

/**
 * Cancels an order the kitchen cannot make, confirmed with the owner's login
 * (plan decision 12, contract cancelOrder): signs the owner in, cancels with
 * that token and drops it. Nothing is stored, so the kitchen never holds an
 * owner session. The refund is done in the Mercado Pago panel (SPEC 4.6).
 */
export async function cancelAsOwner(
  number: string,
  owner: { email: string; password: string },
  reason: CancelReason,
): Promise<Result<KitchenOrder>> {
  try {
    const login = await coreApiV2().POST("/v2/admin/auth/login", { body: owner });
    if (!login.data) {
      const invalid =
        problemCode(login.error) === "INVALID_CREDENTIALS" || login.response.status === 401;
      return { ok: false, code: invalid ? "INVALID_CREDENTIALS" : "CORE_UNAVAILABLE" };
    }
    const result = await coreApiV2().POST("/v2/admin/orders/{number}/cancel", {
      headers: { Authorization: `Bearer ${login.data.accessToken}` },
      params: { path: { number } },
      body: { reason },
    });
    return result.data ? success(result.data) : failure(result.error, result.response.status);
  } catch (error) {
    return failure(error);
  }
}
