import { describe, expect, it, vi } from "vitest";

import type { components } from "@/lib/core-api";

import type { Result } from "./core";
import { clearLostPayment, type PaymentCalls } from "./payment-recovery";

type Payment = components["schemas"]["Payment"];
type Status = Payment["paymentStatus"];

const payment = (id: string, paymentStatus: Status): Payment => ({
  id,
  orderId: "ord-1",
  method: "CREDIT",
  amount: 1000,
  paymentStatus,
  gatewayType: "SIMULATED",
  providerRef: null,
  failureReason: null,
  pix: null,
  createdAt: "2026-11-04T12:00:00Z",
  updatedAt: "2026-11-04T12:00:00Z",
});
const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const no = (code: Extract<Result<never>, { ok: false }>["code"]): Result<never> => ({
  ok: false,
  code,
});

function calls(overrides: Partial<PaymentCalls>): PaymentCalls {
  return {
    startPayment: vi.fn(async () => ok(payment("pay-1", "AUTHORISING"))),
    pollPayment: vi.fn(async () => ok(payment("pay-1", "AUTHORISING"))),
    cancelPayment: vi.fn(async () => ok(payment("pay-1", "CANCELLED"))),
    ...overrides,
  };
}

const lost = [{ key: "k1", method: "CREDIT" as const }];

describe("clearLostPayment", () => {
  it("replays the lost key, then cancels the payment it finds still running", async () => {
    const c = calls({});
    const result = await clearLostPayment("ord-1", lost, c);
    expect(c.startPayment).toHaveBeenCalledWith("ord-1", "CREDIT", "k1");
    expect(c.cancelPayment).toHaveBeenCalledWith("pay-1");
    expect(result).toEqual({ outcome: "free", settled: ["k1"] });
  });

  it("reads the payment now rather than trusting the replayed snapshot", async () => {
    const c = calls({ pollPayment: vi.fn(async () => ok(payment("pay-1", "AUTHORISED"))) });
    const result = await clearLostPayment("ord-1", lost, c);
    expect(c.cancelPayment).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: "paid", settled: ["k1"] });
  });

  it("reports paid when the payment authorised between the poll and the cancel", async () => {
    const poll = vi
      .fn()
      .mockResolvedValueOnce(ok(payment("pay-1", "AUTHORISING")))
      .mockResolvedValueOnce(ok(payment("pay-1", "AUTHORISED")));
    const c = calls({
      pollPayment: poll,
      cancelPayment: vi.fn(async () => no("PAYMENT_NOT_CANCELLABLE")),
    });
    expect((await clearLostPayment("ord-1", lost, c)).outcome).toBe("paid");
  });

  it("skips a key that made nothing and clears an older one", async () => {
    const start = vi
      .fn()
      .mockResolvedValueOnce(no("PAYMENT_IN_PROGRESS"))
      .mockResolvedValueOnce(ok(payment("pay-1", "AUTHORISING")));
    const c = calls({ startPayment: start });
    const result = await clearLostPayment(
      "ord-1",
      [
        { key: "old", method: "PIX" },
        { key: "new", method: "DEBIT" },
      ],
      c,
    );
    expect(start.mock.calls.map((call) => call[2])).toEqual(["new", "old"]);
    expect(result).toEqual({ outcome: "free", settled: ["new", "old"] });
  });

  it("treats an order no longer awaiting payment as paid", async () => {
    const c = calls({ startPayment: vi.fn(async () => no("ORDER_NOT_AWAITING_PAYMENT")) });
    expect((await clearLostPayment("ord-1", lost, c)).outcome).toBe("paid");
  });

  it("gives up as unknown, keeping the attempt, when the Core API does not answer", async () => {
    const c = calls({ cancelPayment: vi.fn(async () => no("CORE_UNAVAILABLE")) });
    expect(await clearLostPayment("ord-1", lost, c)).toEqual({ outcome: "unknown", settled: [] });
  });

  it("is free with nothing to recover", async () => {
    const c = calls({});
    expect(await clearLostPayment("ord-1", [], c)).toEqual({ outcome: "free", settled: [] });
    expect(c.startPayment).not.toHaveBeenCalled();
  });
});
