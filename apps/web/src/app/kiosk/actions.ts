"use server";

import { after } from "next/server";

import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";
import {
  deviceCall,
  loadActiveMenu,
  loadLanguagePack,
  type Menu,
  reportKeyAction,
  type Result,
  success,
} from "@/lib/kiosk/core";
import { type Language, mergeStrings, type Strings } from "@/lib/kiosk/strings";

// Server Actions of the kiosk journey. The browser holds the journey state;
// these are its only way to the Core API, and they hold the device token.

const isLanguage = (value: unknown): value is Language => value === "pt-BR" || value === "en";

export type JourneyStart = {
  orderNonce: string;
  journeyStartedTimestamp: string | null;
  menu: Menu;
  strings: Strings;
};

/**
 * Starts a guest journey (OP-START-01, OP-START-04): records it, and loads
 * the active menu and language pack once. Recording the journey never blocks
 * the guest; a menu that cannot load does.
 */
export async function beginJourney(language: Language): Promise<Result<JourneyStart>> {
  if (!isLanguage(language)) return { ok: false, code: "VALIDATION_FAILED" };
  const orderNonce = crypto.randomUUID();

  const [journey, menu, pack] = await Promise.all([
    deviceCall((headers) =>
      coreApi().POST("/v1/journeys", { headers, body: { orderNonce, language } }),
    ),
    loadActiveMenu(language),
    loadLanguagePack(language),
  ]);

  if (!journey.ok) console.warn(`Journey start not recorded: ${journey.code}`);
  if (!menu.ok) {
    reportKeyAction({
      kind: "KEY_ACTION",
      type: "START_JOURNEY_FAILED",
      kioskStatusType: "TRADING",
      reason: "FAILED_LOAD_MENU",
      message: menu.code,
    });
    return menu;
  }
  reportKeyAction({
    kind: "KEY_ACTION",
    type: "START_JOURNEY_SUCCESS",
    kioskStatusType: "TRADING",
  });
  return success({
    orderNonce,
    journeyStartedTimestamp: journey.ok ? journey.data.journeyStartedTimestamp : null,
    menu: menu.data,
    strings: mergeStrings(language, pack),
  });
}

/** Reloads menu and strings in another language mid-journey (F-START-03). */
export async function switchLanguage(
  language: Language,
): Promise<Result<{ menu: Menu; strings: Strings }>> {
  if (!isLanguage(language)) return { ok: false, code: "VALIDATION_FAILED" };
  const [menu, pack] = await Promise.all([loadActiveMenu(language), loadLanguagePack(language)]);
  if (!menu.ok) return menu;
  return success({ menu: menu.data, strings: mergeStrings(language, pack) });
}

export type OrderTotal = components["schemas"]["OrderTotal"];
export type QuoteInput = components["schemas"]["QuoteRequest"];

/** Totals for the basket (OP-BASKET-01). Called after every basket or discount change. */
export async function quoteBasket(input: QuoteInput): Promise<Result<OrderTotal>> {
  return deviceCall((headers) =>
    coreApi().POST("/v1/quotes", {
      headers,
      body: {
        orderType: input.orderType,
        orderItems: input.orderItems,
        discountCode: input.discountCode ?? null,
      },
    }),
  );
}

/**
 * Records how a journey ended without an order (OP-KIOSK-01/02): RESET,
 * IDLE_TIMEOUT or CANCELLED_BY_GUEST. Fire-and-forget: the kiosk never waits.
 */
export async function recordJourneyEvent(
  orderNonce: string,
  type: components["schemas"]["JourneyEvent"]["type"],
  orderTotal: number,
): Promise<void> {
  after(async () => {
    const result = await deviceCall((headers) =>
      coreApi().POST("/v1/journeys/{orderNonce}/events", {
        headers,
        params: { path: { orderNonce } },
        body: { type, orderTotal },
      }),
    );
    if (!result.ok) console.warn(`Journey event ${type} not recorded: ${result.code}`);
  });
}

export type DiscountItem = components["schemas"]["DiscountItem"];

/**
 * Checks a coupon or restaurant discount code against this basket (OP-DISC-01).
 * One discount per order: when replacing, `currentDiscountCode` is the one on it.
 */
export async function validateCoupon(input: {
  code: string;
  orderType: components["schemas"]["OrderType"];
  orderItems: components["schemas"]["OrderLineInput"][];
  currentDiscountCode: string | null;
}): Promise<Result<DiscountItem>> {
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, code: "INVALID_COUPON" };
  return deviceCall((headers) =>
    coreApi().POST("/v1/discounts/validate", {
      headers,
      body: {
        code,
        entryMethod: "MANUAL",
        orderType: input.orderType,
        orderItems: input.orderItems,
        currentDiscountCode: input.currentDiscountCode,
      },
    }),
  );
}
