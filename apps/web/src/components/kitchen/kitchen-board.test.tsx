// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { components } from "@/lib/core-api-v2";

type StorePace = components["schemas"]["StorePace"];

const actions = vi.hoisted(() => ({
  moveOrder: vi.fn(),
  setAvailable: vi.fn(),
  cancelOrder: vi.fn(),
  setKitchenPace: vi.fn(),
  closeKitchenDay: vi.fn(),
  readKitchenPace: vi.fn(),
}));
vi.mock("@/app/kitchen/actions", () => actions);

/** The browser's EventSource, driven by the test: one instance per connection. */
class FakeEventSource {
  static last: FakeEventSource | null = null;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners = new Map<string, (event: MessageEvent<string>) => void>();
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, listener);
  }
  close() {}
  emit(type: string, data: unknown) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
}

const { KitchenBoard } = await import("./kitchen-board");

const pace = (level: StorePace["pace"], changedAt: string, pausedUntil: string | null = null): StorePace => ({
  pace: level,
  pausedUntil,
  changedAt,
  changedBy: "OWNER",
  waitMinutes: { NORMAL: 8, BUSY: 15 },
});

const flush = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
const header = () => screen.getByRole("button", { name: /Ritmo normal|Movimentado|Pausado/ });

describe("KitchenBoard store pace (COM-121)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetAllMocks();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { headers: { "Content-Type": "application/json" } })),
    );
    actions.readKitchenPace.mockResolvedValue({ ok: true, data: pace("NORMAL", "2026-11-05T10:00:00Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function renderBoard() {
    render(
      <KitchenBoard
        initial={[]}
        initialCollected={[]}
        initialPace={pace("NORMAL", "2026-11-05T10:00:00Z")}
      />,
    );
    act(() => FakeEventSource.last!.onopen?.());
  }

  it("shows a pace set from Início as soon as the stream announces it", async () => {
    renderBoard();
    expect(header().textContent).toContain("Ritmo normal");

    act(() =>
      FakeEventSource.last!.emit(
        "store.pace_changed",
        pace("PAUSED", "2026-11-05T10:05:00Z", "2026-11-05T10:20:00Z"),
      ),
    );
    expect(header().textContent).toContain("Pausado");
  });

  it("ignores an announced pace older than the one on screen", async () => {
    renderBoard();
    act(() => FakeEventSource.last!.emit("store.pace_changed", pace("BUSY", "2026-11-05T10:05:00Z")));
    act(() => FakeEventSource.last!.emit("store.pace_changed", pace("NORMAL", "2026-11-05T09:00:00Z")));
    expect(header().textContent).toContain("Movimentado");
  });

  it("reads the pace every 10 s while the stream is down", async () => {
    renderBoard();
    await flush();
    actions.readKitchenPace.mockResolvedValue({ ok: true, data: pace("BUSY", "2026-11-05T10:05:00Z") });
    const calls = actions.readKitchenPace.mock.calls.length;

    act(() => FakeEventSource.last!.onerror?.());
    await flush(10_000);

    expect(actions.readKitchenPace.mock.calls.length).toBeGreaterThan(calls);
    expect(header().textContent).toContain("Movimentado");
  });
});

describe("KitchenBoard orders on contract v2 (COM-148)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.resetAllMocks();
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { headers: { "Content-Type": "application/json" } })),
    );
    actions.readKitchenPace.mockResolvedValue({ ok: true, data: pace("NORMAL", "2026-11-05T10:00:00Z") });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const paid = (version = 1, status = "PAID") => ({
    number: "20261110-0042",
    customerCheckNumber: "42",
    orderType: "DINEIN",
    status,
    version,
    placedAt: new Date().toISOString(),
    history: [{ status: "PAID", at: new Date().toISOString(), by: "KIOSK" }],
    basketId: "B-1",
    subTotal: 19,
    tax: 0,
    total: 19,
    orderItems: [
      { id: "2001", name: "Cappuccino", quantity: 1, modifiers: [{ id: "2001-L", name: "Grande", quantity: 1 }] },
      { id: "2001", name: "Cappuccino", quantity: 1, modifiers: [{ id: "2001-L", name: "Grande", quantity: 1 }] },
      { id: "3001", name: "Croissant", quantity: 1, specialNotes: "Aquecer" },
    ],
  });

  it("shows a paid order from the stream with its short number and merged lines", async () => {
    render(<KitchenBoard initial={[]} initialCollected={[]} initialPace={null} />);
    act(() => FakeEventSource.last!.onopen?.());
    act(() => FakeEventSource.last!.emit("order.paid", paid()));

    const novos = screen.getByRole("region", { name: "Novos" });
    expect(novos.textContent).toContain("42");
    expect(novos.textContent).toContain("2× Cappuccino");
    expect(novos.textContent).toContain("Grande");
    expect(novos.textContent).toContain("Obs.: Aquecer");
    expect(novos.textContent).not.toContain("Comer aqui");
  });

  it("moves the card by its number and keeps the newest version", async () => {
    render(<KitchenBoard initial={[]} initialCollected={[]} initialPace={null} />);
    act(() => FakeEventSource.last!.onopen?.());
    act(() => FakeEventSource.last!.emit("order.paid", paid()));
    act(() => FakeEventSource.last!.emit("order.status_changed", paid(2, "PREPARING")));
    act(() => FakeEventSource.last!.emit("order.paid", paid())); // late duplicate

    expect(screen.getByRole("region", { name: "Novos" }).textContent).not.toContain("Cappuccino");
    expect(screen.getByRole("region", { name: "Preparando" }).textContent).toContain("42");
  });
});
