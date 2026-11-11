import { describe, expect, it } from "vitest";

import { productionTotals } from "./production";

/** A line: quantity, name, option names; the item id defaults to the name. */
type Line = [number, string, string[], string?];

const order = (number: string, status: string, lines: Line[]) =>
  ({
    number: `20261104-${number}`,
    customerCheckNumber: number,
    status,
    orderType: "DINEIN",
    placedAt: "2026-11-04T12:00:00Z",
    history: [],
    orderItems: lines.map(([quantity, name, options, itemId]) => ({
      id: itemId ?? `item-${name}`,
      quantity,
      name,
      modifiers: options.map((o) => ({ id: `opt-${o}`, name: o, quantity: 1 })),
    })),
  }) as never;

const board = [
  order("41", "PREPARING", [[2, "Croissant", []]]),
  order("44", "PAID", [
    [2, "Pão na chapa", ["Manteiga"]],
    [1, "Café coado", []],
  ]),
  order("45", "PAID", [[2, "Pão na chapa", ["Requeijão"]]]),
  order("39", "READY", [[1, "Croissant", []]]),
];

describe("productionTotals", () => {
  it("adds up Novos and Preparando by item and options, never Prontos", () => {
    const { items, orders } = productionTotals(board, "open");
    expect(orders).toEqual(["44", "45", "41"]);
    expect(items.map((i) => [i.quantity, i.name])).toEqual([
      [1, "Café coado"],
      [2, "Croissant"],
      [4, "Pão na chapa"],
    ]);
    expect(items[2]).toMatchObject({
      variants: [
        { label: "Manteiga", quantity: 2 },
        { label: "Requeijão", quantity: 2 },
      ],
      orders: ["44", "45"],
    });
  });

  it("can add up only the new orders", () => {
    const { items, orders } = productionTotals(board, "new");
    expect(orders).toEqual(["44", "45"]);
    expect(items.some((i) => i.name === "Croissant")).toBe(false);
  });

  it("groups by item id, not by name", () => {
    const { items } = productionTotals(
      [
        order("50", "PAID", [[1, "Café", [], "item-cafe-coado"]]),
        // Same name, another item (e.g. the morning menu's espresso).
        order("51", "PAID", [[1, "Café", [], "item-espresso"]]),
        // The owner renamed the item during the day: still the same thing to make.
        order("52", "PAID", [[2, "Café coado", [], "item-cafe-coado"]]),
      ],
      "open",
    );
    expect(items.map((i) => [i.itemId, i.quantity])).toEqual([
      ["item-cafe-coado", 3],
      ["item-espresso", 1],
    ]);
  });
});
