import type { OrderTotal } from "@/app/kiosk/actions";
import type { components } from "@/lib/core-api";
import type { Result } from "@/lib/kiosk/core";
import type { BasketLine } from "@/lib/kiosk/menu-view";
import type { Language, Strings } from "@/lib/kiosk/strings";

type Schemas = components["schemas"];
export type Menu = Schemas["Menu"];
export type OrderType = Schemas["OrderType"];

/** One journey on the kiosk, held in the browser from tap to reset. */
export type Journey = {
  phase: "attract" | "starting" | "startFailed" | "orderType" | "menu" | "item" | "basket";
  language: Language;
  orderNonce: string | null;
  journeyStartedTimestamp: string | null;
  /** The menu loaded at journey start (OP-START-04), in `language`. */
  menu: Menu | null;
  strings: Strings | null;
  orderType: OrderType | null;
  /** What the kiosk sends: item and option ids with quantities, never prices. */
  basket: BasketLine[];
  /** Category open on the menu screen; kept while an item is open (F-MENU-12). */
  categoryId: string | null;
  /** The item open in the builder, and the basket line it edits, if any. */
  item: { itemId: string; editGuid: string | null; returnTo: "menu" | "basket" } | null;
  /** CPF (11) or CNPJ (14) digits for the receipt, if the guest gave one (F-BASKET-10). */
  cpfCnpj: string | null;
  /** Coupon or restaurant discount code on the order (one per order). */
  discountCode: string | null;
  /** The Core API's latest totals, for the basket they were asked for (`key`). */
  quote: { key: string; result: Result<OrderTotal> } | null;
};

export type JourneyAction =
  | { type: "language"; language: Language }
  | { type: "start" }
  | {
      type: "started";
      orderNonce: string;
      journeyStartedTimestamp: string | null;
      menu: Menu;
      strings: Strings;
      /** Set when only one order type exists, so its screen is skipped (BR-START-12). */
      orderType: OrderType | null;
    }
  | { type: "startFailed" }
  | { type: "relocalized"; language: Language; menu: Menu; strings: Strings }
  | { type: "orderType"; orderType: OrderType }
  | { type: "changeOrderType" }
  | { type: "addLine"; line: BasketLine }
  | { type: "pickCategory"; categoryId: string }
  | { type: "openItem"; itemId: string; editGuid?: string }
  | { type: "closeItem" }
  | { type: "saveItem"; line: BasketLine }
  | { type: "openBasket" }
  | { type: "openMenu" }
  | { type: "lineQuantity"; guid: string; quantity: number }
  | { type: "removeLine"; guid: string }
  | { type: "quoted"; key: string; result: Result<OrderTotal> }
  | { type: "taxId"; cpfCnpj: string | null }
  | { type: "discount"; code: string | null }
  | { type: "reset"; language: Language };

export function initialJourney(language: Language): Journey {
  return {
    phase: "attract",
    language,
    orderNonce: null,
    journeyStartedTimestamp: null,
    menu: null,
    strings: null,
    orderType: null,
    basket: [],
    categoryId: null,
    item: null,
    cpfCnpj: null,
    discountCode: null,
    quote: null,
  };
}

export function journeyReducer(state: Journey, action: JourneyAction): Journey {
  switch (action.type) {
    case "language":
      return { ...state, language: action.language };
    case "start":
      return state.phase === "attract" || state.phase === "startFailed"
        ? { ...state, phase: "starting" }
        : state;
    case "started":
      if (state.phase !== "starting") return state;
      return {
        ...state,
        phase: action.orderType ? "menu" : "orderType",
        orderNonce: action.orderNonce,
        journeyStartedTimestamp: action.journeyStartedTimestamp,
        menu: action.menu,
        strings: action.strings,
        orderType: action.orderType,
      };
    case "startFailed":
      return state.phase === "starting" ? { ...state, phase: "startFailed" } : state;
    case "relocalized":
      return { ...state, language: action.language, menu: action.menu, strings: action.strings };
    case "orderType":
      return { ...state, phase: "menu", orderType: action.orderType };
    case "changeOrderType":
      return { ...state, phase: "orderType" };
    case "addLine":
      return { ...state, basket: addOrMerge(state.basket, action.line) };
    case "pickCategory":
      return { ...state, categoryId: action.categoryId };
    case "openItem":
      return {
        ...state,
        phase: "item",
        item: {
          itemId: action.itemId,
          editGuid: action.editGuid ?? null,
          returnTo: state.phase === "basket" ? "basket" : "menu",
        },
      };
    case "closeItem":
      return { ...state, phase: state.item?.returnTo ?? "menu", item: null };
    case "saveItem": {
      const editGuid = state.item?.editGuid;
      const basket = editGuid
        ? state.basket.map((line) => (line.guid === editGuid ? action.line : line))
        : addOrMerge(state.basket, action.line);
      return { ...state, phase: state.item?.returnTo ?? "menu", item: null, basket };
    }
    case "openBasket":
      return state.basket.length > 0 ? { ...state, phase: "basket" } : state;
    case "openMenu":
      return { ...state, phase: "menu" };
    case "lineQuantity":
      return {
        ...state,
        basket: state.basket.map((line) =>
          line.guid === action.guid ? { ...line, quantity: Math.max(1, action.quantity) } : line,
        ),
      };
    case "removeLine":
      return { ...state, basket: state.basket.filter((line) => line.guid !== action.guid) };
    case "discount":
      return { ...state, discountCode: action.code };
    case "taxId":
      return { ...state, cpfCnpj: action.cpfCnpj };
    case "quoted":
      // A late answer for an older basket is dropped.
      return action.key === quoteKey(state)
        ? { ...state, quote: { key: action.key, result: action.result } }
        : state;
    case "reset":
      return initialJourney(action.language);
  }
}

/** Identifies what a quote was asked for: order type, lines and discount. */
export function quoteKey(state: Pick<Journey, "orderType" | "basket" | "discountCode">): string {
  return JSON.stringify([state.orderType, state.basket, state.discountCode]);
}

/** The quote's totals when they match the current basket, else null. */
export function currentQuote(state: Journey): OrderTotal | null {
  return state.quote && state.quote.key === quoteKey(state) && state.quote.result.ok
    ? state.quote.result.data
    : null;
}

const sameChoices = (a: BasketLine, b: BasketLine) =>
  a.itemId === b.itemId && JSON.stringify(a.options) === JSON.stringify(b.options);

/** Adds a line, or bumps the quantity of an identical one (F-BASKET-01 merges them). */
function addOrMerge(basket: BasketLine[], line: BasketLine): BasketLine[] {
  const twin = basket.find((existing) => sameChoices(existing, line));
  if (!twin) return [...basket, line];
  return basket.map((existing) =>
    existing === twin ? { ...existing, quantity: existing.quantity + line.quantity } : existing,
  );
}

/** Order types the restaurant offers, DINEIN first (BR-START-11). */
export function availableOrderTypes(restaurant: {
  isDineInAvailable: boolean;
  isTakeOutAvailable: boolean;
}): OrderType[] {
  return [
    ...(restaurant.isDineInAvailable ? (["DINEIN"] as const) : []),
    ...(restaurant.isTakeOutAvailable ? (["TAKE_OUT"] as const) : []),
  ];
}
