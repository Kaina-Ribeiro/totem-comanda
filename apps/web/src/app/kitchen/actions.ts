"use server";

import { coreApi } from "@/lib/core/client";
import { requireDeviceKind } from "@/lib/device/config";
import { deviceCallAs, failure, type Result } from "@/lib/kiosk/core";
import {
  cancelAsOwner,
  getKitchenPace,
  type CancelReason,
  type KitchenAvailability,
  type KitchenOrder,
  type KitchenStatus,
  type StorePace,
} from "@/lib/kitchen/core";

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

const REASONS = new Set<CancelReason>(["ITEM_SOLD_OUT", "CANNOT_PREPARE", "OTHER"]);

/**
 * "Cancelar" in the order detail: only from the kitchen device, and only with
 * the owner's email and password (no PIN, decision 12).
 */
export async function cancelOrder(
  orderId: string,
  email: string,
  password: string,
  reason: CancelReason,
): Promise<Result<KitchenOrder>> {
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password ||
    email.length > 254 ||
    password.length > 200 ||
    !REASONS.has(reason)
  ) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  try {
    await requireDeviceKind("KITCHEN");
  } catch (error) {
    return failure(error);
  }
  return cancelAsOwner(orderId, { email: email.trim(), password }, reason);
}

/** "Ritmo da cozinha" (K4): Normal, Movimentado, or paused for 15 or 30 min. */
export async function setKitchenPace(
  pace: StorePace["pace"],
  pauseMinutes?: 15 | 30,
): Promise<Result<StorePace>> {
  if (pace !== "NORMAL" && pace !== "BUSY" && pace !== "PAUSED") {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  if (pace === "PAUSED" && pauseMinutes !== 15 && pauseMinutes !== 30) {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  return deviceCallAs("KITCHEN", (headers) =>
    coreApi().PUT("/v1/kitchen/pace", {
      headers,
      body: pace === "PAUSED" ? { pace, pauseMinutes } : { pace },
    }),
  );
}

/**
 * "Encerrar o dia" (plan G-K9): Go moves every open order of today to
 * NOT_COLLECTED and answers how many it moved.
 */
export async function closeKitchenDay(): Promise<Result<{ count: number }>> {
  return deviceCallAs("KITCHEN", (headers) => coreApi().POST("/v1/kitchen/close-day", { headers }));
}

/** Reads the pace again (the owner may have changed it on Início). */
export async function readKitchenPace(): Promise<Result<StorePace>> {
  return getKitchenPace();
}
