// Back-office routes. Catalogue saves are PUT upserts with the id in the
// path, validated as a whole catalogue (422 MENU_INVALID). Owner login and
// devices are in ./routes-devices.ts, the store pace in ../pace.ts.

import { randomBytes } from "node:crypto";

import { authOwner, ok, type Reply, type Request, type Route } from "../http.ts";
import { firstFile, imageSize } from "../media.ts";
import { adminPaceRoutes } from "../pace.ts";
import { schedulesOverlap } from "../schedule.ts";
import { now, state } from "../state.ts";
import { key, notFound, problem, type Entity, type EntityType, type S } from "./http.ts";
import { activeMenuV2, toWindows, validateCatalogue, type MenuError } from "./menu.ts";
import { cancelOrder, dailyReport, setAvailability } from "./orders.ts";
import { deviceAdminRoutes } from "./routes-devices.ts";
import { storeNow } from "./routes-guest.ts";
import { v2, type MockMenuV2 } from "./state.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const owner =
  (handler: (req: Request, params: string[]) => Reply) => (req: Request, params: string[]) =>
    authOwner(req) ?? handler(req, params.map(decodeURIComponent));

const invalid = (detail: string) => problem(422, "VALIDATION_FAILED", "Validation failed", detail);
const menuInvalid = (errors: MenuError[]) =>
  problem(422, "MENU_INVALID", "The menu would be broken", undefined, { errors });
const mismatch = (type: EntityType, id: string): MenuError => ({
  field: "id",
  message: "the body id must be the path id",
  rule: "ID_MISMATCH",
  entity: { type, id },
});

/** Commits `entities` (and menus) when the catalogue stays sound, else MENU_INVALID. */
function commit(entities: Map<string, Entity>, menus = v2().menus, badges = v2().badges): Reply | null {
  const errors = validateCatalogue(entities, menus, badges);
  if (errors.length) return menuInvalid(errors);
  const s = v2();
  s.entities = entities;
  s.menus = menus;
  s.badges = badges;
  return null;
}

/** GET list, PUT upsert and DELETE for one family of entity types. */
function catalogue(path: string, types: EntityType[]): Route[] {
  const base = `^\\/v2\\/admin\\/${path}`;
  const find = (id: string) => types.map((t) => v2().entities.get(key(t, id))).find(Boolean);
  return [
    [
      "GET",
      new RegExp(`${base}$`),
      owner((req) => {
        const only = req.query.get("type");
        return ok([...v2().entities.values()].filter((e) => types.includes(e.type) && (!only || e.type === only)));
      }),
    ],
    [
      "PUT",
      new RegExp(`${base}\\/([^/]+)$`),
      owner((req, [id]) => {
        const body = req.body as Entity | null;
        if (!body || typeof body !== "object" || !types.includes(body.type)) return invalid(`type must be one of ${types.join(", ")}`);
        if (typeof body.name !== "string" || !body.name.trim() || !Array.isArray(body.links)) return invalid("name, links");
        if (body.id !== id) return menuInvalid([mismatch(body.type, id)]);
        if (!ID.test(id)) return menuInvalid([{ field: "id", message: `"${id}" is not allowed`, rule: "INVALID_ID", entity: { type: body.type, id } }]);
        const saved = { ...body } as Entity & { displayPrice?: number };
        delete saved.displayPrice;
        const next = new Map(v2().entities);
        for (const t of types) next.delete(key(t, id));
        next.set(key(saved.type, id), saved);
        return commit(next) ?? ok(saved);
      }),
    ],
    [
      "DELETE",
      new RegExp(`${base}\\/([^/]+)$`),
      owner((_req, [id]) => {
        const found = find(id);
        if (!found) return notFound();
        const next = new Map(v2().entities);
        next.delete(key(found.type, id));
        return commit(next) ?? { status: 204 };
      }),
    ],
  ];
}

function adminMenu(menu: MockMenuV2): S["AdminMenu"] {
  const { schedules: _, ...rest } = menu;
  const forced = menu.forcedUntil && Date.parse(menu.forcedUntil) > now().getTime() ? menu.forcedUntil : null;
  return { ...rest, isActive: activeMenuV2(now())?.menu.id === menu.id, forcedUntil: forced };
}

const findMenu = (id: string) => v2().menus.find((m) => m.id === id);
const TIME = /^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
const DAYS = new Set(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]);
const COLOUR = /^#[0-9A-Fa-f]{6}$/;

function storeProblem(s: Partial<S["StoreConfigurationResponse"]> | null): string | null {
  if (!s?.locationName?.trim()) return "locationName";
  if (!Array.isArray(s.languages) || !s.languages.length) return "languages";
  if (!s.defaultLanguage || !s.languages.includes(s.defaultLanguage)) return "defaultLanguage";
  if (!s.closedMessage?.title?.["pt-BR"] || !s.closedMessage?.description?.["pt-BR"]) return "closedMessage";
  if (!s.invoiceNotice?.["pt-BR"]?.trim()) return "invoiceNotice";
  if (!s.timezone?.trim()) return "timezone";
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(s.businessDayCutoff ?? "")) return "businessDayCutoff";
  return null;
}

export const adminRoutes: Route[] = [
  ...deviceAdminRoutes,
  ["GET", /^\/v2\/admin\/store$/, owner(() => ok(storeNow()))],
  [
    "PUT",
    /^\/v2\/admin\/store$/,
    owner((req) => {
      const input = req.body as Partial<S["StoreConfigurationResponse"]> | null;
      const bad = storeProblem(input);
      if (bad) return invalid(bad);
      const { pace: _p, waitMinutes: _w, ...settings } = input as S["StoreConfigurationResponse"];
      v2().store = settings;
      return ok(storeNow());
    }),
  ],
  [
    "POST",
    /^\/v2\/admin\/media$/,
    owner((req) => {
      const file = firstFile(req.raw, req.headers["content-type"]);
      if (!file || !file.type.startsWith("image/")) return invalid("file");
      const id = `img-${randomBytes(4).toString("hex")}`;
      const ext = file.type === "image/png" ? "png" : "jpg";
      state.media.set(`${id}.${ext}`, { bytes: file.bytes, type: file.type });
      const size = imageSize(file.bytes);
      const image: S["PosEntityImage"] = { id, name: file.filename, type: "IMAGE", url: `/media/${id}.${ext}`, altText: null, links: [] };
      v2().entities.set(key("IMAGE", id), image);
      v2().imageSizes.set(id, size);
      return ok({ ...image, ...size } satisfies S["MediaAsset"], 201);
    }),
  ],
  [
    "GET",
    /^\/v2\/admin\/images$/,
    owner(() =>
      ok(
        [...v2().entities.values()]
          .filter((e): e is S["PosEntityImage"] => e.type === "IMAGE")
          .map((e) => ({ ...e, ...(v2().imageSizes.get(e.id) ?? { width: 1080, height: 1080 }) })),
      ),
    ),
  ],

  ["GET", /^\/v2\/admin\/menus$/, owner(() => ok(v2().menus.map(adminMenu)))],
  [
    "PUT",
    /^\/v2\/admin\/menus\/([^/]+)$/,
    owner((req, [id]) => {
      const body = req.body as Partial<S["AdminMenu"]> | null;
      if (!body?.name?.trim() || !Array.isArray(body.root)) return invalid("name, root");
      if (body.id !== id) return menuInvalid([mismatch("CATEGORY", id)]);
      const existing = findMenu(id);
      const menu: MockMenuV2 = {
        id,
        name: body.name,
        translations: body.translations,
        root: body.root,
        forcedUntil: existing?.forcedUntil ?? null,
        schedules: existing?.schedules ?? [],
      };
      const menus = [...v2().menus.filter((m) => m.id !== id), menu];
      return commit(v2().entities, menus) ?? ok(adminMenu(menu));
    }),
  ],
  [
    "DELETE",
    /^\/v2\/admin\/menus\/([^/]+)$/,
    owner((_req, [id]) => {
      if (!findMenu(id)) return notFound();
      v2().menus = v2().menus.filter((m) => m.id !== id);
      return { status: 204 };
    }),
  ],
  [
    "GET",
    /^\/v2\/admin\/menus\/([^/]+)\/schedules$/,
    owner((_req, [id]) => {
      const menu = findMenu(id);
      return menu ? ok(menu.schedules) : notFound();
    }),
  ],
  [
    "PUT",
    /^\/v2\/admin\/menus\/([^/]+)\/schedules$/,
    owner((req, [id]) => {
      const menu = findMenu(id);
      if (!menu) return notFound();
      const windows = req.body as S["PosEntitySectionHours"][] | null;
      if (!Array.isArray(windows) || windows.some((w) => !DAYS.has(w?.dayOfWeek) || !TIME.test(w.open) || !TIME.test(w.close))) {
        return invalid("dayOfWeek, open, close");
      }
      const clash = v2().menus.some((m) => m.id !== id && schedulesOverlap(toWindows(windows), toWindows(m.schedules)));
      if (clash) return problem(409, "SCHEDULE_OVERLAP", "Overlaps another menu");
      menu.schedules = windows;
      return ok(menu.schedules);
    }),
  ],
  [
    "POST",
    /^\/v2\/admin\/menus\/([^/]+)\/force$/,
    owner((req, [id]) => {
      const menu = findMenu(id);
      if (!menu) return notFound();
      const until = (req.body as { until?: unknown } | null)?.until;
      if (typeof until !== "string" || Number.isNaN(Date.parse(until))) return invalid("until");
      for (const m of v2().menus) m.forcedUntil = null;
      menu.forcedUntil = until;
      return ok(adminMenu(menu));
    }),
  ],
  [
    "DELETE",
    /^\/v2\/admin\/menus\/([^/]+)\/force$/,
    owner((_req, [id]) => {
      const menu = findMenu(id);
      if (!menu) return notFound();
      menu.forcedUntil = null;
      return { status: 204 };
    }),
  ],

  ...catalogue("sections", ["CATEGORY"]),
  ...catalogue("items", ["ITEM", "SIZED_ITEM", "COMBO_MEAL"]),
  ...catalogue("modifier-groups", ["MODIFIERS", "COMBO_MAIN", "COMBO_SIDE"]),
  ...catalogue("swap-sells", ["SWAP_SELL"]),
  [
    "PUT",
    /^\/v2\/admin\/items\/([^/]+)\/availability$/,
    owner((req, [id]) => {
      const available = (req.body as { available?: unknown } | null)?.available;
      if (typeof available !== "boolean") return invalid("available");
      return setAvailability(id, available);
    }),
  ],

  ["GET", /^\/v2\/admin\/badges$/, owner(() => ok(v2().badges))],
  [
    "PUT",
    /^\/v2\/admin\/badges\/([^/]+)$/,
    owner((req, [id]) => {
      const b = req.body as Partial<S["Badge"]> | null;
      if (b?.id !== id || !b.name?.trim() || !COLOUR.test(b.textColour ?? "") || !COLOUR.test(b.backgroundColour ?? "")) {
        return invalid("id, name, textColour, backgroundColour");
      }
      v2().badges = [...v2().badges.filter((x) => x.id !== id), b as S["Badge"]];
      return ok(b);
    }),
  ],
  [
    "DELETE",
    /^\/v2\/admin\/badges\/([^/]+)$/,
    owner((_req, [id]) => {
      if (!v2().badges.some((b) => b.id === id)) return notFound();
      return commit(v2().entities, v2().menus, v2().badges.filter((b) => b.id !== id)) ?? { status: 204 };
    }),
  ],

  ["GET", /^\/v2\/admin\/discount-rules$/, owner(() => ok(v2().discountRules))],
  [
    "PUT",
    /^\/v2\/admin\/discount-rules\/([^/]+)$/,
    owner((req, [id]) => {
      const r = req.body as Partial<S["DiscountRule"]> | null;
      if (r?.id !== id || !/^[A-Z0-9]{3,20}$/.test(r.code ?? "") || !r.name?.trim()) return invalid("id, code, name");
      if ((r.type !== "PERCENT" && r.type !== "FIXED") || typeof r.value !== "number" || r.value <= 0) return invalid("type, value");
      if (r.type === "PERCENT" && r.value > 100) return invalid("value");
      if (typeof r.active !== "boolean") return invalid("active");
      if (v2().discountRules.some((x) => x.code === r.code && x.id !== id)) {
        return problem(409, "DISCOUNT_CODE_TAKEN", "Code already used by another coupon");
      }
      const previous = v2().discountRules.find((x) => x.id === id);
      const rule = { ...(r as S["DiscountRule"]), usesCount: previous?.usesCount ?? 0 };
      v2().discountRules = [...v2().discountRules.filter((x) => x.id !== id), rule];
      return ok(rule);
    }),
  ],
  [
    "DELETE",
    /^\/v2\/admin\/discount-rules\/([^/]+)$/,
    owner((_req, [id]) => {
      if (!v2().discountRules.some((r) => r.id === id)) return notFound();
      v2().discountRules = v2().discountRules.filter((r) => r.id !== id);
      return { status: 204 };
    }),
  ],

  [
    "POST",
    /^\/v2\/admin\/orders\/([^/]+)\/cancel$/,
    owner((req, [number]) => {
      const reason = (req.body as { reason?: unknown } | null)?.reason;
      if (reason !== "ITEM_SOLD_OUT" && reason !== "CANNOT_PREPARE" && reason !== "OTHER") return invalid("reason");
      return cancelOrder(number);
    }),
  ],
  ...adminPaceRoutes,
  [
    "GET",
    /^\/v2\/admin\/reports\/daily$/,
    owner((req) => {
      const date = req.query.get("date") ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return invalid("date");
      return ok(dailyReport(date));
    }),
  ],
];

