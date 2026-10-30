import { describe, expect, it } from "vitest";

import { BUNDLED, format, mergeStrings } from "@/lib/kiosk/strings";

import { availableOrderTypes, initialJourney, type Journey, journeyReducer, type Menu } from "./journey-state";

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

describe("availableOrderTypes", () => {
  it("puts DINEIN first and leaves out closed ones (BR-START-11)", () => {
    expect(availableOrderTypes({ isDineInAvailable: true, isTakeOutAvailable: true })).toEqual([
      "DINEIN",
      "TAKE_OUT",
    ]);
    expect(availableOrderTypes({ isDineInAvailable: false, isTakeOutAvailable: true })).toEqual(["TAKE_OUT"]);
  });
});

describe("strings", () => {
  it("merges the owner's overrides over the bundle, ignoring unknown keys", () => {
    const merged = mergeStrings("pt-BR", { "attract.cta": "Toque aqui", "made.up": "x", "nav.home": "" });
    expect(merged["attract.cta"]).toBe("Toque aqui");
    expect(merged["nav.home"]).toBe(BUNDLED["pt-BR"]["nav.home"]);
    expect(merged).not.toHaveProperty("made.up");
  });

  it("fills placeholders", () => {
    expect(format("{n} itens", { n: 3 })).toBe("3 itens");
  });
});
