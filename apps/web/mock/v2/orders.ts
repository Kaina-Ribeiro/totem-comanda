// Baskets, coupons, placed orders and the kitchen lifecycle of the v2 mock.
// A paid basket becomes exactly one order: submitOrder is idempotent on basketId,
// whether the kiosk calls it or the simulated webhook does (payments.ts).

import { randomBytes } from "node:crypto";

import { ok, type Reply } from "../http.ts";
import { businessDate } from "../schedule.ts";
import { now } from "../state.ts";
import { isItem, key, notFound, problem, toBrl, toCents, type S } from "./http.ts";
import { checkCoupon, priceBasket } from "./pricing.ts";
import { v2, type Basket, type StoredOrder } from "./state.ts";

const basketMissing = () => problem(404, "NOT_FOUND", "Basket not found");

// ------------------------------------------------------------------ kitchen stream

type Listener = { write: (chunk: string) => unknown };
const listeners = new Set<Listener>();

export function addKitchenListenerV2(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function broadcastV2(event: string, data: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const listener of listeners) listener.write(frame);
}

export function publicOrder(order: StoredOrder): S["SubmitOrderResponse"] {
  const { deviceId: _d, businessDate: _b, couponCode: _c, ...rest } = order;
  return rest;
}

// ------------------------------------------------------------------ baskets

export function ownBasket(basketId: string | null | undefined, deviceId: string | null): Basket | null {
  const basket = basketId ? v2().baskets.get(basketId) : undefined;
  if (!basket || (deviceId !== null && basket.deviceId !== deviceId)) return null;
  return basket;
}

/** Prices the basket in pt-BR (kept for the order) and in `language` (answered). */
function price(basket: Basket, req: S["TotalsRequest"], language: S["LanguageCode"]) {
  const pt = priceBasket(req, "pt-BR", basket.couponCode, basket.id);
  if ("error" in pt) return pt;
  const answer = language === "pt-BR" ? pt : priceBasket(req, language, basket.couponCode, basket.id);
  if ("error" in answer) return answer;
  basket.request = req;
  basket.totals = pt.totals;
  return answer;
}

export function createTotals(req: S["TotalsRequest"], deviceId: string, language: S["LanguageCode"]): Reply {
  let basket: Basket;
  if (req.basketId) {
    const found = ownBasket(req.basketId, deviceId);
    if (!found) return basketMissing();
    basket = found;
  } else {
    const id = `B-${randomBytes(4).toString("hex")}`;
    basket = { id, deviceId, request: req, couponCode: null, totals: { basketId: id, subTotal: 0, tax: 0, total: 0 } };
  }
  const priced = price(basket, req, language);
  if ("error" in priced) return priced.error;
  v2().baskets.set(basket.id, basket);
  return ok(priced.totals);
}

/** Re-prices the basket as it was last sent, in pt-BR. */
export function reprice(basket: Basket) {
  return priceBasket(basket.request, "pt-BR", basket.couponCode, basket.id);
}

export function applyDiscount(req: S["DiscountRequest"], deviceId: string, language: S["LanguageCode"]): Reply {
  const basket = ownBasket(req.basketId, deviceId);
  if (!basket) return basketMissing();
  const award = req.awards?.find((a) => a.type === "CODE") ?? req.awards?.[0];
  if (!award?.id) return problem(422, "VALIDATION_FAILED", "Validation failed", "awards[0].id");
  const code = award.id.toUpperCase();
  if (basket.couponCode === code) return problem(409, "COUPON_ALREADY_APPLIED", "Coupon already applied");
  const plain = priceBasket(req, "pt-BR", null, basket.id);
  if ("error" in plain) return plain.error;
  const coupon = checkCoupon(code, toCents(plain.totals.subTotal));
  if ("error" in coupon) return coupon.error;
  const previous = basket.couponCode;
  basket.couponCode = code;
  const priced = price(basket, req, language);
  if ("error" in priced) {
    basket.couponCode = previous;
    return priced.error;
  }
  const translated = language === "en" ? coupon.rule.translations?.en?.name : undefined;
  return ok({
    awards: [
      {
        id: code,
        description: translated || coupon.rule.name,
        type: "CODE",
        source: "COMANDA",
        isExternal: false,
        discountAmount: priced.totals.discount ?? 0,
      },
    ],
  } satisfies S["DiscountResponse"]);
}

export function cancelDiscount(req: S["DiscountRequest"], deviceId: string): Reply {
  const basket = ownBasket(req.basketId, deviceId);
  if (!basket) return basketMissing();
  if (basket.couponCode && (req.codesToRemove ?? []).map((c) => c.toUpperCase()).includes(basket.couponCode)) {
    basket.couponCode = null;
    const priced = reprice(basket);
    if (!("error" in priced)) basket.totals = priced.totals;
  }
  return { status: 204 };
}

// ------------------------------------------------------------------ orders

const cutoffMinutes = () => {
  const [h, m] = v2().store.businessDayCutoff.split(":").map(Number);
  return h * 60 + m;
};

/** The business date of `at`: days start at the store's `businessDayCutoff`. */
export const businessDay = (at: Date | string) =>
  businessDate(new Date(new Date(at).getTime() - cutoffMinutes() * 60_000), v2().store.timezone);

const orderForBasket = (basketId: string) => [...v2().orders.values()].find((o) => o.basketId === basketId);
export const basketPaid = (basketId: string) =>
  !!orderForBasket(basketId) || [...v2().payments.values()].some((p) => p.basketId === basketId && p.status === "APPROVED");

function nextCheckNumber(date: string): number {
  const s = v2();
  if (s.checkNumbers.date !== date) s.checkNumbers = { date, last: s.checkNumbers.date === "" ? 41 : 0 };
  s.checkNumbers.last += 1;
  return s.checkNumbers.last;
}

/**
 * Places the paid basket (contract submitOrder). `by` is KIOSK for the kiosk's
 * call and SYSTEM for the simulated Mercado Pago webhook.
 */
export function submitOrder(
  body: S["SubmitOrderRequest"],
  deviceId: string | null,
  by: "KIOSK" | "SYSTEM",
  at: Date = now(),
): Reply {
  if (body.orderType && body.orderType !== "DINEIN") {
    return problem(422, "ORDER_TYPE_UNAVAILABLE", "Only dine-in orders", body.orderType);
  }
  const basket = ownBasket(body.basketId, deviceId);
  if (!basket) return basketMissing();
  const existing = orderForBasket(basket.id);
  if (existing) return ok(publicOrder(existing));

  const sessions = [...v2().payments.values()].filter((p) => p.basketId === basket.id);
  const payment = body.payments?.[0];
  const session = payment
    ? sessions.find((s) => s.tenderRef === payment.tenderRef && s.tenderId === payment.tenderId)
    : sessions.find((s) => s.status === "APPROVED");
  if (!session || session.status === "PENDING" || session.status === "CANCELLED") {
    return problem(409, "PAYMENT_NOT_APPROVED", "The payment is not approved");
  }
  if (session.status === "DECLINED") return problem(409, "PAYMENT_DECLINED", "The payment was declined");
  if (session.status === "EXPIRED") return problem(409, "PAYMENT_EXPIRED", "The payment expired");
  const paid = toCents(session.amount);
  if ((payment && toCents(payment.amount) !== paid) || paid !== toCents(basket.totals.total)) {
    return problem(409, "BASKET_CHANGED", "The basket changed since totals");
  }

  const date = businessDay(at);
  const seq = nextCheckNumber(date);
  const placedAt = at.toISOString();
  const order: StoredOrder = {
    ...basket.totals,
    number: `${date.replaceAll("-", "")}-${String(seq).padStart(4, "0")}`,
    customerCheckNumber: String(seq),
    displayText: `Pedido ${seq}`,
    orderType: "DINEIN",
    status: "PAID",
    version: 1,
    placedAt,
    history: [{ status: "PAID", at: placedAt, by }],
    deviceId: basket.deviceId,
    businessDate: date,
    couponCode: basket.couponCode,
  };
  v2().orders.set(order.number, order);
  if (basket.couponCode) {
    const rule = v2().discountRules.find((r) => r.code === basket.couponCode);
    if (rule) rule.usesCount = (rule.usesCount ?? 0) + 1;
  }
  broadcastV2("order.paid", publicOrder(order));
  return ok(publicOrder(order), 201);
}

// ------------------------------------------------------------------ kitchen

const OPEN = new Set<S["OrderStatus"]>(["PAID", "PREPARING", "READY"]);
const FORWARD: Record<string, S["OrderStatus"][]> = {
  PAID: ["PREPARING", "READY"],
  PREPARING: ["READY"],
  READY: ["COLLECTED"],
};
const BACK: Record<string, S["OrderStatus"]> = { READY: "PREPARING", COLLECTED: "READY" };

function change(order: StoredOrder, status: S["OrderStatus"], by: S["OrderStatusChange"]["by"], at: Date) {
  order.status = status;
  order.version += 1;
  order.history.push({ status, at: at.toISOString(), by });
  broadcastV2("order.status_changed", publicOrder(order));
}

export function openOrders(): S["SubmitOrderResponse"][] {
  return [...v2().orders.values()]
    .filter((o) => OPEN.has(o.status))
    .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt))
    .map(publicOrder);
}

export function collectedToday(at: Date = now()): S["SubmitOrderResponse"][] {
  const day = businessDay(at);
  const last = (o: StoredOrder) => Date.parse(o.history.at(-1)!.at);
  return [...v2().orders.values()]
    .filter((o) => o.status === "COLLECTED" && o.businessDate === day)
    .sort((a, b) => last(b) - last(a))
    .map(publicOrder);
}

export function moveOrder(number: string, update: Partial<S["KitchenStatusUpdate"]>, at: Date = now()): Reply {
  const order = v2().orders.get(number);
  if (!order) return notFound();
  const target = update.status;
  if (target !== "PREPARING" && target !== "READY" && target !== "COLLECTED") {
    return problem(422, "VALIDATION_FAILED", "Validation failed", "status");
  }
  if (update.expectedVersion != null && update.expectedVersion !== order.version) {
    return problem(409, "STALE_ORDER_VERSION", "The order changed on another screen");
  }
  const forward = FORWARD[order.status]?.includes(target);
  const back = BACK[order.status] === target && order.businessDate === businessDay(at);
  if (!forward && !back) return problem(409, "INVALID_STATUS_TRANSITION", "Not allowed from the current status");
  change(order, target, "KITCHEN", at);
  return ok(publicOrder(order));
}

export function cancelOrder(number: string, at: Date = now()): Reply {
  const order = v2().orders.get(number);
  if (!order) return notFound();
  if (!OPEN.has(order.status)) return problem(409, "INVALID_STATUS_TRANSITION", "Not allowed from the current status");
  change(order, "CANCELLED", "OWNER", at);
  return ok(publicOrder(order));
}

export function closeDay(at: Date = now()): number {
  const day = businessDay(at);
  let count = 0;
  for (const order of v2().orders.values()) {
    if (!OPEN.has(order.status) || order.businessDate !== day) continue;
    change(order, "NOT_COLLECTED", "KITCHEN", at);
    count += 1;
  }
  return count;
}

/** "Acabou" and the back office's on/off: sets `available` on a product, option or size. */
export function setAvailability(id: string, available: boolean): Reply {
  const entity = (["ITEM", "SIZED_ITEM", "COMBO_MEAL"] as const)
    .map((t) => v2().entities.get(key(t, id)))
    .find(isItem);
  if (!entity) return notFound();
  entity.available = available;
  return ok({
    posItems: [
      {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        price: entity.price,
        dineInPriceOverride: entity.dineInPriceOverride ?? null,
        available: entity.available,
      },
    ],
  } satisfies S["LightMenuResponse"]);
}

export function dailyReport(date: string): S["DailyReport"] {
  const orders = [...v2().orders.values()].filter((o) => o.businessDate === date);
  const sold = orders.filter((o) => o.status !== "CANCELLED");
  const revenue = sold.reduce((sum, o) => sum + toCents(o.total), 0);
  const best = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
  for (const o of sold) {
    for (const line of o.orderItems ?? []) {
      const row = best.get(line.id) ?? { id: line.id, name: line.name ?? line.id, quantity: 0, revenue: 0 };
      row.quantity += line.quantity;
      row.revenue += toCents(line.total);
      best.set(line.id, row);
    }
  }
  return {
    date,
    ordersCount: sold.length,
    revenue: toBrl(revenue),
    averageTicket: sold.length ? toBrl(Math.floor(revenue / sold.length + 0.5)) : 0,
    discountTotal: toBrl(sold.reduce((sum, o) => sum + toCents(o.discount), 0)),
    cancelledCount: orders.length - sold.length,
    notCollectedCount: orders.filter((o) => o.status === "NOT_COLLECTED").length,
    bestSellers: [...best.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map((r) => ({ ...r, revenue: toBrl(r.revenue) })),
  };
}
