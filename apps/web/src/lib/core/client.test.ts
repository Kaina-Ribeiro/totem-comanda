import { describe, expect, it } from "vitest";

import { fetchWithTimeout, problemCode } from "./client";

describe("problemCode", () => {
  it("reads the code of a problem body", () => {
    expect(problemCode({ code: "ITEM_UNAVAILABLE", status: 422 })).toBe("ITEM_UNAVAILABLE");
  });

  it("ignores a timeout's numeric DOMException code", () => {
    expect(problemCode(new DOMException("timed out", "TimeoutError"))).toBeUndefined();
  });
});

describe("fetchWithTimeout", () => {
  it("aborts a call that takes longer than the budget", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = ((_input: Request, init?: RequestInit) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
      )) as typeof fetch;
    try {
      const call = fetchWithTimeout(20)(new Request("http://core.test/v1/menus/active"));
      await expect(call).rejects.toMatchObject({ name: "TimeoutError" });
    } finally {
      globalThis.fetch = original;
    }
  });
});
