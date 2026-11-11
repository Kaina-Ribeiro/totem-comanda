"use server";

import { coreApi } from "@/lib/core/client";
import { requireDeviceKind } from "@/lib/device/config";
import { failure } from "@/lib/kiosk/core";
import {
  type Availability,
  cancelAsOwner,
  type CancelReason,
  deviceCallAs,
  getKitchenPace,
  type KitchenOrder,
  type KitchenStatus,
  type Result,
  type StorePace,
} from "@/lib/kitchen/core";

const STATUSES = new Set<KitchenStatus>(["PREPARING", "READY", "COLLECTED"]);

/**
 * Moves an order along New → Preparing → Ready → Collected, or one step back.
 * With `expectedVersion`, Go refuses if another screen moved it first.
 */
export async function moveOrder(
  number: string,
  status: KitchenStatus,
  expectedVersion?: number,
): Promise<Result<KitchenOrder>> {
  if (!STATUSES.has(status)) return { ok: false, code: "VALIDATION_FAILED" };
  return deviceCallAs("KITCHEN", (headers) =>
    coreApi().POST("/v2/kitchen/orders/{number}/status", {
      headers,
      params: { path: { number } },
      body: { status, expectedVersion },
    }),
  );
}

/**
 * "Acabou": sets a product, or one option of it (both are menu entities),
 * unavailable until someone brings it back; `available: true` is the 5 s
 * undo. Orders already placed stay open (KDS BR-027).
 */
export async function setAvailable(id: string, available: boolean): Promise<Result<Availability>> {
  if (typeof id !== "string" || !id || typeof available !== "boolean") {
    return { ok: false, code: "VALIDATION_FAILED" };
  }
  return deviceCallAs("KITCHEN", (headers) =>
    coreApi().PUT("/v2/kitchen/availability", { headers, body: { id, available } }),
  );
}

const REASONS = new Set<CancelReason>(["ITEM_SOLD_OUT", "CANNOT_PREPARE", "OTHER"]);

/**
 * "Cancelar" in the order detail: only from the kitchen device, and only with
 * the owner's email and password (no PIN, decision 12).
 */
export async function cancelOrder(
  number: string,
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
  return cancelAsOwner(number, { email: email.trim(), password }, reason);
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
    coreApi().PUT("/v2/kitchen/pace", {
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
  return deviceCallAs("KITCHEN", (headers) => coreApi().POST("/v2/kitchen/close-day", { headers }));
}

/** Reads the pace again (the owner may have changed it on Início). */
export async function readKitchenPace(): Promise<Result<StorePace>> {
  return getKitchenPace();
}
