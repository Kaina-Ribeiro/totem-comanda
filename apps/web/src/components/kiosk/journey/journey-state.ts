import type { components } from "@/lib/core-api";
import type { BasketLine } from "@/lib/kiosk/menu-view";
import type { Language, Strings } from "@/lib/kiosk/strings";

type Schemas = components["schemas"];
export type Menu = Schemas["Menu"];
export type OrderType = Schemas["OrderType"];

/** One journey on the kiosk, held in the browser from tap to reset. */
export type Journey = {
  phase: "attract" | "starting" | "startFailed" | "orderType" | "menu";
  language: Language;
  orderNonce: string | null;
  journeyStartedTimestamp: string | null;
  /** The menu loaded at journey start (OP-START-04), in `language`. */
  menu: Menu | null;
  strings: Strings | null;
  orderType: OrderType | null;
  /** What the kiosk sends: item and option ids with quantities, never prices. */
  basket: BasketLine[];
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
      return { ...state, basket: [...state.basket, action.line] };
    case "reset":
      return initialJourney(action.language);
  }
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
