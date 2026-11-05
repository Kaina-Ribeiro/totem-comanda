// Kitchen screen: open orders, status changes and the Server-Sent Events
// stream (one event per change, a ping comment every 15 s).

import type { ServerResponse } from "node:http";

import {
  authDevice,
  authOwner,
  notFound,
  ok,
  problem,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
import { soldOutOptions } from "./kiosk-menu.ts";
import { today } from "./routes-kiosk.ts";
import { now, state } from "./state.ts";

type StoredOrder = Schemas["Order"] & { deviceId: string; menuId: string };

const OPEN = new Set<Schemas["OrderStatus"]>(["PAID", "PREPARING", "READY"]);
const NEXT: Partial<Record<Schemas["OrderStatus"], Schemas["OrderStatus"][]>> = {
  PAID: ["PREPARING", "READY"],
  PREPARING: ["READY"],
  READY: ["COLLECTED"],
};
// One step back, the same business day only (contract 0.2.0, plan decision 2).
const BACK: Partial<Record<Schemas["OrderStatus"], Schemas["OrderStatus"]>> = {
  READY: "PREPARING",
  COLLECTED: "READY",
};
const businessDay = (at: Date | string) =>
  new Date(at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const PING_MS = 15_000;

/** Option names of a line, flattened, in pt-BR (KitchenOrder.lines[].options). */
function optionNames(options: Schemas["OrderLineOption"][]): string[] {
  return options.flatMap((o) => [
    o.quantity > 1 ? `${o.quantity}× ${o.name}` : o.name,
    ...optionNames(o.options),
  ]);
}

/** The chosen options with their ids, flattened (KitchenOrder.lines[].choices). */
function optionChoices(options: Schemas["OrderLineOption"][]): Schemas["KitchenOrder"]["lines"][number]["choices"] {
  return options.flatMap((o) => [
    { optionId: o.optionId, name: o.name, quantity: o.quantity },
    ...optionChoices(o.options),
  ]);
}

// Status history per order (contract 0.2.0); `version` is its length.
const histories = new Map<string, Schemas["KitchenStatusChange"][]>();

export function historyOf(order: StoredOrder): Schemas["KitchenStatusChange"][] {
  let history = histories.get(order.id);
  if (!history) {
    history = [{ status: "PAID", at: order.placedAt ?? order.createdAt, by: "KIOSK" }];
    histories.set(order.id, history);
  }
  return history;
}

export function kitchenOrder(order: StoredOrder): Schemas["KitchenOrder"] {
  const history = historyOf(order);
  return {
    id: order.id,
    posCheckNumber: order.posCheckNumber ?? "",
    orderType: order.orderType,
    status: order.status,
    placedAt: order.placedAt ?? order.createdAt,
    readyAt: order.readyAt,
    updatedAt: history[history.length - 1].at,
    version: history.length,
    history,
    lines: order.orderItems.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      quantity: line.quantity,
      options: optionNames(line.options),
      choices: optionChoices(line.options),
    })),
  };
}

const listeners = new Set<ServerResponse>();

/** Sends one event to every open kitchen stream. */
export function broadcastKitchen(event: "order.paid" | "order.status_changed", order: StoredOrder) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(kitchenOrder(order))}\n\n`;
  for (const res of listeners) res.write(frame);
}

/** GET /v1/kitchen/stream, answered outside the Reply routes because it never ends. */
export function serveKitchenStream(req: Request, res: ServerResponse): boolean {
  if (req.method !== "GET" || req.path !== "/v1/kitchen/stream") return false;
  const { error } = authDevice(req);
  if (error) {
    res.writeHead(error.status, error.headers);
    res.end(JSON.stringify(error.body));
    return true;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");
  listeners.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), PING_MS);
  res.on("close", () => {
    clearInterval(ping);
    listeners.delete(res);
  });
  return true;
}

/**
 * "Encerrar o dia" (contract closeKitchenDay): every open order of the business
 * day of `at` becomes NOT_COLLECTED, never COLLECTED. Returns how many moved.
 */
export function closeDay(at: Date = now()): number {
  const day = businessDay(at);
  let count = 0;
  for (const order of state.orders.values()) {
    if (!OPEN.has(order.status) || businessDay(order.placedAt ?? order.createdAt) !== day) continue;
    order.status = "NOT_COLLECTED";
    historyOf(order).push({ status: "NOT_COLLECTED", at: at.toISOString(), by: "KITCHEN" });
    broadcastKitchen("order.status_changed", order);
    count += 1;
  }
  return count;
}

/**
 * "Retirados hoje" (contract listKitchenOrders, status=collected): COLLECTED
 * orders of the business day of `at`, newest hand-over (`updatedAt`) first.
 */
export function collectedToday(at: Date = now()): StoredOrder[] {
  const day = businessDay(at);
  const handedAt = (o: StoredOrder) => Date.parse(historyOf(o).at(-1)!.at);
  return [...state.orders.values()]
    .filter((o) => o.status === "COLLECTED" && businessDay(o.placedAt ?? o.createdAt) === day)
    .sort((a, b) => handedAt(b) - handedAt(a));
}

export const kitchenRoutes: Route[] = [
  [
    "POST",
    /^\/v1\/kitchen\/close-day$/,
    (req) => {
      const { error } = authDevice(req);
      if (error) return error;
      return ok({ count: closeDay() });
    },
  ],
  [
    "GET",
    /^\/v1\/kitchen\/orders$/,
    (req) => {
      const { error } = authDevice(req);
      if (error) return error;
      const filter = req.query.get("status") ?? "open";
      if (filter === "collected") return ok(collectedToday().map(kitchenOrder));
      if (filter !== "open") return problem(422, "VALIDATION_FAILED", "Validation failed", "status");
      const open = [...state.orders.values()]
        .filter((o) => OPEN.has(o.status))
        .sort(
          (a, b) => Date.parse(a.placedAt ?? a.createdAt) - Date.parse(b.placedAt ?? b.createdAt),
        );
      return ok(open.map(kitchenOrder));
    },
  ],
  [
    "POST",
    /^\/v1\/kitchen\/orders\/([^/]+)\/status$/,
    (req, [orderId]) => {
      const { error } = authDevice(req);
      if (error) return error;
      const order = state.orders.get(orderId);
      if (!order) return notFound();
      const body = req.body as Partial<Schemas["KitchenStatusUpdate"]> | null;
      const status = body?.status;
      if (status !== "PREPARING" && status !== "READY" && status !== "COLLECTED") {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "status");
      }
      const version = historyOf(order).length;
      if (body?.expectedVersion !== undefined && body.expectedVersion !== version) {
        return problem(409, "STALE_ORDER_VERSION", "The order changed since this version");
      }
      const back = BACK[order.status] === status;
      const sameDay = businessDay(order.placedAt ?? order.createdAt) === businessDay(now());
      if (!NEXT[order.status]?.includes(status) && !(back && sameDay)) {
        return problem(409, "INVALID_STATUS_TRANSITION", "Not allowed from the current status");
      }
      const wasCollected = order.status === "COLLECTED";
      order.status = status;
      if (status === "READY" && !wasCollected) order.readyAt = now().toISOString();
      if (status === "PREPARING") order.readyAt = null;
      historyOf(order).push({ status, at: now().toISOString(), by: "KITCHEN" });
      broadcastKitchen("order.status_changed", order);
      return ok(kitchenOrder(order));
    },
  ],
  [
    "PUT",
    /^\/v1\/kitchen\/availability$/,
    (req) => {
      const { error } = authDevice(req);
      if (error) return error;
      const body = req.body as Partial<Schemas["KitchenAvailabilityUpdate"]> | null;
      if (typeof body?.itemId !== "string" || typeof body.soldOut !== "boolean") {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "itemId");
      }
      const item = state.catalogue.items.find((i) => i.id === body.itemId);
      if (!item) return notFound();
      const optionId = body.optionId ?? null;
      const date = body.soldOut ? today() : null;
      if (optionId) {
        const known = state.catalogue.optionGroups.some((g) =>
          g.options.some((o) => o.id === optionId),
        );
        if (!known) return notFound();
        if (date) soldOutOptions.set(optionId, date);
        else soldOutOptions.delete(optionId);
      } else {
        item.soldOutDate = date;
      }
      return ok({ itemId: item.id, optionId, soldOutDate: date });
    },
  ],
  [
    "POST",
    /^\/v1\/admin\/orders\/([^/]+)\/cancel$/,
    (req, [orderId]) => {
      // The kitchen BFF signs the owner in and calls this with her token (decision 12).
      const denied = authOwner(req);
      if (denied) return denied;
      const order = state.orders.get(orderId);
      if (!order) return notFound();
      const reason = (req.body as Partial<Schemas["OrderCancelRequest"]> | null)?.reason;
      if (reason !== "ITEM_SOLD_OUT" && reason !== "CANNOT_PREPARE" && reason !== "OTHER") {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "reason");
      }
      if (!OPEN.has(order.status)) {
        return problem(409, "INVALID_STATUS_TRANSITION", "Only open orders can be cancelled");
      }
      order.status = "CANCELLED";
      historyOf(order).push({ status: "CANCELLED", at: now().toISOString(), by: "OWNER" });
      broadcastKitchen("order.status_changed", order);
      return ok(kitchenOrder(order));
    },
  ],
];
