import type { components } from "@/lib/core-api-v2";

import { ALL_ALLERGENS, type Allergen } from "./allergens";
import { checked, priceField, text } from "./form";
import { AdminApiError } from "./session";

// Pure readers of the v2 back-office forms: FormData (+ the entity as it is
// now) → the body the Core API takes. Pages, tests and the MODELS 5.20 proof
// share them, so what the editor saves is what is tested. Fields a form does
// not show are kept from the current entity (Review Focus 3).

type S = components["schemas"];
export type Link = S["Link"];
export type EntityType = S["PosEntityType"];
export type Section = S["PosEntitySection"];
export type Item = S["PosEntityItem"];
export type ComboMeal = S["PosEntityComboMeal"];
export type AdminItem = S["AdminItem"];
export type Group = S["PosEntityModifier"];
export type SwapSell = S["PosEntitySwapSell"];
export type Badge = S["Badge"];
export type AdminMenu = S["AdminMenu"];
export type DiscountRule = S["DiscountRule"];
export type Hours = S["PosEntitySectionHours"];
type Day = Hours["dayOfWeek"];

export const PRODUCT_TYPES = ["ITEM", "SIZED_ITEM", "COMBO_MEAL"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];
export const GROUP_TYPES = ["MODIFIERS", "COMBO_MAIN", "COMBO_SIDE"] as const;
export type GroupType = (typeof GROUP_TYPES)[number];
export const MODIFIER_TYPES = ["MODI", "SIZE", "INGR", "SURC", "INGM"] as const;
export type ModifierType = (typeof MODIFIER_TYPES)[number];

export const DAYS: Array<[Day, string]> = [
  ["MONDAY", "Segunda"],
  ["TUESDAY", "Terça"],
  ["WEDNESDAY", "Quarta"],
  ["THURSDAY", "Quinta"],
  ["FRIDAY", "Sexta"],
  ["SATURDAY", "Sábado"],
  ["SUNDAY", "Domingo"],
];

const ENTITY_TYPES = new Set<string>([
  "CATEGORY",
  "ITEM",
  "SIZED_ITEM",
  "MODIFIERS",
  "COMBO_MEAL",
  "COMBO_MAIN",
  "COMBO_SIDE",
  "IMAGE",
  "SWAP_SELL",
]);

const invalid = (label: string) => new AdminApiError("VALIDATION_FAILED", label);

/** A fresh id the owner never types: `cat-3fa9c1`. Matches the contract's EntityId. */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return `${prefix}-${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/** `name.pt` (required), `name.en`, `description.pt`, `description.en`. */
export function readTexts(form: FormData, prefix = "") {
  const field = (name: string) => text(form, `${prefix}${name}`);
  const name = field("name.pt");
  if (!name) throw invalid("nome");
  const enName = field("name.en");
  const enDescription = field("description.en");
  const en = {
    ...(enName ? { name: enName } : {}),
    ...(enDescription ? { description: enDescription } : {}),
  };
  return {
    name,
    description: field("description.pt") || null,
    translations: Object.keys(en).length ? { en } : undefined,
  };
}

/** A whole number field: `fallback` when the field is not in the form, null when empty. */
function wholeNumber(
  form: FormData,
  name: string,
  label: string,
  fallback: number | null | undefined,
): number | null | undefined {
  if (!form.has(name)) return fallback;
  const value = text(form, name);
  if (!value) return null;
  if (!/^\d{1,6}$/.test(value)) throw invalid(label);
  return Number(value);
}

function requiredWholeNumber(form: FormData, name: string, label: string): number {
  const value = wholeNumber(form, name, label, null);
  if (value == null) throw invalid(label);
  return value;
}

/**
 * Ordered link rows `${prefix}.N.type|id|order|remove`, plus `${prefix}.add`
 * ("TYPE:id") at the end. Rows sort by their order number (blank keeps its
 * place); removed rows and repeats are dropped.
 */
export function readLinks(form: FormData, prefix: string): Link[] {
  const rows: Array<{ link: Link; order: number; index: number }> = [];
  const pattern = new RegExp(`^${prefix.replaceAll(".", "\\.")}\\.(\\d+)\\.id$`);
  for (const key of form.keys()) {
    const match = pattern.exec(key);
    if (!match) continue;
    const row = `${prefix}.${match[1]}`;
    const id = text(form, `${row}.id`);
    const type = text(form, `${row}.type`);
    if (!id || !ENTITY_TYPES.has(type) || checked(form, `${row}.remove`)) continue;
    const order = Number(text(form, `${row}.order`).replace(",", "."));
    const index = Number(match[1]);
    rows.push({ link: { type: type as EntityType, id }, order: Number.isFinite(order) && text(form, `${row}.order`) ? order : index + 1, index });
  }
  rows.sort((a, b) => a.order - b.order || a.index - b.index);
  const links = rows.map((r) => r.link);
  for (const add of form.getAll(`${prefix}.add`)) {
    const [type, ...rest] = String(add).split(":");
    const id = rest.join(":");
    if (id && ENTITY_TYPES.has(type)) links.push({ type: type as EntityType, id });
  }
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = `${l.type}:${l.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const time = (value: string, label: string) => {
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value)) throw invalid(label);
  return `${value}:00`;
};

/** One window per day: `MONDAY.open` (checkbox), `MONDAY.start`, `MONDAY.end` (HH:mm). */
export function readHours(form: FormData): Hours[] {
  return DAYS.filter(([day]) => checked(form, `${day}.open`)).map(([day, label]) => ({
    dayOfWeek: day,
    open: time(text(form, `${day}.start`), `${label}, abre`),
    close: time(text(form, `${day}.end`), `${label}, fecha`),
  }));
}

/** `image`: the IMAGE id to show (an upload sets it before reading), or empty for none. */
function imageLink(form: FormData): Link[] {
  const id = text(form, "image");
  return id ? [{ type: "IMAGE", id }] : [];
}

const withoutImages = (links: Link[]) => links.filter((l) => l.type !== "IMAGE");

/** A `CATEGORY` section: texts, shown or hidden, hours (`hours.on`), picture, contents. */
export function readSection(form: FormData, current: Section | null): Section {
  const { name, description, translations } = readTexts(form);
  return {
    ...current,
    id: current?.id ?? (text(form, "id") || newId("cat")),
    type: "CATEGORY",
    name,
    description,
    translations,
    available: checked(form, "available"),
    availableHours: checked(form, "hours.on") ? readHours(form) : [],
    links: [...imageLink(form), ...withoutImages(readLinks(form, "links"))],
  };
}

const values = <T extends string>(form: FormData, name: string, allowed: readonly T[]) => {
  const set = new Set<string>(allowed);
  return [...new Set(form.getAll(name).map(String))].filter((v): v is T => set.has(v));
};

const optionalText = (form: FormData, name: string, fallback: string | null | undefined) =>
  form.has(name) ? text(form, name) || null : fallback;

/**
 * A product, option, size, sized item or combo meal. `nextComboId` numbers a
 * new combo (`comboMealId` is required and kept by Go afterwards).
 */
export function readItem(
  form: FormData,
  current: AdminItem | null,
  { nextComboId }: { nextComboId?: number } = {},
): AdminItem {
  const type = (current?.type ?? text(form, "type")) as ProductType;
  if (!PRODUCT_TYPES.includes(type)) throw invalid("tipo");
  const { name, description, translations } = readTexts(form);
  const allergens = values<Allergen>(form, "allergens", ALL_ALLERGENS);
  const ageRestriction = wholeNumber(form, "ageRestriction", "idade mínima", current?.ageRestriction);
  const base = {
    ...(current ?? {}),
    id: current?.id ?? (text(form, "id") || newId(type === "COMBO_MEAL" ? "combo" : "it")),
    name,
    description,
    translations,
    price: type === "SIZED_ITEM" ? 0 : (priceField(form, "price", "preço") as number),
    dineInPriceOverride:
      type === "SIZED_ITEM" ? null : priceField(form, "dineInPrice", "preço para comer aqui", { optional: true }),
    available: checked(form, "available"),
    alcoholic: checked(form, "alcoholic"),
    ageRestriction,
    plu: optionalText(form, "plu", current?.plu),
    internalName: optionalText(form, "internalName", current?.internalName),
    calories: optionalText(form, "calories", current?.calories),
    allergens,
    allergenTraces: values<Allergen>(form, "traces", ALL_ALLERGENS),
    allergensDeclared: checked(form, "allergensDeclared"),
    badgeIds: [...new Set(form.getAll("badgeIds").map(String))].filter(Boolean),
    crossSellIds: [...new Set(form.getAll("crossSellIds").map(String))].filter(Boolean),
    defaultQuantity: wholeNumber(form, "defaultQuantity", "quantidade inicial", current?.defaultQuantity),
    minChoices: wholeNumber(form, "minChoices", "mínimo da opção", current?.minChoices),
    maxChoices: wholeNumber(form, "maxChoices", "máximo da opção", current?.maxChoices),
    links: [...imageLink(form), ...withoutImages(readLinks(form, "links"))],
  };
  delete (base as { displayPrice?: number }).displayPrice;
  if (type === "COMBO_MEAL") {
    const comboMealId = (current as ComboMeal | null)?.comboMealId ?? nextComboId;
    if (comboMealId == null) throw invalid("número do combo");
    return { ...base, type, comboMealId } as ComboMeal;
  }
  return { ...base, type } as Item;
}

/**
 * Inline option rows `${prefix}.N.*` of a group or a sized item: `id` (empty
 * for a new one), `name.pt`, `name.en`, `price`, `defaultQuantity`,
 * `minChoices`, `maxChoices`, `available`, `nested` (a MODIFIERS id), `order`,
 * `remove`. A new row with no name is ignored. Options keep every other field
 * of their current entity (`items`).
 */
export function readOptionRows(
  form: FormData,
  prefix: string,
  items: ReadonlyMap<string, AdminItem>,
): { links: Link[]; options: Item[] } {
  const rows: Array<{ option: Item; order: number; index: number }> = [];
  const pattern = new RegExp(`^${prefix}\\.(\\d+)\\.name\\.pt$`);
  for (const key of form.keys()) {
    const match = pattern.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    const row = `${prefix}.${index}.`;
    const id = text(form, `${row}id`);
    if (checked(form, `${row}remove`) || (!id && !text(form, `${row}name.pt`))) continue;
    const current = id ? (items.get(id) as Item | undefined) : undefined;
    const { name } = readTexts(form, row);
    const enName = text(form, `${row}name.en`);
    const en = { ...current?.translations?.en };
    if (enName) en.name = enName;
    else delete en.name;
    const label = `opção “${name}”`;
    const nested = text(form, `${row}nested`);
    const otherLinks = (current?.links ?? []).filter((l) => l.type !== "MODIFIERS");
    const extraGroups = (current?.links ?? []).filter((l) => l.type === "MODIFIERS").slice(1);
    const option: Item = {
      ...(current ?? { available: true, links: [] }),
      id: current?.id ?? newId("op"),
      type: current?.type === "SIZED_ITEM" ? "SIZED_ITEM" : "ITEM",
      name,
      translations: en.name || en.description ? { ...current?.translations, en } : undefined,
      price: current?.type === "SIZED_ITEM" ? 0 : (priceField(form, `${row}price`, `preço da ${label}`, { optional: true }) ?? 0),
      available: checked(form, `${row}available`),
      defaultQuantity: wholeNumber(form, `${row}defaultQuantity`, `quantidade inicial da ${label}`, current?.defaultQuantity),
      minChoices: wholeNumber(form, `${row}minChoices`, `mínimo da ${label}`, current?.minChoices),
      maxChoices: wholeNumber(form, `${row}maxChoices`, `máximo da ${label}`, current?.maxChoices),
      links: [...otherLinks, ...(nested ? [{ type: "MODIFIERS" as const, id: nested }] : []), ...extraGroups],
    };
    delete (option as { displayPrice?: number }).displayPrice;
    const orderText = text(form, `${row}order`);
    const order = Number(orderText.replace(",", "."));
    rows.push({ option, order: orderText && Number.isFinite(order) ? order : index + 1, index });
  }
  rows.sort((a, b) => a.order - b.order || a.index - b.index);
  const options = rows.map((r) => r.option);
  return { options, links: options.map((o) => ({ type: o.type as EntityType, id: o.id })) };
}

/** A modifier group (`MODIFIERS`, `COMBO_MAIN`, `COMBO_SIDE`) and its inline options. */
export function readGroup(
  form: FormData,
  current: Group | null,
  items: ReadonlyMap<string, AdminItem>,
): { group: Group; options: Item[] } {
  const type = (current?.type ?? text(form, "type")) as GroupType;
  if (!GROUP_TYPES.includes(type)) throw invalid("tipo do grupo");
  const modifierType = text(form, "modifierType") as ModifierType;
  if (modifierType && !MODIFIER_TYPES.includes(modifierType)) throw invalid("tipo de opção");
  const { name, translations } = readTexts(form);
  const min = requiredWholeNumber(form, "min", "mínimo");
  const max = requiredWholeNumber(form, "max", "máximo");
  if (max < 1 || min > max) throw invalid("mínimo e máximo");
  const { links, options } = readOptionRows(form, "opt", items);
  const group: Group = {
    ...current,
    id: current?.id ?? (text(form, "id") || newId("grp")),
    type,
    name,
    translations,
    min,
    max,
    modifierType: modifierType || current?.modifierType || "MODI",
    internalName: optionalText(form, "internalName", current?.internalName),
    links: [...imageLink(form), ...links],
  };
  return { group, options };
}

/** An upgrade offer: name and the products the guest can swap to (`links` rows). */
export function readSwapSell(form: FormData, current: SwapSell | null): SwapSell {
  const { name, translations } = readTexts(form);
  return {
    ...current,
    id: current?.id ?? (text(form, "id") || newId("troca")),
    type: "SWAP_SELL",
    name,
    translations,
    links: readLinks(form, "links").filter((l) => (PRODUCT_TYPES as readonly string[]).includes(l.type)),
  };
}

const COLOUR = /^#[0-9A-Fa-f]{6}$/;

export function readBadge(form: FormData, current: Badge | null): Badge {
  const { name, translations } = readTexts(form);
  const textColour = text(form, "textColour").toUpperCase();
  const backgroundColour = text(form, "backgroundColour").toUpperCase();
  if (!COLOUR.test(textColour) || !COLOUR.test(backgroundColour)) throw invalid("cores");
  return {
    ...current,
    id: current?.id ?? (text(form, "id") || newId("selo")),
    name,
    translations,
    textColour,
    backgroundColour,
  };
}

/** A scheduled menu: name and its top sections (`root` rows). Go keeps `isActive`/`forcedUntil`. */
export function readMenu(form: FormData, current: AdminMenu | null): AdminMenu {
  const { name, translations } = readTexts(form);
  return {
    id: current?.id ?? (text(form, "id") || newId("mnu")),
    name,
    translations,
    root: readLinks(form, "root").filter((l) => l.type === "CATEGORY"),
  };
}

/**
 * A coupon (`DiscountRule`): code upper-cased, PERCENT 1–100 whole or FIXED in
 * reais, optional minimum order, maximum discount and uses cap. `usesCount` is
 * Go's: copied from the current rule, never read from the form.
 */
export function readDiscountRule(form: FormData, current: DiscountRule | null): DiscountRule {
  const { name, translations } = readTexts(form);
  const code = text(form, "code").toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw invalid("código (3 a 20 letras ou números)");
  const type = text(form, "type");
  if (type !== "PERCENT" && type !== "FIXED") throw invalid("tipo");
  let value: number;
  if (type === "PERCENT") {
    const percent = text(form, "value");
    if (!/^\d{1,3}$/.test(percent) || Number(percent) < 1 || Number(percent) > 100) throw invalid("porcentagem (1 a 100)");
    value = Number(percent);
  } else {
    value = priceField(form, "value", "valor do desconto") as number;
    if (value <= 0) throw invalid("valor do desconto");
  }
  const maxUses = wholeNumber(form, "maxUses", "limite de usos", null);
  if (maxUses === 0) throw invalid("limite de usos");
  return {
    id: current?.id ?? (text(form, "id") || newId("cupom")),
    code,
    name,
    translations,
    type,
    value,
    minOrderTotal: priceField(form, "minOrderTotal", "pedido mínimo", { optional: true }),
    maxDiscount: priceField(form, "maxDiscount", "desconto máximo", { optional: true }),
    maxUses: maxUses ?? null,
    usesCount: current?.usesCount ?? 0,
    validFrom: current?.validFrom ?? null,
    validTo: current?.validTo ?? null,
    active: checked(form, "active"),
  };
}
