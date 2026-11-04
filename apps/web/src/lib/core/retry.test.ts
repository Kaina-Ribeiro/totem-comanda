import { afterEach, describe, expect, it, vi } from "vitest";

import { retryUnknown } from "./retry";

type R = { ok: true } | { ok: false; code: string };

/** A fake clock: each call takes `callMs`, each sleep advances the clock. */
function harness(answers: R[], callMs: number) {
  let t = 0;
  const call = vi.fn(async () => {
    t += callMs;
    return answers.shift() ?? { ok: false, code: "CORE_UNAVAILABLE" };
  });
  const options = {
    budgetMs: 15_000,
    attemptMs: 5_000,
    backoffMs: 500,
    now: () => t,
    sleep: async (ms: number) => void (t += ms),
  };
  return { call, options, elapsed: () => t };
}

describe("retryUnknown", () => {
  it("returns the first answer that is known", async () => {
    const { call, options } = harness(
      [{ ok: false, code: "CORE_UNAVAILABLE" }, { ok: true }],
      1_000,
    );
    await expect(retryUnknown(call, options)).resolves.toEqual({ ok: true });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("never retries a 4xx answer", async () => {
    const { call, options } = harness([{ ok: false, code: "PAYMENT_NOT_AUTHORISED" }], 100);
    await expect(retryUnknown(call, options)).resolves.toEqual({
      ok: false,
      code: "PAYMENT_NOT_AUTHORISED",
    });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("stops inside the 15 s budget when every attempt times out", async () => {
    const { call, options, elapsed } = harness([], 5_000);
    await expect(retryUnknown(call, options)).resolves.toEqual({
      ok: false,
      code: "CORE_UNAVAILABLE",
    });
    expect(call).toHaveBeenCalledTimes(2);
    expect(elapsed()).toBeLessThanOrEqual(15_000);
  });

  it("tries more often when failures are quick", async () => {
    const { call, options, elapsed } = harness([], 200);
    await retryUnknown(call, options);
    expect(call.mock.calls.length).toBeGreaterThan(10);
    expect(elapsed()).toBeLessThanOrEqual(15_000);
  });
});

describe("retryUnknown deadline (COM-99)", () => {
  afterEach(() => vi.useRealTimers());

  it("cuts an attempt that outlasts the budget and aborts its request", async () => {
    vi.useFakeTimers();
    const started = Date.now();
    let signal: AbortSignal | undefined;
    // One attempt that runs long: token exchange, a 401, a new token and the call again.
    const call = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<R>((resolve) => setTimeout(() => resolve({ ok: true }), 20_000));
    });
    let settled: { result: R; at: number } | undefined;
    void retryUnknown(call).then((result) => (settled = { result, at: Date.now() }));

    await vi.advanceTimersByTimeAsync(15_000);
    expect(settled).toEqual({ result: { ok: false, code: "CORE_UNAVAILABLE" }, at: started + 15_000 });
    expect(signal?.aborted).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("returns an answer that arrives inside the budget, without aborting", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const call = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<R>((resolve) => setTimeout(() => resolve({ ok: true }), 9_000));
    });
    const result = retryUnknown(call);
    await vi.advanceTimersByTimeAsync(9_000);
    await expect(result).resolves.toEqual({ ok: true });
    expect(signal?.aborted).toBe(false);
  });
});
