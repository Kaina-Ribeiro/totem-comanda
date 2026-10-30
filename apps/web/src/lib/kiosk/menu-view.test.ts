import { describe, expect, it } from "vitest";

import { seedCatalogue } from "../../../mock/catalogue";
import { resolveMenu } from "../../../mock/kiosk-menu";
import {
  badgesFor,
  basketDisplayTotal,
  cellPrice,
  filterMenu,
  findItem,
  optionNames,
  unitPrice,
} from "./menu-view";

// The mock's morning menu: the same shape the Core API returns.
const menu = resolveMenu(
  { id: "mnu-manha", name: { "pt-BR": "Manhã" }, showCategoriesPrice: false },
  seedCatalogue(),
  "pt-BR",
  "2026-10-30",
);
const croque = findItem(menu, "itm-croque-monsieur")!;

describe("filterMenu", () => {
  it("drops items not served for the order type (F-MENU-01)", () => {
    const takeOut = filterMenu(menu, "TAKE_OUT");
    expect(findItem(takeOut, "itm-refrigerante")).toBeUndefined();
    expect(findItem(filterMenu(menu, "DINEIN"), "itm-refrigerante")).toBeDefined();
  });
});

describe("prices for display", () => {
  it("shows the cell price with the cheapest required picks", () => {
    expect(cellPrice(croque, "TAKE_OUT")).toBe(3490);
  });

  it("prices a line with its options", () => {
    const options = [
      { optionId: "opt-pao-brioche", quantity: 1 },
      { optionId: "opt-ovo-poche", quantity: 1 },
    ];
    expect(unitPrice(croque, options, "TAKE_OUT")).toBe(4090);
    expect(
      optionNames(croque, [...options, { optionId: "opt-sem-bechamel", quantity: 1 }]),
    ).toEqual(["Brioche", "Ovo pochê", "Sem bechamel"]);
    expect(
      basketDisplayTotal(
        menu,
        [{ guid: "a", itemId: croque.id, quantity: 2, options }],
        "TAKE_OUT",
      ),
    ).toBe(8180);
  });
});

describe("badgesFor", () => {
  it("finds owner badges for the page", () => {
    expect(
      badgesFor(menu, { id: "itm-fermentacao-natural" }, "ITEM_MENU").map((b) => b.label),
    ).toEqual(["Mais pedido"]);
    expect(badgesFor(menu, { id: "itm-fermentacao-natural" }, "BASKET")).toEqual([]);
  });
});
