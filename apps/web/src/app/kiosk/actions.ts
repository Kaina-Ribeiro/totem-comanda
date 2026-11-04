"use server";

import { after } from "next/server";

import { coreApi } from "@/lib/core/client";
import { retryUnknown } from "@/lib/core/retry";
import type { components } from "@/lib/core-api";
import {
  deviceCall,
  deviceCallAs,
  loadActiveMenu,
  loadLanguagePack,
  type Menu,
  reportKeyAction,
  type Result,
  success,
} from "@/lib/kiosk/core";
import { simulatedOutcome, terminalAnswered } from "@/lib/kiosk/simulated-payment";
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
    deviceCallAs("KIOSK", (headers) =>
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

type Schemas = components["schemas"];
export type Order = Schemas["Order"];
export type Payment = Schemas["Payment"];
export type PaymentMethod = Schemas["PaymentMethod"];
export type PlacedOrder = Schemas["PlacedOrder"];

/**
 * Stores the order as AWAITING_PAYMENT (first half of OP-PAY-01). The Core
 * API reprices every line; `idempotencyKey` makes a retry return the same order,
 * so an unknown answer is retried with it for up to 15 s.
 */
export async function createOrder(
  idempotencyKey: string,
  order: Schemas["CreateOrderRequest"],
): Promise<Result<Order>> {
  return retryUnknown((signal) => postOrder(idempotencyKey, order, signal));
}

function postOrder(
  idempotencyKey: string,
  order: Schemas["CreateOrderRequest"],
  signal: AbortSignal,
): Promise<Result<Order>> {
  return deviceCallAs("KIOSK", (headers) =>
    coreApi().POST("/v1/orders", {
      headers,
      signal,
      params: { header: { "Idempotency-Key": idempotencyKey } },
      body: {
        orderNonce: order.orderNonce,
        orderType: order.orderType,
        language: order.language,
        orderItems: order.orderItems,
        discountCode: order.discountCode ?? null,
        cpfCnpj: order.cpfCnpj ?? null,
        journeyStartedTimestamp: order.journeyStartedTimestamp ?? null,
      },
    }),
  );
}

/** Starts a payment for the order total; one key per attempt (second half of OP-PAY-01). */
export async function startPayment(
  orderId: string,
  method: PaymentMethod,
  idempotencyKey: string,
): Promise<Result<Payment>> {
  return deviceCall((headers) =>
    coreApi().POST("/v1/orders/{orderId}/payments", {
      headers,
      params: { path: { orderId }, header: { "Idempotency-Key": idempotencyKey } },
      body: { method },
    }),
  );
}

/**
 * Polls a payment (OP-PAY-02), at most once a second. While the gateway is
 * SIMULATED, the BFF answers for the terminal once it has "waited" long enough.
 */
export async function pollPayment(paymentId: string): Promise<Result<Payment>> {
  const result = await deviceCall((headers) =>
    coreApi().GET("/v1/payments/{paymentId}", { headers, params: { path: { paymentId } } }),
  );
  if (!result.ok) return result;
  const payment = result.data;
  if (payment.gatewayType !== "SIMULATED") return result;
  if (!terminalAnswered(payment.id, payment.paymentStatus !== "AUTHORISING")) return result;

  const outcome = await simulatedOutcome();
  if (outcome === "MANUAL") return result;
  const simulated = await deviceCall((headers) =>
    coreApi().POST("/v1/payments/{paymentId}/simulate", {
      headers,
      params: { path: { paymentId } },
      body: { outcome },
    }),
  );
  return simulated.ok ? simulated : result;
}

/** Cancels a payment still AUTHORISING; `PAYMENT_NOT_CANCELLABLE` once it is final. */
export async function cancelPayment(paymentId: string): Promise<Result<Payment>> {
  return deviceCall((headers) =>
    coreApi().POST("/v1/payments/{paymentId}/cancel", { headers, params: { path: { paymentId } } }),
  );
}

/**
 * Places a paid order (OP-PAY-03): the Core API assigns the order number. An
 * unknown answer is retried with the same key for up to 15 s; after that it is
 * still CORE_UNAVAILABLE, which the kiosk shows as "verificando", never "falhou".
 */
export async function placeOrder(
  orderId: string,
  idempotencyKey: string,
): Promise<Result<PlacedOrder>> {
  return retryUnknown((signal) =>
    deviceCall((headers) =>
      coreApi().POST("/v1/orders/{orderId}/place", {
        headers,
        signal,
        params: { path: { orderId }, header: { "Idempotency-Key": idempotencyKey } },
      }),
    ),
  );
}
