import { describe, expect, it } from "vitest";

import { kitchenLines, type KitchenOrder, readyAt, updatedAt } from "./order";

type Line = NonNullable<KitchenOrder["orderItems"]>[number];

const line = (id: string, name: string, modifiers: Line[] = [], specialNotes: string | null = null): Line => ({
  id,
  name,
  quantity: 1,
  modifiers,
  specialNotes,
});
const mod = (id: string, name: string, quantity = 1, modifiers: Line[] = []): Line => ({
  id,
  name,
  quantity,
  modifiers,
});

const order = (orderItems: Line[], history: KitchenOrder["history"] = []): KitchenOrder =>
  ({
    number: "20261110-0042",
    customerCheckNumber: "42",
    orderType: "DINEIN",
    status: "PAID",
    version: 1,
    placedAt: "2026-11-10T12:00:00Z",
    history,
    basketId: "B-1",
    subTotal: 0,
    tax: 0,
    total: 0,
    orderItems,
  }) as KitchenOrder;

describe("kitchenLines", () => {
  it("merges one line per unit into one line with the quantity", () => {
    const lines = kitchenLines(
      order([line("2001", "Cappuccino", [mod("2001-L", "Grande")]), line("2001", "Cappuccino", [mod("2001-L", "Grande")])]),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ id: "2001", name: "Cappuccino", quantity: 2, options: ["Grande"], note: null });
  });

  it("keeps different choices and different notes apart", () => {
    const lines = kitchenLines(
      order([
        line("2001", "Cappuccino", [mod("2001-L", "Grande")]),
        line("2001", "Cappuccino", [mod("2001-S", "Pequeno")]),
        line("2001", "Cappuccino", [mod("2001-L", "Grande")], "Bem quente"),
      ]),
    );
    expect(lines.map((l) => [l.quantity, l.options, l.note])).toEqual([
      [1, ["Grande"], null],
      [1, ["Pequeno"], null],
      [1, ["Grande"], "Bem quente"],
    ]);
  });

  it("lists nested options depth-first, with their quantity", () => {
    const [burger] = kitchenLines(
      order([
        line("1001", "Burger", [mod("X-CHEESE", "Queijo", 2), mod("X-SAUCE", "Molho", 1, [mod("S-BBQ", "Barbecue")])]),
      ]),
    );
    expect(burger.options).toEqual(["2× Queijo", "Molho", "Barbecue"]);
    expect(burger.choices).toEqual([
      { id: "X-CHEESE", name: "Queijo" },
      { id: "X-SAUCE", name: "Molho" },
      { id: "S-BBQ", name: "Barbecue" },
    ]);
  });

  it("names a line by its id when Go sent no name", () => {
    const [plain] = kitchenLines(order([{ id: "3001", quantity: 1 }]));
    expect(plain).toMatchObject({ name: "3001", options: [], choices: [] });
  });
});

describe("order times", () => {
  const history: KitchenOrder["history"] = [
    { status: "PAID", at: "2026-11-10T12:00:00Z", by: "KIOSK" },
    { status: "PREPARING", at: "2026-11-10T12:02:00Z", by: "KITCHEN" },
    { status: "READY", at: "2026-11-10T12:09:00Z", by: "KITCHEN" },
  ];

  it("updatedAt is the last change", () => {
    expect(updatedAt(order([], history))).toBe("2026-11-10T12:09:00Z");
    expect(updatedAt(order([], []))).toBe("2026-11-10T12:00:00Z");
  });

  it("readyAt is the last READY while the order is ready", () => {
    expect(readyAt({ ...order([], history), status: "READY" })).toBe("2026-11-10T12:09:00Z");
    expect(readyAt({ ...order([], history), status: "PREPARING" })).toBeNull();
  });
});
