import { describe, expect, it } from "vitest";

import { EtagCache } from "./etag-cache";

describe("EtagCache", () => {
  it("has no If-None-Match before the first answer", () => {
    expect(new EtagCache<string>().ifNoneMatch("kiosk")).toBeUndefined();
  });

  it("stores a 200 with its ETag and sends it back next time", () => {
    const cache = new EtagCache<string>();
    expect(cache.resolve("kiosk", 200, '"v1"', "config v1")).toBe("config v1");
    expect(cache.ifNoneMatch("kiosk")).toBe('"v1"');
  });

  it("answers a 304 with the stored value", () => {
    const cache = new EtagCache<string>();
    cache.resolve("kiosk", 200, '"v1"', "config v1");
    expect(cache.resolve("kiosk", 304, null, undefined)).toBe("config v1");
  });

  it("keeps entries apart per key", () => {
    const cache = new EtagCache<string>();
    cache.resolve("kiosk", 200, '"v1"', "kiosk config");
    expect(cache.ifNoneMatch("kitchen")).toBeUndefined();
  });

  it("does not store a 200 without an ETag", () => {
    const cache = new EtagCache<string>();
    expect(cache.resolve("kiosk", 200, null, "config")).toBe("config");
    expect(cache.ifNoneMatch("kiosk")).toBeUndefined();
  });

  it("returns undefined for a 304 it has nothing for", () => {
    expect(new EtagCache<string>().resolve("kiosk", 304, null, undefined)).toBeUndefined();
  });
});
