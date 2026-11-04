// Kitchen screen: open orders, status changes and the Server-Sent Events
// stream (one event per change, a ping comment every 15 s).

import type { ServerResponse } from "node:http";

import {
  authDevice,
  notFound,
  ok,
  problem,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
import { now, state } from "./state.ts";

type StoredOrder = Schemas["Order"] & { deviceId: string; menuId: string };

const OPEN = new Set<Schemas["OrderStatus"]>(["PAID", "PREPARING", "READY"]);
const NEXT: Partial<Record<Schemas["OrderStatus"], Schemas["OrderStatus"][]>> = {
  PAID: ["PREPARING", "READY"],
  PREPARING: ["READY"],
  READY: ["COLLECTED"],
};
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

export const kitchenRoutes: Route[] = [
  [
    "GET",
    /^\/v1\/kitchen\/orders$/,
    (req) => {
      const { error } = authDevice(req);
      if (error) return error;
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
      const status = (req.body as Partial<Schemas["KitchenStatusUpdate"]> | null)?.status;
      if (status !== "PREPARING" && status !== "READY" && status !== "COLLECTED") {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "status");
      }
      if (!NEXT[order.status]?.includes(status)) {
        return problem(409, "INVALID_STATUS_TRANSITION", "Not allowed from the current status");
      }
      order.status = status;
      if (status === "READY") order.readyAt = now().toISOString();
      historyOf(order).push({ status, at: now().toISOString(), by: "KITCHEN" });
      broadcastKitchen("order.status_changed", order);
      return ok(kitchenOrder(order));
    },
  ],
];
