"use server";

import { coreApi } from "@/lib/core/client";
import { deviceCallAs, type Result } from "@/lib/kiosk/core";
import type { KitchenAvailability, KitchenOrder, KitchenStatus } from "@/lib/kitchen/core";

const STATUSES = new Set<KitchenStatus>(["PREPARING", "READY", "COLLECTED"]);

/**
 * Moves an order along New → Preparing → Ready → Collected, or one step back.
 * With `expectedVersion`, Go refuses if another screen moved it first.
 */
export async function moveOrder(
  orderId: string,
  status: KitchenStatus,
  expectedVersion?: number,
): Promise<Result<KitchenOrder>> {
  if (!STATUSES.has(status)) return { ok: false, code: "VALIDATION_FAILED" };
  return deviceCallAs("KITCHEN", (headers) =>
    coreApi().POST("/v1/kitchen/orders/{orderId}/status", {
      headers,
      params: { path: { orderId } },
      body: { status, expectedVersion },
    }),
  );
}

/**
 * "Acabou": marks an item, or one option of it, sold out for today's business
 * date; `soldOut: false` brings it back (the 5 s undo). Orders already placed
 * stay open (KDS BR-027).
 */
export async function setSoldOut(
  itemId: string,
  optionId: string | null,
  soldOut: boolean,
): Promise<Result<KitchenAvailability>> {
  return deviceCallAs("KITCHEN", (headers) =>
    coreApi().PUT("/v1/kitchen/availability", { headers, body: { itemId, optionId, soldOut } }),
  );
}
