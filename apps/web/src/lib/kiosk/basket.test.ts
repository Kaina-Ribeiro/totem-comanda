import { beforeEach, describe, expect, it } from "vitest";

import { applyScenario, now } from "../../../mock/state";
import { guestMenu } from "../../../mock/v2/menu";
import { type BasketLine, lineUnits, pickNames, toOrderItems, type TotalsResponse } from "./basket";
import { findProduct, kitchenNames, type KioskMenu, readMenu } from "./menu-graph";

let menu: KioskMenu;
beforeEach(() => {
  applyScenario("afternoon");
  menu = readMenu(guestMenu(now(), "pt-BR")!);
});

/** The contract's createTotals example: burger with 2 × cheese and a sauce with BBQ. */
const burger: BasketLine = {
  guid: "a",
  productId: "1001",
  quantity: 1,
  picks: [
    { groupKey: "1001/M-EXTRAS", optionId: "X-CHEESE", quantity: 2 },
    { groupKey: "1001/M-EXTRAS", optionId: "X-SAUCE", quantity: 1 },
    { groupKey: "1001/M-EXTRAS/X-SAUCE/M-SAUCE", optionId: "S-BBQ", quantity: 1 },
  ],
};

describe("toOrderItems", () => {
  it("builds the contract's example tree, one product line per unit", () => {
    const items = toOrderItems(menu, [{ ...burger, quantity: 2 }]);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: "1001",
      quantity: 1,
      uniqueId: 1,
      specialNotes: "sem Alface, sem Tomate",
      modifiers: [
        { id: "X-CHEESE", quantity: 2, uniqueId: 2, parentId: 1, position: 1, modifierType: "MODI" },
        { id: "X-SAUCE", quantity: 1, uniqueId: 3, parentId: 1, position: 3, modifierType: "MODI" },
        { id: "S-BBQ", quantity: 1, uniqueId: 4, parentId: 3, position: 1, modifierType: "MODI" },
      ],
    });
    expect(items[1].uniqueId).toBe(5);
    expect(items[1].modifiers?.map((m) => [m.uniqueId, m.parentId])).toEqual([
      [6, 5],
      [7, 5],
      [8, 7],
    ]);
  });

  it("sends a size as a SIZE modifier at its position", () => {
    const cola: BasketLine = {
      guid: "c",
      productId: "2001",
      quantity: 1,
      picks: [{ groupKey: "2001/2001-SIZE", optionId: "2001-L", quantity: 1 }],
    };
    expect(toOrderItems(menu, [cola])[0].modifiers).toEqual([
      { id: "2001-L", quantity: 1, uniqueId: 2, parentId: 1, position: 2, modifierType: "SIZE" },
    ]);
  });
});

describe("the kitchen note for ingredients taken out", () => {
  const keeping = (...optionIds: string[]): BasketLine => ({
    guid: "i",
    productId: "1001",
    quantity: 1,
    picks: optionIds.map((optionId) => ({ groupKey: "1001/M-ING-1001", optionId, quantity: 1 })),
  });

  it("names the ingredient taken out", () => {
    expect(toOrderItems(menu, [keeping("I-LETTUCE")])[0].specialNotes).toBe("sem Tomate");
  });

  it("sends no note when every ingredient stays", () => {
    expect(toOrderItems(menu, [keeping("I-LETTUCE", "I-TOMATO")])[0]).not.toHaveProperty("specialNotes");
  });

  it("goes on every unit of the line", () => {
    const items = toOrderItems(menu, [{ ...keeping("I-LETTUCE"), quantity: 2 }]);
    expect(items.map((item) => item.specialNotes)).toEqual(["sem Tomate", "sem Tomate"]);
  });

  it("stays in the kitchen's language for a guest in English", () => {
    const english = readMenu(guestMenu(now(), "en")!, kitchenNames(guestMenu(now(), "pt-BR")!));
    expect(toOrderItems(english, [keeping("I-LETTUCE")])[0].specialNotes).toBe("sem Tomate");
  });

  it("fits the contract's limit, cutting between whole names", () => {
    const options = Array.from({ length: 20 }, (_, i) => ({
      id: `I-${i}`,
      name: `Ingrediente ${i}`,
      kitchenName: `Ingrediente ${i}`,
      defaultQuantity: 1,
      groups: [],
    }));
    const long = {
      products: { P: { groups: [{ key: "P/G", modifierType: "INGR", options }] } },
    } as unknown as KioskMenu;
    const note = toOrderItems(long, [{ guid: "l", productId: "P", quantity: 1, picks: [] }])[0].specialNotes!;
    expect(note.length).toBeLessThanOrEqual(140);
    expect(note).toMatch(/^sem Ingrediente 0, .*sem Ingrediente \d+, …$/);
  });
});

describe("lineUnits", () => {
  it("maps Core's per-unit lines back to basket lines, in order", () => {
    const lines = [
      { ...burger, quantity: 2 },
      { guid: "w", productId: "2010", quantity: 1, picks: [] },
    ];
    const unit = (id: string, total: number) => ({ id, quantity: 1, total });
    const totals: TotalsResponse = {
      basketId: "B-1",
      subTotal: 0,
      tax: 0,
      total: 0,
      orderItems: [unit("1001", 11.5), unit("1001", 11.5), unit("2010", 5.2)],
    };
    const units = lineUnits(lines, totals);
    expect(units.get("a")?.total).toBe(11.5);
    expect(units.get("w")?.total).toBe(5.2);
    expect(lineUnits([{ ...burger, guid: "x" }], { ...totals, orderItems: [] }).get("x")).toBeNull();
  });
});

describe("pickNames", () => {
  it("names picks in order and the ingredients taken out", () => {
    const product = findProduct(menu, "1001")!;
    const line = { ...burger, picks: [{ groupKey: "1001/M-ING-1001", optionId: "I-TOMATO", quantity: 1 }, ...burger.picks] };
    expect(pickNames(product, line, (name) => `sem ${name}`)).toEqual([
      "sem Alface",
      "2× Queijo extra",
      "Adicionar molho",
      "Molho barbecue",
    ]);
  });
});
