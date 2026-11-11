import { afterEach, describe, expect, it, vi } from "vitest";

import { mockDeviceCredentials, needsPairing, pendingPayment, type MockDevice } from "./mock-scenarios";

const devices: MockDevice[] = [
  { id: "KIOSK-TBT-001", kind: "KIOSK", name: "Totem da entrada", status: "ACTIVE" },
  { id: "KITCHEN-TBT-001", kind: "KITCHEN", name: "Tela da cozinha", status: "ACTIVE" },
];

describe("needsPairing (COM-139)", () => {
  it("pairs a kiosk browser again to open the kitchen, and back", () => {
    expect(needsPairing("KIOSK-TBT-001", devices, "KITCHEN")).toBe(true);
    expect(needsPairing("KITCHEN-TBT-001", devices, "KIOSK")).toBe(true);
  });

  it("keeps a browser that already is a device of that kind", () => {
    expect(needsPairing("KIOSK-TBT-001", devices, "KIOSK")).toBe(false);
  });

  it("pairs a browser that is no device, or one the mock does not know", () => {
    expect(needsPairing(undefined, devices, "KIOSK")).toBe(true);
    expect(needsPairing("TOTEM-9", devices, "KIOSK")).toBe(true);
  });
});

describe("mockDeviceCredentials (COM-139)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks the mock for a seeded device of that kind, in development only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MOCK_CONTROL_URL", "http://localhost:4020/__mock");
    const fetch = vi.fn(async () =>
      Response.json({ deviceId: "KITCHEN-TBT-001", deviceSecret: "kitchen-s3cr3t" }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(mockDeviceCredentials("KITCHEN")).resolves.toEqual({
      deviceId: "KITCHEN-TBT-001",
      deviceSecret: "kitchen-s3cr3t",
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4020/__mock/device-credentials?kind=KITCHEN",
      { cache: "no-store" },
    );
  });

  it("never asks outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MOCK_CONTROL_URL", "http://localhost:4020/__mock");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(mockDeviceCredentials("KITCHEN")).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("pendingPayment (/dev/mock decides a Mercado Pago session)", () => {
  const session = (id: string, status: string, createdAt: string) => ({ id, status, method: "PIX", amount: 9.5, createdAt });

  it("is the newest session still waiting for the guest", () => {
    const payments = [
      session("pay-1", "PENDING", "2026-11-10T10:00:00Z"),
      session("pay-2", "PENDING", "2026-11-10T10:05:00Z"),
      session("pay-3", "APPROVED", "2026-11-10T10:09:00Z"),
    ];
    expect(pendingPayment({ v2: { payments } })?.id).toBe("pay-2");
  });

  it("is null when nothing waits, or the mock says nothing about payments", () => {
    expect(pendingPayment({ v2: { payments: [session("pay-3", "DECLINED", "2026-11-10T10:09:00Z")] } })).toBeNull();
    expect(pendingPayment({})).toBeNull();
  });
});
