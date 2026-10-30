// Orders and simulated payments (OP-PAY-01..03). Writes are idempotent per
// Idempotency-Key, like the Go API.

import { randomBytes } from "node:crypto";

import {
  authDevice,
  idempotent,
  notFound,
  ok,
  problem,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
import { priceBasket } from "./kiosk-menu.ts";
import { journeyMenuId, pricingProblem, today } from "./routes-kiosk.ts";
import { now, state } from "./state.ts";

const id = (prefix: string) => `${prefix}-${randomBytes(3).toString("hex")}`;

/** Orders and payments are visible to the device that created them. */
function ownOrder(req: Request, orderId: string) {
  const { device, error } = authDevice(req);
  if (error) return { error };
  const order = state.orders.get(orderId);
  if (!order || order.deviceId !== device.id) return { error: notFound() };
  return { order, device };
}

function ownPayment(req: Request, paymentId: string) {
  const payment = state.payments.get(paymentId);
  if (!payment) {
    const { error } = authDevice(req);
    return { error: error ?? notFound() };
  }
  const { error } = ownOrder(req, payment.orderId);
  return error ? { error } : { payment };
}

export const publicOrder = (order: Schemas["Order"] & { deviceId: string; menuId: string }) => {
  const { deviceId: _d, menuId: _m, ...rest } = order;
  return rest;
};

/**
 * Next order number of the business day (FR-1010): resets each day. The
 * mock's first day starts at 42, the prototype's number.
 */
function nextCheckNumber(): string {
  const date = today();
  if (state.checkNumbers.date !== date) {
    state.checkNumbers = { date, last: state.checkNumbers.date === "" ? 41 : 0 };
  }
  state.checkNumbers.last += 1;
  return String(state.checkNumbers.last);
}

/**
 * Minutes until ready. OPEN QUESTION 2 (docs/data-model-and-api.md): how the
 * Go API computes waitTime. The mock guesses 5 min plus 2 per open order.
 */
function waitTimeGuess(): number {
  const open = [...state.orders.values()].filter(
    (o) => o.status === "PAID" || o.status === "PREPARING",
  );
  return 5 + 2 * open.length;
}

export const orderRoutes: Route[] = [
  [
    "POST",
    /^\/v1\/orders$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      return idempotent(req, `order:${device.id}`, () => {
        const body = req.body as Schemas["CreateOrderRequest"];
        if (!body?.orderItems?.length)
          return problem(422, "VALIDATION_FAILED", "Validation failed", "orderItems");
        const menuId = journeyMenuId(device.id);
        try {
          const { lines, total } = priceBasket(
            { ...body, menuId },
            state.catalogue,
            state.restaurant,
            {
              today: today(),
              at: now(),
              language: body.language,
            },
          );
          const order = {
            id: id("ord"),
            orderNonce: body.orderNonce,
            orderType: body.orderType,
            status: "AWAITING_PAYMENT" as const,
            posCheckNumber: null,
            businessDate: today(),
            language: body.language,
            orderItems: lines,
            orderTotal: total,
            cpfCnpj: body.cpfCnpj ?? null,
            journeyStartedTimestamp: body.journeyStartedTimestamp ?? null,
            createdAt: now().toISOString(),
            placedAt: null,
            readyAt: null,
            deviceId: device.id,
            menuId: menuId!,
          };
          state.orders.set(order.id, order);
          console.log(
            `[mock] order ${order.id}: ${total.total} (cpf ${order.cpfCnpj ? "yes" : "no"})`,
          );
          return ok(publicOrder(order), 201);
        } catch (e) {
          return pricingProblem(e);
        }
      });
    },
  ],
  [
    "GET",
    /^\/v1\/orders\/([^/]+)$/,
    (req, [orderId]) => {
      const { order, error } = ownOrder(req, orderId);
      return error ?? ok(publicOrder(order));
    },
  ],
  [
    "POST",
    /^\/v1\/orders\/([^/]+)\/payments$/,
    (req, [orderId]) => {
      const { order, error } = ownOrder(req, orderId);
      if (error) return error;
      return idempotent(req, `payment:${orderId}`, () => {
        const method = (req.body as Partial<Schemas["StartPaymentRequest"]> | null)?.method;
        if (method !== "PIX" && method !== "CREDIT" && method !== "DEBIT") {
          return problem(422, "VALIDATION_FAILED", "Validation failed", "method");
        }
        if (order.status !== "AWAITING_PAYMENT") {
          return problem(409, "ORDER_NOT_AWAITING_PAYMENT", "Order is not awaiting payment");
        }
        const running = [...state.payments.values()].some(
          (p) => p.orderId === orderId && p.paymentStatus === "AUTHORISING",
        );
        if (running) return problem(409, "PAYMENT_IN_PROGRESS", "Another payment is in progress");
        const at = now().toISOString();
        const payment: Schemas["Payment"] = {
          id: id("pay"),
          orderId,
          method,
          amount: order.orderTotal.total,
          paymentStatus: "AUTHORISING",
          gatewayType: "SIMULATED",
          providerRef: null,
          failureReason: null,
          pix: null,
          createdAt: at,
          updatedAt: at,
        };
        state.payments.set(payment.id, payment);
        return ok(payment, 201);
      });
    },
  ],
  [
    "GET",
    /^\/v1\/payments\/([^/]+)$/,
    (req, [paymentId]) => {
      const { payment, error } = ownPayment(req, paymentId);
      return error ?? ok(payment);
    },
  ],
  [
    "POST",
    /^\/v1\/payments\/([^/]+)\/cancel$/,
    (req, [paymentId]) => {
      const { payment, error } = ownPayment(req, paymentId);
      if (error) return error;
      if (payment.paymentStatus !== "AUTHORISING") {
        return problem(409, "PAYMENT_NOT_CANCELLABLE", "Payment is already final");
      }
      Object.assign(payment, { paymentStatus: "CANCELLED", updatedAt: now().toISOString() });
      return ok(payment);
    },
  ],
  [
    "POST",
    /^\/v1\/payments\/([^/]+)\/simulate$/,
    (req, [paymentId]) => {
      const { payment, error } = ownPayment(req, paymentId);
      if (error) return error;
      const outcome = (req.body as Partial<Schemas["SimulatePaymentRequest"]> | null)?.outcome;
      if (outcome !== "AUTHORISED" && outcome !== "FAILED") {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "outcome");
      }
      // A final payment keeps its outcome; simulating it again changes nothing.
      if (payment.paymentStatus === "AUTHORISING") {
        Object.assign(payment, {
          paymentStatus: outcome,
          providerRef: outcome === "AUTHORISED" ? id("sim") : null,
          failureReason: outcome === "FAILED" ? "Recusado pela operadora (simulado)" : null,
          updatedAt: now().toISOString(),
        });
      }
      return ok(payment);
    },
  ],
  [
    "POST",
    /^\/v1\/orders\/([^/]+)\/place$/,
    (req, [orderId]) => {
      const { order, error } = ownOrder(req, orderId);
      if (error) return error;
      return idempotent(req, `place:${orderId}`, () => {
        const authorised = [...state.payments.values()].some(
          (p) => p.orderId === orderId && p.paymentStatus === "AUTHORISED",
        );
        if (!authorised) return problem(409, "PAYMENT_NOT_AUTHORISED", "No authorised payment");
        if (order.status === "AWAITING_PAYMENT") {
          Object.assign(order, {
            status: "PAID",
            posCheckNumber: nextCheckNumber(),
            placedAt: now().toISOString(),
          });
          console.log(`[mock] order ${order.id} placed: #${order.posCheckNumber}`);
        }
        return ok({
          orderId,
          posCheckNumber: order.posCheckNumber!,
          waitTime: waitTimeGuess(),
          status: order.status,
        } satisfies Schemas["PlacedOrder"]);
      });
    },
  ],
];
