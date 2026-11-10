import { describe, expect, it } from "vitest";

import {
  currentTotals,
  currentTotalsFailure,
  type JourneyAction,
  journeyReducer,
  lastTotal,
  totalsKey,
} from "./journey-state";
import { journeyAt, line, pricedAt, totals } from "./test-journey";

const burger = line("1001");
const pint = line("2010");

describe("journeyReducer (v2, dine-in only)", () => {
  it("goes from the tap straight to the menu: no order-type screen", () => {
    expect(journeyAt().phase).toBe("menu");
  });

  it("merges an identical line instead of adding another", () => {
    const journey = journeyAt({ type: "addLine", line: pint }, { type: "addLine", line: { ...pint, guid: "other" } });
    expect(journey.basket).toEqual([{ ...pint, quantity: 2 }]);
  });

  it("offers the swap sell first, then the cross-sells, until the guest turns them off", () => {
    const added = journeyAt({ type: "addLine", line: burger });
    expect(added.offer).toEqual({ kind: "swap", guid: burger.guid, productId: "1001" });
    const kept = journeyReducer(added, { type: "swapDone" });
    expect(kept.offer).toEqual({ kind: "crossSell", productId: "1001" });
    const off = journeyReducer(kept, { type: "crossSellDismissed" });
    expect(off.offer).toBeNull();
    expect(journeyReducer(off, { type: "addLine", line: { ...burger, guid: "b2", picks: [{ groupKey: "1001/M-EXTRAS", optionId: "X-CHEESE", quantity: 1 }] } }).offer).toEqual({
      kind: "swap",
      guid: "b2",
      productId: "1001",
    });
  });

  it("a taken swap replaces the line and goes on to cross-sells", () => {
    const added = journeyAt({ type: "addLine", line: burger });
    const swapped = journeyReducer(added, { type: "swapped", line: { ...burger, productId: "1003" } });
    expect(swapped.basket.map((l) => l.productId)).toEqual(["1003"]);
    expect(swapped.offer).toBeNull(); // 1003 has no cross-sells
  });

  it("does not suggest a cross-sell already in the basket", () => {
    const journey = journeyAt({ type: "addLine", line: line("2001") }, { type: "addLine", line: burger }, { type: "swapDone" });
    expect(journey.offer).toBeNull();
  });

  it("keeps Go's totals only for the basket they priced, and Go's basket id always", () => {
    const journey = journeyAt({ type: "addLine", line: pint });
    const stale: JourneyAction = { type: "priced", key: "older", result: { ok: true, data: totals(9, { basketId: "B-9" }) } };
    const afterStale = journeyReducer(journey, stale);
    expect(currentTotals(afterStale)).toBeNull();
    expect(afterStale.basketId).toBe("B-9");
    const priced = journeyReducer(journey, pricedAt(journey, 5.2));
    expect(currentTotals(priced)?.total).toBe(5.2);
    // A change makes them stale; the last total stays for the bar, greyed.
    const changed = journeyReducer(priced, { type: "lineQuantity", guid: pint.guid, quantity: 2 });
    expect(currentTotals(changed)).toBeNull();
    expect(lastTotal(changed)).toBe(5.2);
  });

  it("shows a totals failure only for the basket on screen", () => {
    const journey = journeyAt({ type: "addLine", line: pint });
    const failed = journeyReducer(journey, {
      type: "priced",
      key: totalsKey(journey),
      result: { ok: false, code: "ITEM_UNAVAILABLE", detail: "2010" },
    });
    expect(currentTotalsFailure(failed)?.code).toBe("ITEM_UNAVAILABLE");
    expect(currentTotalsFailure(journeyReducer(failed, { type: "removeLine", guid: pint.guid }))).toBeNull();
  });

  it("a lost basket drops its id and its coupon", () => {
    const journey = journeyAt({ type: "addLine", line: pint });
    const withCoupon = journeyReducer(journeyReducer(journey, pricedAt(journey, 5.2)), { type: "coupon", code: "BEMVINDO10" });
    const lost = journeyReducer(withCoupon, { type: "basketLost" });
    expect([lost.basketId, lost.coupon, lost.totals]).toEqual([null, null, null]);
  });

  it("opens checkout only on priced totals, and keeps the order key while the basket stays", () => {
    const journey = journeyAt({ type: "addLine", line: pint });
    expect(journeyReducer(journey, { type: "openCheckout", orderKey: "k1" }).phase).toBe("menu");
    const priced = journeyReducer(journey, pricedAt(journey, 5.2));
    const open = journeyReducer(priced, { type: "openCheckout", orderKey: "k1" });
    expect(open.phase).toBe("checkout");
    const back = journeyReducer(open, { type: "openBasket" });
    expect(journeyReducer(back, { type: "openCheckout", orderKey: "k2" }).checkout?.orderKey).toBe("k1");
  });

  it("removing the last line from the basket goes back to the menu", () => {
    const journey = journeyAt({ type: "addLine", line: pint }, { type: "crossSellDismissed" }, { type: "openBasket" });
    expect(journeyReducer(journey, { type: "removeLine", guid: pint.guid }).phase).toBe("menu");
  });
});
