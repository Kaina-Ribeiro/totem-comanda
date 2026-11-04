import "server-only";

import { coreApi, problemCode } from "@/lib/core/client";
import type { components } from "@/lib/core-api";
import { deviceCallAs, failure, type Result, success } from "@/lib/kiosk/core";

export type KitchenOrder = components["schemas"]["KitchenOrder"];
export type KitchenStatus = components["schemas"]["KitchenStatusUpdate"]["status"];
export type KitchenAvailability = components["schemas"]["KitchenAvailability"];

/** Paid orders not yet collected, oldest first. */
export function listKitchenOrders(): Promise<Result<KitchenOrder[]>> {
  return deviceCallAs("KITCHEN", (headers) =>
    coreApi().GET("/v1/kitchen/orders", { headers, params: { query: { status: "open" } } }),
  );
}

/**
 * Where the BFF opens the kitchen event stream. Prism's proxy buffers whole
 * responses, so an SSE stream never gets through it; CORE_STREAM_URL points
 * past it in development (the mock's own port). Falls back to CORE_API_URL.
 */
export function kitchenStreamUrl(): string {
  const base = process.env.CORE_STREAM_URL ?? process.env.CORE_API_URL;
  if (!base) throw new Error("CORE_API_URL is not set (see apps/web/.env.example)");
  return `${base}/v1/kitchen/stream`;
}

export type StorePace = components["schemas"]["StorePace"];

/** The store's pace (Normal, Movimentado, Pausado), as the kitchen sees it. */
export function getKitchenPace(): Promise<Result<StorePace>> {
  return deviceCallAs("KITCHEN", (headers) => coreApi().GET("/v1/kitchen/pace", { headers }));
}

export type CancelReason = components["schemas"]["OrderCancelRequest"]["reason"];

/**
 * Cancels an order the kitchen cannot make, confirmed with the owner's login
 * (plan decision 12, contract cancelOrder): signs the owner in, cancels with
 * that token and drops it. Nothing is stored, so the kitchen never holds an
 * owner session.
 */
export async function cancelAsOwner(
  orderId: string,
  owner: { email: string; password: string },
  reason: CancelReason,
): Promise<Result<KitchenOrder>> {
  try {
    const login = await coreApi().POST("/v1/admin/auth/login", { body: owner });
    if (!login.data) {
      const invalid =
        problemCode(login.error) === "INVALID_CREDENTIALS" || login.response.status === 401;
      return { ok: false, code: invalid ? "INVALID_CREDENTIALS" : "CORE_UNAVAILABLE" };
    }
    const result = await coreApi().POST("/v1/admin/orders/{orderId}/cancel", {
      headers: { Authorization: `Bearer ${login.data.accessToken}` },
      params: { path: { orderId } },
      body: { reason },
    });
    return result.data ? success(result.data) : failure(result.error, result.response.status);
  } catch (error) {
    return failure(error);
  }
}
