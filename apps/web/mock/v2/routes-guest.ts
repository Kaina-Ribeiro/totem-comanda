// v2 device and guest routes: auth, config, heartbeat, status, active menu,
// language pack, journeys, totals, coupons, payments and orders.

import { createHash, randomBytes } from "node:crypto";

import { authDevice, idempotent, ok, type Request, type Route } from "../http.ts";
import { currentPace } from "../pace.ts";
import { now, signInDevice, state } from "../state.ts";
import { notFound, problem, type S } from "./http.ts";
import { activeMenuV2, guestMenu, nextOpeningV2 } from "./menu.ts";
import { applyDiscount, cancelDiscount, createTotals, publicOrder, submitOrder } from "./orders.ts";
import { cancelPayment, createPayment, forceOutcome, getPayment, ownSession, sweep } from "./payments.ts";
import { paymentTerminalId, v2 } from "./state.ts";

const TOKEN_TTL_S = Number(process.env.MOCK_TOKEN_TTL ?? 900);

const language = (req: Request): S["LanguageCode"] => (req.query.get("language") === "en" ? "en" : "pt-BR");
const etagOf = (prefix: string, value: unknown) =>
  `"${prefix}-${createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16)}"`;

/** Runs `handler` for the signed-in device, or answers 401. */
const device =
  (handler: (req: Request, deviceId: string, params: string[]) => ReturnType<Route[2]>) =>
  (req: Request, params: string[]) => {
    const { device: d, error } = authDevice(req);
    return error ?? handler(req, d.id, params);
  };

export function storeNow(): S["StoreConfigurationResponse"] {
  const pace = currentPace();
  return { ...v2().store, pace, waitMinutes: pace.waitMinutes };
}

function deviceConfig(d: (typeof state.devices)[number]): S["DeviceConfig"] {
  const at = now();
  const active = activeMenuV2(at);
  const pace = currentPace();
  return {
    kioskID: d.id,
    kind: d.kind,
    idleTimerIntervalMilliseconds: d.idleTimerIntervalMilliseconds,
    printerEnabled: d.printerEnabled,
    maintenanceMode: d.maintenanceMode,
    atCapacityMode: d.atCapacityMode || pace.pace === "PAUSED",
    isOpen: active !== null,
    store: storeNow(),
    activeMenu: active
      ? { menuId: active.menu.id, name: active.menu.name, validUntil: active.until.toISOString() }
      : null,
    nextOpeningAt: active ? null : (nextOpeningV2(at)?.toISOString() ?? null),
    serverTime: at.toISOString(),
    paymentTerminalId: paymentTerminalId(d.id),
  };
}

export const guestRoutes: Route[] = [
  [
    "POST",
    /^\/v2\/devices\/auth$/,
    (req) => {
      const { deviceId, deviceSecret } = (req.body ?? {}) as Partial<S["DeviceAuthRequest"]>;
      const d = signInDevice(deviceId, deviceSecret);
      if (!d) return problem(401, "INVALID_CREDENTIALS", "Invalid credentials");
      if (d.status === "DISABLED") return problem(403, "DEVICE_DISABLED", "Device disabled");
      const accessToken = randomBytes(24).toString("base64url");
      state.tokens.set(accessToken, { deviceId: d.id, expiresAt: Date.now() + TOKEN_TTL_S * 1000 });
      return ok({ accessToken, tokenType: "Bearer", expiresIn: TOKEN_TTL_S } satisfies S["DeviceToken"]);
    },
  ],
  [
    "GET",
    /^\/v2\/devices\/me\/config$/,
    (req) => {
      const { device: d, error } = authDevice(req);
      if (error) return error;
      const config = deviceConfig(d);
      const { serverTime: _, ...versioned } = config;
      const etag = etagOf("cfg2", versioned);
      if (req.headers["if-none-match"] === etag) return { status: 304, headers: { ETag: etag } };
      return { status: 200, body: config, headers: { ETag: etag } };
    },
  ],
  [
    "POST",
    /^\/v2\/devices\/heartbeat$/,
    (req) => {
      const { device: d, error } = authDevice(req);
      if (error) return error;
      const beat = req.body as S["Heartbeat"];
      d.appVersion = beat.appVersion;
      d.screenResolution = beat.screenResolution;
      d.ip = beat.ip ?? req.ip;
      d.lastSeenAt = new Date().toISOString();
      return { status: 204 };
    },
  ],
  [
    "POST",
    /^\/v2\/devices\/status$/,
    device((req, deviceId) => {
      state.statusReports.push({ deviceId, at: new Date().toISOString(), report: req.body as never });
      state.statusReports.splice(0, state.statusReports.length - 50);
      return { status: 204 };
    }),
  ],
  [
    "GET",
    /^\/v2\/menus\/active$/,
    device((req) => {
      const lang = language(req);
      const menu = guestMenu(now(), lang);
      if (!menu) return problem(404, "NO_ACTIVE_MENU", "No menu is active now");
      const etag = etagOf(`menu-${menu.menuId}-${lang}`, menu);
      if (req.headers["if-none-match"] === etag) return { status: 304, headers: { ETag: etag } };
      return { status: 200, body: menu, headers: { ETag: etag } };
    }),
  ],
  [
    "GET",
    /^\/v2\/languages\/([^/]+)$/,
    device((_req, _id, [code]) => {
      if (code !== "pt-BR" && code !== "en") return notFound();
      return ok({
        code,
        name: code === "pt-BR" ? "Português" : "English",
        strings: state.languagePacks[code],
      } satisfies S["LanguagePack"]);
    }),
  ],
  [
    "POST",
    /^\/v2\/journeys$/,
    device((req, deviceId) => {
      const body = req.body as Partial<S["StartJourneyRequest"]> | null;
      if (!body?.orderNonce || (body.language !== "pt-BR" && body.language !== "en")) {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "orderNonce, language");
      }
      const at = now().toISOString();
      v2().journeys.set(body.orderNonce, { deviceId, language: body.language, at });
      return ok({ journeyStartedTimestamp: at } satisfies S["JourneyStarted"], 201);
    }),
  ],
  ["POST", /^\/v2\/journeys\/([^/]+)\/events$/, device(() => ({ status: 204 }))],
  ["POST", /^\/v2\/totals$/, device((req, id) => createTotals(req.body as S["TotalsRequest"], id, language(req)))],
  [
    "POST",
    /^\/v2\/discounts\/apply$/,
    device((req, id) => applyDiscount(req.body as S["DiscountRequest"], id, language(req))),
  ],
  ["POST", /^\/v2\/discounts\/cancel$/, device((req, id) => cancelDiscount(req.body as S["DiscountRequest"], id))],
  [
    "POST",
    /^\/v2\/payments$/,
    device((req, id) => {
      sweep();
      return idempotent(req, `v2-payment:${id}`, () => createPayment(req.body as S["CreatePaymentRequest"], id));
    }),
  ],
  ["GET", /^\/v2\/payments\/([^/]+)$/, device((_req, id, [paymentId]) => getPayment(paymentId, id))],
  ["POST", /^\/v2\/payments\/([^/]+)\/cancel$/, device((_req, id, [paymentId]) => cancelPayment(paymentId, id))],
  [
    "POST",
    /^\/v2\/payments\/([^/]+)\/simulate$/,
    device((req, id, [paymentId]) => {
      const session = ownSession(paymentId, id);
      if (!session) return notFound();
      return forceOutcome(session, (req.body as { outcome?: unknown } | null)?.outcome);
    }),
  ],
  [
    "POST",
    /^\/v2\/orders$/,
    device((req, id) => {
      sweep();
      return idempotent(req, `v2-order:${id}`, () => submitOrder(req.body as S["SubmitOrderRequest"], id, "KIOSK"));
    }),
  ],
  [
    "GET",
    /^\/v2\/orders\/([^/]+)$/,
    device((_req, id, [number]) => {
      const order = v2().orders.get(decodeURIComponent(number));
      return order && order.deviceId === id ? ok(publicOrder(order)) : notFound();
    }),
  ],
];
