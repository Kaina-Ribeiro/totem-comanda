import type { components } from "@/lib/core-api";

// Type-only: `core` is server-only, but its Result type is shared with the kiosk client.
import type { Result } from "./core";

type Schemas = components["schemas"];
type Payment = Schemas["Payment"];
type PaymentMethod = Schemas["PaymentMethod"];

/** A `startPayment` call whose answer never arrived: Go may or may not have made the payment. */
export type UnknownAttempt = { key: string; method: PaymentMethod };

export type PaymentCalls = {
  startPayment: (orderId: string, method: PaymentMethod, key: string) => Promise<Result<Payment>>;
  pollPayment: (paymentId: string) => Promise<Result<Payment>>;
  cancelPayment: (paymentId: string) => Promise<Result<Payment>>;
};

export type Recovery = {
  /**
   * `free`: no lost payment is still running, so a new one can start.
   * `paid`: a lost payment went through; the order must be placed, never paid again.
   * `unknown`: the Core API did not say; the guest can try again.
   */
  outcome: "free" | "paid" | "unknown";
  /** Attempts whose fate is now known; the caller forgets them. */
  settled: string[];
};

/**
 * Finds and clears a payment the kiosk lost track of (COM-97). When a
 * `startPayment` answer is lost, Go may have made the payment anyway, and
 * every later attempt with a new key gets `PAYMENT_IN_PROGRESS`. Replaying the
 * lost attempt with its own key and body returns that payment (idempotency),
 * so it can be read and cancelled before the guest's new choice starts.
 * Newest attempt first, since that is the one most likely still running.
 */
export async function clearLostPayment(
  orderId: string,
  attempts: UnknownAttempt[],
  calls: PaymentCalls,
): Promise<Recovery> {
  const settled: string[] = [];
  for (const attempt of [...attempts].reverse()) {
    const replay = await calls.startPayment(orderId, attempt.method, attempt.key);
    if (!replay.ok) {
      // Another payment is running, so this key made nothing: look further back.
      if (replay.code === "PAYMENT_IN_PROGRESS") {
        settled.push(attempt.key);
        continue;
      }
      if (replay.code === "ORDER_NOT_AWAITING_PAYMENT") return { outcome: "paid", settled };
      return { outcome: "unknown", settled };
    }
    // A replay returns the payment as it was when made; ask how it is now.
    const outcome = await finish(replay.data.id, calls);
    if (outcome === "unknown") return { outcome, settled };
    settled.push(attempt.key);
    if (outcome === "paid") return { outcome, settled };
  }
  return { outcome: "free", settled };
}

/** Cancels a payment that is still running; reports whether it ended paid. */
async function finish(
  paymentId: string,
  calls: PaymentCalls,
): Promise<"free" | "paid" | "unknown"> {
  const current = await calls.pollPayment(paymentId);
  if (!current.ok) return "unknown";
  if (current.data.paymentStatus !== "AUTHORISING") return ended(current.data);
  const cancelled = await calls.cancelPayment(paymentId);
  if (cancelled.ok) return ended(cancelled.data);
  if (cancelled.code !== "PAYMENT_NOT_CANCELLABLE") return "unknown";
  // It ended between the poll and the cancel: read how.
  const final = await calls.pollPayment(paymentId);
  return final.ok ? ended(final.data) : "unknown";
}

function ended(payment: Payment): "free" | "paid" | "unknown" {
  switch (payment.paymentStatus) {
    case "AUTHORISED":
      return "paid";
    case "FAILED":
    case "CANCELLED":
      return "free";
    default:
      return "unknown";
  }
}
