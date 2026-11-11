import type { components } from "@/lib/core-api";

// Reads the v2 menu graph (MODELS 5: flat `entities`, `links` between them,
// `root` in display order) into the tree the kiosk screens walk. Pure and
// defensive: a link to a missing entity, a group with no options, a swap sell
// with nothing to swap to, or a loop is skipped, so a graph edited by hand in
// the database never crashes or hangs the kiosk (pilot Review Focus 3).
// Prices are copied as Core sent them; the kiosk never computes one.

type Schemas = components["schemas"];
export type MenuResponse = Schemas["MenuResponse"];
type Entity = Schemas["PosEntity"];
type Link = Schemas["Link"];
type ItemEntity = Schemas["PosEntityItem"] | Schemas["PosEntityComboMeal"];
type GroupEntity = Schemas["PosEntityModifier"];
type SectionEntity = Schemas["PosEntitySection"];
export type Allergen = Schemas["Allergen"];
export type ModifierType = Schemas["ModifierType"];
export type Badge = Schemas["Badge"];

export type ProductType = "ITEM" | "SIZED_ITEM" | "COMBO_MEAL";
export type Picture = { url: string; alt: string | null };

export type MenuOption = {
  id: string;
  type: "ITEM" | "SIZED_ITEM";
  name: string;
  /** The name in the kitchen's language, whatever the guest's (see `kitchenNames`). */
  kitchenName: string;
  /** The extra this option adds (`0` when free), as Core sent it. */
  price: number;
  available: boolean;
  defaultQuantity: number;
  minChoices: number;
  maxChoices: number;
  groups: MenuGroup[];
};

export type MenuGroup = {
  /** Path inside its product ("1001/M-EXTRAS/X-SAUCE/M-SAUCE"): unique even when a group is linked twice. */
  key: string;
  id: string;
  /** SIZE is the group Go makes from a SIZED_ITEM's sizes (contract PosEntityItem). */
  kind: "MODIFIERS" | "COMBO_MAIN" | "COMBO_SIDE" | "SIZE";
  name: string;
  modifierType: ModifierType | null;
  min: number;
  /** `0` means no limit. */
  max: number;
  options: MenuOption[];
};

export type Product = {
  id: string;
  type: ProductType;
  name: string;
  description: string | null;
  /** `dineInPriceOverride ?? price` (every pilot order is dine-in). */
  price: number;
  /** "A partir de R$ X", computed by Go for sizes and required choices. */
  displayPrice: number | null;
  available: boolean;
  picture: Picture | null;
  allergens: Allergen[];
  allergenTraces: Allergen[];
  allergensDeclared: boolean;
  calories: string | null;
  badges: Badge[];
  crossSellIds: string[];
  swapSell: { name: string; productIds: string[] } | null;
  groups: MenuGroup[];
};

export type Section = {
  id: string;
  name: string;
  description: string | null;
  picture: Picture | null;
  products: Product[];
  sections: Section[];
};

export type KioskMenu = {
  menuId: string;
  validUntil: string | null;
  sections: Section[];
  /** Every product reachable from the menu (sections, swap sells, cross-sells), by id. */
  products: Record<string, Product>;
};

const PRODUCT_TYPES: readonly string[] = ["ITEM", "SIZED_ITEM", "COMBO_MEAL"];
const GROUP_TYPES: readonly string[] = ["MODIFIERS", "COMBO_MAIN", "COMBO_SIDE"];
const OPTION_TYPES: readonly string[] = ["ITEM", "SIZED_ITEM"];

const isItem = (e: Entity | undefined): e is ItemEntity => !!e && PRODUCT_TYPES.includes(e.type);
const isGroup = (e: Entity | undefined): e is GroupEntity => !!e && GROUP_TYPES.includes(e.type);
const isSection = (e: Entity | undefined): e is SectionEntity => !!e && e.type === "CATEGORY";

const keyOf = (link: Pick<Link, "type" | "id">) => `${link.type}:${link.id}`;

/**
 * The ingredient options (`INGR` groups) of a menu, id → name. Read from the
 * pt-BR menu, it gives a guest in another language the names the kitchen reads.
 */
export function kitchenNames(menu: MenuResponse): Record<string, string> {
  const items = new Map(menu.entities.filter(isItem).map((e) => [e.id, e.name]));
  const names: Record<string, string> = {};
  for (const group of menu.entities.filter(isGroup)) {
    if (group.modifierType !== "INGR") continue;
    for (const link of group.links) {
      const name = items.get(link.id);
      if (name !== undefined) names[link.id] = name;
    }
  }
  return names;
}

export function readMenu(menu: MenuResponse, kitchen: Record<string, string> = {}): KioskMenu {
  const index = new Map<string, Entity>(menu.entities.map((e) => [keyOf(e), e]));
  const badges = new Map(menu.badges.map((b) => [b.id, b]));
  const products: Record<string, Product> = {};

  const get = (link: Link) => index.get(keyOf(link));
  const pictureOf = (entity: Entity): Picture | null => {
    for (const link of entity.links) {
      const image = get(link);
      if (image?.type === "IMAGE" && "url" in image) return { url: image.url, alt: image.altText ?? null };
    }
    return null;
  };
  const productById = (id: string): ItemEntity | undefined =>
    PRODUCT_TYPES.map((type) => index.get(`${type}:${id}`)).find(isItem);

  /** Options of a group (or the sizes of a sized item), skipping missing and looping links. */
  function readOptions(links: Link[], path: string, visiting: Set<string>): MenuOption[] {
    return links.flatMap((link) => {
      if (!OPTION_TYPES.includes(link.type)) return [];
      const entity = get(link);
      if (!isItem(entity) || visiting.has(keyOf(link))) return [];
      const inside = new Set(visiting).add(keyOf(link));
      return [
        {
          id: entity.id,
          type: entity.type as MenuOption["type"],
          name: entity.name,
          kitchenName: kitchen[entity.id] ?? entity.name,
          price: entity.dineInPriceOverride ?? entity.price,
          available: entity.available,
          defaultQuantity: entity.defaultQuantity ?? 0,
          minChoices: entity.minChoices ?? 0,
          maxChoices: entity.maxChoices ?? 1,
          groups: readGroups(entity, `${path}/${entity.id}`, inside),
        },
      ];
    });
  }

  /** The groups an item offers: its size group first, then linked groups (SIZE type first). */
  function readGroups(entity: ItemEntity, path: string, visiting: Set<string>): MenuGroup[] {
    const groups: MenuGroup[] = [];
    if (entity.type === "SIZED_ITEM") {
      const id = `${entity.id}-SIZE`;
      const options = readOptions(entity.links, `${path}/${id}`, visiting);
      if (options.length > 0) {
        groups.push({ key: `${path}/${id}`, id, kind: "SIZE", name: entity.name, modifierType: "SIZE", min: 1, max: 1, options });
      }
    }
    const linked = entity.links.flatMap((link): MenuGroup[] => {
      const group = get(link);
      if (!isGroup(group) || visiting.has(keyOf(link))) return [];
      const key = `${path}/${group.id}`;
      const options = readOptions(group.links, key, new Set(visiting).add(keyOf(link)));
      if (options.length === 0) return [];
      return [
        {
          key,
          id: group.id,
          kind: group.type as MenuGroup["kind"],
          name: group.name,
          modifierType: group.modifierType ?? null,
          min: group.min,
          max: group.max,
          options,
        },
      ];
    });
    const sizesFirst = [...linked].sort(
      (a, b) => Number(b.modifierType === "SIZE") - Number(a.modifierType === "SIZE"),
    );
    return [...groups, ...sizesFirst];
  }

  function readProduct(entity: ItemEntity): Product {
    const cached = products[entity.id];
    if (cached) return cached;
    const swap = entity.links.map(get).find((e) => e?.type === "SWAP_SELL");
    const swapIds = (swap?.links ?? [])
      .filter((l) => OPTION_TYPES.includes(l.type) && isItem(get(l)))
      .map((l) => l.id);
    const product: Product = {
      id: entity.id,
      type: entity.type as ProductType,
      name: entity.name,
      description: entity.description ?? null,
      price: entity.dineInPriceOverride ?? entity.price,
      displayPrice: entity.displayPrice ?? null,
      available: entity.available,
      picture: pictureOf(entity),
      allergens: entity.allergens ?? [],
      allergenTraces: entity.allergenTraces ?? [],
      allergensDeclared: entity.allergensDeclared ?? false,
      calories: entity.calories ?? null,
      badges: (entity.badgeIds ?? []).flatMap((id) => badges.get(id) ?? []),
      crossSellIds: (entity.crossSellIds ?? []).filter((id) => productById(id)),
      swapSell: swap && swapIds.length > 0 ? { name: swap.name, productIds: swapIds } : null,
      groups: readGroups(entity, entity.id, new Set([keyOf(entity)])),
    };
    products[entity.id] = product;
    // Swap targets and cross-sells must be findable even when no section lists them.
    for (const id of [...swapIds, ...product.crossSellIds]) {
      const target = productById(id);
      if (target) readProduct(target);
    }
    return product;
  }

  function readSection(entity: SectionEntity, visiting: Set<string>): Section | null {
    if (entity.available === false) return null;
    const inside = new Set(visiting).add(keyOf(entity));
    const sections: Section[] = [];
    const list: Product[] = [];
    for (const link of entity.links) {
      if (visiting.has(keyOf(link)) || keyOf(link) === keyOf(entity)) continue;
      const child = get(link);
      if (isSection(child)) {
        const section = readSection(child, inside);
        if (section) sections.push(section);
      } else if (isItem(child)) {
        list.push(readProduct(child));
      }
    }
    if (list.length === 0 && sections.length === 0) return null;
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? null,
      picture: pictureOf(entity),
      products: list,
      sections,
    };
  }

  const sections = menu.root.flatMap((link) => {
    const entity = get(link);
    const section = isSection(entity) ? readSection(entity, new Set()) : null;
    return section ? [section] : [];
  });
  return { menuId: menu.menuId, validUntil: menu.validUntil ?? null, sections, products };
}

export const findProduct = (menu: KioskMenu, id: string): Product | undefined => menu.products[id];

/** The guest-facing name of a product or option id (Core names it in `detail`), or null. */
export function nameOf(menu: KioskMenu, id: string): string | null {
  const product = menu.products[id];
  if (product) return product.name;
  const walk = (groups: MenuGroup[]): string | null => {
    for (const group of groups) {
      for (const option of group.options) {
        if (option.id === id) return option.name;
        const nested = walk(option.groups);
        if (nested) return nested;
      }
    }
    return null;
  };
  for (const p of Object.values(menu.products)) {
    const found = walk(p.groups);
    if (found) return found;
  }
  return null;
}
