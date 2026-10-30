import type { components } from "@/lib/core-api";

// Display helpers over the menu the kiosk loaded at journey start. The prices
// here are only what the screens show; every total the guest pays comes from
// the Core API (quotes and orders), which reprices from ids.

type Schemas = components["schemas"];
export type Menu = Schemas["Menu"];
export type MenuEntity = Schemas["MenuEntity"];
export type OptionGroup = Schemas["OptionGroup"];
export type Option = Schemas["Option"];
export type OrderType = Schemas["OrderType"];
export type TagsPage = Schemas["TagsPage"];
export type LineOptionInput = Schemas["OrderLineOptionInput"];
export type BasketLine = Schemas["OrderLineInput"];

const byOrder = <T extends { displayOrder: number }>(list: T[]) =>
  [...list].sort((a, b) => a.displayOrder - b.displayOrder);

const availableFor = (entity: MenuEntity, orderType: OrderType) =>
  entity.serviceAvailability?.[orderType] ?? true;

/**
 * The menu as one order type sees it (F-MENU-01): items not served for it
 * removed, empty categories removed, every level sorted by displayOrder.
 */
export function filterMenu(menu: Menu, orderType: OrderType): Menu {
  const filterEntities = (entities: MenuEntity[]): MenuEntity[] =>
    byOrder(entities).flatMap((entity) => {
      if (entity.type === "ITEM") return availableFor(entity, orderType) ? [entity] : [];
      const childEntities = filterEntities(entity.childEntities);
      return childEntities.length > 0 ? [{ ...entity, childEntities }] : [];
    });
  return { ...menu, entities: filterEntities(menu.entities) };
}

/** Every item in the menu, with the category it was found in. */
export function* menuItems(menu: Menu): Generator<{ item: MenuEntity; categoryId: string }> {
  function* walk(
    entities: MenuEntity[],
    categoryId: string,
  ): Generator<{ item: MenuEntity; categoryId: string }> {
    for (const entity of entities) {
      if (entity.type === "ITEM") yield { item: entity, categoryId };
      else yield* walk(entity.childEntities, entity.id);
    }
  }
  yield* walk(menu.entities, "");
}

export function findItem(menu: Menu, itemId: string): MenuEntity | undefined {
  for (const { item } of menuItems(menu)) if (item.id === itemId) return item;
  return undefined;
}

/** The item's own price for the order type (`servicePriceOverride` wins). */
export function itemPrice(item: MenuEntity, orderType: OrderType): number {
  return item.servicePriceOverride?.[orderType] ?? item.price ?? 0;
}

export function optionPrice(option: Option, orderType: OrderType): number {
  return option.servicePriceOverride?.[orderType] ?? option.price;
}

/** Groups the guest picks from on the item screen (not COMBO_MAIN, which has its own flow). */
export const isPickGroup = (group: OptionGroup) => group.role !== "COMBO_MAIN";

/**
 * Price shown on a menu cell (F-MENU-03): the item plus the cheapest picks
 * its required groups force, so "from" prices never undersell.
 */
export function cellPrice(item: MenuEntity, orderType: OrderType): number {
  let price = itemPrice(item, orderType);
  for (const group of item.optionGroups ?? []) {
    if (!isPickGroup(group) || group.minimum === 0) continue;
    const cheapest = group.options.map((o) => optionPrice(o, orderType)).sort((a, b) => a - b);
    price += cheapest.slice(0, group.minimum).reduce((sum, p) => sum + p, 0);
  }
  return price;
}

/** Display price of one unit of a line: item plus its chosen options, recursively. */
export function unitPrice(
  item: MenuEntity,
  options: LineOptionInput[],
  orderType: OrderType,
): number {
  const lookup = new Map<string, Option>();
  const collect = (groups: OptionGroup[] | undefined) => {
    for (const group of groups ?? []) {
      for (const option of group.options) {
        lookup.set(option.id, option);
        collect(option.optionGroups);
      }
      for (const composite of group.compositeOptions) {
        lookup.set(composite.positiveOption.id, composite.positiveOption);
        lookup.set(composite.negativeOption.id, composite.negativeOption);
      }
    }
  };
  collect(item.optionGroups);
  const sum = (inputs: LineOptionInput[]): number =>
    inputs.reduce((total, input) => {
      const option = lookup.get(input.optionId);
      const own = option ? optionPrice(option, orderType) : 0;
      return total + (own + sum(input.options ?? [])) * input.quantity;
    }, 0);
  return itemPrice(item, orderType) + sum(options);
}

/** Option names of a line for its summary ("Brioche, ovo pochê"), negatives included. */
export function optionNames(item: MenuEntity, options: LineOptionInput[]): string[] {
  const names = new Map<string, string>();
  const collect = (groups: OptionGroup[] | undefined) => {
    for (const group of groups ?? []) {
      for (const option of group.options) {
        names.set(option.id, option.name);
        collect(option.optionGroups);
      }
      for (const composite of group.compositeOptions) {
        names.set(composite.negativeOption.id, composite.negativeOption.name);
      }
    }
  };
  collect(item.optionGroups);
  const walk = (inputs: LineOptionInput[]): string[] =>
    inputs.flatMap((input) => {
      const name = names.get(input.optionId);
      const own = name ? [input.quantity > 1 ? `${input.quantity}× ${name}` : name] : [];
      return [...own, ...walk(input.options ?? [])];
    });
  return walk(options);
}

/** Units in the basket (the bar's "3 itens"). */
export const basketUnits = (lines: BasketLine[]) => lines.reduce((n, line) => n + line.quantity, 0);

/** Display total of the basket before the Core API's quote arrives. */
export function basketDisplayTotal(menu: Menu, lines: BasketLine[], orderType: OrderType): number {
  return lines.reduce((total, line) => {
    const item = findItem(menu, line.itemId);
    return item ? total + unitPrice(item, line.options, orderType) * line.quantity : total;
  }, 0);
}

export type Badge = { id: string; label: string; textColour: string; backgroundColour: string };

/** Owner badges (customizedItemTags, F-MENU-05) for an item on a page. */
export function badgesFor(
  menu: Menu,
  item: { id: string; categoryId?: string },
  page: TagsPage,
): Badge[] {
  return menu.customizedItemTags
    .filter((tag) => tag.tagsPages.length === 0 || tag.tagsPages.includes(page))
    .filter((tag) =>
      tag.items.some(
        (link) =>
          link.enabled &&
          (link.menuItemId === item.id || (item.categoryId && link.categoryId === item.categoryId)),
      ),
    )
    .map((tag) => ({
      id: tag.id,
      label: tag.badgeName,
      textColour: tag.textColour || "#A3472F",
      backgroundColour: tag.backgroundColour || "#FFFFFF",
    }));
}
