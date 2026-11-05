import { beforeEach, describe, expect, it, vi } from "vitest";

const { asDevice, requireDeviceKind, DeviceAuthError } = vi.hoisted(() => {
  class DeviceAuthError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return { asDevice: vi.fn(), requireDeviceKind: vi.fn(), DeviceAuthError };
});

vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => void task() }));
vi.mock("@/lib/device/session", () => ({ asDevice, DeviceAuthError }));
vi.mock("@/lib/device/config", () => ({ requireDeviceKind }));
vi.mock("@/lib/core/client", () => ({
  CALL_TIMEOUT_MS: 5_000,
  coreApi: () => ({ GET: vi.fn(), POST: vi.fn() }),
  problemCode: (error: { code?: string } | undefined) => error?.code,
}));
vi.mock("@/lib/kiosk/simulated-payment", () => ({
  simulatedOutcome: async () => "AUTHORISED",
  terminalAnswered: () => false,
}));

const actions = await import("./actions");

const line = { guid: "line-1", itemId: "item-1", quantity: 1, options: [] };

// Every kiosk Server Action, called the way the journey calls it.
const calls: Record<string, () => Promise<unknown>> = {
  beginJourney: () => actions.beginJourney("pt-BR"),
  switchLanguage: () => actions.switchLanguage("en"),
  quoteBasket: () => actions.quoteBasket({ orderType: "TAKE_OUT", orderItems: [line] }),
  recordJourneyEvent: () => actions.recordJourneyEvent("nonce-1", "IDLE_TIMEOUT", 0),
  validateCoupon: () =>
    actions.validateCoupon({
      code: "DESCONTO5",
      orderType: "TAKE_OUT",
      orderItems: [line],
      currentDiscountCode: null,
    }),
  createOrder: () =>
    actions.createOrder("key-1", {
      orderNonce: "nonce-1",
      orderType: "TAKE_OUT",
      language: "pt-BR",
      orderItems: [line],
    }),
  startPayment: () => actions.startPayment("order-1", "CREDIT", "key-2"),
  pollPayment: () => actions.pollPayment("payment-1"),
  cancelPayment: () => actions.cancelPayment("payment-1"),
  placeOrder: () => actions.placeOrder("order-1", "key-3"),
};

describe("kiosk Server Actions", () => {
  beforeEach(() => {
    asDevice.mockReset();
    requireDeviceKind.mockReset();
  });

  it("covers every exported action", () => {
    const exported = Object.entries(actions)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(Object.keys(calls).sort()).toEqual(exported);
  });

  describe.each(Object.entries(calls))("%s", (name, call) => {
    it("refuses a device that is not a kiosk, before any Core call", async () => {
      requireDeviceKind.mockRejectedValue(new DeviceAuthError("WRONG_DEVICE"));
      const result = await call();
      if (name !== "recordJourneyEvent") {
        expect(result).toEqual({ ok: false, code: "DEVICE_UNAVAILABLE" });
      }
      expect(requireDeviceKind).toHaveBeenCalledWith("KIOSK");
      expect(asDevice).not.toHaveBeenCalled();
    });
  });
});
