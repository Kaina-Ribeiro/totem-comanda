// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type RefObject, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlacedOrder } from "@/app/kiosk/actions";
import type { LostPayments } from "@/lib/kiosk/payment-recovery";
import { noLostPayments } from "@/lib/kiosk/payment-recovery";

import { CheckoutFlow } from "./checkout-flow";
import { type Journey, journeyReducer } from "./journey-state";
import { journeyAt, line, order, payment, quotedAt, strings } from "./test-journey";

const actions = vi.hoisted(() => ({
  createOrder: vi.fn(),
  startPayment: vi.fn(),
  pollPayment: vi.fn(),
  cancelPayment: vi.fn(),
  placeOrder: vi.fn(),
}));
vi.mock("@/app/kiosk/actions", () => actions);

const placed: PlacedOrder = { orderId: "ord-1", posCheckNumber: "42", waitTime: 8, status: "PREPARING" };

/** A basket of 14,00 quoted by the Core API, with checkout opened on it. */
function checkoutAt(): Journey {
  const basket = journeyAt({ type: "addLine", line: line("itm-croissant") });
  const quoted = journeyReducer(basket, quotedAt(basket, 1400));
  return journeyReducer(quoted, { type: "openCheckout", orderKey: "order-key", placeKey: "place-key" });
}

/**
 * Holds the journey in state, as the kiosk does: `onOrderCreated` puts the
 * order into the checkout, so later steps see it like in production.
 */
function CheckoutHost(props: {
  journey: Journey;
  lostRef: RefObject<LostPayments>;
  onPlaced: (placed: PlacedOrder) => void;
  onBack: () => void;
  onCancelOrder: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [journey, setJourney] = useState(props.journey);
  return (
    <CheckoutFlow
      {...props}
      journey={journey}
      strings={strings}
      onOrderCreated={(created) => setJourney((j) => journeyReducer(j, { type: "orderCreated", order: created }))}
    />
  );
}

function renderCheckout(lost: LostPayments = noLostPayments()) {
  const on = { onPlaced: vi.fn(), onBack: vi.fn(), onCancelOrder: vi.fn(), onBusy: vi.fn() };
  const lostRef = { current: lost };
  render(<CheckoutHost journey={checkoutAt()} lostRef={lostRef} {...on} />);
  return { ...on, lostRef };
}

/** Lets pending promises and timers run, so the next screen is on the page. */
const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));

/**
 * Waits for the terminal screen, so the poll timer exists, then runs one poll.
 * Advancing the clock before that screen is up skips the poll under load.
 */
async function pollOnce() {
  await flush();
  await screen.findByText(strings["pay.waiting"]);
  await flush(1_000);
}

const choose = (name: RegExp) => screen.getByRole("button", { name });
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

describe("CheckoutFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetAllMocks();
    actions.createOrder.mockResolvedValue({ ok: true, data: order(1400) });
    actions.startPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISING") });
    actions.pollPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISING") });
    actions.cancelPayment.mockResolvedValue({ ok: true, data: payment("CANCELLED") });
    actions.placeOrder.mockResolvedValue({ ok: true, data: placed });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers Pix, Crédito and Débito for the total", () => {
    renderCheckout();

    expect(choose(/Pix/)).toBeTruthy();
    expect(choose(/Crédito/)).toBeTruthy();
    expect(choose(/Débito/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*14,00/)).toBeTruthy();
  });

  it("creates the order once with the checkout key, then starts the payment", async () => {
    renderCheckout();
    await user().click(choose(/Crédito/));
    await flush();

    expect(actions.createOrder).toHaveBeenCalledOnce();
    expect(actions.createOrder).toHaveBeenCalledWith(
      "order-key",
      expect.objectContaining({ orderType: "TAKE_OUT", orderItems: expect.any(Array) }),
    );
    expect(actions.startPayment).toHaveBeenCalledWith("ord-1", "CREDIT", expect.any(String));
    expect(screen.getByText(strings["pay.waiting"])).toBeTruthy();
  });

  it("places the order once the terminal authorised the payment, then reports it", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISED") });
    const on = renderCheckout();
    await user().click(choose(/Crédito/));
    await pollOnce();

    expect(actions.placeOrder).toHaveBeenCalledWith("ord-1", "place-key");
    expect(on.onPlaced).toHaveBeenCalledWith(placed);
  });

  it("shows the declined screen on FAILED, and retry starts a new payment", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: payment("FAILED") });
    renderCheckout();
    await user().click(choose(/Crédito/));
    await pollOnce();

    expect(screen.getByText(strings["pay.declinedTag"])).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Nada foi/ })).toBeTruthy();
    expect(actions.placeOrder).not.toHaveBeenCalled();

    const firstKey = actions.startPayment.mock.calls[0][2];
    await user().click(choose(/Tentar novamente/));
    await flush();
    expect(actions.startPayment).toHaveBeenCalledTimes(2);
    expect(actions.startPayment.mock.calls[1][2]).not.toBe(firstKey);
  });

  it("reports busy while the terminal is authorising, and idle again after a decline", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: payment("FAILED") });
    const on = renderCheckout();
    await user().click(choose(/Crédito/));
    await flush();
    expect(on.onBusy).toHaveBeenLastCalledWith(true);

    await pollOnce();
    expect(on.onBusy).toHaveBeenLastCalledWith(false);
  });

  it("on an unknown start answer, shows the error and keeps the attempt for recovery (COM-110)", async () => {
    actions.startPayment.mockResolvedValueOnce({ ok: false, code: "CORE_UNAVAILABLE" });
    const on = renderCheckout();
    await user().click(choose(/Débito/));
    await flush();

    expect(screen.getByText(strings["pay.errorTag"])).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Não deu para/ })).toBeTruthy();
    expect(on.lostRef.current.orderId).toBe("ord-1");
    expect(on.lostRef.current.attempts).toEqual([{ key: expect.any(String), method: "DEBIT" }]);
  });

  it("retry reuses the payment key and no second order, and a definite answer clears the attempt", async () => {
    actions.startPayment.mockResolvedValueOnce({ ok: false, code: "CORE_UNAVAILABLE" });
    const on = renderCheckout();
    await user().click(choose(/Crédito/));
    await flush();
    const firstKey = actions.startPayment.mock.calls[0][2];

    await user().click(choose(/Tentar novamente/));
    await flush();

    expect(actions.startPayment).toHaveBeenNthCalledWith(2, "ord-1", "CREDIT", firstKey);
    expect(actions.createOrder).toHaveBeenCalledOnce();
    expect(on.lostRef.current.attempts).toEqual([]);
  });

  it("recovers a lost payment before starting the guest's new one (COM-97)", async () => {
    actions.startPayment
      .mockResolvedValueOnce({ ok: false, code: "PAYMENT_IN_PROGRESS" }) // the new attempt
      .mockResolvedValueOnce({ ok: true, data: payment("AUTHORISED", "pay-lost") }); // replay of the lost key
    actions.pollPayment.mockResolvedValueOnce({ ok: true, data: payment("AUTHORISED", "pay-lost") });
    const on = renderCheckout({
      orderId: "ord-1",
      attempts: [{ key: "lost-key", method: "PIX" }],
    });
    await user().click(choose(/Crédito/));
    await flush();

    expect(actions.startPayment).toHaveBeenNthCalledWith(2, "ord-1", "PIX", "lost-key");
    expect(actions.placeOrder).toHaveBeenCalledWith("ord-1", "place-key");
    expect(on.onPlaced).toHaveBeenCalledWith(placed);
    expect(on.lostRef.current.attempts).toEqual([]);
  });

  it("shows the verifying screen, never a failure, when placement is unknown, then places again with the same key", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISED") });
    actions.placeOrder
      .mockResolvedValueOnce({ ok: false, code: "CORE_UNAVAILABLE" })
      .mockResolvedValueOnce({ ok: true, data: placed });
    const on = renderCheckout();
    await user().click(choose(/Crédito/));
    await pollOnce();

    expect(screen.getByRole("heading", { name: /Verificando/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Chame um/ })).toBeNull();
    expect(screen.queryByRole("button", { name: strings["pay.placeRetry"] })).toBeNull();
    expect(on.onPlaced).not.toHaveBeenCalled();

    await flush(5_000);
    expect(actions.placeOrder).toHaveBeenNthCalledWith(2, "ord-1", "place-key");
    expect(on.onPlaced).toHaveBeenCalledWith(placed);
  });

  // Suspected bug: a poll that rejects (kiosk offline, the Server Action throws) is not
  // wrapped in `settle`. The tick throws before its next setTimeout, so polling stops and
  // the terminal screen never moves on. checkout-flow.tsx:267 (and :255, :300 for cancel).
  it.todo("keeps polling when a poll rejects instead of stalling on the terminal screen");

  it("a paid order that cannot be placed asks for a team member, never another payment", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISED") });
    actions.placeOrder.mockResolvedValue({ ok: false, code: "ORDER_NOT_AWAITING_PAYMENT" });
    renderCheckout();
    await user().click(choose(/Crédito/));
    await pollOnce();

    expect(screen.getByRole("heading", { name: /Chame um/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: strings["pay.retry"] })).toBeNull();
    expect(actions.startPayment).toHaveBeenCalledOnce();
  });
});
