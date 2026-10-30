import { describe, expect, it } from "vitest";

import { applyOrder, waitingMinutes } from "./board";

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
});
