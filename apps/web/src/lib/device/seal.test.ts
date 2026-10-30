import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { sealCredentials, unsealCredentials } from "./seal";

const key = randomBytes(32).toString("base64");
const credentials = { deviceId: "KIOSK-TBT-001", deviceSecret: "s3cr3t" };

describe("device credential sealing", () => {
  it("round-trips the credentials", () => {
    expect(unsealCredentials(sealCredentials(credentials, key), key)).toEqual(credentials);
  });

  it("does not expose the secret in the sealed value", () => {
    const sealed = sealCredentials(credentials, key);
    expect(sealed).not.toContain("s3cr3t");
    expect(sealed).not.toContain("KIOSK");
  });

  it("rejects a value sealed with another key", () => {
    const other = randomBytes(32).toString("base64");
    expect(unsealCredentials(sealCredentials(credentials, other), key)).toBeNull();
  });

  it("rejects a tampered value", () => {
    const sealed = sealCredentials(credentials, key);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BA" : "AA");
    expect(unsealCredentials(tampered, key)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(unsealCredentials("not-a-seal", key)).toBeNull();
  });

  it("refuses a key that is not 32 bytes", () => {
    expect(() => sealCredentials(credentials, "c2hvcnQ=")).toThrow(/32 bytes/);
  });
});
