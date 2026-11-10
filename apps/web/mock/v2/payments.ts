// Mercado Pago, simulated (contract createPayment, getPayment, cancelPayment,
// simulatePayment). Outcomes are lazy: `sweep(at)` moves sessions on from the
// clock, so tests are deterministic; the server also sweeps every second.
//
//   MOCK_PAYMENT_OUTCOME   APPROVED (default) | DECLINED | EXPIRED | NONE (wait for /__mock)
//   MOCK_PAYMENT_DELAY_MS  when the outcome lands after the session starts (default 3000)
//   MOCK_WEBHOOK_PLACE_MS  after approval, the "webhook" places the order if the kiosk
//                          has not (default 30000)

import { randomBytes } from "node:crypto";

import { ok, type Reply } from "../http.ts";
import { now } from "../state.ts";
import { notFound, problem, toBrl, toCents, type S } from "./http.ts";
import { basketPaid, ownBasket, reprice, submitOrder } from "./orders.ts";
import { paymentTerminalId, v2, type Session } from "./state.ts";

const PIX_MINUTES = 5;
// A 1×1 PNG: enough for the kiosk to show "a QR code".
const QR_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const env = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && process.env[name] !== "" && process.env[name] !== undefined ? n : fallback;
};
const outcomeSetting = () => (process.env.MOCK_PAYMENT_OUTCOME ?? "APPROVED").toUpperCase();

export function publicSession(s: Session): S["PaymentSession"] {
  const { deviceId: _d, outcomeAt: _o, approvedAt: _a, ...rest } = s;
  return rest;
}

export function createPayment(body: Partial<S["CreatePaymentRequest"]> | null, deviceId: string, at: Date = now()): Reply {
  const method = body?.method;
  if ((method !== "PIX" && method !== "CARD") || typeof body?.amount !== "number" || !body.basketId) {
    return problem(422, "VALIDATION_FAILED", "Validation failed", "basketId, method and amount are required");
  }
  const basket = ownBasket(body.basketId, deviceId);
  if (!basket) return problem(404, "NOT_FOUND", "Basket not found");
  if (basketPaid(basket.id)) return problem(409, "BASKET_ALREADY_PAID", "This basket is already paid");

  // Price or availability changed since totals: never charge the old total.
  const fresh = reprice(basket);
  if ("error" in fresh || toCents(fresh.totals.total) !== toCents(basket.totals.total)) {
    if (!("error" in fresh)) basket.totals = fresh.totals;
    return problem(409, "BASKET_CHANGED", "The basket changed since totals");
  }
  if (toCents(body.amount) !== toCents(basket.totals.total)) {
    return problem(409, "BASKET_CHANGED", "The amount is not the basket total");
  }
  const terminalId = method === "CARD" ? paymentTerminalId(deviceId) : null;
  if (method === "CARD" && !terminalId) {
    return problem(409, "PAYMENT_TERMINAL_UNAVAILABLE", "No card terminal next to this kiosk");
  }

  const s = v2();
  for (const other of s.payments.values()) {
    if (other.basketId === basket.id && other.status === "PENDING") other.status = "CANCELLED";
  }
  const id = `pay-${randomBytes(4).toString("hex")}`;
  const session: Session = {
    id,
    basketId: basket.id,
    method,
    amount: toBrl(toCents(body.amount)),
    status: "PENDING",
    tenderId: method === "PIX" ? "MP_PIX" : "MP_POINT",
    tenderRef: String(1_300_000_000 + Math.floor(Math.random() * 99_999_999)),
    qrCode: method === "PIX" ? QR_PNG : null,
    copyPaste:
      method === "PIX"
        ? `00020126580014br.gov.bcb.pix0136mock-${id}5204000053039865406${body.amount.toFixed(2)}5802BR6304MOCK`
        : null,
    expiresAt: method === "PIX" ? new Date(at.getTime() + PIX_MINUTES * 60_000).toISOString() : null,
    terminalId,
    createdAt: at.toISOString(),
    cardScheme: null,
    cardLast4Digits: null,
    authCode: null,
    deviceId,
    outcomeAt: at.getTime() + env("MOCK_PAYMENT_DELAY_MS", 3000),
    approvedAt: null,
  };
  s.payments.set(id, session);
  return ok(publicSession(session), 201);
}

function approve(session: Session, at: Date) {
  session.status = "APPROVED";
  session.approvedAt = at.getTime();
  if (session.method === "CARD") {
    session.cardScheme = "VISA";
    session.cardLast4Digits = "4242";
    session.authCode = randomBytes(3).toString("hex").toUpperCase();
  }
}

/**
 * Forces an outcome (mock control and simulatePayment). Approving a session
 * that already expired or was replaced means the guest paid late: the payment
 * is listed for refund and refused (PAYMENT_EXPIRED / INVALID_STATUS_TRANSITION).
 */
export function forceOutcome(session: Session, outcome: unknown, at: Date = now()): Reply {
  if (outcome !== "APPROVED" && outcome !== "DECLINED" && outcome !== "EXPIRED") {
    return problem(422, "VALIDATION_FAILED", "Validation failed", "outcome");
  }
  sweep(at);
  if (session.status !== "PENDING") {
    if (outcome === "APPROVED" && (session.status === "EXPIRED" || session.status === "CANCELLED")) {
      v2().refunds.push({
        paymentId: session.id,
        basketId: session.basketId,
        amount: session.amount,
        at: at.toISOString(),
        reason: session.status === "EXPIRED" ? "APPROVED_AFTER_EXPIRY" : "SECOND_PAYMENT",
      });
      if (session.status === "EXPIRED") return problem(409, "PAYMENT_EXPIRED", "The payment expired; refund needed");
    }
    return problem(409, "INVALID_STATUS_TRANSITION", `The payment is already ${session.status}`);
  }
  if (outcome === "APPROVED") approve(session, at);
  else session.status = outcome;
  return ok(publicSession(session));
}

/** Moves sessions on from the clock: expiry, automatic outcome, webhook placement. */
export function sweep(at: Date = now()): void {
  const t = at.getTime();
  const setting = outcomeSetting();
  const webhookMs = env("MOCK_WEBHOOK_PLACE_MS", 30_000);
  for (const session of v2().payments.values()) {
    if (session.status === "PENDING") {
      if (session.expiresAt && t >= Date.parse(session.expiresAt)) session.status = "EXPIRED";
      else if (setting !== "NONE" && t >= session.outcomeAt) {
        if (setting === "APPROVED") approve(session, at);
        else if (setting === "DECLINED" || setting === "EXPIRED") session.status = setting;
      }
    }
    if (session.status === "APPROVED" && session.approvedAt !== null && t >= session.approvedAt + webhookMs) {
      const basket = v2().baskets.get(session.basketId);
      if (basket && ![...v2().orders.values()].some((o) => o.basketId === basket.id)) {
        submitOrder({ basketId: basket.id, orderType: "DINEIN", items: basket.request.items }, null, "SYSTEM", at);
      }
    }
  }
}

export function ownSession(paymentId: string, deviceId: string): Session | null {
  const session = v2().payments.get(paymentId);
  return session && session.deviceId === deviceId ? session : null;
}

export function getPayment(paymentId: string, deviceId: string): Reply {
  sweep();
  const session = ownSession(paymentId, deviceId);
  return session ? ok(publicSession(session)) : notFound();
}

export function cancelPayment(paymentId: string, deviceId: string): Reply {
  sweep();
  const session = ownSession(paymentId, deviceId);
  if (!session) return notFound();
  if (session.status !== "PENDING") return problem(409, "PAYMENT_NOT_CANCELLABLE", "The payment is already final");
  session.status = "CANCELLED";
  return ok(publicSession(session));
}
