// Back-office catalogue: categories, items and the category ↔ item links
// (with a price per menu). The kiosk menu is resolved from the same state.

import { randomBytes } from "node:crypto";

import { notFound, ok, problem, type Route, type Schemas } from "./http.ts";
import { owner } from "./routes-admin.ts";
import { today } from "./routes-kiosk.ts";
import { state } from "./state.ts";

const newId = (prefix: string) => `${prefix}-${randomBytes(3).toString("hex")}`;
const catalogue = () => state.catalogue;
const invalid = (field: string) => problem(422, "VALIDATION_FAILED", "Validation failed", field);

type StoredCategory = (typeof state.catalogue.categories)[number];

/**
 * AdminCategory plus its item links. `items` is not in the contract (it has
 * no read for the links); proposed addition, see docs/backlog-pending.md.
 */
function adminCategory(category: StoredCategory): Schemas["AdminCategory"] & {
  items: Schemas["CategoryItemLink"][];
} {
  return { ...category };
}

function categoryProblem(input: Partial<Schemas["CategoryInput"]> | null): string | null {
  if (!input?.name?.["pt-BR"]?.trim()) return "name";
  if (!state.menus.some((m) => m.id === input.menuId)) return "menuId";
  if (!Number.isInteger(input.displayOrder)) return "displayOrder";
  if (input.parentId && !catalogue().categories.some((c) => c.id === input.parentId)) {
    return "parentId";
  }
  return null;
}

function itemProblem(input: Partial<Schemas["ItemInput"]> | null): string | null {
  if (!input?.name?.["pt-BR"]?.trim()) return "name";
  if (!Number.isInteger(input.price) || input.price! < 0) return "price";
  const availability = input.serviceAvailability;
  if (typeof availability?.DINEIN !== "boolean" || typeof availability.TAKE_OUT !== "boolean") {
    return "serviceAvailability";
  }
  const group = input.crossSellGroupId;
  if (group && !catalogue().crossSellGroups.some((g) => g.id === group)) return "crossSellGroupId";
  return null;
}

/** The item as stored: ItemInput's fields, plus id and soldOutDate. */
function storedItem(
  input: Schemas["ItemInput"],
  id: string,
  soldOutDate: string | null,
): Schemas["AdminItem"] {
  return {
    id,
    soldOutDate,
    plu: input.plu ?? null,
    name: input.name,
    shortName: input.shortName,
    description: input.description,
    image: input.image ?? null,
    price: input.price,
    servicePriceOverride: input.servicePriceOverride ?? {},
    serviceAvailability: input.serviceAvailability,
    calories: input.calories ?? null,
    itemLabels: input.itemLabels ?? [],
    defaultEntity: input.defaultEntity ?? null,
    crossSellGroupId: input.crossSellGroupId ?? null,
    fiscal: input.fiscal ?? null,
  };
}

export const catalogueRoutes: Route[] = [
  [
    "GET",
    /^\/v1\/admin\/categories$/,
    owner((req) => {
      const menuId = req.query.get("menuId");
      return ok(
        catalogue()
          .categories.filter((c) => !menuId || c.menuId === menuId)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(adminCategory),
      );
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/categories$/,
    owner((req) => {
      const input = req.body as Schemas["CategoryInput"];
      const bad = categoryProblem(input);
      if (bad) return invalid(bad);
      const category: StoredCategory = {
        id: newId("cat"),
        menuId: input.menuId,
        parentId: input.parentId ?? null,
        name: input.name,
        image: input.image ?? null,
        displayOrder: input.displayOrder,
        items: [],
      };
      catalogue().categories.push(category);
      return ok(adminCategory(category), 201);
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/categories\/([^/]+)$/,
    owner((req, [categoryId]) => {
      const category = catalogue().categories.find((c) => c.id === categoryId);
      if (!category) return notFound();
      const input = req.body as Schemas["CategoryInput"];
      const bad = categoryProblem(input);
      if (bad) return invalid(bad);
      Object.assign(category, {
        menuId: input.menuId,
        parentId: input.parentId ?? null,
        name: input.name,
        image: input.image ?? null,
        displayOrder: input.displayOrder,
      });
      return ok(adminCategory(category));
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/categories\/([^/]+)$/,
    owner((_req, [categoryId]) => {
      if (!catalogue().categories.some((c) => c.id === categoryId)) return notFound();
      catalogue().categories = catalogue().categories.filter(
        (c) => c.id !== categoryId && c.parentId !== categoryId,
      );
      return { status: 204 };
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/categories\/([^/]+)\/items$/,
    owner((req, [categoryId]) => {
      const category = catalogue().categories.find((c) => c.id === categoryId);
      if (!category) return notFound();
      const links = req.body as Schemas["CategoryItemLink"][];
      if (!Array.isArray(links)) return invalid("body");
      const bad = links.findIndex(
        (l) =>
          !catalogue().items.some((i) => i.id === l.itemId) ||
          !Number.isInteger(l.displayOrder) ||
          (l.priceOverride != null && (!Number.isInteger(l.priceOverride) || l.priceOverride < 0)),
      );
      if (bad !== -1) return invalid(`[${bad}]`);
      if (new Set(links.map((l) => l.itemId)).size !== links.length)
        return invalid("itemId repeated");
      category.items = links.map(({ itemId, displayOrder, priceOverride }) => ({
        itemId,
        displayOrder,
        priceOverride: priceOverride ?? null,
      }));
      return ok(category.items);
    }),
  ],
  ["GET", /^\/v1\/admin\/items$/, owner(() => ok(catalogue().items))],
  [
    "POST",
    /^\/v1\/admin\/items$/,
    owner((req) => {
      const input = req.body as Schemas["ItemInput"];
      const bad = itemProblem(input);
      if (bad) return invalid(bad);
      const item = storedItem(input, newId("itm"), null);
      catalogue().items.push(item);
      return ok(item, 201);
    }),
  ],
  [
    "GET",
    /^\/v1\/admin\/items\/([^/]+)$/,
    owner((_req, [itemId]) => {
      const item = catalogue().items.find((i) => i.id === itemId);
      return item ? ok(item) : notFound();
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/items\/([^/]+)$/,
    owner((req, [itemId]) => {
      const index = catalogue().items.findIndex((i) => i.id === itemId);
      if (index === -1) return notFound();
      const input = req.body as Schemas["ItemInput"];
      const bad = itemProblem(input);
      if (bad) return invalid(bad);
      const item = storedItem(input, itemId, catalogue().items[index].soldOutDate);
      catalogue().items[index] = item;
      return ok(item);
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/items\/([^/]+)$/,
    owner((_req, [itemId]) => {
      const c = catalogue();
      if (!c.items.some((i) => i.id === itemId)) return notFound();
      c.items = c.items.filter((i) => i.id !== itemId);
      for (const category of c.categories) {
        category.items = category.items.filter((l) => l.itemId !== itemId);
      }
      c.optionGroups = c.optionGroups.filter((g) => g.itemId !== itemId);
      for (const group of c.crossSellGroups) {
        group.crossSells = group.crossSells.filter((id) => id !== itemId);
      }
      return { status: 204 };
    }),
  ],
];

catalogueRoutes.push([
  "GET",
  /^\/v1\/admin\/cross-sells$/,
  owner(() => ok(catalogue().crossSellGroups)),
]);

catalogueRoutes.push(
  [
    "POST",
    /^\/v1\/admin\/items\/([^/]+)\/sold-out$/,
    owner((_req, [itemId]) => {
      const item = catalogue().items.find((i) => i.id === itemId);
      if (!item) return notFound();
      // Sold out for today's business date: back by itself tomorrow.
      item.soldOutDate = today();
      return ok(item);
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/items\/([^/]+)\/sold-out$/,
    owner((_req, [itemId]) => {
      const item = catalogue().items.find((i) => i.id === itemId);
      if (!item) return notFound();
      item.soldOutDate = null;
      return ok(item);
    }),
  ],
);

const HEX = /^#[0-9a-fA-F]{6}$/;
const PAGES = new Set(["ITEM_MENU", "ITEM_PAGE", "BASKET"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function tagProblem(input: Partial<Schemas["TagInput"]> | null): string | null {
  if (!input?.badgeName?.["pt-BR"]?.trim()) return "badgeName";
  if (!HEX.test(input.textColour ?? "")) return "textColour";
  if (!HEX.test(input.backgroundColour ?? "")) return "backgroundColour";
  if (!Array.isArray(input.tagsPages) || input.tagsPages.some((p) => !PAGES.has(p)))
    return "tagsPages";
  if (typeof input.scheduleEnabled !== "boolean") return "scheduleEnabled";
  if (input.startDate && !DATE.test(input.startDate)) return "startDate";
  if (input.endDate && !DATE.test(input.endDate)) return "endDate";
  if (!Array.isArray(input.links)) return "links";
  const bad = input.links.findIndex(
    (l) =>
      (l.menuItemId && !catalogue().items.some((i) => i.id === l.menuItemId)) ||
      (l.categoryId && !catalogue().categories.some((c) => c.id === l.categoryId)),
  );
  return bad === -1 ? null : `links[${bad}]`;
}

function crossSellProblem(input: Partial<Schemas["CrossSellGroupInput"]> | null): string | null {
  if (!input?.name?.["pt-BR"]?.trim()) return "name";
  if (!Array.isArray(input.crossSells)) return "crossSells";
  const bad = input.crossSells.findIndex((id) => !catalogue().items.some((i) => i.id === id));
  return bad === -1 ? null : `crossSells[${bad}]`;
}

const tagOf = (input: Schemas["TagInput"], id: string): Schemas["AdminTag"] => ({
  id,
  badgeName: input.badgeName,
  textColour: input.textColour,
  backgroundColour: input.backgroundColour,
  tagsPages: input.tagsPages,
  scheduleEnabled: input.scheduleEnabled,
  startDate: input.startDate ?? null,
  endDate: input.endDate ?? null,
  links: input.links.map((l) => ({
    menuItemId: l.menuItemId ?? null,
    categoryId: l.categoryId ?? null,
    enabled: l.enabled,
  })),
});

catalogueRoutes.push(
  ["GET", /^\/v1\/admin\/tags$/, owner(() => ok(catalogue().tags))],
  [
    "POST",
    /^\/v1\/admin\/tags$/,
    owner((req) => {
      const input = req.body as Schemas["TagInput"];
      const bad = tagProblem(input);
      if (bad) return invalid(bad);
      const tag = tagOf(input, newId("tag"));
      catalogue().tags.push(tag);
      return ok(tag, 201);
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/tags\/([^/]+)$/,
    owner((req, [tagId]) => {
      const index = catalogue().tags.findIndex((t) => t.id === tagId);
      if (index === -1) return notFound();
      const input = req.body as Schemas["TagInput"];
      const bad = tagProblem(input);
      if (bad) return invalid(bad);
      catalogue().tags[index] = tagOf(input, tagId);
      return ok(catalogue().tags[index]);
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/tags\/([^/]+)$/,
    owner((_req, [tagId]) => {
      if (!catalogue().tags.some((t) => t.id === tagId)) return notFound();
      catalogue().tags = catalogue().tags.filter((t) => t.id !== tagId);
      return { status: 204 };
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/cross-sells$/,
    owner((req) => {
      const input = req.body as Schemas["CrossSellGroupInput"];
      const bad = crossSellProblem(input);
      if (bad) return invalid(bad);
      const group = { id: newId("xs"), name: input.name, crossSells: input.crossSells };
      catalogue().crossSellGroups.push(group);
      return ok(group, 201);
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/cross-sells\/([^/]+)$/,
    owner((req, [groupId]) => {
      const group = catalogue().crossSellGroups.find((g) => g.id === groupId);
      if (!group) return notFound();
      const input = req.body as Schemas["CrossSellGroupInput"];
      const bad = crossSellProblem(input);
      if (bad) return invalid(bad);
      Object.assign(group, { name: input.name, crossSells: input.crossSells });
      return ok(group);
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/cross-sells\/([^/]+)$/,
    owner((_req, [groupId]) => {
      if (!catalogue().crossSellGroups.some((g) => g.id === groupId)) return notFound();
      catalogue().crossSellGroups = catalogue().crossSellGroups.filter((g) => g.id !== groupId);
      for (const item of catalogue().items) {
        if (item.crossSellGroupId === groupId) item.crossSellGroupId = null;
      }
      return { status: 204 };
    }),
  ],
);

function discountProblem(input: Partial<Schemas["DiscountInput"]> | null): string | null {
  if (input?.type !== "COMANDA_COUPON" && input?.type !== "RESTAURANT_DISCOUNT") return "type";
  if (!/^[A-Z0-9]{3,20}$/.test(input.code ?? "")) return "code";
  if (!input.title?.["pt-BR"]?.trim()) return "title";
  if (input.kind !== "PERCENT" && input.kind !== "FIXED") return "kind";
  const value = input.value ?? 0;
  if (!Number.isInteger(value) || value < 1 || (input.kind === "PERCENT" && value > 100))
    return "value";
  for (const field of ["validFrom", "validTo"] as const) {
    const at = input[field];
    if (at && Number.isNaN(Date.parse(at))) return field;
  }
  if (
    input.validFrom &&
    input.validTo &&
    Date.parse(input.validTo) <= Date.parse(input.validFrom)
  ) {
    return "validTo";
  }
  if (typeof input.active !== "boolean") return "active";
  return null;
}

const codeTaken = (code: string, except?: string) =>
  catalogue().discounts.some((d) => d.id !== except && d.code.toUpperCase() === code.toUpperCase());

const discountOf = (input: Schemas["DiscountInput"], id: string): Schemas["AdminDiscount"] => ({
  id,
  type: input.type,
  code: input.code,
  title: input.title,
  ...(input.description ? { description: input.description } : {}),
  kind: input.kind,
  value: input.value,
  validFrom: input.validFrom ?? null,
  validTo: input.validTo ?? null,
  active: input.active,
});

catalogueRoutes.push(
  ["GET", /^\/v1\/admin\/discounts$/, owner(() => ok(catalogue().discounts))],
  [
    "POST",
    /^\/v1\/admin\/discounts$/,
    owner((req) => {
      const input = req.body as Schemas["DiscountInput"];
      const bad = discountProblem(input);
      if (bad) return invalid(bad);
      if (codeTaken(input.code)) {
        return problem(409, "DISCOUNT_CODE_TAKEN", "Code already used by another discount");
      }
      const discount = discountOf(input, newId("dsc"));
      catalogue().discounts.push(discount);
      return ok(discount, 201);
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/discounts\/([^/]+)$/,
    owner((req, [discountId]) => {
      const index = catalogue().discounts.findIndex((d) => d.id === discountId);
      if (index === -1) return notFound();
      const input = req.body as Schemas["DiscountInput"];
      const bad = discountProblem(input);
      if (bad) return invalid(bad);
      if (codeTaken(input.code, discountId)) {
        return problem(409, "DISCOUNT_CODE_TAKEN", "Code already used by another discount");
      }
      catalogue().discounts[index] = discountOf(input, discountId);
      return ok(catalogue().discounts[index]);
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/discounts\/([^/]+)$/,
    owner((_req, [discountId]) => {
      if (!catalogue().discounts.some((d) => d.id === discountId)) return notFound();
      catalogue().discounts = catalogue().discounts.filter((d) => d.id !== discountId);
      return { status: 204 };
    }),
  ],
);
