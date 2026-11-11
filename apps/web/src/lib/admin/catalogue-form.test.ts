import { describe, expect, it } from "vitest";

import { ALL_ALLERGENS } from "./allergens";
import {
  type AdminItem,
  type Item,
  newId,
  readBadge,
  readDiscountRule,
  readGroup,
  readHours,
  readItem,
  readLinks,
  readMenu,
  readSection,
  readSwapSell,
  readTexts,
} from "./catalogue-form";

const form = (fields: Record<string, string | string[]>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) data.append(key, v);
  }
  return data;
};

const failsWith = (detail: string) => expect.objectContaining({ code: "VALIDATION_FAILED", detail });

describe("allergens", () => {
  it("covers every v2 Allergen value once", () => {
    expect(new Set(ALL_ALLERGENS).size).toBe(ALL_ALLERGENS.length);
    expect(ALL_ALLERGENS).toHaveLength(55);
    expect(ALL_ALLERGENS).toContain("NATURAL_LATEX");
  });
});

describe("newId", () => {
  it("makes an id the contract accepts, never with ':'", () => {
    const id = newId("cat");
    expect(id).toMatch(/^cat-[0-9a-f]{6}$/);
    expect(id).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
  });
});

describe("readTexts", () => {
  it("reads pt-BR as the name and English as translations", () => {
    expect(readTexts(form({ "name.pt": "Bebidas", "name.en": "Drinks", "description.pt": "Geladas" }))).toEqual({
      name: "Bebidas",
      description: "Geladas",
      translations: { en: { name: "Drinks" } },
    });
  });

  it("has no translations when English is empty, and requires a name", () => {
    expect(readTexts(form({ "name.pt": "Bebidas", "name.en": " " })).translations).toBeUndefined();
    expect(() => readTexts(form({ "name.pt": "" }))).toThrow(failsWith("nome"));
  });
});

describe("readLinks", () => {
  it("orders rows by their number, drops removed rows and repeats, appends the added one", () => {
    const links = readLinks(
      form({
        "links.0.type": "ITEM",
        "links.0.id": "a",
        "links.0.order": "2",
        "links.1.type": "CATEGORY",
        "links.1.id": "b",
        "links.1.order": "1",
        "links.2.type": "ITEM",
        "links.2.id": "c",
        "links.2.remove": "on",
        "links.add": "SIZED_ITEM:d",
        "links.3.type": "ITEM",
        "links.3.id": "a",
      }),
      "links",
    );
    expect(links).toEqual([
      { type: "CATEGORY", id: "b" },
      { type: "ITEM", id: "a" },
      { type: "SIZED_ITEM", id: "d" },
    ]);
  });
});

describe("readHours", () => {
  it("reads one window per ticked day as HH:mm:ss", () => {
    expect(
      readHours(form({ "FRIDAY.open": "on", "FRIDAY.start": "11:00", "FRIDAY.end": "23:00", "MONDAY.start": "06:00", "MONDAY.end": "11:00" })),
    ).toEqual([{ dayOfWeek: "FRIDAY", open: "11:00:00", close: "23:00:00" }]);
  });

  it("refuses a time that is not HH:mm", () => {
    expect(() => readHours(form({ "MONDAY.open": "on", "MONDAY.start": "25:00", "MONDAY.end": "11:00" }))).toThrow(
      failsWith("Segunda, abre"),
    );
  });
});

describe("readSection", () => {
  it("puts the picture first, then sub-sections and products in order", () => {
    const section = readSection(
      form({
        id: "100",
        "name.pt": "Hambúrgueres",
        "name.en": "Burgers",
        available: "on",
        image: "img-1",
        "hours.on": "on",
        "SUNDAY.open": "on",
        "SUNDAY.start": "12:00",
        "SUNDAY.end": "21:00",
        "links.0.type": "CATEGORY",
        "links.0.id": "110",
        "links.1.type": "ITEM",
        "links.1.id": "1001",
      }),
      null,
    );
    expect(section).toMatchObject({
      id: "100",
      type: "CATEGORY",
      available: true,
      availableHours: [{ dayOfWeek: "SUNDAY", open: "12:00:00", close: "21:00:00" }],
      links: [
        { type: "IMAGE", id: "img-1" },
        { type: "CATEGORY", id: "110" },
        { type: "ITEM", id: "1001" },
      ],
    });
  });

  it("keeps the current id and has no hours when they are off", () => {
    const current = { id: "200", name: "x", type: "CATEGORY" as const, links: [], gfcId: 9 };
    const section = readSection(form({ id: "evil", "name.pt": "Bebidas" }), current);
    expect(section).toMatchObject({ id: "200", gfcId: 9, available: false, availableHours: [] });
  });
});

const burger: Item = {
  id: "1001",
  name: "Hambúrguer clássico",
  type: "ITEM",
  price: 9.5,
  available: true,
  deliveryPriceOverride: 10.5,
  barcodes: ["5012345678900"],
  dineinFlag: 1,
  posMetadata: { kitchenPrinter: "grill" },
  displayPrice: 9.5,
  links: [{ type: "MODIFIERS", id: "M-EXTRAS" }],
};

const itemForm = (extra: Record<string, string | string[]> = {}) =>
  form({
    "name.pt": "Hambúrguer clássico",
    price: "9,50",
    available: "on",
    allergensDeclared: "on",
    allergens: ["GLUTEN", "MILK", "NOT_A_VALUE"],
    traces: ["SESAME"],
    badgeIds: ["NOVO"],
    crossSellIds: ["2001"],
    "links.0.type": "MODIFIERS",
    "links.0.id": "M-EXTRAS",
    ...extra,
  });

describe("readItem", () => {
  it("reads a product with decimal price, allergens, traces, badges and cross-sells", () => {
    const item = readItem(itemForm({ type: "ITEM", dineInPrice: "R$ 8,90", image: "1001" }), null);
    expect(item).toMatchObject({
      type: "ITEM",
      price: 9.5,
      dineInPriceOverride: 8.9,
      allergens: ["GLUTEN", "MILK"],
      allergenTraces: ["SESAME"],
      allergensDeclared: true,
      badgeIds: ["NOVO"],
      crossSellIds: ["2001"],
      links: [
        { type: "IMAGE", id: "1001" },
        { type: "MODIFIERS", id: "M-EXTRAS" },
      ],
    });
    expect(item.id).toMatch(/^it-/);
  });

  it("keeps the fields the form does not show and drops displayPrice (Review Focus 3)", () => {
    const item = readItem(itemForm(), burger);
    expect(item).toMatchObject({
      id: "1001",
      deliveryPriceOverride: 10.5,
      barcodes: ["5012345678900"],
      dineinFlag: 1,
      posMetadata: { kitchenPrinter: "grill" },
    });
    expect(item).not.toHaveProperty("displayPrice");
  });

  it("refuses a price that is not one instead of guessing (Review Focus 5)", () => {
    expect(() => readItem(itemForm({ price: "9,505" }), burger)).toThrow(failsWith("preço"));
    expect(() => readItem(itemForm({ dineInPrice: "abc" }), burger)).toThrow(failsWith("preço para comer aqui"));
  });

  it("prices a sized item at 0 (its sizes carry the price)", () => {
    expect(readItem(itemForm({ type: "SIZED_ITEM", price: "" }), null)).toMatchObject({ type: "SIZED_ITEM", price: 0 });
  });

  it("numbers a new combo and keeps the number of an existing one", () => {
    expect(readItem(itemForm({ type: "COMBO_MEAL" }), null, { nextComboId: 8 })).toMatchObject({ type: "COMBO_MEAL", comboMealId: 8 });
    const combo = { ...burger, type: "COMBO_MEAL", comboMealId: 7 } as AdminItem;
    expect(readItem(itemForm(), combo, { nextComboId: 99 })).toMatchObject({ comboMealId: 7 });
  });

  it("reads option limits, keeping them when the form does not show them", () => {
    const option = { ...burger, id: "X-CHEESE", minChoices: 0, maxChoices: 2 };
    expect(readItem(itemForm(), option)).toMatchObject({ minChoices: 0, maxChoices: 2 });
    expect(readItem(itemForm({ defaultQuantity: "1", maxChoices: "" }), option)).toMatchObject({
      defaultQuantity: 1,
      maxChoices: null,
    });
    expect(() => readItem(itemForm({ maxChoices: "-1" }), option)).toThrow(failsWith("máximo da opção"));
  });
});

describe("readGroup", () => {
  const items = new Map<string, AdminItem>([
    ["X-SAUCE", { id: "X-SAUCE", name: "Adicionar molho", type: "ITEM", price: 0, available: true, plu: "X-SAUCE", links: [{ type: "MODIFIERS", id: "M-SAUCE" }] }],
  ]);
  const groupForm = (extra: Record<string, string> = {}) =>
    form({
      type: "MODIFIERS",
      modifierType: "MODI",
      "name.pt": "Adicionais",
      "name.en": "Add extras",
      min: "0",
      max: "3",
      "opt.0.id": "X-SAUCE",
      "opt.0.name.pt": "Adicionar molho",
      "opt.0.price": "",
      "opt.0.available": "on",
      "opt.0.nested": "M-SAUCE",
      "opt.0.order": "2",
      "opt.1.id": "",
      "opt.1.name.pt": "Queijo extra",
      "opt.1.name.en": "Extra cheese",
      "opt.1.price": "1,00",
      "opt.1.available": "on",
      "opt.1.minChoices": "0",
      "opt.1.maxChoices": "2",
      "opt.1.order": "1",
      "opt.2.id": "",
      "opt.2.name.pt": "",
      ...extra,
    });

  it("reads the group and its options in order; new options get an id, blank rows are ignored", () => {
    const { group, options } = readGroup(groupForm(), null, items);
    expect(group).toMatchObject({ type: "MODIFIERS", modifierType: "MODI", min: 0, max: 3, translations: { en: { name: "Add extras" } } });
    expect(options.map((o) => o.name)).toEqual(["Queijo extra", "Adicionar molho"]);
    expect(options[0]).toMatchObject({ price: 1, minChoices: 0, maxChoices: 2, translations: { en: { name: "Extra cheese" } } });
    expect(options[0].id).toMatch(/^op-/);
    expect(options[1]).toMatchObject({ id: "X-SAUCE", plu: "X-SAUCE", price: 0, links: [{ type: "MODIFIERS", id: "M-SAUCE" }] });
    expect(group.links).toEqual(options.map((o) => ({ type: "ITEM", id: o.id })));
  });

  it("drops the nested group when cleared and unlinks a removed option", () => {
    const { options } = readGroup(groupForm({ "opt.0.nested": "", "opt.1.remove": "on" }), null, items);
    expect(options).toHaveLength(1);
    expect(options[0].links).toEqual([]);
  });

  it("refuses a minimum above the maximum", () => {
    expect(() => readGroup(groupForm({ min: "4" }), null, items)).toThrow(failsWith("mínimo e máximo"));
  });
});

describe("readSwapSell, readBadge, readMenu", () => {
  it("keeps only products in a swap sell", () => {
    const swap = readSwapSell(
      form({ "name.pt": "Turbine", "links.0.type": "ITEM", "links.0.id": "1003", "links.add": "CATEGORY:100" }),
      null,
    );
    expect(swap).toMatchObject({ type: "SWAP_SELL", links: [{ type: "ITEM", id: "1003" }] });
  });

  it("reads badge colours and refuses a colour that is not #RRGGBB", () => {
    expect(readBadge(form({ "name.pt": "Novidade", textColour: "#faf6f0", backgroundColour: "#4E3426" }), null)).toMatchObject({
      textColour: "#FAF6F0",
    });
    expect(() => readBadge(form({ "name.pt": "N", textColour: "red", backgroundColour: "#4E3426" }), null)).toThrow(failsWith("cores"));
  });

  it("keeps only sections in a menu root", () => {
    const menu = readMenu(
      form({ "name.pt": "Tarde", "root.0.type": "CATEGORY", "root.0.id": "100", "root.add": "ITEM:1001" }),
      { id: "mnu-tarde", name: "x", root: [], isActive: true, forcedUntil: null },
    );
    expect(menu).toEqual({ id: "mnu-tarde", name: "Tarde", translations: undefined, root: [{ type: "CATEGORY", id: "100" }] });
  });
});

describe("readDiscountRule (Review Focus 5)", () => {
  const rule = (extra: Record<string, string> = {}) =>
    form({ "name.pt": "R$ 5 acima de R$ 20", code: "cafe5", type: "FIXED", value: "5,00", minOrderTotal: "20", active: "on", ...extra });

  it("reads a fixed coupon in reais and upper-cases the code", () => {
    expect(readDiscountRule(rule(), null)).toMatchObject({
      code: "CAFE5",
      type: "FIXED",
      value: 5,
      minOrderTotal: 20,
      maxDiscount: null,
      maxUses: null,
      usesCount: 0,
      active: true,
    });
  });

  it("keeps Go's use count, never the form's", () => {
    const current = { id: "dr-1", code: "CAFE5", name: "x", type: "FIXED" as const, value: 5, usesCount: 4, active: true };
    expect(readDiscountRule(rule({ usesCount: "0" }), current)).toMatchObject({ id: "dr-1", usesCount: 4 });
  });

  it.each([
    [{ type: "PERCENT", value: "101" }, "porcentagem (1 a 100)"],
    [{ type: "PERCENT", value: "0" }, "porcentagem (1 a 100)"],
    [{ type: "PERCENT", value: "12,5" }, "porcentagem (1 a 100)"],
    [{ value: "0" }, "valor do desconto"],
    [{ value: "abc" }, "valor do desconto"],
    [{ code: "AB" }, "código (3 a 20 letras ou números)"],
    [{ code: "CAFÉ5" }, "código (3 a 20 letras ou números)"],
    [{ maxUses: "0" }, "limite de usos"],
    [{ minOrderTotal: "20,005" }, "pedido mínimo"],
  ])("refuses %j", (extra, detail) => {
    expect(() => readDiscountRule(rule(extra), null)).toThrow(failsWith(detail));
  });

  it("reads a percent coupon with a maximum discount and a uses cap", () => {
    expect(readDiscountRule(rule({ type: "PERCENT", value: "10", maxDiscount: "15,00", maxUses: "50" }), null)).toMatchObject({
      type: "PERCENT",
      value: 10,
      maxDiscount: 15,
      maxUses: 50,
    });
  });
});
