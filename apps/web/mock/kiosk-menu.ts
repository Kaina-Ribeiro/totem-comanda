// What the Go API does with the catalogue for the kiosk: resolve the active
// menu in one language (OP-MENU-01) and price a basket (OP-BASKET-01). Pure
// functions over the catalogue, so they are unit-tested on their own.

import type { MockDiscount, MockItem, MockOptionGroup, seedCatalogue } from "./catalogue.ts";
import type { Schemas } from "./http.ts";

type Catalogue = ReturnType<typeof seedCatalogue>;
type Language = Schemas["LanguageCode"];
type OrderType = Schemas["OrderType"];

const text = (value: Schemas["LocalizedText"] | undefined, language: Language) =>
  value ? (value[language] ?? value["pt-BR"]) : null;

const byOrder = <T extends { displayOrder: number }>(list: T[]) =>
  [...list].sort((a, b) => a.displayOrder - b.displayOrder);

const isSoldOut = (item: MockItem, today: string) => item.soldOutDate === today;

function resolveOption(
  option: Schemas["AdminOption"],
  catalogue: Catalogue,
  language: Language,
): Schemas["Option"] {
  return {
    id: option.id ?? "",
    plu: option.plu ?? null,
    name: text(option.name, language) ?? "",
    price: option.price,
    servicePriceOverride: option.servicePriceOverride ?? {},
    maximumQuantity: option.maximumQuantity,
    defaultQuantity: option.defaultQuantity,
    supersede: option.supersede,
    displayOrder: option.displayOrder,
    optionGroups: groupsOf(catalogue, { parentOptionId: option.id ?? "" }).map((g) =>
      resolveGroup(g, catalogue, language),
    ),
  };
}

function resolveGroup(
  group: MockOptionGroup,
  catalogue: Catalogue,
  language: Language,
): Schemas["OptionGroup"] {
  return {
    id: group.id,
    name: text(group.name, language) ?? "",
    role: group.role,
    minimum: group.minimum,
    maximum: group.maximum,
    defaultOption: group.defaultOption ?? null,
    displayOrder: group.displayOrder,
    options: byOrder(group.options).map((o) => resolveOption(o, catalogue, language)),
    compositeOptions: (group.compositeOptions ?? []).map((c) => ({
      type: "TOGGLE" as const,
      positiveOption: resolveOption(c.positiveOption, catalogue, language),
      negativeOption: resolveOption(c.negativeOption, catalogue, language),
      defaultChoice: c.defaultChoice ?? null,
    })),
  };
}

function groupsOf(
  catalogue: Catalogue,
  owner: { itemId: string } | { parentOptionId: string },
): MockOptionGroup[] {
  return byOrder(
    catalogue.optionGroups.filter((g) =>
      "itemId" in owner
        ? g.itemId === owner.itemId && !g.parentOptionId
        : g.parentOptionId === owner.parentOptionId,
    ),
  );
}

function resolveItem(
  item: MockItem,
  link: Schemas["CategoryItemLink"],
  catalogue: Catalogue,
  language: Language,
): Schemas["MenuEntity"] {
  return {
    id: item.id,
    type: "ITEM",
    plu: item.plu ?? null,
    name: text(item.name, language) ?? "",
    shortName: text(item.shortName, language),
    description: text(item.description, language),
    image: item.image ?? null,
    price: link.priceOverride ?? item.price,
    servicePriceOverride: item.servicePriceOverride ?? {},
    serviceAvailability: item.serviceAvailability,
    calories: item.calories ?? null,
    itemLabels: item.itemLabels ?? [],
    displayOrder: link.displayOrder,
    showFromPrice: false,
    defaultEntity: item.defaultEntity ?? null,
    crossSellGroupId: item.crossSellGroupId ?? null,
    childEntities: [],
    optionGroups: groupsOf(catalogue, { itemId: item.id }).map((g) =>
      resolveGroup(g, catalogue, language),
    ),
  };
}

const tagActive = (tag: Schemas["AdminTag"], today: string) =>
  !tag.scheduleEnabled ||
  ((!tag.startDate || tag.startDate <= today) && (!tag.endDate || today <= tag.endDate));

/** The kiosk Menu (ENT-MENU-01) for `menu`, in `language`, without today's sold-out items. */
export function resolveMenu(
  menu: { id: string; name: Schemas["LocalizedText"]; showCategoriesPrice: boolean },
  catalogue: Catalogue,
  language: Language,
  today: string,
): Schemas["Menu"] {
  const items = new Map(catalogue.items.map((i) => [i.id, i]));
  const categories = byOrder(
    catalogue.categories.filter((c) => c.menuId === menu.id && !c.parentId),
  );
  const entities = categories
    .map((category): Schemas["MenuEntity"] => ({
      id: category.id,
      type: "CATEGORY",
      plu: null,
      name: text(category.name, language) ?? "",
      image: category.image ?? null,
      displayOrder: category.displayOrder,
      childEntities: byOrder(category.items).flatMap((link) => {
        const item = items.get(link.itemId);
        return item && !isSoldOut(item, today)
          ? [resolveItem(item, link, catalogue, language)]
          : [];
      }),
    }))
    .filter((c) => c.childEntities.length > 0);

  const onMenu = new Set(entities.flatMap((c) => c.childEntities.map((i) => i.id)));
  return {
    id: menu.id,
    name: text(menu.name, language) ?? "",
    language,
    currency: "BRL",
    showCategoriesPrice: menu.showCategoriesPrice,
    entities,
    customizedItemTags: catalogue.tags
      .filter((tag) => tagActive(tag, today))
      .map((tag) => ({
        id: tag.id,
        badgeName: text(tag.badgeName, language) ?? "",
        textColour: tag.textColour,
        backgroundColour: tag.backgroundColour,
        tagsPages: tag.tagsPages,
        items: tag.links.filter((link) => link.enabled),
      })),
    crossSellGroups: catalogue.crossSellGroups.map((group) => ({
      id: group.id,
      name: text(group.name, language) ?? "",
      crossSells: group.crossSells.filter((id) => onMenu.has(id)),
    })),
  };
}

// ------------------------------------------------------------------ pricing

// No parameter properties: Node runs the mock with type stripping only.
export class PricingError extends Error {
  readonly status: number;
  readonly code: Schemas["ProblemCode"];
  readonly title: string;
  readonly detail?: string;

  constructor(status: number, code: Schemas["ProblemCode"], title: string, detail?: string) {
    super(detail ?? title);
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
  }
}

/** FR-421: the most units one basket may hold. */
export const BASKET_ITEM_LIMIT = 50;

type PricedLine = Schemas["OrderLine"];

function findItem(menuId: string, catalogue: Catalogue, itemId: string) {
  for (const category of catalogue.categories) {
    if (category.menuId !== menuId) continue;
    const link = category.items.find((l) => l.itemId === itemId);
    if (link) return { link, item: catalogue.items.find((i) => i.id === itemId) };
  }
  return undefined;
}

const priceFor = (
  base: number,
  override: Schemas["ServicePriceOverride"] | undefined,
  orderType: OrderType,
) => override?.[orderType] ?? base;

/** Prices the options picked inside `groups`, recursively; throws a PricingError when invalid. */
function priceOptions(
  inputs: Schemas["OrderLineOptionInput"][],
  groups: MockOptionGroup[],
  catalogue: Catalogue,
  orderType: OrderType,
  language: Language,
  where: string,
): { total: number; lines: Schemas["OrderLineOption"][] } {
  const lookup = new Map<string, { option: Schemas["AdminOption"]; group: MockOptionGroup }>();
  for (const group of groups) {
    for (const option of group.options) lookup.set(option.id ?? "", { option, group });
    for (const composite of group.compositeOptions ?? []) {
      lookup.set(composite.positiveOption.id ?? "", { option: composite.positiveOption, group });
      lookup.set(composite.negativeOption.id ?? "", { option: composite.negativeOption, group });
    }
  }

  const perGroup = new Map<string, number>();
  let total = 0;
  const lines: Schemas["OrderLineOption"][] = [];
  for (const input of inputs) {
    const found = lookup.get(input.optionId);
    if (!found) throw validation(`${where}: unknown option ${input.optionId}`);
    if (input.quantity > found.option.maximumQuantity) {
      throw validation(`${where}: ${input.optionId} above its maximum quantity`);
    }
    const isComposite = found.group.compositeOptions?.some(
      (c) => c.positiveOption.id === input.optionId || c.negativeOption.id === input.optionId,
    );
    if (!isComposite) {
      perGroup.set(found.group.id, (perGroup.get(found.group.id) ?? 0) + input.quantity);
    }
    const nested = priceOptions(
      input.options ?? [],
      catalogue.optionGroups.filter((g) => g.parentOptionId === input.optionId),
      catalogue,
      orderType,
      language,
      `${where}.${input.optionId}`,
    );
    const unit = priceFor(found.option.price, found.option.servicePriceOverride, orderType);
    total += unit * input.quantity + nested.total * input.quantity;
    lines.push({
      optionId: input.optionId,
      name: text(found.option.name, language) ?? "",
      price: unit,
      quantity: input.quantity,
      options: nested.lines,
    });
  }

  for (const group of groups) {
    if (group.options.length === 0) continue;
    const count = perGroup.get(group.id) ?? 0;
    if (count < group.minimum || (group.maximum > 0 && count > group.maximum)) {
      throw validation(
        `${where}: ${group.id} needs ${group.minimum}..${group.maximum || "∞"} choices`,
      );
    }
  }
  return { total, lines };
}

function validation(detail: string): PricingError {
  return new PricingError(422, "VALIDATION_FAILED", "Validation failed", detail);
}

/** Applies a discount code to a subtotal, or throws INVALID_COUPON. */
export function applyDiscount(
  code: string,
  subtotal: number,
  discounts: MockDiscount[],
  at: Date,
  language: Language,
  entryMethod: Schemas["DiscountItem"]["entryMethod"] = "MANUAL",
): Schemas["DiscountItem"] {
  const discount = discounts.find((d) => d.code.toUpperCase() === code.trim().toUpperCase());
  const valid =
    discount &&
    discount.active &&
    (!discount.validFrom || new Date(discount.validFrom) <= at) &&
    (!discount.validTo || at < new Date(discount.validTo));
  if (!valid) throw new PricingError(422, "INVALID_COUPON", "Invalid coupon");
  const amount =
    discount.kind === "PERCENT"
      ? Math.round((subtotal * Math.min(discount.value, 100)) / 100)
      : Math.min(discount.value, subtotal);
  return {
    type: discount.type,
    value: discount.code,
    entryMethod,
    title: text(discount.title, language) ?? discount.code,
    description: text(discount.description, language),
    amount,
  };
}

/**
 * Prices every line from the menu (the client never sends prices) and applies
 * the discount. Throws a PricingError for a basket that cannot be priced.
 */
export function priceBasket(
  input: {
    menuId: string | null;
    orderType: OrderType;
    orderItems: Schemas["OrderLineInput"][];
    discountCode?: string | null;
  },
  catalogue: Catalogue,
  restaurant: { isDineInAvailable: boolean; isTakeOutAvailable: boolean },
  ctx: { today: string; at: Date; language: Language },
): { lines: PricedLine[]; total: Schemas["OrderTotal"] } {
  if (!input.menuId) throw new PricingError(422, "NO_ACTIVE_MENU", "No menu is active now");
  const typeOpen =
    input.orderType === "DINEIN" ? restaurant.isDineInAvailable : restaurant.isTakeOutAvailable;
  if (!typeOpen) {
    throw new PricingError(422, "ORDER_TYPE_UNAVAILABLE", "Order type unavailable");
  }
  const units = input.orderItems.reduce((n, line) => n + line.quantity, 0);
  if (units > BASKET_ITEM_LIMIT) {
    throw new PricingError(422, "BASKET_ITEM_LIMIT_EXCEEDED", "Too many items in the basket");
  }

  const lines = input.orderItems.map((line, index): PricedLine => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw validation(`orderItems[${index}].quantity must be at least 1`);
    }
    const found = findItem(input.menuId!, catalogue, line.itemId);
    const item = found?.item;
    if (
      !found ||
      !item ||
      isSoldOut(item, ctx.today) ||
      !item.serviceAvailability[input.orderType]
    ) {
      throw new PricingError(
        422,
        "ITEM_UNAVAILABLE",
        "Item unavailable",
        item ? (text(item.name, ctx.language) ?? line.itemId) : line.itemId,
      );
    }
    const options = priceOptions(
      line.options,
      catalogue.optionGroups.filter((g) => g.itemId === item.id && !g.parentOptionId),
      catalogue,
      input.orderType,
      ctx.language,
      `orderItems[${index}]`,
    );
    const base =
      found.link.priceOverride ?? priceFor(item.price, item.servicePriceOverride, input.orderType);
    const unitPrice = base + options.total;
    return {
      guid: line.guid,
      itemId: item.id,
      name: text(item.name, ctx.language) ?? "",
      unitPrice,
      quantity: line.quantity,
      lineTotal: unitPrice * line.quantity,
      options: options.lines,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const discount = input.discountCode
    ? applyDiscount(input.discountCode, subtotal, catalogue.discounts, ctx.at, ctx.language)
    : undefined;
  const discountTotal = discount?.amount ?? 0;
  return {
    lines,
    total: {
      subtotal,
      discountTotal,
      total: subtotal - discountTotal,
      taxInclusive: true,
      tax: null,
      currency: "BRL",
      ...(discount ? { discount } : {}),
    },
  };
}
