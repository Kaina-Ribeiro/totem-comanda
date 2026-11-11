import { describe, expect, it } from "vitest";

import { coreApiUrl, fetchWithTimeout, problemCode } from "./client";

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
      const call = fetchWithTimeout(20)(new Request("http://core.test/v2/menus/active"));
      await expect(call).rejects.toMatchObject({ name: "TimeoutError" });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("coreApiUrl", () => {
  it("reads CORE_API_URL", () => {
    expect(coreApiUrl({ CORE_API_URL: "http://localhost:4010" })).toBe("http://localhost:4010");
  });

  it("refuses to guess when it is not set, even with the old CORE_API_V2_URL", () => {
    expect(() => coreApiUrl({ CORE_API_V2_URL: "http://localhost:4011" })).toThrow(/CORE_API_URL is not set/);
  });
});
