// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Language } from "@/lib/kiosk/strings";

import { applyScenario, now } from "../../../../mock/state";
import { guestMenu } from "../../../../mock/v2/menu";
import { type KioskSettings, KioskJourney } from "./kiosk-journey";
import { placed, session, strings, totals } from "./test-journey";

const spies = vi.hoisted(() => ({
  beginJourney: vi.fn(),
  switchLanguage: vi.fn(),
  priceBasket: vi.fn(),
  applyCoupon: vi.fn(),
  removeCoupon: vi.fn(),
  recordJourneyEvent: vi.fn(),
  startPayment: vi.fn(),
  pollPayment: vi.fn(),
  cancelPayment: vi.fn(),
  submitOrder: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/app/kiosk/actions", () => spies);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: spies.refresh }) }));

const settings: KioskSettings = {
  brand: "Padaria Teste",
  defaultLanguage: "pt-BR",
  languages: ["pt-BR", "en"],
  idleMs: 0, // no idle warning: these tests do not wait for it
  cardAvailable: true,
  waitMinutes: 8,
  invoiceNotice: { "pt-BR": "Se quiser nota fiscal, dirija-se ao caixa.", en: "If you need an invoice, please go to the counter." },
};
const attract: Record<Language, ReactNode> = { "pt-BR": <p>Vitrine</p>, en: <p>Showcase</p> };

const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
const button = (name: RegExp | string) => screen.getByRole("button", { name });

describe("KioskJourney (v2)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetAllMocks();
    applyScenario("afternoon");
    spies.beginJourney.mockResolvedValue({
      ok: true,
      data: {
        orderNonce: "00000000-0000-4000-8000-000000000001",
        journeyStartedTimestamp: "2026-11-10T12:00:00Z",
        menu: guestMenu(now(), "pt-BR"),
        strings,
      },
    });
    spies.priceBasket.mockResolvedValue({
      ok: true,
      data: totals(5.2, { orderItems: [{ id: "2010", name: "Chope (pint)", quantity: 1, total: 5.2 }] }),
    });
    spies.recordJourneyEvent.mockResolvedValue(undefined);
    spies.startPayment.mockResolvedValue({ ok: true, data: session("PENDING") });
    spies.pollPayment.mockResolvedValue({ ok: true, data: session("APPROVED") });
    spies.submitOrder.mockResolvedValue({ ok: true, data: placed });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("orders a pint with Pix, from the tap to the number and the invoice notice", async () => {
    render(<KioskJourney settings={settings} attract={attract} />);
    await user().click(button(strings["attract.cta"]));
    // No order-type screen: straight to the menu, dine-in.
    await user().click(await screen.findByRole("button", { name: "Bebidas" }));
    await user().click(button("Adicionar Chope (pint)"));

    // Go prices the basket; the bar shows Go's total.
    await flush(400);
    expect(spies.priceBasket).toHaveBeenCalledWith({
      basketId: null,
      items: [{ id: "2010", quantity: 1, uniqueId: 1, modifiers: [] }],
      language: "pt-BR",
    });
    expect(within(button(/Ver meu pedido/)).getByText(/R\$\s*5,20/)).toBeTruthy();

    await user().click(button(/Ver meu pedido/));
    await flush(400);
    await user().click(button(strings["basket.pay"]));
    await user().click(button(/^Pix/));
    await flush(1_000);
    await flush();

    expect(spies.submitOrder).toHaveBeenCalledWith(expect.objectContaining({ basketId: "B-1" }), expect.any(String));
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Fica pronto em cerca de 8 min.")).toBeTruthy();
    expect(screen.getByText("Se quiser nota fiscal, dirija-se ao caixa.")).toBeTruthy();
  });

  it("shows unavailable products grey, and they cannot be added", async () => {
    applyScenario("afternoon");
    const menu = guestMenu(now(), "pt-BR")!;
    const pint = menu.entities.find((e) => e.id === "2010" && e.type === "ITEM") as { available: boolean };
    pint.available = false;
    spies.beginJourney.mockResolvedValue({
      ok: true,
      data: { orderNonce: "n", journeyStartedTimestamp: null, menu, strings },
    });
    render(<KioskJourney settings={settings} attract={attract} />);
    await user().click(button(strings["attract.cta"]));
    await user().click(await screen.findByRole("button", { name: "Bebidas" }));
    const cell = button("Chope (pint), Indisponível") as HTMLButtonElement;
    expect(cell.disabled).toBe(true);
  });

  it("offers the swap sell after a burger, then the cross-sell", async () => {
    render(<KioskJourney settings={settings} attract={attract} />);
    await user().click(button(strings["attract.cta"]));
    await user().click(await screen.findByRole("button", { name: "Adicionar Hambúrguer clássico" }));
    await user().click(button(strings["item.addToOrder"]));
    expect(screen.getByRole("heading", { name: "Turbine seu hambúrguer" })).toBeTruthy();
    await user().click(button("Manter Hambúrguer clássico"));
    expect(screen.getByRole("heading", { name: strings["crossSell.title"] })).toBeTruthy();
  });

  it("tells the kitchen in pt-BR what a guest in English took out", async () => {
    const menu = guestMenu(now(), "en")!;
    const burger = menu.entities.find((e) => e.id === "1001" && e.type === "ITEM")!;
    spies.beginJourney.mockResolvedValue({
      ok: true,
      data: { orderNonce: "n", journeyStartedTimestamp: null, menu, strings, kitchenNames: { "I-TOMATO": "Tomate" } },
    });
    render(<KioskJourney settings={settings} attract={attract} />);
    await user().click(button(strings["attract.cta"]));
    await user().click(await screen.findByRole("button", { name: `Adicionar ${burger.name}` }));
    await user().click(screen.getByText("Tomato").closest("button")!);
    await user().click(button(strings["item.addToOrder"]));
    await flush(400);
    expect(spies.priceBasket.mock.lastCall![0].items[0].specialNotes).toBe("sem Tomate");
  });

  it("records an abandoned journey with Go's last total", async () => {
    render(<KioskJourney settings={settings} attract={attract} />);
    await user().click(button(strings["attract.cta"]));
    await user().click(await screen.findByRole("button", { name: "Bebidas" }));
    await user().click(button("Adicionar Chope (pint)"));
    await flush(400);
    await user().click(button(strings["menu.cancel"]));
    await user().click(button(strings["cancel.confirm"]));
    expect(spies.recordJourneyEvent).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001", "CANCELLED_BY_GUEST", 5.2);
  });
});
