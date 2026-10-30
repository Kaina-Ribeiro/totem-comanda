// Back-office catalogue: categories, items and the category ↔ item links
// (with a price per menu). The kiosk menu is resolved from the same state.

import { randomBytes } from "node:crypto";

import { notFound, ok, problem, type Route, type Schemas } from "./http.ts";
import { owner } from "./routes-admin.ts";
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
