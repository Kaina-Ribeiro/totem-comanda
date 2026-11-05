// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Order, PlacedOrder } from "@/app/kiosk/actions";
import type { Language } from "@/lib/kiosk/strings";

import { type KioskSettings, KioskJourney } from "./kiosk-journey";
import { menu, order, payment, strings, total } from "./test-journey";

const spies = vi.hoisted(() => ({
  beginJourney: vi.fn(),
  switchLanguage: vi.fn(),
  quoteBasket: vi.fn(),
  recordJourneyEvent: vi.fn(),
  validateCoupon: vi.fn(),
  createOrder: vi.fn(),
  startPayment: vi.fn(),
  pollPayment: vi.fn(),
  cancelPayment: vi.fn(),
  placeOrder: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/app/kiosk/actions", () => ({
  beginJourney: spies.beginJourney,
  switchLanguage: spies.switchLanguage,
  quoteBasket: spies.quoteBasket,
  recordJourneyEvent: spies.recordJourneyEvent,
  validateCoupon: spies.validateCoupon,
  createOrder: spies.createOrder,
  startPayment: spies.startPayment,
  pollPayment: spies.pollPayment,
  cancelPayment: spies.cancelPayment,
  placeOrder: spies.placeOrder,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: spies.refresh }),
}));

const ORDER_NONCE = "00000000-0000-4000-8000-000000000001";

const settings: KioskSettings = {
  brand: "Fornada Teste",
  defaultLanguage: "pt-BR",
  languages: ["pt-BR", "en"],
  orderTypes: ["DINEIN", "TAKE_OUT"],
  checkNumberDigits: 4,
  idleMs: 0, // no idle warning: these tests do not wait for it
};

const attract: Record<Language, ReactNode> = {
  "pt-BR": <p>Vitrine da padaria</p>,
  en: <p>Bakery showcase</p>,
};

const started = {
  orderNonce: ORDER_NONCE,
  journeyStartedTimestamp: "2026-10-30T09:00:00Z",
  menu,
  strings,
};

let user: UserEvent;

const start = () => screen.getByRole("button", { name: strings["attract.cta"] });
const pay = () => screen.getByRole<HTMLButtonElement>("button", { name: "Escolher como pagar" });

/** Taps from the attract screen to the menu, with one baguete in the basket. */
async function startAndAddBaguete() {
  await user.click(start());
  await user.click(await screen.findByRole("button", { name: /Para viagem/ }));
  await user.click(await screen.findByRole("button", { name: "Adicionar Baguete tradicional" }));
}

/** From the basket to the payment method screen, once the Core API has quoted it. */
async function toPaymentMethods() {
  await user.click(screen.getByRole("button", { name: /Ver meu pedido/ }));
  await screen.findAllByText(/R\$\s*12,00/);
  await vi.waitFor(() => expect(pay().disabled).toBe(false));
  await user.click(pay());
  await screen.findByRole("button", { name: /^Crédito/ });
}

function renderKiosk() {
  render(<KioskJourney settings={settings} attract={attract} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  spies.beginJourney.mockResolvedValue({ ok: true, data: started });
  spies.quoteBasket.mockResolvedValue({ ok: true, data: total(1200) });
  spies.recordJourneyEvent.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("KioskJourney", () => {
  it("takes a guest from the attract screen to the success number", async () => {
    const placed: PlacedOrder = { orderId: "ord-1", posCheckNumber: "1042", waitTime: 8, status: "PAID" };
    const created: Order = order(1200);
    spies.createOrder.mockResolvedValue({ ok: true, data: created });
    spies.startPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISING") });
    spies.pollPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISED") });
    spies.placeOrder.mockResolvedValue({ ok: true, data: placed });
    renderKiosk();

    await startAndAddBaguete();
    expect(spies.beginJourney).toHaveBeenCalledWith("pt-BR");
    expect((await screen.findAllByText(/R\$\s*12,00/)).length).toBeGreaterThan(0); // the basket bar
    await toPaymentMethods();

    expect(spies.quoteBasket).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderType: "TAKE_OUT", discountCode: null }),
    );
    await user.click(screen.getByRole("button", { name: /^Crédito/ }));

    await vi.waitFor(() =>
      expect(spies.createOrder).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          orderNonce: ORDER_NONCE,
          orderType: "TAKE_OUT",
          language: "pt-BR",
          orderItems: [expect.objectContaining({ itemId: "itm-baguete", quantity: 1 })],
        }),
      ),
    );
    expect(spies.startPayment).toHaveBeenCalledWith("ord-1", "CREDIT", expect.any(String));
    // The terminal is polled until it authorises, then the order is placed.
    expect(await screen.findByRole("heading", { level: 1, name: /maquininha/ })).toBeTruthy();
    await vi.waitFor(() => expect(spies.placeOrder).toHaveBeenCalledWith("ord-1", expect.any(String)));

    expect(await screen.findByText("1042")).toBeTruthy();
    expect(screen.getByText(strings["success.tag"])).toBeTruthy();
  });

  it("asks before cancelling an order with items, then records it and returns to the start", async () => {
    renderKiosk();
    await startAndAddBaguete();

    await user.click(await screen.findByRole("button", { name: strings["menu.cancel"] }));
    expect(screen.getByText(strings["cancel.bodyOne"])).toBeTruthy();
    expect(spies.recordJourneyEvent).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: strings["cancel.confirm"] }));

    expect(spies.recordJourneyEvent).toHaveBeenCalledWith(ORDER_NONCE, "CANCELLED_BY_GUEST", 1200);
    expect(await screen.findByRole("button", { name: strings["attract.cta"] })).toBeTruthy();
  });

  it("returns to the start and reloads the gate when the menu is no longer active", async () => {
    spies.beginJourney.mockResolvedValue({ ok: false, code: "NO_ACTIVE_MENU" });
    renderKiosk();

    await user.click(start());

    await vi.waitFor(() => expect(spies.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByRole("button", { name: strings["attract.cta"] })).toBeTruthy();
    expect(spies.beginJourney).toHaveBeenCalledOnce();
  });

  it("offers to start over when the menu cannot load, and retries the start", async () => {
    spies.beginJourney.mockResolvedValueOnce({ ok: false, code: "CORE_UNAVAILABLE" });
    renderKiosk();

    await user.click(start());
    expect(await screen.findByText(strings["startFailed.title"])).toBeTruthy();

    await user.click(screen.getByRole("button", { name: strings.startOver }));
    expect(await screen.findByRole("button", { name: /Para viagem/ })).toBeTruthy();
    expect(spies.beginJourney).toHaveBeenCalledTimes(2);
  });

  // COM-110: a payment whose answer was lost is cancelled when the guest leaves the order.
  it("cancels a payment whose start answer was lost when the guest cancels the order", async () => {
    spies.createOrder.mockResolvedValue({ ok: true, data: order(1200) });
    spies.startPayment
      .mockResolvedValueOnce({ ok: false, code: "CORE_UNAVAILABLE" })
      .mockResolvedValueOnce({ ok: true, data: payment("AUTHORISING") });
    spies.pollPayment.mockResolvedValue({ ok: true, data: payment("AUTHORISING") });
    spies.cancelPayment.mockResolvedValue({ ok: true, data: payment("CANCELLED") });
    renderKiosk();

    await startAndAddBaguete();
    await toPaymentMethods();
    await user.click(screen.getByRole("button", { name: /^Crédito/ }));

    const errorTitle = await screen.findByRole("heading", { level: 1, name: /Não deu para\s+concluir/ });
    expect(errorTitle).toBeTruthy();
    await user.click(screen.getByRole("button", { name: strings["menu.cancel"] }));
    await user.click(screen.getByRole("button", { name: strings["cancel.confirm"] }));

    // The lost attempt is replayed with its own key, read, then cancelled, after the reset.
    await vi.waitFor(() => expect(spies.cancelPayment).toHaveBeenCalledWith("pay-1"));
    expect(spies.startPayment).toHaveBeenCalledTimes(2);
    const [, method, key] = spies.startPayment.mock.calls[0];
    expect(spies.startPayment.mock.calls[1]).toEqual(["ord-1", method, key]);
    expect(method).toBe("CREDIT");
    expect(await screen.findByRole("button", { name: strings["attract.cta"] })).toBeTruthy();
  });
});
