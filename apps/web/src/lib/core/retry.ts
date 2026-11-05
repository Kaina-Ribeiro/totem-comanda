import { CALL_TIMEOUT_MS } from "./client";

/** Total time to create or place an order, retries included (BFF BR-XC-04). */
export const ORDER_BUDGET_MS = 15_000;
const BACKOFF_MS = 500;

type Outcome = { ok: true } | { ok: false; code: string };

/**
 * Codes after which a write may or may not have reached Go: the call timed
 * out, the network failed, or Go answered 5xx without a problem code. Retrying
 * is safe only because every caller sends the same Idempotency-Key, which makes
 * Go return the first result. A 4xx is an answer and is never retried.
 */
export const isUnknownOutcome = (result: Outcome) =>
  !result.ok && result.code === "CORE_UNAVAILABLE";

const UNKNOWN = { ok: false, code: "CORE_UNAVAILABLE" } as const;

/**
 * Runs `call` again while its outcome is unknown, as long as one more attempt
 * still fits in `budgetMs`. Returns the first known outcome, or the last
 * unknown one when the budget runs out (the caller then must not say "failed").
 *
 * `budgetMs` is a hard deadline (COM-99): one attempt can outlast `attemptMs`
 * (a token exchange, then a 401, a new token and the call again), so when the
 * budget is spent the attempt is cut, `signal` aborts its request and the
 * outcome is unknown. Callers pass `signal` to the Core API call.
 */
export async function retryUnknown<R extends Outcome>(
  call: (signal: AbortSignal) => Promise<R>,
  {
    budgetMs = ORDER_BUDGET_MS,
    attemptMs = CALL_TIMEOUT_MS,
    backoffMs = BACKOFF_MS,
    now = Date.now,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = {},
): Promise<R> {
  const start = now();
  const deadline = new AbortController();
  let expire = () => {};
  const expired = new Promise<R>((resolve) => (expire = () => resolve(UNKNOWN as R)));
  const timer = setTimeout(() => {
    deadline.abort(new DOMException("Order budget spent", "TimeoutError"));
    expire();
  }, budgetMs);
  try {
    for (;;) {
      const result = await Promise.race([call(deadline.signal), expired]);
      if (!isUnknownOutcome(result) || deadline.signal.aborted) return result;
      if (now() - start + backoffMs + attemptMs > budgetMs) return result;
      await sleep(backoffMs);
    }
  } finally {
    clearTimeout(timer);
  }
}
