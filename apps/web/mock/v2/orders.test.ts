import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyScenario, now } from "../state";
import { key, type S } from "./http";
import { createTotals, submitOrder } from "./orders";
import { createPayment, forceOutcome, sweep } from "./payments";
import { v2 } from "./state";

const DEVICE = "KIOSK-TBT-001";
const later = (ms: number) => new Date(now().getTime() + ms);

const burger: S["OrderItem"] = { id: "1001", quantity: 1, uniqueId: 1 };
const cola: S["OrderItem"] = {
  id: "2001",
  quantity: 1,
  uniqueId: 2,
  modifiers: [{ id: "2001-L", quantity: 1, uniqueId: 3, parentId: 2, position: 2, modifierType: "SIZE" }],
};

function basket(items: S["OrderItem"][] = [burger, cola]) {
  const reply = createTotals({ orderType: "DINEIN", items }, DEVICE, "pt-BR");
  expect(reply.status).toBe(200);
  return reply.body as S["TotalsResponse"];
}

function pay(totals: S["TotalsResponse"], method: "PIX" | "CARD" = "PIX") {
  const reply = createPayment({ basketId: totals.basketId, method, amount: totals.total }, DEVICE);
  expect(reply.status).toBe(201);
  return v2().payments.get((reply.body as S["PaymentSession"]).id)!;
}

const submit = (totals: S["TotalsResponse"], session: S["PaymentSession"]) =>
  submitOrder(
    {
      basketId: totals.basketId,
      orderType: "DINEIN",
      items: [burger, cola],
      payments: [{ tenderId: session.tenderId, tenderRef: session.tenderRef, amount: session.amount }],
    },
    DEVICE,
    "KIOSK",
  );

describe("payments and orders (SPEC 4.6)", () => {
  beforeEach(() => {
    process.env.MOCK_PAYMENT_OUTCOME = "NONE";
    applyScenario("afternoon");
  });
  afterEach(() => {
    delete process.env.MOCK_PAYMENT_OUTCOME;
  });

  it("an order needs an approved payment", () => {
    const totals = basket();
    const session = pay(totals);
    expect(submit(totals, session)).toMatchObject({ status: 409, body: { code: "PAYMENT_NOT_APPROVED" } });
  });

  it("places an approved Pix order with a daily number", () => {
    const totals = basket();
    const session = pay(totals);
    forceOutcome(session, "APPROVED");
    const reply = submit(totals, session);
    expect(reply.status).toBe(201);
    expect(reply.body).toMatchObject({
      customerCheckNumber: "42",
      status: "PAID",
      version: 1,
      total: 12.7,
      history: [{ status: "PAID", by: "KIOSK" }],
    });
  });

  it("kiosk and webhook race make one order", () => {
    const totals = basket();
    const session = pay(totals);
    forceOutcome(session, "APPROVED");
    const first = submit(totals, session);
    sweep(later(60_000));
    const again = submit(totals, session);
    expect(again.status).toBe(200);
    expect((again.body as S["SubmitOrderResponse"]).number).toBe((first.body as S["SubmitOrderResponse"]).number);
    expect(v2().orders.size).toBe(1);
  });

  it("the webhook places the order when the kiosk never calls", () => {
    const totals = basket();
    const session = pay(totals);
    forceOutcome(session, "APPROVED");
    sweep(later(60_000));
    const [order] = v2().orders.values();
    expect(order).toMatchObject({ basketId: totals.basketId, history: [{ by: "SYSTEM" }] });
  });

  it("a price change after totals is BASKET_CHANGED", () => {
    const totals = basket();
    (v2().entities.get(key("ITEM", "1001")) as S["PosEntityItem"]).price = 10;
    const reply = createPayment({ basketId: totals.basketId, method: "PIX", amount: totals.total }, DEVICE);
    expect(reply).toMatchObject({ status: 409, body: { code: "BASKET_CHANGED" } });
  });

  it("an item turned unavailable after totals is BASKET_CHANGED", () => {
    const totals = basket();
    (v2().entities.get(key("ITEM", "1001")) as S["PosEntityItem"]).available = false;
    const reply = createPayment({ basketId: totals.basketId, method: "PIX", amount: totals.total }, DEVICE);
    expect(reply).toMatchObject({ status: 409, body: { code: "BASKET_CHANGED" } });
  });

  it("late approval after expiry is PAYMENT_EXPIRED and needs a refund", () => {
    const totals = basket();
    const session = pay(totals);
    sweep(later(5 * 60_000 + 1));
    expect(session.status).toBe("EXPIRED");
    expect(forceOutcome(session, "APPROVED", later(5 * 60_000 + 2))).toMatchObject({
      status: 409,
      body: { code: "PAYMENT_EXPIRED" },
    });
    expect(v2().refunds).toEqual([expect.objectContaining({ paymentId: session.id, reason: "APPROVED_AFTER_EXPIRY" })]);
    expect(submit(totals, session)).toMatchObject({ status: 409, body: { code: "PAYMENT_EXPIRED" } });
  });

  it("a second payment on a paid basket is BASKET_ALREADY_PAID", () => {
    const totals = basket();
    forceOutcome(pay(totals), "APPROVED");
    const reply = createPayment({ basketId: totals.basketId, method: "CARD", amount: totals.total }, DEVICE);
    expect(reply).toMatchObject({ status: 409, body: { code: "BASKET_ALREADY_PAID" } });
  });

  it("a new session cancels the pending one; paying the old QR later is flagged for refund", () => {
    const totals = basket();
    const first = pay(totals);
    pay(totals);
    expect(first.status).toBe("CANCELLED");
    expect(forceOutcome(first, "APPROVED").status).toBe(409);
    expect(v2().refunds[0]).toMatchObject({ paymentId: first.id, reason: "SECOND_PAYMENT" });
  });

  it("a declined card cannot be placed", () => {
    const totals = basket();
    const session = pay(totals, "CARD");
    expect(session).toMatchObject({ terminalId: "MOCK-POINT-001", tenderId: "MP_POINT" });
    forceOutcome(session, "DECLINED");
    expect(submit(totals, session)).toMatchObject({ status: 409, body: { code: "PAYMENT_DECLINED" } });
  });

  it("MOCK_PAYMENT_OUTCOME approves by itself after the delay", () => {
    process.env.MOCK_PAYMENT_OUTCOME = "APPROVED";
    const session = pay(basket());
    sweep(later(1000));
    expect(session.status).toBe("PENDING");
    sweep(later(3001));
    expect(session.status).toBe("APPROVED");
  });
});
