import { beforeEach, describe, expect, it } from "vitest";

import { applyScenario, now } from "../../../mock/state";
import { guestMenu } from "../../../mock/v2/menu";
import type { components } from "../core-api";
import { findProduct, kitchenNames, type KioskMenu, readMenu } from "./menu-graph";

type MenuResponse = components["schemas"]["MenuResponse"];

/** The mock's afternoon menu (MODELS 5.20 minus tax), as Core sends it. */
function reference(): KioskMenu {
  applyScenario("afternoon");
  return readMenu(guestMenu(now(), "pt-BR")!);
}

const product = (menu: KioskMenu, id: string) => findProduct(menu, id)!;

/** A small hand-made menu: one section, one product, its groups. */
function tiny(entities: MenuResponse["entities"]): MenuResponse {
  return {
    root: [{ type: "CATEGORY", id: "S" }],
    entities: [
      { id: "S", type: "CATEGORY", name: "Seção", available: true, links: [{ type: "ITEM", id: "P" }] },
      ...entities,
    ],
    menuId: "m",
    validUntil: null,
    badges: [],
  };
}

const item = (id: string, links: MenuResponse["entities"][number]["links"] = [], price = 0) => ({
  id,
  type: "ITEM" as const,
  name: id,
  price,
  available: true,
  links,
});

describe("kitchenNames", () => {
  it("lists only the ingredient options, by id", () => {
    applyScenario("afternoon");
    expect(kitchenNames(guestMenu(now(), "pt-BR")!)).toEqual({ "I-LETTUCE": "Alface", "I-TOMATO": "Tomate" });
  });

  it("gives an option its kitchen name, or its own name when there is none", () => {
    applyScenario("afternoon");
    const groups = findProduct(readMenu(guestMenu(now(), "en")!, { "I-TOMATO": "Tomate" }), "1001")!.groups;
    const options = groups.find((g) => g.modifierType === "INGR")!.options;
    expect(options.map((o) => [o.name, o.kitchenName])).toEqual([
      ["Lettuce", "Lettuce"],
      ["Tomato", "Tomate"],
    ]);
  });
});

describe("readMenu", () => {
  let menu: KioskMenu;
  beforeEach(() => {
    menu = reference();
  });

  it("reads sections from root in order, sub-sections nested", () => {
    expect(menu.sections.map((s) => s.id)).toEqual(["100", "200", "300"]);
    const burgers = menu.sections[0];
    expect(burgers.products.map((p) => p.id)).toEqual(["1001"]);
    expect(burgers.sections.map((s) => [s.id, s.products.map((p) => p.id)])).toEqual([
      ["110", ["1002"]],
    ]);
    expect(burgers.picture?.url).toBe("/media/croque-monsieur.jpg");
  });

  it("a sized item gets its size group first", () => {
    const cola = product(menu, "2001");
    expect(cola.type).toBe("SIZED_ITEM");
    const [size] = cola.groups;
    expect(size).toMatchObject({ kind: "SIZE", modifierType: "SIZE", min: 1, max: 1 });
    expect(size.options.map((o) => [o.id, o.price])).toEqual([
      ["2001-S", 2.5],
      ["2001-L", 3.2],
    ]);
    expect(cola.displayPrice).toBe(2.5);
  });

  it("nested groups hang under their option", () => {
    const extras = product(menu, "1001").groups.find((g) => g.id === "M-EXTRAS")!;
    const sauce = extras.options.find((o) => o.id === "X-SAUCE")!;
    expect(sauce.groups.map((g) => [g.id, g.min, g.max])).toEqual([["M-SAUCE", 1, 1]]);
    expect(sauce.groups[0].key).toBe("1001/M-EXTRAS/X-SAUCE/M-SAUCE");
  });

  it("combos list the main choice, then the sides", () => {
    expect(product(menu, "3001").groups.map((g) => g.kind)).toEqual([
      "COMBO_MAIN",
      "COMBO_SIDE",
      "COMBO_SIDE",
    ]);
  });

  it("INGR options keep defaultQuantity 1; unavailable options stay, grey", () => {
    const burger = product(menu, "1001");
    const ingredients = burger.groups.find((g) => g.modifierType === "INGR")!;
    expect(ingredients.options.map((o) => o.defaultQuantity)).toEqual([1, 1]);
    const bacon = burger.groups.flatMap((g) => g.options).find((o) => o.id === "X-BACON")!;
    expect(bacon.available).toBe(false);
  });

  it("reads swap sell, cross-sell, badges and allergens", () => {
    const burger = product(menu, "1001");
    expect(burger.swapSell).toEqual({ name: "Turbine seu hambúrguer", productIds: ["1003"] });
    expect(burger.crossSellIds).toEqual(["2001"]);
    expect(burger.badges.map((b) => b.name)).toEqual(["Novidade"]);
    expect(burger.allergens).toEqual(["GLUTEN", "MILK", "SESAME"]);
    expect(burger.allergensDeclared).toBe(true);
    // The swap target is reachable even though no section lists it.
    expect(findProduct(menu, "1003")?.name).toBe("Hambúrguer duplo");
  });

  it("uses the dine-in price override", () => {
    const menu = readMenu(tiny([{ ...item("P", [], 9.5), dineInPriceOverride: 8 }]));
    expect(product(menu, "P").price).toBe(8);
  });

  // Review Focus 3: a broken graph never crashes or hangs the kiosk.
  it("a missing link is skipped", () => {
    const menu = readMenu(
      tiny([
        item("P", [
          { type: "MODIFIERS", id: "G" },
          { type: "IMAGE", id: "NOPE" },
        ]),
        { id: "G", type: "MODIFIERS", name: "G", min: 0, max: 1, links: [{ type: "ITEM", id: "GONE" }, { type: "ITEM", id: "O" }] },
        item("O"),
      ]),
    );
    expect(product(menu, "P").groups[0].options.map((o) => o.id)).toEqual(["O"]);
    expect(product(menu, "P").picture).toBeNull();
  });

  it("an empty group is dropped", () => {
    const menu = readMenu(
      tiny([
        item("P", [{ type: "MODIFIERS", id: "G" }]),
        { id: "G", type: "MODIFIERS", name: "G", min: 1, max: 1, links: [] },
      ]),
    );
    expect(product(menu, "P").groups).toEqual([]);
  });

  it("a swap sell with no products is null", () => {
    const menu = readMenu(
      tiny([
        item("P", [{ type: "SWAP_SELL", id: "SS" }]),
        { id: "SS", type: "SWAP_SELL", name: "Troca", links: [{ type: "ITEM", id: "GONE" }] },
      ]),
    );
    expect(product(menu, "P").swapSell).toBeNull();
  });

  it("a loop ends without hanging", () => {
    const menu = readMenu(
      tiny([
        item("P", [{ type: "MODIFIERS", id: "G" }]),
        { id: "G", type: "MODIFIERS", name: "G", min: 0, max: 1, links: [{ type: "ITEM", id: "O" }] },
        item("O", [{ type: "MODIFIERS", id: "G" }]),
      ]),
    );
    const [group] = product(menu, "P").groups;
    expect(group.options[0].id).toBe("O");
    expect(group.options[0].groups).toEqual([]);
  });

  it("a section linking itself, or hidden, is left out", () => {
    const menu = readMenu({
      root: [
        { type: "CATEGORY", id: "S" },
        { type: "CATEGORY", id: "H" },
        { type: "CATEGORY", id: "E" },
      ],
      entities: [
        { id: "S", type: "CATEGORY", name: "S", available: true, links: [{ type: "CATEGORY", id: "S" }, { type: "ITEM", id: "P" }] },
        { id: "H", type: "CATEGORY", name: "H", available: false, links: [{ type: "ITEM", id: "P" }] },
        { id: "E", type: "CATEGORY", name: "E", available: true, links: [] },
        item("P"),
      ],
      menuId: "m",
      validUntil: null,
      badges: [],
    });
    expect(menu.sections.map((s) => [s.id, s.sections.length])).toEqual([["S", 0]]);
  });
});
