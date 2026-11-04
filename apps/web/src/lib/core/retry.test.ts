import { describe, expect, it, vi } from "vitest";

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
