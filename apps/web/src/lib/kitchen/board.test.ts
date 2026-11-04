import { describe, expect, it } from "vitest";

import { applyOrder, moveErrorMessage, waitingMinutes, waitLabel, waitState } from "./board";

const order = (id: string, status: string, placedAt: string) =>
  ({
    id,
    status,
    placedAt,
    posCheckNumber: id,
    orderType: "TAKE_OUT",
    readyAt: null,
    lines: [],
  }) as never;

describe("kitchen board", () => {
  it("adds new orders oldest first and moves them between columns", () => {
    let board = applyOrder([], order("43", "PAID", "2026-10-30T12:05:00Z"));
    board = applyOrder(board, order("42", "PAID", "2026-10-30T12:04:00Z"));
    expect(board.map((o) => o.id)).toEqual(["42", "43"]);
    board = applyOrder(board, order("42", "READY", "2026-10-30T12:04:00Z"));
    expect(board.find((o) => o.id === "42")?.status).toBe("READY");
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
