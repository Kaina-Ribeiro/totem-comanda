// The v2 menu graph in the mock: which menu is active, the guest MenuResponse
// (reachable graph, text resolved, section hours applied, displayPrice), and the
// catalogue validator behind `422 MENU_INVALID` (contract: MenuInvalid).

import { activeMenu, nextOpening, type ScheduledMenu, type Weekday } from "../schedule.ts";
import { isGroup, isItem, key, toBrl, toCents, type Entity, type S } from "./http.ts";
import { v2, type MockMenuV2 } from "./state.ts";

type Hours = S["PosEntitySectionHours"];
export type MenuError = Required<Pick<NonNullable<S["Problem"]["errors"]>[number], "field" | "message" | "rule" | "entity">>;

export const toWindows = (hours: Hours[]) =>
  hours.map((h) => ({
    weekday: h.dayOfWeek.slice(0, 3) as Weekday,
    timeStart: h.open.slice(0, 5),
    timeEnd: h.close.slice(0, 5),
  }));

const scheduled = (menus: MockMenuV2[]): ScheduledMenu[] =>
  menus.map((m) => ({ id: m.id, schedules: toWindows(m.schedules), forcedUntil: m.forcedUntil ?? null }));

/** The menu active at `at` and when it stops, or null when closed. */
export function activeMenuV2(at: Date): { menu: MockMenuV2; until: Date } | null {
  const s = v2();
  const found = activeMenu(scheduled(s.menus), at, s.store.timezone);
  if (!found) return null;
  return { menu: s.menus.find((m) => m.id === found.menu.id)!, until: found.until };
}

export const nextOpeningV2 = (at: Date) => nextOpening(scheduled(v2().menus), at, v2().store.timezone);

/** True when `at` falls inside one of the windows (store timezone). */
export function withinHours(hours: Hours[], at: Date): boolean {
  return activeMenu([{ id: "h", schedules: toWindows(hours), forcedUntil: null }], at, v2().store.timezone) !== null;
}

export const entityOf = (link: S["Link"]) => v2().entities.get(key(link.type, link.id));

/** A product's own price for dine-in, in cents. */
export const ownPriceCents = (e: Entity) =>
  isItem(e) ? toCents(e.type === "SIZED_ITEM" ? 0 : (e.dineInPriceOverride ?? e.price)) : 0;

/** "From R$ X": cheapest size, or price plus the cheapest picks of each required group. */
export function displayPriceCents(product: Entity): number {
  if (product.type === "SIZED_ITEM") {
    const sizes = product.links.map(entityOf).filter(isItem).map(ownPriceCents);
    return sizes.length ? Math.min(...sizes) : 0;
  }
  let cents = ownPriceCents(product);
  for (const groupLink of product.links) {
    const group = entityOf(groupLink);
    if (!isGroup(group) || group.min < 1) continue;
    const prices = group.links.map(entityOf).filter(isItem).map(ownPriceCents).sort((a, b) => a - b);
    cents += prices.slice(0, group.min).reduce((sum, p) => sum + p, 0);
  }
  return cents;
}

const needsFrom = (product: Entity) =>
  product.type === "SIZED_ITEM" ||
  product.links.some((l) => {
    const g = entityOf(l);
    return isGroup(g) && g.min > 0;
  });

function resolve<T extends Entity>(entity: T, language: S["LanguageCode"]): T {
  const { translations, ...rest } = entity as T & { translations?: S["Translations"] };
  const english = language === "en" ? translations?.en : undefined;
  const out = { ...rest, name: english?.name || entity.name } as T;
  if ("description" in out && english?.description) {
    (out as { description?: string | null }).description = english.description;
  }
  return out;
}

/** The guest menu at `at`, or null when no menu is active. */
export function guestMenu(at: Date, language: S["LanguageCode"]): S["MenuResponse"] | null {
  const active = activeMenuV2(at);
  if (!active) return null;
  const s = v2();
  const seen = new Set<string>();
  const products = new Set<string>();
  const entities: Entity[] = [];
  const visit = (link: S["Link"], fromSection: boolean) => {
    if (link.type === "TAX") return;
    const k = key(link.type, link.id);
    const entity = s.entities.get(k);
    if (!entity) return;
    if (fromSection && isItem(entity)) products.add(k);
    if (seen.has(k)) return;
    seen.add(k);
    entities.push(entity);
    for (const next of entity.links) visit(next, entity.type === "CATEGORY");
    if (isItem(entity)) for (const id of entity.crossSellIds ?? []) visitProduct(id);
  };
  const visitProduct = (id: string) => {
    for (const type of ["ITEM", "SIZED_ITEM", "COMBO_MEAL"] as const) {
      if (s.entities.has(key(type, id))) visit({ type, id }, true);
    }
  };
  for (const link of active.menu.root) visit(link, true);

  return {
    root: active.menu.root.filter((l) => s.entities.has(key(l.type, l.id))),
    entities: entities.map((entity) => {
      const out = resolve(entity, language);
      out.links = out.links.filter((l) => l.type !== "TAX");
      if (out.type === "CATEGORY" && out.availableHours?.length && !withinHours(out.availableHours, at)) {
        out.available = false;
      }
      if (isItem(out) && products.has(key(out.type, out.id)) && needsFrom(entity)) {
        out.displayPrice = toBrl(displayPriceCents(entity));
      }
      return out;
    }),
    menuId: active.menu.id,
    validUntil: active.until.toISOString(),
    badges: s.badges.map(({ translations, ...badge }) => ({
      ...badge,
      name: (language === "en" && translations?.en?.name) || badge.name,
    })),
  };
}

// ------------------------------------------------------------------ validator

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const ALLOWED: Record<string, readonly string[]> = {
  CATEGORY: ["CATEGORY", "ITEM", "SIZED_ITEM", "COMBO_MEAL", "IMAGE"],
  ITEM: ["MODIFIERS", "IMAGE", "TAX", "SWAP_SELL"],
  SIZED_ITEM: ["ITEM", "SIZED_ITEM", "MODIFIERS", "IMAGE", "TAX", "SWAP_SELL"],
  COMBO_MEAL: ["MODIFIERS", "COMBO_MAIN", "COMBO_SIDE", "IMAGE", "TAX", "SWAP_SELL"],
  MODIFIERS: ["ITEM", "SIZED_ITEM", "IMAGE"],
  COMBO_MAIN: ["ITEM", "SIZED_ITEM", "IMAGE"],
  COMBO_SIDE: ["ITEM", "SIZED_ITEM", "IMAGE"],
  SWAP_SELL: ["ITEM", "SIZED_ITEM"],
  IMAGE: [],
  TAX: [],
};

/** Every rule the saved catalogue breaks; empty when it is sound. */
export function validateCatalogue(
  entities: Map<string, Entity>,
  menus: MockMenuV2[],
  badges: S["Badge"][],
): MenuError[] {
  const errors: MenuError[] = [];
  const err = (entity: S["Link"], rule: MenuError["rule"], field: string, message: string) =>
    errors.push({ entity: { type: entity.type, id: entity.id }, rule, field, message });
  const productIds = new Map<string, string>();

  for (const e of entities.values()) {
    const self = { type: e.type, id: e.id };
    if (!ID.test(e.id)) err(self, "INVALID_ID", "id", `${e.type} id "${e.id}" is not allowed`);
    if (isItem(e)) {
      const other = productIds.get(e.id);
      if (other && other !== e.type) err(self, "DUPLICATE_PRODUCT_ID", "id", `${e.id} is also a ${other}`);
      productIds.set(e.id, e.type);
      for (const id of e.badgeIds ?? []) {
        if (!badges.some((b) => b.id === id)) err(self, "MISSING_LINK", "badgeIds", `badge ${id} does not exist`);
      }
      for (const id of e.crossSellIds ?? []) {
        if (!["ITEM", "SIZED_ITEM", "COMBO_MEAL"].some((t) => entities.has(key(t, id)))) {
          err(self, "MISSING_LINK", "crossSellIds", `product ${id} does not exist`);
        }
      }
    }
    e.links.forEach((l, i) => {
      if (!entities.has(key(l.type, l.id))) {
        err(self, "MISSING_LINK", `links[${i}]`, `${l.type} ${l.id} does not exist`);
      } else if (!(ALLOWED[e.type] ?? []).includes(l.type)) {
        err(self, "LINK_NOT_ALLOWED", `links[${i}]`, `${e.type} cannot link ${l.type}`);
      }
    });
    const options = e.links.filter((l) => l.type === "ITEM" || l.type === "SIZED_ITEM");
    if (isGroup(e) && options.length === 0) err(self, "EMPTY_GROUP", "links", `${e.name} has no options`);
    if (e.type === "SWAP_SELL" && options.length === 0) err(self, "EMPTY_SWAP_SELL", "links", `${e.name} has no items`);
    if (e.type === "COMBO_MEAL") {
      const mains = e.links.filter((l) => l.type === "COMBO_MAIN").length;
      const sides = e.links.filter((l) => l.type === "COMBO_SIDE").length;
      if (mains !== 1 || sides < 1) err(self, "COMBO_INCOMPLETE", "links", "needs one COMBO_MAIN and a COMBO_SIDE");
    }
    // An option may sit in only one group of the same parent (Go finds a line's group from it).
    const seenOptions = new Set<string>();
    for (const l of e.links) {
      const group = entities.get(key(l.type, l.id));
      if (!isGroup(group)) continue;
      for (const o of group.links) {
        if (o.type === "IMAGE") continue;
        const k = key(o.type, o.id);
        if (seenOptions.has(k)) err(self, "LINK_NOT_ALLOWED", "links", `${o.id} is in two groups of ${e.id}`);
        seenOptions.add(k);
      }
    }
  }

  // Loops: a link back to an entity still on the current path.
  const state = new Map<string, "open" | "done">();
  const walk = (k: string) => {
    state.set(k, "open");
    const e = entities.get(k)!;
    for (const l of e.links) {
      const next = key(l.type, l.id);
      if (!entities.has(next)) continue;
      if (state.get(next) === "open") err({ type: e.type, id: e.id }, "LOOP", "links", `${l.type} ${l.id} leads back to itself`);
      else if (!state.has(next)) walk(next);
    }
    state.set(k, "done");
  };
  for (const k of entities.keys()) if (!state.has(k)) walk(k);

  for (const m of menus) {
    m.root.forEach((l, i) => {
      if (!entities.has(key(l.type, l.id))) err(l, "MISSING_LINK", `menus[${m.id}].root[${i}]`, `${l.type} ${l.id} does not exist`);
    });
  }
  return errors;
}
