import { beforeEach, describe, expect, it } from "vitest";

import { applyScenario, now } from "../../../mock/state";
import { guestMenu } from "../../../mock/v2/menu";
import {
  canAdd,
  draftToLine,
  groupCount,
  initialDraft,
  isBlocked,
  lineToDraft,
  setOptionQuantity,
  swapTo,
  toggleOption,
} from "./builder";
import { findProduct, type KioskMenu, type MenuGroup, readMenu } from "./menu-graph";

let menu: KioskMenu;
beforeEach(() => {
  applyScenario("afternoon");
  menu = readMenu(guestMenu(now(), "pt-BR")!);
});

const product = (id: string) => findProduct(menu, id)!;
const group = (productId: string, id: string): MenuGroup => {
  const walk = (groups: MenuGroup[]): MenuGroup | undefined =>
    groups.find((g) => g.id === id) ??
    groups.flatMap((g) => g.options.flatMap((o) => o.groups)).reduce<MenuGroup | undefined>(
      (found, g) => found ?? walk([g]),
      undefined,
    );
  return walk(product(productId).groups)!;
};
const option = (g: MenuGroup, id: string) => g.options.find((o) => o.id === id)!;

describe("item builder", () => {
  it("INGR ingredients start picked and can be removed", () => {
    const burger = product("1001");
    const ingredients = group("1001", "M-ING-1001");
    let draft = initialDraft(burger);
    expect(groupCount(draft, ingredients)).toBe(2);
    draft = toggleOption(draft, ingredients, option(ingredients, "I-LETTUCE"));
    expect(draft.picks[ingredients.key]).toEqual({ "I-TOMATO": 1 });
    expect(canAdd(burger, draft)).toBe(true);
  });

  it("a single choice replaces the pick", () => {
    const cola = product("2001");
    const [size] = cola.groups;
    let draft = toggleOption(initialDraft(cola), size, option(size, "2001-S"));
    draft = toggleOption(draft, size, option(size, "2001-L"));
    expect(draft.picks[size.key]).toEqual({ "2001-L": 1 });
  });

  it("a size is required before a sized item can be added", () => {
    const cola = product("2001");
    expect(canAdd(cola, initialDraft(cola))).toBe(false);
    const [size] = cola.groups;
    expect(canAdd(cola, toggleOption(initialDraft(cola), size, option(size, "2001-S")))).toBe(true);
  });

  it("a full group blocks another pick", () => {
    const extras = group("1001", "M-EXTRAS");
    const full = { ...extras, max: 2 };
    const draft = setOptionQuantity(initialDraft(product("1001")), full, option(full, "X-CHEESE"), 2);
    expect(isBlocked(draft, full, option(full, "X-SAUCE"))).toBe(true);
    expect(toggleOption(draft, full, option(full, "X-SAUCE"))).toBe(draft);
  });

  it("maxChoices caps the stepper, and the group's max caps it too", () => {
    const extras = group("1001", "M-EXTRAS");
    const cheese = option(extras, "X-CHEESE");
    const draft = setOptionQuantity(initialDraft(product("1001")), extras, cheese, 5);
    expect(draft.picks[extras.key]["X-CHEESE"]).toBe(2);
  });

  it("an unavailable option cannot be picked", () => {
    const extras = group("1001", "M-EXTRAS");
    const draft = initialDraft(product("1001"));
    expect(isBlocked(draft, extras, option(extras, "X-BACON"))).toBe(true);
    expect(toggleOption(draft, extras, option(extras, "X-BACON"))).toBe(draft);
  });

  it("a nested required group must be chosen, and goes when its option goes", () => {
    const burger = product("1001");
    const extras = group("1001", "M-EXTRAS");
    const sauce = group("1001", "M-SAUCE");
    let draft = toggleOption(initialDraft(burger), extras, option(extras, "X-SAUCE"));
    expect(canAdd(burger, draft)).toBe(false);
    draft = toggleOption(draft, sauce, option(sauce, "S-BBQ"));
    expect(canAdd(burger, draft)).toBe(true);
    draft = toggleOption(draft, extras, option(extras, "X-SAUCE"));
    expect(draft.picks[sauce.key]).toBeUndefined();
  });

  it("a combo needs its main choice and every side", () => {
    const combo = product("3001");
    let draft = initialDraft(combo);
    expect(canAdd(combo, draft)).toBe(false);
    for (const g of combo.groups) draft = toggleOption(draft, g, g.options[0]);
    expect(canAdd(combo, draft)).toBe(true);
  });

  it("an option with minChoices must be picked", () => {
    const burger = product("1001");
    const extras = group("1001", "M-EXTRAS");
    const strict = {
      ...burger,
      groups: burger.groups.map((g) =>
        g.id === "M-EXTRAS"
          ? { ...g, options: g.options.map((o) => (o.id === "X-CHEESE" ? { ...o, minChoices: 1 } : o)) }
          : g,
      ),
    };
    expect(canAdd(strict, initialDraft(strict))).toBe(false);
    expect(canAdd(strict, toggleOption(initialDraft(strict), extras, option(extras, "X-CHEESE")))).toBe(true);
  });

  it("a line round-trips back into the same draft", () => {
    const burger = product("1001");
    const extras = group("1001", "M-EXTRAS");
    const sauce = group("1001", "M-SAUCE");
    let draft = setOptionQuantity(initialDraft(burger), extras, option(extras, "X-CHEESE"), 2);
    draft = toggleOption(draft, extras, option(extras, "X-SAUCE"));
    draft = toggleOption(draft, sauce, option(sauce, "S-MAYO"));
    draft = { ...draft, quantity: 3 };
    const line = draftToLine(burger, draft, "g1");
    expect(line.quantity).toBe(3);
    expect(draftToLine(burger, lineToDraft(burger, line), "g1")).toEqual(line);
  });
});

describe("swapTo", () => {
  it("keeps the picks of shared groups and says whether a choice is missing", () => {
    const burger = product("1001");
    const extras = group("1001", "M-EXTRAS");
    const draft = toggleOption(initialDraft(burger), extras, option(extras, "X-CHEESE"));
    const { line, ready } = swapTo(product("1003"), draftToLine(burger, draft, "g1"));
    expect(line).toEqual({
      guid: "g1",
      productId: "1003",
      quantity: 1,
      picks: [{ groupKey: "1003/M-EXTRAS", optionId: "X-CHEESE", quantity: 1 }],
    });
    expect(ready).toBe(true);
  });
});
