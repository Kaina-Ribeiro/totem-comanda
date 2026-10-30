import "server-only";

import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";
import { deviceCallAs, type Result } from "@/lib/kiosk/core";

export type KitchenOrder = components["schemas"]["KitchenOrder"];
export type KitchenStatus = components["schemas"]["KitchenStatusUpdate"]["status"];

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
