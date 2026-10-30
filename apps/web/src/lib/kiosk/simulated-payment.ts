import "server-only";

import { cookies } from "next/headers";

/**
 * Until phase 4 the payment gateway is SIMULATED: nothing decides the outcome,
 * so the BFF plays the card terminal and calls `simulatePayment` itself once
 * the guest has had time to "use" it. In development /dev/mock picks the
 * outcome (approve, decline, or never answer to test cancelling); elsewhere
 * SIMULATED_PAYMENT_OUTCOME does, approving by default.
 */
export const SIMULATED_OUTCOME_COOKIE = "comanda_mock_payment";
export const SIMULATED_OUTCOMES = ["AUTHORISED", "FAILED", "MANUAL"] as const;
export type SimulatedOutcome = (typeof SIMULATED_OUTCOMES)[number];

/** How long the simulated terminal "takes" before answering. */
const SIMULATED_TERMINAL_MS = 3_000;

// When the BFF first saw each simulated payment. Measured here rather than
// from `createdAt`, so a clock shifted by a mock scenario cannot stall it.
const firstSeen = new Map<string, number>();

/** True once the simulated terminal has had its time; forgets finished payments. */
export function terminalAnswered(paymentId: string, final: boolean): boolean {
  if (final) {
    firstSeen.delete(paymentId);
    return false;
  }
  const seen = firstSeen.get(paymentId) ?? Date.now();
  firstSeen.set(paymentId, seen);
  return Date.now() - seen >= SIMULATED_TERMINAL_MS;
}

const isOutcome = (value: unknown): value is SimulatedOutcome =>
  SIMULATED_OUTCOMES.includes(value as SimulatedOutcome);

export async function simulatedOutcome(): Promise<SimulatedOutcome> {
  if (process.env.NODE_ENV === "development") {
    try {
      const chosen = (await cookies()).get(SIMULATED_OUTCOME_COOKIE)?.value;
      if (isOutcome(chosen)) return chosen;
    } catch {
      // Outside a request: fall through to the default.
    }
  }
  const configured = process.env.SIMULATED_PAYMENT_OUTCOME;
  return isOutcome(configured) ? configured : "AUTHORISED";
}
