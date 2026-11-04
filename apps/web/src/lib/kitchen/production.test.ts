import { describe, expect, it } from "vitest";

import { productionTotals } from "./production";

const order = (number: string, status: string, lines: [number, string, string[]][]) =>
  ({
    id: `ord-${number}`,
    posCheckNumber: number,
    status,
    orderType: "DINEIN",
    placedAt: "2026-11-04T12:00:00Z",
    readyAt: null,
    lines: lines.map(([quantity, name, options]) => ({ quantity, name, options })),
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
});
