// Back office (owner) routes. Every route but login needs the owner's token.

import { randomBytes } from "node:crypto";

import {
  authOwner,
  notFound,
  ok,
  problem,
  type Reply,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
import { firstFile, imageSize } from "./media.ts";
import { activeMenu, schedulesOverlap } from "./schedule.ts";
import { now, state } from "./state.ts";

const OWNER_TTL_S = Number(process.env.MOCK_OWNER_TOKEN_TTL ?? 8 * 60 * 60);

/** Wraps an owner-only handler: 401 without a valid owner token. */
export const owner =
  (handler: (req: Request, params: string[]) => Reply) => (req: Request, params: string[]) =>
    authOwner(req) ?? handler(req, params);

export const adminRoutes: Route[] = [
  [
    "POST",
    /^\/v1\/admin\/auth\/login$/,
    (req) => {
      const { email, password } = (req.body ?? {}) as Partial<Schemas["OwnerLoginRequest"]>;
      const match =
        email?.trim().toLowerCase() === state.owner.email && password === state.owner.password;
      if (!match) return problem(401, "INVALID_CREDENTIALS", "Invalid credentials");
      const accessToken = randomBytes(24).toString("base64url");
      state.ownerTokens.set(accessToken, Date.now() + OWNER_TTL_S * 1000);
      return ok({
        accessToken,
        tokenType: "Bearer",
        expiresIn: OWNER_TTL_S,
      } satisfies Schemas["OwnerToken"]);
    },
  ],
];

adminRoutes.push(
  ["GET", /^\/v1\/admin\/restaurant$/, owner(() => ok(state.restaurant))],
  [
    "PUT",
    /^\/v1\/admin\/restaurant$/,
    owner((req) => {
      const input = req.body as Partial<Schemas["RestaurantInput"]> | null;
      const invalid = restaurantProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      state.restaurant = { ...state.restaurant, ...(input as Schemas["RestaurantInput"]) };
      return ok(state.restaurant);
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/media$/,
    owner((req) => {
      const file = firstFile(req.raw, req.headers["content-type"]);
      if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type) || file.bytes.length === 0) {
        return problem(
          422,
          "VALIDATION_FAILED",
          "Validation failed",
          "file must be a PNG, JPEG or WebP image",
        );
      }
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const id = `med-${randomBytes(4).toString("hex")}`;
      state.media.set(`${id}.${ext}`, { bytes: file.bytes, type: file.type });
      return ok(
        {
          id,
          url: `/media/${id}.${ext}`,
          ...imageSize(file.bytes),
        } satisfies Schemas["MediaAsset"],
        201,
      );
    }),
  ],
);

/** The first field that breaks RestaurantInput's rules, or null. */
function restaurantProblem(input: Partial<Schemas["RestaurantInput"]> | null): string | null {
  if (!input) return "body";
  if (!input.name?.trim()) return "name";
  if (!/^[0-9]{14}$/.test(input.cnpj ?? "")) return "cnpj";
  if (!input.supportedLanguages?.includes(input.defaultLanguage ?? "pt-BR"))
    return "defaultLanguage";
  const digits = input.posCheckNumberDisplayLength ?? 0;
  if (digits < 1 || digits > 6) return "posCheckNumberDisplayLength";
  if (!input.closedMessage?.title?.["pt-BR"] || !input.closedMessage.description?.["pt-BR"])
    return "closedMessage";
  return null;
}

/** AdminDevice.online: a heartbeat in the last 3 minutes. */
const ONLINE_MS = 3 * 60_000;

function adminDevice(device: (typeof state.devices)[number]): Schemas["AdminDevice"] {
  const { secret: _, ...rest } = device;
  const seen = device.lastSeenAt ? Date.parse(device.lastSeenAt) : 0;
  return { ...rest, online: Date.now() - seen < ONLINE_MS };
}

function deviceProblem(input: Partial<Schemas["DeviceInput"]> | null): string | null {
  if (!input?.name?.trim()) return "name";
  if (input.kind !== "KIOSK" && input.kind !== "KITCHEN") return "kind";
  if (input.status !== "ACTIVE" && input.status !== "DISABLED") return "status";
  if (
    !Number.isInteger(input.idleTimerIntervalMilliseconds) ||
    input.idleTimerIntervalMilliseconds! < 0
  ) {
    return "idleTimerIntervalMilliseconds";
  }
  return null;
}

const newSecret = () => randomBytes(18).toString("base64url");

/** Drops every token a device holds, so a new secret or a disable takes effect at once. */
function forgetTokens(deviceId: string) {
  for (const [token, entry] of state.tokens)
    if (entry.deviceId === deviceId) state.tokens.delete(token);
}

adminRoutes.push(
  ["GET", /^\/v1\/admin\/devices$/, owner(() => ok(state.devices.map(adminDevice)))],
  [
    "POST",
    /^\/v1\/admin\/devices$/,
    owner((req) => {
      const input = req.body as Schemas["DeviceInput"];
      const invalid = deviceProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      const prefix = input.kind === "KIOSK" ? "KIOSK" : "KITCHEN";
      const count = state.devices.filter((d) => d.kind === input.kind).length + 1;
      const device = {
        ...input,
        id: `${prefix}-TBT-${String(count).padStart(3, "0")}`,
        secret: newSecret(),
        appVersion: null,
        lastSeenAt: null,
        ip: null,
        screenResolution: null,
      };
      state.devices.push(device);
      return ok(
        {
          device: adminDevice(device),
          deviceSecret: device.secret,
        } satisfies Schemas["DeviceCredentials"],
        201,
      );
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/devices\/([^/]+)$/,
    owner((req, [deviceId]) => {
      const device = state.devices.find((d) => d.id === deviceId);
      if (!device) return notFound();
      const input = req.body as Schemas["DeviceInput"];
      const invalid = deviceProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      Object.assign(device, input);
      if (device.status === "DISABLED") forgetTokens(device.id);
      return ok(adminDevice(device));
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/devices\/([^/]+)\/secret$/,
    owner((_req, [deviceId]) => {
      const device = state.devices.find((d) => d.id === deviceId);
      if (!device) return notFound();
      device.secret = newSecret();
      forgetTokens(device.id);
      return ok({
        device: adminDevice(device),
        deviceSecret: device.secret,
      } satisfies Schemas["DeviceCredentials"]);
    }),
  ],
);

type MockMenu = (typeof state.menus)[number];

function adminMenu(menu: MockMenu): Schemas["AdminMenu"] {
  const active = activeMenu(state.menus, now(), state.restaurant.timezone);
  return {
    id: menu.id,
    name: menu.name,
    showCategoriesPrice: menu.showCategoriesPrice,
    currency: "BRL",
    isActive: active?.menu.id === menu.id,
    forcedUntil:
      menu.forcedUntil && Date.parse(menu.forcedUntil) > now().getTime() ? menu.forcedUntil : null,
  };
}

const findMenu = (menuId: string) => state.menus.find((m) => m.id === menuId);
const LOCAL_TIME = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const WEEKDAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

function menuProblem(input: Partial<Schemas["MenuInput"]> | null): string | null {
  if (!input?.name?.["pt-BR"]?.trim()) return "name";
  if (typeof input.showCategoriesPrice !== "boolean") return "showCategoriesPrice";
  return null;
}

adminRoutes.push(
  ["GET", /^\/v1\/admin\/menus$/, owner(() => ok(state.menus.map(adminMenu)))],
  [
    "POST",
    /^\/v1\/admin\/menus$/,
    owner((req) => {
      const input = req.body as Schemas["MenuInput"];
      const invalid = menuProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      const menu: MockMenu = {
        id: `mnu-${randomBytes(3).toString("hex")}`,
        name: input.name,
        showCategoriesPrice: input.showCategoriesPrice,
        schedules: [],
        forcedUntil: null,
      };
      state.menus.push(menu);
      return ok(adminMenu(menu), 201);
    }),
  ],
  [
    "GET",
    /^\/v1\/admin\/menus\/([^/]+)$/,
    owner((_req, [menuId]) => {
      const menu = findMenu(menuId);
      return menu ? ok(adminMenu(menu)) : notFound();
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/menus\/([^/]+)$/,
    owner((req, [menuId]) => {
      const menu = findMenu(menuId);
      if (!menu) return notFound();
      const input = req.body as Schemas["MenuInput"];
      const invalid = menuProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      Object.assign(menu, { name: input.name, showCategoriesPrice: input.showCategoriesPrice });
      return ok(adminMenu(menu));
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/menus\/([^/]+)$/,
    owner((_req, [menuId]) => {
      if (!findMenu(menuId)) return notFound();
      state.menus = state.menus.filter((m) => m.id !== menuId);
      state.catalogue.categories = state.catalogue.categories.filter((c) => c.menuId !== menuId);
      return { status: 204 };
    }),
  ],
  [
    "GET",
    /^\/v1\/admin\/menus\/([^/]+)\/schedules$/,
    owner((_req, [menuId]) => {
      const menu = findMenu(menuId);
      return menu ? ok(menu.schedules) : notFound();
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/menus\/([^/]+)\/schedules$/,
    owner((req, [menuId]) => {
      const menu = findMenu(menuId);
      if (!menu) return notFound();
      const windows = req.body as Schemas["MenuSchedule"][];
      if (!Array.isArray(windows))
        return problem(422, "VALIDATION_FAILED", "Validation failed", "body");
      const bad = windows.findIndex(
        (w) =>
          !WEEKDAYS.has(w.weekday) ||
          !LOCAL_TIME.test(w.timeStart) ||
          !LOCAL_TIME.test(w.timeEnd) ||
          w.timeStart === w.timeEnd,
      );
      if (bad !== -1) return problem(422, "VALIDATION_FAILED", "Validation failed", `[${bad}]`);
      const clash = state.menus.find(
        (m) => m.id !== menuId && schedulesOverlap(windows, m.schedules),
      );
      if (clash) {
        return problem(409, "SCHEDULE_OVERLAP", "Overlaps another menu", clash.name["pt-BR"]);
      }
      menu.schedules = windows.map(({ weekday, timeStart, timeEnd }) => ({
        weekday,
        timeStart,
        timeEnd,
      }));
      return ok(menu.schedules);
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/menus\/([^/]+)\/force$/,
    owner((req, [menuId]) => {
      const menu = findMenu(menuId);
      if (!menu) return notFound();
      const until = (req.body as Partial<Schemas["ForceMenuRequest"]> | null)?.until;
      if (!until || Number.isNaN(Date.parse(until)) || Date.parse(until) <= now().getTime()) {
        return problem(422, "VALIDATION_FAILED", "Validation failed", "until");
      }
      // One forced menu at a time.
      for (const m of state.menus) m.forcedUntil = null;
      menu.forcedUntil = new Date(until).toISOString();
      return ok(adminMenu(menu));
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/menus\/([^/]+)\/force$/,
    owner((_req, [menuId]) => {
      const menu = findMenu(menuId);
      if (!menu) return notFound();
      menu.forcedUntil = null;
      return { status: 204 };
    }),
  ],
);

const PAID_STATUSES = new Set(["PAID", "PREPARING", "READY", "COLLECTED"]);

adminRoutes.push([
  "GET",
  /^\/v1\/admin\/reports\/daily$/,
  owner((req) => {
    const date = req.query.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return problem(422, "VALIDATION_FAILED", "Validation failed", "date");
    const orders = [...state.orders.values()].filter(
      (o) => o.businessDate === date && PAID_STATUSES.has(o.status),
    );
    const revenue = orders.reduce((sum, o) => sum + o.orderTotal.total, 0);
    const byType = (type: Schemas["OrderType"]) => {
      const list = orders.filter((o) => o.orderType === type);
      return { orders: list.length, revenue: list.reduce((sum, o) => sum + o.orderTotal.total, 0) };
    };
    const sellers = new Map<
      string,
      { itemId: string; name: string; quantity: number; revenue: number }
    >();
    for (const line of orders.flatMap((o) => o.orderItems)) {
      const entry = sellers.get(line.itemId) ?? {
        itemId: line.itemId,
        name: line.name,
        quantity: 0,
        revenue: 0,
      };
      entry.quantity += line.quantity;
      entry.revenue += line.lineTotal;
      sellers.set(line.itemId, entry);
    }
    return ok({
      date,
      ordersCount: orders.length,
      revenue,
      averageTicket: orders.length ? Math.round(revenue / orders.length) : 0,
      byOrderType: { DINEIN: byType("DINEIN"), TAKE_OUT: byType("TAKE_OUT") },
      bestSellers: [...sellers.values()]
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 10),
    } satisfies Schemas["DailyReport"]);
  }),
]);
