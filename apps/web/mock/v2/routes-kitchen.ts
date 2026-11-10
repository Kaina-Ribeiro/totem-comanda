// v2 kitchen routes: board, Server-Sent Events, status moves, "Acabou",
// close the day and the store pace. The pace itself is v1's (one store pace);
// v2 streams hear the changes made through v2 routes.

import type { ServerResponse } from "node:http";

import { authDevice, ok, type Reply, type Request, type Route } from "../http.ts";
import { paceRoutes } from "../pace.ts";
import { problem, type S } from "./http.ts";
import { addKitchenListenerV2, broadcastV2, closeDay, collectedToday, moveOrder, openOrders, setAvailability } from "./orders.ts";
import { sweep } from "./payments.ts";

const PING_MS = 15_000;

/** The v1 pace handler for `method` + `path` (the store has one pace for both versions). */
export const v1Pace = (method: string, path: string) =>
  paceRoutes.find(([m, p]) => m === method && p.test(path))![2];

/** Runs a v1 pace handler and tells the v2 streams when the pace changed. */
export function paceVia(method: string, path: string, req: Request): Reply {
  const reply = v1Pace(method, path)(req, []);
  if (method === "PUT" && reply.status === 200) broadcastV2("store.pace_changed", reply.body);
  return reply;
}

const device =
  (handler: (req: Request, params: string[]) => Reply) => (req: Request, params: string[]) =>
    authDevice(req).error ?? handler(req, params);

/** GET /v2/kitchen/stream, answered outside the Reply routes because it never ends. */
export function serveKitchenStreamV2(req: Request, res: ServerResponse): boolean {
  if (req.method !== "GET" || req.path !== "/v2/kitchen/stream") return false;
  const { error } = authDevice(req);
  if (error) {
    res.writeHead(error.status, error.headers);
    res.end(JSON.stringify(error.body));
    return true;
  }
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.write(": connected\n\n");
  const remove = addKitchenListenerV2(res);
  const ping = setInterval(() => res.write(": ping\n\n"), PING_MS);
  res.on("close", () => {
    clearInterval(ping);
    remove();
  });
  return true;
}

export const kitchenRoutesV2: Route[] = [
  [
    "GET",
    /^\/v2\/kitchen\/orders$/,
    device((req) => {
      sweep();
      return ok(req.query.get("status") === "collected" ? collectedToday() : openOrders());
    }),
  ],
  [
    "POST",
    /^\/v2\/kitchen\/orders\/([^/]+)\/status$/,
    device((req, [number]) => moveOrder(decodeURIComponent(number), (req.body ?? {}) as Partial<S["KitchenStatusUpdate"]>)),
  ],
  [
    "PUT",
    /^\/v2\/kitchen\/availability$/,
    device((req) => {
      const body = req.body as Partial<S["KitchenAvailabilityUpdate"]> | null;
      if (typeof body?.id !== "string" || typeof body.available !== "boolean") {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "id, available");
      }
      return setAvailability(body.id, body.available);
    }),
  ],
  ["POST", /^\/v2\/kitchen\/close-day$/, device(() => ok({ count: closeDay() } satisfies S["CloseDayResult"]))],
  ["GET", /^\/v2\/kitchen\/pace$/, (req) => paceVia("GET", "/v1/kitchen/pace", req)],
  ["PUT", /^\/v2\/kitchen\/pace$/, (req) => paceVia("PUT", "/v1/kitchen/pace", req)],
];
