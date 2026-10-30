"use server";

import { coreApi } from "@/lib/core/client";
import { deviceCallAs, type Result } from "@/lib/kiosk/core";
import type { KitchenOrder, KitchenStatus } from "@/lib/kitchen/core";

const STATUSES = new Set<KitchenStatus>(["PREPARING", "READY", "COLLECTED"]);

/** Moves an order along New → Preparing → Ready → Collected. */
export async function moveOrder(
  orderId: string,
  status: KitchenStatus,
): Promise<Result<KitchenOrder>> {
  if (!STATUSES.has(status)) return { ok: false, code: "VALIDATION_FAILED" };
  return deviceCallAs("KITCHEN", (headers) =>
    coreApi().POST("/v1/kitchen/orders/{orderId}/status", {
      headers,
      params: { path: { orderId } },
      body: { status },
    }),
  );
}
