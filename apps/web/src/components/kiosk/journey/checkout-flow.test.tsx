// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CheckoutFlow } from "./checkout-flow";
import { type Journey, journeyReducer } from "./journey-state";
import { journeyAt, line, placed, pricedAt, session, strings, totals } from "./test-journey";

const actions = vi.hoisted(() => ({
  startPayment: vi.fn(),
  pollPayment: vi.fn(),
  cancelPayment: vi.fn(),
  submitOrder: vi.fn(),
  priceBasket: vi.fn(),
}));
vi.mock("@/app/kiosk/actions", () => actions);

/** A pint (R$ 5,20) priced by Go, with checkout opened on it. */
function checkoutAt(): Journey {
  const basket = journeyAt({ type: "addLine", line: line("2010") }, { type: "crossSellDismissed" });
  const priced = journeyReducer(basket, pricedAt(basket, 5.2));
  return journeyReducer(priced, { type: "openCheckout", orderKey: "order-key" });
}

function renderCheckout({ cardAvailable = true } = {}) {
  const on = { onRepriced: vi.fn(), onPlaced: vi.fn(), onBack: vi.fn(), onCancelOrder: vi.fn(), onBusy: vi.fn() };
  const view = render(<CheckoutFlow journey={checkoutAt()} strings={strings} cardAvailable={cardAvailable} {...on} />);
  return { ...on, view };
}

/** Lets pending promises and timers run, so the next screen is on the page. */
const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
const button = (name: RegExp | string) => screen.getByRole("button", { name });

/**
 * Waits for the Pix or card screen, so the poll timer exists, then runs one
 * poll. Advancing the clock before that screen is up skips the poll under load.
 */
async function pollOnce() {
  await flush();
  await screen.findByText(strings["pay.waiting"]);
  await flush(1_000);
}
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

describe("CheckoutFlow (Mercado Pago on v2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetAllMocks();
    actions.startPayment.mockImplementation(async (input: { method: "PIX" | "CARD" }) => ({
      ok: true,
      data: session("PENDING", input.method),
    }));
    actions.pollPayment.mockResolvedValue({ ok: true, data: session("PENDING") });
    actions.cancelPayment.mockResolvedValue({ ok: true, data: session("CANCELLED") });
    actions.submitOrder.mockResolvedValue({ ok: true, data: placed });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("offers Pix and Cartão for Go's total", () => {
    renderCheckout();
    expect(button(/^Pix/)).toBeTruthy();
    expect(button(/^Cartão/)).toBeTruthy();
    expect(screen.getByText(/R\$\s*5,20/)).toBeTruthy();
  });

  it("greys the card out when no terminal sits next to this kiosk", () => {
    renderCheckout({ cardAvailable: false });
    expect((button(/^Cartão/) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(strings["pay.CARD.off"])).toBeTruthy();
  });

  it("Pix shows the QR, the copy-paste code and a countdown", async () => {
    renderCheckout();
    await user().click(button(/^Pix/));
    await flush();
    expect(actions.startPayment).toHaveBeenCalledWith({ basketId: "B-1", method: "PIX", amount: 5.2 }, expect.any(String));
    expect(screen.getByRole("img", { name: "QR Code Pix" })).toBeTruthy();
    expect(screen.getByText("00020126580014br.gov.bcb.pix-mock")).toBeTruthy();
    expect(screen.getByRole("timer").textContent).toMatch(/Expira em [45]:\d\d/);
  });

  it("counts the Pix down from Go's 5 minutes even when the kiosk clock is off", async () => {
    const ahead = Date.now() + 10 * 3_600_000;
    actions.startPayment.mockResolvedValue({
      ok: true,
      data: { ...session("PENDING"), createdAt: new Date(ahead).toISOString(), expiresAt: new Date(ahead + 300_000).toISOString() },
    });
    renderCheckout();
    await user().click(button(/^Pix/));
    await flush();
    expect(screen.getByRole("timer").textContent).toBe("Expira em 5:00");
  });

  it("an approved Pix places the order with the session and the basket's key", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: session("APPROVED") });
    const on = renderCheckout();
    await user().click(button(/^Pix/));
    await pollOnce();
    await flush();
    expect(actions.submitOrder).toHaveBeenCalledWith(
      {
        basketId: "B-1",
        items: [{ id: "2010", quantity: 1, uniqueId: 1, modifiers: [] }],
        payment: expect.objectContaining({ id: "pay-1", status: "APPROVED", tenderRef: "1319876543" }),
      },
      "order-key",
    );
    expect(on.onPlaced).toHaveBeenCalledWith(placed);
  });

  it("a declined card offers retry and another method; nothing was charged", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: session("DECLINED", "CARD") });
    renderCheckout();
    await user().click(button(/^Cartão/));
    await pollOnce();
    expect(screen.getByText(strings["pay.declinedTag"])).toBeTruthy();
    expect(button(strings["pay.retry"])).toBeTruthy();
    await user().click(button(strings["pay.other"]));
    expect(button(/^Pix/)).toBeTruthy();
  });

  // Review Focus 4: Pix late or twice.
  it("an expired Pix offers a new QR code, never success", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: session("EXPIRED") });
    const on = renderCheckout();
    await user().click(button(/^Pix/));
    await pollOnce();
    expect(screen.getByText(strings["pix.expiredTag"])).toBeTruthy();
    expect(on.onPlaced).not.toHaveBeenCalled();
    expect(button(strings["pix.new"])).toBeTruthy();
  });

  it("Gerar novo starts a new session and stops polling the old one", async () => {
    actions.startPayment
      .mockResolvedValueOnce({ ok: true, data: session("PENDING", "PIX", "pay-1") })
      .mockResolvedValueOnce({ ok: true, data: session("PENDING", "PIX", "pay-2") });
    renderCheckout();
    await user().click(button(/^Pix/));
    await pollOnce();
    await user().click(button(strings["pix.new"]));
    await flush();
    const [first, second] = actions.startPayment.mock.calls.map(([, key]) => key);
    expect(first).not.toBe(second);
    actions.pollPayment.mockClear();
    await flush(3_000);
    expect(actions.pollPayment.mock.calls.map(([id]) => id)).toEqual(["pay-2", "pay-2", "pay-2"]);
  });

  it("Gerar novo first asks Go about the QR on screen: if it was just paid, places it", async () => {
    renderCheckout();
    await user().click(button(/^Pix/));
    await flush();
    actions.pollPayment.mockResolvedValue({ ok: true, data: session("APPROVED") });
    await user().click(button(strings["pix.new"]));
    await flush();
    expect(actions.startPayment).toHaveBeenCalledOnce();
    expect(actions.submitOrder).toHaveBeenCalledWith(
      expect.objectContaining({ payment: expect.objectContaining({ id: "pay-1", status: "APPROVED" }) }),
      "order-key",
    );
  });

  it("an unknown answer when starting is asked again with the same key before any way out", async () => {
    actions.startPayment
      .mockResolvedValueOnce({ ok: false, code: "CORE_UNAVAILABLE" })
      .mockResolvedValueOnce({ ok: true, data: session("PENDING", "CARD") });
    renderCheckout();
    await user().click(button(/^Cartão/));
    await flush(1_000);
    const keys = actions.startPayment.mock.calls.map(([, key]) => key);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(screen.getByText(strings["pay.waiting"])).toBeTruthy();
  });

  it("a basket already paid (an older Pix approved) places the order", async () => {
    actions.startPayment.mockResolvedValue({ ok: false, code: "BASKET_ALREADY_PAID" });
    const on = renderCheckout();
    await user().click(button(/^Pix/));
    await flush();
    expect(actions.submitOrder).toHaveBeenCalledWith(expect.objectContaining({ payment: null }), "order-key");
    expect(on.onPlaced).toHaveBeenCalledWith(placed);
  });

  // Review Focus 2: price changed between totals and payment.
  it("BASKET_CHANGED re-prices and asks the guest to confirm the new total", async () => {
    actions.startPayment.mockResolvedValueOnce({ ok: false, code: "BASKET_CHANGED" });
    actions.priceBasket.mockResolvedValue({ ok: true, data: totals(5.9) });
    const on = renderCheckout();
    await user().click(button(/^Pix/));
    await flush();
    expect(on.onRepriced).toHaveBeenCalledWith({ ok: true, data: totals(5.9) });
    expect(screen.getByText(strings["pay.changedTag"])).toBeTruthy();
    // Nothing is charged until the guest taps again.
    expect(actions.startPayment).toHaveBeenCalledOnce();
  });

  it("an item gone unavailable sends the guest back to the basket, naming it", async () => {
    actions.startPayment.mockResolvedValueOnce({ ok: false, code: "BASKET_CHANGED" });
    actions.priceBasket.mockResolvedValue({ ok: false, code: "ITEM_UNAVAILABLE", detail: "2010" });
    const on = renderCheckout();
    await user().click(button(/^Pix/));
    await flush();
    expect(screen.getByText(/Chope \(pint\) não está mais disponível/)).toBeTruthy();
    await user().click(button(strings["pay.toBasket"]));
    expect(on.onBack).toHaveBeenCalled();
  });

  it("a terminal that is offline offers Pix", async () => {
    actions.startPayment.mockResolvedValueOnce({ ok: false, code: "PAYMENT_TERMINAL_UNAVAILABLE" });
    renderCheckout();
    await user().click(button(/^Cartão/));
    await flush();
    expect(screen.getByText(strings["pay.terminalOffTag"])).toBeTruthy();
  });

  // Review Focus 1: paid, then the connection drops.
  it("an unknown submit shows 'verificando' and asks again with the same key", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: session("APPROVED") });
    actions.submitOrder.mockResolvedValueOnce({ ok: false, code: "CORE_UNAVAILABLE" });
    const on = renderCheckout();
    await user().click(button(/^Pix/));
    await pollOnce();
    await flush();
    expect(screen.getByText(strings["pay.verifyingTag"])).toBeTruthy();
    await flush(5_000);
    expect(actions.submitOrder.mock.calls.map(([, key]) => key)).toEqual(["order-key", "order-key"]);
    expect(on.onPlaced).toHaveBeenCalledWith(placed);
  });

  it("a submit refused after approval sends the guest to the counter with the payment code", async () => {
    actions.pollPayment.mockResolvedValue({ ok: true, data: session("APPROVED") });
    actions.submitOrder.mockResolvedValue({ ok: false, code: "PAYMENT_NOT_APPROVED" });
    renderCheckout();
    await user().click(button(/^Pix/));
    await pollOnce();
    await flush();
    expect(screen.getByText("Código do pagamento: 1319876543")).toBeTruthy();
    // The payment is taken: no other method and no cancel.
    expect(screen.queryByRole("button", { name: strings["pay.other"] })).toBeNull();
    expect(screen.queryByRole("button", { name: strings["menu.cancel"] })).toBeNull();
  });

  it("'Trocar forma de pagamento' cancels the Pix and goes back to the methods", async () => {
    renderCheckout();
    await user().click(button(/^Pix/));
    await flush();
    await user().click(button(strings["pix.other"]));
    await flush();
    expect(actions.cancelPayment).toHaveBeenCalledWith("pay-1");
    expect(button(/^Cartão/)).toBeTruthy();
  });
});
