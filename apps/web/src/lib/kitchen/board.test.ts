import { describe, expect, it } from "vitest";

import {
  accept,
  applyOrder,
  mergeSnapshot,
  moveErrorMessage,
  waitingMinutes,
  waitLabel,
  waitState,
} from "./board";

const order = (id: string, status: string, placedAt: string) =>
  ({
    number: id,
    customerCheckNumber: id,
    status,
    placedAt,
    orderType: "DINEIN",
    history: [],
    orderItems: [],
  }) as never;

describe("kitchen board", () => {
  it("adds new orders oldest first and moves them between columns", () => {
    let board = applyOrder([], order("43", "PAID", "2026-10-30T12:05:00Z"));
    board = applyOrder(board, order("42", "PAID", "2026-10-30T12:04:00Z"));
    expect(board.map((o) => o.number)).toEqual(["42", "43"]);
    board = applyOrder(board, order("42", "READY", "2026-10-30T12:04:00Z"));
    expect(board.find((o) => o.number === "42")?.status).toBe("READY");
  });

  it("drops collected orders", () => {
    const board = applyOrder(
      [order("42", "READY", "2026-10-30T12:04:00Z")],
      order("42", "COLLECTED", "2026-10-30T12:04:00Z"),
    );
    expect(board).toEqual([]);
  });

  it("counts whole waiting minutes", () => {
    expect(waitingMinutes("2026-10-30T12:00:00Z", Date.parse("2026-10-30T12:07:59Z"))).toBe(7);
  });

  it("offers a retry when Go could not be reached", () => {
    const message = moveErrorMessage({
      order: order("41", "PREPARING", "2026-10-30T12:00:00Z"),
      status: "READY",
      code: "CORE_UNAVAILABLE",
    });
    expect(message).toEqual({
      text: "Não deu para marcar o pedido 41 como Pronto. Verifique a conexão.",
      retry: true,
    });
  });

  it("does not offer a retry when another screen moved the order first", () => {
    const message = moveErrorMessage({
      order: order("41", "PREPARING", "2026-10-30T12:00:00Z"),
      status: "READY",
      code: "INVALID_STATUS_TRANSITION",
    });
    expect(message.retry).toBe(false);
  });

  it("ages waiting time in 3 steps", () => {
    expect([0, 4, 5, 9, 10, 25].map(waitState)).toEqual(["ok", "ok", "warn", "warn", "late", "late"]);
  });

  it("says agora under a minute", () => {
    expect(waitLabel(0)).toBe("agora");
    expect(waitLabel(7)).toBe("7 min");
  });
});

describe("stale-event guard (G-K3)", () => {
  const v = (id: string, status: string, version: number) =>
    ({ ...(order(id, status, "2026-10-30T12:04:00Z") as object), version }) as never;

  it("ignores an event older than what the board saw", () => {
    const seen = new Map();
    expect(accept(seen, v("42", "COLLECTED", 4), 10)).toBe(true);
    expect(accept(seen, v("42", "READY", 3), 11)).toBe(false);
    expect(accept(seen, v("42", "READY", 5), 12)).toBe(true);
  });

  it("does not bring back a card collected after the reload started", () => {
    const seen = new Map([["42", { version: 4, at: 20 }]]);
    // Reload sent at 10, the tap on "Retirado" answered at 20, the reload answered at 30.
    const board = mergeSnapshot([], [v("42", "READY", 3)], seen, 10, 30);
    expect(board).toEqual([]);
  });

  it("keeps a card that arrived after the reload started and drops one Go closed", () => {
    const seen = new Map([
      ["43", { version: 1, at: 20 }],
      ["44", { version: 2, at: 5 }],
    ]);
    const current = [v("43", "PAID", 1), v("44", "READY", 2)];
    const board = mergeSnapshot(current, [], seen, 10, 30);
    expect(board.map((o) => o.number)).toEqual(["43"]);
  });
});
