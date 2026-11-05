import { describe, expect, it } from "vitest";

import { accept, mergeSnapshot, type Seen } from "./board";
import { applyCollected, findByNumber } from "./collected";

/** A kitchen order with what the Retirados list reads. */
const order = (id: string, status: string, updatedAt: string, version = 1) =>
  ({
    id,
    status,
    version,
    updatedAt,
    placedAt: "2026-11-04T12:00:00Z",
    posCheckNumber: id,
    orderType: "TAKE_OUT",
    readyAt: null,
    lines: [],
  }) as never;

describe("applyCollected", () => {
  it("adds a collected order, newest hand-over first", () => {
    let list = applyCollected([], order("42", "COLLECTED", "2026-11-04T12:10:00Z"));
    list = applyCollected(list, order("43", "COLLECTED", "2026-11-04T12:20:00Z"));
    list = applyCollected(list, order("41", "COLLECTED", "2026-11-04T12:05:00Z"));
    expect(list.map((o: { id: string }) => o.id)).toEqual(["43", "42", "41"]);
  });

  it("drops an order that went back to Prontos or anywhere else", () => {
    const list = [order("42", "COLLECTED", "2026-11-04T12:10:00Z")];
    expect(applyCollected(list, order("42", "READY", "2026-11-04T12:11:00Z"))).toEqual([]);
  });

  it("ignores open orders it never listed", () => {
    expect(applyCollected([], order("44", "PREPARING", "2026-11-04T12:10:00Z"))).toEqual([]);
  });
});

describe("findByNumber", () => {
  const list = ["42", "142", "43", "7"].map((n) => order(n, "COLLECTED", "2026-11-04T12:00:00Z"));
  const ids = (l: { id: string }[]) => l.map((o) => o.id);

  it("shows everything while the search is empty", () => {
    expect(ids(findByNumber(list, ""))).toEqual(["42", "142", "43", "7"]);
    expect(ids(findByNumber(list, "  "))).toEqual(["42", "142", "43", "7"]);
  });

  it("shows only the numbers that start with what was typed", () => {
    expect(ids(findByNumber(list, "4"))).toEqual(["42", "43"]);
    expect(ids(findByNumber(list, "42"))).toEqual(["42"]);
    expect(ids(findByNumber(list, " 7 "))).toEqual(["7"]);
    expect(findByNumber(list, "9")).toEqual([]);
  });
});

describe("mergeSnapshot with applyCollected", () => {
  it("keeps the board's newer copy when a late reload still lists an order as collected", () => {
    const seen: Seen = new Map();
    accept(seen, order("42", "READY", "2026-11-04T12:11:00Z", 4), 20);
    const board = mergeSnapshot(
      [],
      [order("42", "COLLECTED", "2026-11-04T12:10:00Z", 3)],
      seen,
      10,
      30,
      applyCollected,
    );
    expect(board).toEqual([]);
  });
});
