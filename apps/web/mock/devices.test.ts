import { beforeEach, describe, expect, it } from "vitest";

import { applyScenario, seededCredentials, signInDevice, state } from "./state";

describe("signInDevice", () => {
  beforeEach(() => applyScenario("normal"));

  it("signs in a known device only with its secret", () => {
    expect(signInDevice("KIOSK-TBT-001", "s3cr3t-from-provisioning")?.id).toBe("KIOSK-TBT-001");
    expect(signInDevice("KIOSK-TBT-001", "wrong", true)).toBeNull();
  });

  it("refuses unknown devices unless auto-registration is on", () => {
    expect(signInDevice("TOTEM-1", "anything", false)).toBeNull();
    expect(state.devices.some((d) => d.id === "TOTEM-1")).toBe(false);
  });

  it("registers an unknown device with the secret it sent", () => {
    const kiosk = signInDevice("TOTEM-1", "anything", true);
    expect(kiosk).toMatchObject({ id: "TOTEM-1", kind: "KIOSK", status: "ACTIVE" });
    expect(signInDevice("TOTEM-1", "anything", true)).toBe(kiosk);
    expect(signInDevice("TOTEM-1", "other", true)).toBeNull();
    expect(state.devices.filter((d) => d.id === "TOTEM-1")).toHaveLength(1);
  });

  it("makes KITCHEN and COZINHA ids kitchen screens", () => {
    expect(signInDevice("KITCHEN-1", "x", true)?.kind).toBe("KITCHEN");
    expect(signInDevice("cozinha-2", "x", true)?.kind).toBe("KITCHEN");
  });

  it("refuses ids that cannot go in a URL path and empty secrets", () => {
    expect(signInDevice("TOTEM 1", "x", true)).toBeNull();
    expect(signInDevice("TOTEM/1", "x", true)).toBeNull();
    expect(signInDevice("TOTEM-3", "", true)).toBeNull();
    expect(signInDevice(undefined, "x", true)).toBeNull();
  });
});

describe("seededCredentials (COM-139)", () => {
  beforeEach(() => applyScenario("normal"));

  it("hands the id and secret of the first active device of a kind", () => {
    expect(seededCredentials("KITCHEN")).toEqual({
      deviceId: "KITCHEN-TBT-001",
      deviceSecret: "kitchen-s3cr3t",
    });
    expect(seededCredentials("KIOSK")?.deviceId).toBe("KIOSK-TBT-001");
  });

  it("follows the scenario: a rotated secret is the new one", () => {
    applyScenario("secret-rotated");
    expect(seededCredentials("KIOSK")?.deviceSecret).toBe("rotated-in-the-back-office");
  });

  it("has none when no device of that kind is active", () => {
    for (const device of state.devices) if (device.kind === "KITCHEN") device.status = "DISABLED";
    expect(seededCredentials("KITCHEN")).toBeNull();
  });
});
