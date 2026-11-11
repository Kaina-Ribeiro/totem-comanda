"use server";

import { after } from "next/server";

import { coreApi } from "@/lib/core/client";
import { retryUnknown } from "@/lib/core/retry";
import type { components } from "@/lib/core-api";
import {
  deviceCall,
  kioskCall,
  loadActiveMenu,
  loadLanguagePack,
  type MenuResponse,
  notKiosk,
  reportKeyAction,
  type Result,
  success,
} from "@/lib/kiosk/core";
import { kitchenNames } from "@/lib/kiosk/menu-graph";
import { type Language, mergeStrings, type Strings } from "@/lib/kiosk/strings";

// Server Actions of the kiosk journey on Core v2 (pilot, SPEC 4.6 and 5). The
// browser holds the journey; these are its only way to Core, and they hold the
// device token. Every one runs for a KIOSK device only (COM-109). The kiosk
// sends ids and quantities; every amount it shows comes back from Go.

type Schemas = components["schemas"];
export type { MenuResponse };
export type OrderItem = Schemas["OrderItem"];
export type TotalsResponse = Schemas["TotalsResponse"];
export type DiscountResponse = Schemas["DiscountResponse"];
export type PaymentMethod = Schemas["PaymentMethod"];
export type PaymentSession = Schemas["PaymentSession"];
export type SubmitOrderResponse = Schemas["SubmitOrderResponse"];
export type JourneyEventType = Schemas["JourneyEvent"]["type"];

const isLanguage = (value: unknown): value is Language => value === "pt-BR" || value === "en";

export type JourneyStart = {
  orderNonce: string;
  journeyStartedTimestamp: string | null;
  menu: MenuResponse;
  /** Ingredient names in the kitchen's language; empty when `menu` already is in it. */
  kitchenNames: Record<string, string>;
  strings: Strings;
};

/**
 * The names the kitchen reads, for a guest in another language. Never blocks
 * the guest: if they cannot load, the kitchen note uses the guest's names.
 */
async function loadKitchenNames(language: Language): Promise<Record<string, string>> {
  if (language === "pt-BR") return {};
  const menu = await loadActiveMenu("pt-BR");
  if (menu.ok) return kitchenNames(menu.data);
  console.warn(`Kitchen names not loaded: ${menu.code}`);
  return {};
}

/**
 * Starts a guest journey: records it, and loads the active menu and language
 * pack once. Recording never blocks the guest; a menu that cannot load does.
 */
export async function beginJourney(language: Language): Promise<Result<JourneyStart>> {
  if (!isLanguage(language)) return { ok: false, code: "VALIDATION_FAILED" };
  const refused = await notKiosk();
  if (refused) return refused;
  const orderNonce = crypto.randomUUID();

  const [journey, menu, pack, names] = await Promise.all([
    deviceCall((headers) => coreApi().POST("/v2/journeys", { headers, body: { orderNonce, language } })),
    loadActiveMenu(language),
    loadLanguagePack(language),
    loadKitchenNames(language),
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
  reportKeyAction({ kind: "KEY_ACTION", type: "START_JOURNEY_SUCCESS", kioskStatusType: "TRADING" });
  return success({
    orderNonce,
    journeyStartedTimestamp: journey.ok ? journey.data.journeyStartedTimestamp : null,
    menu: menu.data,
    kitchenNames: names,
    strings: mergeStrings(language, pack),
  });
}

/** Reloads menu and strings in another language mid-journey. */
export async function switchLanguage(
  language: Language,
): Promise<Result<{ menu: MenuResponse; kitchenNames: Record<string, string>; strings: Strings }>> {
  if (!isLanguage(language)) return { ok: false, code: "VALIDATION_FAILED" };
  const refused = await notKiosk();
  if (refused) return refused;
  const [menu, pack, names] = await Promise.all([
    loadActiveMenu(language),
    loadLanguagePack(language),
    loadKitchenNames(language),
  ]);
  if (!menu.ok) return menu;
  return success({ menu: menu.data, kitchenNames: names, strings: mergeStrings(language, pack) });
}

/**
 * Prices the basket (`POST /v2/totals`). Go keeps it under `basketId`, which the
 * kiosk sends back so the coupon and the payment stay on the same basket.
 */
export async function priceBasket(input: {
  basketId: string | null;
  items: OrderItem[];
  language: Language;
}): Promise<Result<TotalsResponse>> {
  if (!isLanguage(input.language)) return { ok: false, code: "VALIDATION_FAILED" };
  return kioskCall((headers) =>
    coreApi().POST("/v2/totals", {
      headers,
      params: { query: { language: input.language } },
      body: { basketId: input.basketId, orderType: "DINEIN", items: input.items },
    }),
  );
}

/** Applies a coupon to the basket: one `Award` of type CODE (one coupon per order). */
export async function applyCoupon(input: {
  basketId: string;
  items: OrderItem[];
  code: string;
  language: Language;
}): Promise<Result<DiscountResponse>> {
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, code: "DISCOUNT_INVALID" };
  if (!isLanguage(input.language)) return { ok: false, code: "VALIDATION_FAILED" };
  return kioskCall((headers) =>
    coreApi().POST("/v2/discounts/apply", {
      headers,
      params: { query: { language: input.language } },
      body: {
        basketId: input.basketId,
        orderType: "DINEIN",
        items: input.items,
        awards: [{ id: code, type: "CODE" }],
      },
    }),
  );
}

/** Takes the coupon off the basket. */
export async function removeCoupon(input: {
  basketId: string;
  items: OrderItem[];
  code: string;
}): Promise<Result<unknown>> {
  return kioskCall((headers) =>
    coreApi().POST("/v2/discounts/cancel", {
      headers,
      body: { basketId: input.basketId, orderType: "DINEIN", items: input.items, codesToRemove: [input.code] },
    }),
  );
}

/**
 * Records how a journey ended without an order: RESET, IDLE_TIMEOUT or
 * CANCELLED_BY_GUEST, with the last total Go priced. Fire-and-forget.
 */
export async function recordJourneyEvent(
  orderNonce: string,
  type: JourneyEventType,
  orderTotal: number | null,
): Promise<void> {
  after(async () => {
    const result = await kioskCall((headers) =>
      coreApi().POST("/v2/journeys/{orderNonce}/events", {
        headers,
        params: { path: { orderNonce } },
        body: orderTotal === null ? { type } : { type, orderTotal },
      }),
    );
    if (!result.ok) console.warn(`Journey event ${type} not recorded: ${result.code}`);
  });
}

/**
 * Starts a Mercado Pago Pix or Point payment for the basket's current total.
 * One `idempotencyKey` per attempt. `BASKET_CHANGED` means the total moved: the
 * kiosk re-prices and asks the guest again, never charging the old amount.
 */
export async function startPayment(
  input: { basketId: string; method: PaymentMethod; amount: number },
  idempotencyKey: string,
): Promise<Result<PaymentSession>> {
  if (input.method !== "PIX" && input.method !== "CARD") return { ok: false, code: "VALIDATION_FAILED" };
  return kioskCall((headers) =>
    coreApi().POST("/v2/payments", {
      headers,
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: { basketId: input.basketId, method: input.method, amount: input.amount },
    }),
  );
}

/** Polls a payment session; the kiosk calls it at most once a second while PENDING. */
export async function pollPayment(paymentId: string): Promise<Result<PaymentSession>> {
  return kioskCall((headers) => coreApi().GET("/v2/payments/{paymentId}", { headers, params: { path: { paymentId } } }));
}

/** Cancels a session still PENDING; `PAYMENT_NOT_CANCELLABLE` once it is final. */
export async function cancelPayment(paymentId: string): Promise<Result<PaymentSession>> {
  return kioskCall((headers) =>
    coreApi().POST("/v2/payments/{paymentId}/cancel", { headers, params: { path: { paymentId } } }),
  );
}

/** The `Payment` Go checks against its own session (SPEC 4.6): copied, never made up. */
function paymentOf(session: PaymentSession): Schemas["Payment"] {
  return {
    tenderId: session.tenderId,
    tenderRef: session.tenderRef,
    amount: session.amount,
    ...(session.cardScheme ? { cardScheme: session.cardScheme } : {}),
    ...(session.cardLast4Digits ? { cardLast4Digits: session.cardLast4Digits } : {}),
    ...(session.authCode ? { authCode: session.authCode } : {}),
  };
}

/**
 * Places the paid basket (`POST /v2/orders`). Idempotent on `basketId` and on
 * `idempotencyKey`, which the kiosk keeps for the basket: an unknown answer is
 * retried with it for up to 15 s, and after that it is still CORE_UNAVAILABLE,
 * which the kiosk shows as "verificando", never "falhou" (Review Focus 1).
 * `payment` is null only when Go said the basket is already paid and the kiosk
 * never saw the approved session; Go then finds the session itself.
 */
export async function submitOrder(
  input: { basketId: string; items: OrderItem[]; payment: PaymentSession | null },
  idempotencyKey: string,
): Promise<Result<SubmitOrderResponse>> {
  const refused = await notKiosk();
  if (refused) return refused;
  const payments = input.payment?.status === "APPROVED" ? [paymentOf(input.payment)] : [];
  return retryUnknown((signal) =>
    deviceCall((headers) =>
      coreApi().POST("/v2/orders", {
        headers,
        signal,
        params: { header: { "Idempotency-Key": idempotencyKey } },
        body: { basketId: input.basketId, orderType: "DINEIN", items: input.items, payments },
      }),
    ),
  );
}
