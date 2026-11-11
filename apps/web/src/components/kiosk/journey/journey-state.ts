import type { SubmitOrderResponse, TotalsResponse } from "@/app/kiosk/actions";
import type { BasketLine } from "@/lib/kiosk/basket";
import type { Result } from "@/lib/kiosk/core";
import { findProduct, type KioskMenu } from "@/lib/kiosk/menu-graph";
import type { Language, Strings } from "@/lib/kiosk/strings";

/** One journey on the kiosk, held in the browser from tap to reset (pilot: dine-in only). */
export type Journey = {
  phase: "attract" | "starting" | "startFailed" | "menu" | "item" | "basket" | "checkout" | "success";
  language: Language;
  orderNonce: string | null;
  journeyStartedTimestamp: string | null;
  /** The menu loaded at journey start, in `language`, read into a tree. */
  menu: KioskMenu | null;
  strings: Strings | null;
  /** What the kiosk sends: product and option ids with quantities, never prices. */
  basket: BasketLine[];
  /** Section open on the menu screen; kept while an item is open. */
  sectionId: string | null;
  /** The product open in the builder, and the basket line it edits, if any. */
  item: { productId: string; editGuid: string | null; returnTo: "menu" | "basket" } | null;
  /** The coupon code on the basket (one per order). */
  coupon: string | null;
  /** Go's basket for this journey, from the first `POST /v2/totals`. */
  basketId: string | null;
  /** Go's latest totals, for the basket they were asked for (`key`). */
  totals: { key: string; result: Result<TotalsResponse> } | null;
  /** The `Idempotency-Key` that places this basket; kept while the basket stays the same. */
  checkout: { key: string; orderKey: string } | null;
  /** What to offer after an add: the product's swap sell, then its cross-sells. */
  offer: { kind: "swap"; guid: string; productId: string } | { kind: "crossSell"; productId: string } | null;
  crossSellOff: boolean;
  /** The placed order: its number comes from Go. */
  placed: SubmitOrderResponse | null;
};

export type JourneyAction =
  | { type: "language"; language: Language }
  | { type: "start" }
  | {
      type: "started";
      orderNonce: string;
      journeyStartedTimestamp: string | null;
      menu: KioskMenu;
      strings: Strings;
    }
  | { type: "startFailed" }
  | { type: "relocalized"; language: Language; menu: KioskMenu; strings: Strings }
  | { type: "addLine"; line: BasketLine }
  | { type: "pickSection"; sectionId: string }
  | { type: "openItem"; productId: string; editGuid?: string }
  | { type: "closeItem" }
  | { type: "saveItem"; line: BasketLine }
  /** The guest took the swap: the line now holds the target product. */
  | { type: "swapped"; line: BasketLine }
  /** The swap offer was declined (or taken): go on to cross-sells. */
  | { type: "swapDone" }
  | { type: "crossSellAccepted"; lines: BasketLine[] }
  | { type: "crossSellDismissed" }
  | { type: "openBasket" }
  | { type: "openMenu" }
  | { type: "lineQuantity"; guid: string; quantity: number }
  | { type: "removeLine"; guid: string }
  | { type: "priced"; key: string; result: Result<TotalsResponse> }
  /** Go no longer knows `basketId` (NOT_FOUND): price a new basket, without the coupon. */
  | { type: "basketLost" }
  | { type: "coupon"; code: string | null }
  | { type: "openCheckout"; orderKey: string }
  | { type: "placed"; placed: SubmitOrderResponse }
  | { type: "reset"; language: Language };

export function initialJourney(language: Language): Journey {
  return {
    phase: "attract",
    language,
    orderNonce: null,
    journeyStartedTimestamp: null,
    menu: null,
    strings: null,
    basket: [],
    sectionId: null,
    item: null,
    coupon: null,
    basketId: null,
    totals: null,
    checkout: null,
    offer: null,
    crossSellOff: false,
    placed: null,
  };
}

export function journeyReducer(state: Journey, action: JourneyAction): Journey {
  switch (action.type) {
    case "language":
      return { ...state, language: action.language };
    case "start":
      return state.phase === "attract" || state.phase === "startFailed" ? { ...state, phase: "starting" } : state;
    case "started":
      if (state.phase !== "starting") return state;
      return {
        ...state,
        phase: "menu",
        orderNonce: action.orderNonce,
        journeyStartedTimestamp: action.journeyStartedTimestamp,
        menu: action.menu,
        strings: action.strings,
      };
    case "startFailed":
      return state.phase === "starting" ? { ...state, phase: "startFailed" } : state;
    case "relocalized":
      return { ...state, language: action.language, menu: action.menu, strings: action.strings };
    case "addLine":
      return withOffer({ ...state, basket: addOrMerge(state.basket, action.line) }, action.line);
    case "pickSection":
      return { ...state, sectionId: action.sectionId };
    case "openItem":
      return {
        ...state,
        phase: "item",
        offer: null,
        item: {
          productId: action.productId,
          editGuid: action.editGuid ?? null,
          returnTo: state.phase === "basket" ? "basket" : "menu",
        },
      };
    case "closeItem":
      return { ...state, phase: state.item?.returnTo ?? "menu", item: null };
    case "saveItem": {
      const editGuid = state.item?.editGuid;
      const basket = editGuid
        ? replaceOrMerge(state.basket, editGuid, action.line)
        : addOrMerge(state.basket, action.line);
      const saved = { ...state, phase: state.item?.returnTo ?? "menu", item: null, basket };
      return editGuid ? saved : withOffer(saved, action.line);
    }
    case "swapped":
      return {
        ...state,
        basket: replaceOrMerge(state.basket, action.line.guid, action.line),
        offer: crossSellOffer(state, action.line.productId),
      };
    case "swapDone":
      return {
        ...state,
        offer: state.offer?.kind === "swap" ? crossSellOffer(state, state.offer.productId) : null,
      };
    case "crossSellAccepted":
      return { ...state, offer: null, basket: action.lines.reduce(addOrMerge, state.basket) };
    case "crossSellDismissed":
      return { ...state, offer: null, crossSellOff: true };
    case "openBasket":
      return state.basket.length > 0 ? { ...state, phase: "basket", offer: null } : state;
    case "openMenu":
      return { ...state, phase: "menu" };
    case "lineQuantity":
      return {
        ...state,
        basket: state.basket.map((line) =>
          line.guid === action.guid ? { ...line, quantity: Math.max(1, action.quantity) } : line,
        ),
      };
    case "removeLine": {
      const basket = state.basket.filter((line) => line.guid !== action.guid);
      return { ...state, basket, phase: basket.length === 0 && state.phase === "basket" ? "menu" : state.phase };
    }
    case "priced": {
      // A late answer for an older basket is dropped; Go's basket id is kept either way.
      const basketId = action.result.ok ? action.result.data.basketId : state.basketId;
      if (action.key !== totalsKey(state)) return { ...state, basketId };
      return { ...state, basketId, totals: { key: action.key, result: action.result } };
    }
    case "basketLost":
      return { ...state, basketId: null, coupon: null, totals: null, checkout: null };
    case "coupon":
      return { ...state, coupon: action.code };
    case "openCheckout": {
      if (state.basket.length === 0 || !currentTotals(state)) return state;
      const key = totalsKey(state);
      const keep = state.checkout?.key === key;
      return { ...state, phase: "checkout", checkout: keep ? state.checkout : { key, orderKey: action.orderKey } };
    }
    case "placed":
      return { ...state, phase: "success", placed: action.placed };
    case "reset":
      return initialJourney(action.language);
  }
}

/** Identifies what a totals call was for: the lines, the coupon and the language of the names. */
export function totalsKey(state: Pick<Journey, "basket" | "coupon" | "language">): string {
  return JSON.stringify([state.basket, state.coupon, state.language]);
}

/** Go's totals when they match the basket on screen, else null. */
export function currentTotals(state: Journey): TotalsResponse | null {
  return state.totals && state.totals.key === totalsKey(state) && state.totals.result.ok
    ? state.totals.result.data
    : null;
}

/** The totals error for the basket on screen; an older basket's error is not shown. */
export function currentTotalsFailure(state: Journey): Extract<Result<TotalsResponse>, { ok: false }> | null {
  return state.totals && state.totals.key === totalsKey(state) && !state.totals.result.ok ? state.totals.result : null;
}

/** The last total Go priced for this journey (for the basket bar while re-pricing, and journey events). */
export function lastTotal(state: Journey): number | null {
  return state.totals?.result.ok ? state.totals.result.data.total : null;
}

/** After a product is added: its swap sell first, else its cross-sells. */
function withOffer(state: Journey, line: BasketLine): Journey {
  const product = state.menu && findProduct(state.menu, line.productId);
  if (product?.swapSell) {
    const available = product.swapSell.productIds.some((id) => findProduct(state.menu!, id)?.available);
    if (available) return { ...state, offer: { kind: "swap", guid: line.guid, productId: product.id } };
  }
  return { ...state, offer: crossSellOffer(state, line.productId) };
}

/** Cross-sells of `productId` worth showing: some available and not in the basket already. */
function crossSellOffer(state: Journey, productId: string): Journey["offer"] {
  if (state.crossSellOff || !state.menu) return null;
  const ids = findProduct(state.menu, productId)?.crossSellIds ?? [];
  const offered = ids.filter(
    (id) => findProduct(state.menu!, id)?.available && !state.basket.some((line) => line.productId === id),
  );
  return offered.length > 0 ? { kind: "crossSell", productId } : null;
}

const sameChoices = (a: BasketLine, b: BasketLine) =>
  a.productId === b.productId && JSON.stringify(a.picks) === JSON.stringify(b.picks);

/** Adds a line, or bumps the quantity of an identical one. */
function addOrMerge(basket: BasketLine[], line: BasketLine): BasketLine[] {
  const twin = basket.find((existing) => sameChoices(existing, line));
  if (!twin) return [...basket, line];
  return basket.map((existing) =>
    existing === twin ? { ...existing, quantity: existing.quantity + line.quantity } : existing,
  );
}

/** Saves an edited line: if it now matches another line, the two become one; else it keeps its place. */
function replaceOrMerge(basket: BasketLine[], editGuid: string, line: BasketLine): BasketLine[] {
  const others = basket.filter((existing) => existing.guid !== editGuid);
  if (others.some((existing) => sameChoices(existing, line))) return addOrMerge(others, line);
  return basket.map((existing) => (existing.guid === editGuid ? line : existing));
}
