import { beforeEach, describe, expect, it } from "vitest";

import { applyScenario, now } from "../state";
import { isGroup, isItem, key, type S } from "./http";
import { guestMenu, validateCatalogue } from "./menu";
import { v2 } from "./state";

const check = () => validateCatalogue(v2().entities, v2().menus, v2().badges);
const entity = (type: string, id: string) => v2().entities.get(key(type, id))!;

describe("validateCatalogue (MENU_INVALID)", () => {
  beforeEach(() => applyScenario("afternoon"));

  it("the seed passes the validator", () => {
    expect(check()).toEqual([]);
  });

  it("a link to a missing entity is MISSING_LINK", () => {
    entity("MODIFIERS", "M-EXTRAS").links.push({ id: "NOPE", type: "ITEM" });
    expect(check()).toEqual([
      expect.objectContaining({ rule: "MISSING_LINK", entity: { type: "MODIFIERS", id: "M-EXTRAS" } }),
    ]);
  });

  it("a group with no options is EMPTY_GROUP", () => {
    entity("MODIFIERS", "M-SAUCE").links = [];
    expect(check().map((e) => e.rule)).toEqual(["EMPTY_GROUP"]);
  });

  it("a swap sell with no items is EMPTY_SWAP_SELL", () => {
    entity("SWAP_SELL", "SS-1001").links = [];
    expect(check().map((e) => e.rule)).toEqual(["EMPTY_SWAP_SELL"]);
  });

  it("an option linking back to its group is LOOP", () => {
    entity("ITEM", "S-BBQ").links.push({ id: "M-SAUCE", type: "MODIFIERS" });
    expect(check().map((e) => e.rule)).toContain("LOOP");
  });

  it("an id with :: is INVALID_ID", () => {
    const bad = { ...entity("ITEM", "S-MAYO"), id: "M-SAUCE::S-MAYO" } as S["PosEntityItem"];
    v2().entities.set(key("ITEM", bad.id), bad);
    expect(check()).toEqual([expect.objectContaining({ rule: "INVALID_ID" })]);
  });

  it("a combo without its main choice is COMBO_INCOMPLETE", () => {
    const combo = entity("COMBO_MEAL", "3001");
    combo.links = combo.links.filter((l) => l.type !== "COMBO_MAIN");
    expect(check().map((e) => e.rule)).toEqual(["COMBO_INCOMPLETE"]);
  });
});

describe("guestMenu", () => {
  beforeEach(() => applyScenario("afternoon"));

  it("serves the afternoon menu's graph with no tax and no translations", () => {
    const menu = guestMenu(now(), "pt-BR")!;
    expect(menu.menuId).toBe("mnu-tarde");
    expect(menu.root.map((l) => l.id)).toEqual(["100", "200", "300"]);
    expect(menu.entities.some((e) => e.type === "TAX")).toBe(false);
    expect(menu.entities.some((e) => "translations" in e)).toBe(false);
    expect(menu.entities.find((e) => e.id === "X-BACON")).toMatchObject({ available: false });
  });

  it("resolves English names", () => {
    const menu = guestMenu(now(), "en")!;
    expect(menu.entities.find((e) => e.type === "ITEM" && e.id === "X-CHEESE")?.name).toBe("Extra cheese");
    expect(menu.badges[0].name).toBe("New");
  });

  it("shows a sized item's cheapest size as displayPrice", () => {
    const cola = guestMenu(now(), "pt-BR")!.entities.find((e) => e.type === "SIZED_ITEM");
    expect(isItem(cola) && cola.displayPrice).toBe(2.5);
  });

  it("adds the cheapest required picks to a combo's displayPrice", () => {
    const combo = guestMenu(now(), "pt-BR")!.entities.find((e) => e.type === "COMBO_MEAL");
    expect(isItem(combo) && combo.displayPrice).toBe(12.95);
  });

  it("hides a section outside its hours", () => {
    applyScenario("morning");
    const menu = guestMenu(now(), "pt-BR")!;
    expect(menu.menuId).toBe("mnu-manha");
    expect(menu.entities.find((e) => e.type === "CATEGORY" && e.id === "100")).toMatchObject({ available: false });
    expect(menu.entities.filter(isGroup).length).toBeGreaterThan(0);
  });

  it("is null when the store is closed", () => {
    applyScenario("closed");
    expect(guestMenu(now(), "pt-BR")).toBeNull();
  });
});
