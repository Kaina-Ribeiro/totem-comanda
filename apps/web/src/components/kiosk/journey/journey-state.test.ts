import { describe, expect, it } from "vitest";

import { BUNDLED, format, mergeStrings } from "@/lib/kiosk/strings";

import {
  availableOrderTypes,
  initialJourney,
  type Journey,
  journeyReducer,
  type Menu,
} from "./journey-state";

const menu = { id: "mnu-manha", entities: [] } as unknown as Menu;
const started = {
  type: "started" as const,
  orderNonce: "n-1",
  journeyStartedTimestamp: null,
  menu,
  strings: BUNDLED["pt-BR"],
  orderType: null,
};

describe("journeyReducer", () => {
  it("goes from the tap to the order type, then the menu", () => {
    let state: Journey = initialJourney("pt-BR");
    state = journeyReducer(state, { type: "start" });
    expect(state.phase).toBe("starting");
    state = journeyReducer(state, started);
    expect(state).toMatchObject({ phase: "orderType", orderNonce: "n-1", menu });
    state = journeyReducer(state, { type: "orderType", orderType: "TAKE_OUT" });
    expect(state).toMatchObject({ phase: "menu", orderType: "TAKE_OUT" });
  });

  it("skips the order type screen when only one exists", () => {
    const state = journeyReducer(journeyReducer(initialJourney("en"), { type: "start" }), {
      ...started,
      orderType: "DINEIN",
    });
    expect(state).toMatchObject({ phase: "menu", orderType: "DINEIN" });
  });

  it("ignores a late start result after a reset", () => {
    const reset = journeyReducer(journeyReducer(initialJourney("en"), { type: "start" }), {
      type: "reset",
      language: "pt-BR",
    });
    expect(journeyReducer(reset, started)).toEqual(initialJourney("pt-BR"));
  });
});

describe("basket", () => {
  const inMenu = journeyReducer(
    journeyReducer(journeyReducer(initialJourney("pt-BR"), { type: "start" }), started),
    { type: "orderType", orderType: "TAKE_OUT" },
  );
  const line = (guid: string, options: { optionId: string; quantity: number }[] = []) => ({
    guid,
    itemId: "itm-croque-monsieur",
    quantity: 1,
    options,
  });

  it("merges identical lines and keeps different choices apart (F-BASKET-01)", () => {
    let state = journeyReducer(inMenu, { type: "addLine", line: line("a") });
    state = journeyReducer(state, { type: "addLine", line: line("b") });
    state = journeyReducer(state, {
      type: "addLine",
      line: line("c", [{ optionId: "opt-ovo-poche", quantity: 1 }]),
    });
    expect(state.basket.map((l) => [l.guid, l.quantity])).toEqual([
      ["a", 2],
      ["c", 1],
    ]);
  });

  it("edits a line from the basket and returns there", () => {
    let state = journeyReducer(inMenu, { type: "addLine", line: line("a") });
    state = journeyReducer(state, { type: "openBasket" });
    state = journeyReducer(state, {
      type: "openItem",
      itemId: "itm-croque-monsieur",
      editGuid: "a",
    });
    state = journeyReducer(state, {
      type: "saveItem",
      line: { ...line("a", [{ optionId: "opt-ovo-poche", quantity: 1 }]), quantity: 3 },
    });
    expect(state.phase).toBe("basket");
    expect(state.basket).toEqual([
      { ...line("a", [{ optionId: "opt-ovo-poche", quantity: 1 }]), quantity: 3 },
    ]);
  });

  it("drops a quote that answers an older basket", () => {
    const state = journeyReducer(inMenu, { type: "addLine", line: line("a") });
    const total = {
      subtotal: 1,
      discountTotal: 0,
      total: 1,
      taxInclusive: true,
      tax: null,
      currency: "BRL" as const,
    };
    expect(
      journeyReducer(state, { type: "quoted", key: "old", result: { ok: true, data: total } }),
    ).toBe(state);
  });
});

describe("checkout", () => {
  const inBasket = journeyReducer(
    journeyReducer(
      journeyReducer(journeyReducer(initialJourney("pt-BR"), { type: "start" }), started),
      { type: "orderType", orderType: "TAKE_OUT" },
    ),
    { type: "addLine", line: { guid: "a", itemId: "itm-agua", quantity: 1, options: [] } },
  );

  it("keeps the order's idempotency keys while the basket is the same", () => {
    const first = journeyReducer(inBasket, {
      type: "openCheckout",
      orderKey: "k1",
      placeKey: "p1",
    });
    const back = journeyReducer(first, { type: "openBasket" });
    const again = journeyReducer(back, { type: "openCheckout", orderKey: "k2", placeKey: "p2" });
    expect(again.checkout).toMatchObject({ orderKey: "k1", placeKey: "p1" });
  });

  it("starts a new order when the basket changed", () => {
    const first = journeyReducer(inBasket, {
      type: "openCheckout",
      orderKey: "k1",
      placeKey: "p1",
    });
    const changed = journeyReducer(journeyReducer(first, { type: "openBasket" }), {
      type: "lineQuantity",
      guid: "a",
      quantity: 2,
    });
    const again = journeyReducer(changed, { type: "openCheckout", orderKey: "k2", placeKey: "p2" });
    expect(again.checkout).toMatchObject({ orderKey: "k2", order: null });
  });
});

describe("cross-sell", () => {
  const coffeeMenu = {
    id: "m",
    entities: [
      {
        id: "c",
        type: "CATEGORY",
        displayOrder: 1,
        childEntities: [
          {
            id: "croque",
            type: "ITEM",
            displayOrder: 1,
            childEntities: [],
            crossSellGroupId: "xs",
          },
          { id: "cafe", type: "ITEM", displayOrder: 2, childEntities: [] },
        ],
      },
    ],
    crossSellGroups: [{ id: "xs", name: "Que tal um café?", crossSells: ["cafe"] }],
  } as unknown as Menu;
  const inMenu = journeyReducer(
    journeyReducer(journeyReducer(initialJourney("pt-BR"), { type: "start" }), {
      ...started,
      menu: coffeeMenu,
    }),
    { type: "orderType", orderType: "TAKE_OUT" },
  );
  const croque = { guid: "a", itemId: "croque", quantity: 1, options: [] };

  it("suggests the group after adding an item, and adds what is accepted", () => {
    const suggested = journeyReducer(inMenu, { type: "addLine", line: croque });
    expect(suggested.crossSell).toEqual({ groupId: "xs" });
    const accepted = journeyReducer(suggested, {
      type: "crossSellAccepted",
      lines: [{ guid: "b", itemId: "cafe", quantity: 1, options: [] }],
    });
    expect(accepted.crossSell).toBeNull();
    expect(accepted.basket.map((l) => l.itemId)).toEqual(["croque", "cafe"]);
  });

  it("stops suggesting after the guest says no", () => {
    const dismissed = journeyReducer(journeyReducer(inMenu, { type: "addLine", line: croque }), {
      type: "crossSellDismissed",
    });
    expect(journeyReducer(dismissed, { type: "addLine", line: croque }).crossSell).toBeNull();
  });
});

describe("availableOrderTypes", () => {
  it("puts DINEIN first and leaves out closed ones (BR-START-11)", () => {
    expect(availableOrderTypes({ isDineInAvailable: true, isTakeOutAvailable: true })).toEqual([
      "DINEIN",
      "TAKE_OUT",
    ]);
    expect(availableOrderTypes({ isDineInAvailable: false, isTakeOutAvailable: true })).toEqual([
      "TAKE_OUT",
    ]);
  });
});

describe("strings", () => {
  it("merges the owner's overrides over the bundle, ignoring unknown keys", () => {
    const merged = mergeStrings("pt-BR", {
      "attract.cta": "Toque aqui",
      "made.up": "x",
      "nav.home": "",
    });
    expect(merged["attract.cta"]).toBe("Toque aqui");
    expect(merged["nav.home"]).toBe(BUNDLED["pt-BR"]["nav.home"]);
    expect(merged).not.toHaveProperty("made.up");
  });

  it("fills placeholders", () => {
    expect(format("{n} itens", { n: 3 })).toBe("3 itens");
  });
});
