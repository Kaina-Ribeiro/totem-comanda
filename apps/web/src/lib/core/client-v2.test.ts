import { describe, expect, it } from "vitest";

import { coreApiV2Url } from "./client-v2";

describe("coreApiV2Url", () => {
  it("reads CORE_API_V2_URL", () => {
    expect(coreApiV2Url({ CORE_API_V2_URL: "http://localhost:4011" })).toBe(
      "http://localhost:4011",
    );
  });

  it("refuses to guess when it is not set", () => {
    expect(() => coreApiV2Url({})).toThrow(/CORE_API_V2_URL is not set/);
  });
});
