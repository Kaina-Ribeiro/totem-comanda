// Basket pricing and coupons for the v2 mock (contract createTotals,
// applyDiscount). Amounts are integer cents inside and BRL outside, so totals
// never show float noise. Discounts are rounded per line, half up, to the cent.

import type { Reply } from "../http.ts";
import { now } from "../state.ts";
import { isGroup, isItem, key, problem, toBrl, toCents, type Entity, type S } from "./http.ts";
import { guestMenu } from "./menu.ts";
import { v2 } from "./state.ts";

const MAX_PRODUCT_LINES = 50;

type Priced = { totals: S["TotalsResponse"]; lineCents: number[] };
type Result = Priced | { error: Reply };

/** Splits `total` cents over lines in proportion to `weights`, largest remainder first. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

/** Half up to the cent: 0.5 cent goes up. */
const halfUp = (cents: number) => Math.floor(cents + 0.5 + 1e-9);

/** The coupon's discount per line, in cents. */
export function couponCents(rule: S["DiscountRule"], lineCents: number[]): number[] {
  const subtotal = lineCents.reduce((a, b) => a + b, 0);
  const cap = rule.maxDiscount == null ? Infinity : toCents(rule.maxDiscount);
  if (rule.type === "PERCENT") {
    const perLine = lineCents.map((c) => halfUp((c * rule.value) / 100));
    const sum = perLine.reduce((a, b) => a + b, 0);
    return sum > cap ? allocate(cap, lineCents) : perLine;
  }
  return allocate(Math.min(toCents(rule.value), subtotal, cap), lineCents);
}

/** The rule behind `code` if it may be used on a basket of `subtotalCents` now. */
export function checkCoupon(code: string, subtotalCents: number, at = now()): { rule: S["DiscountRule"] } | { error: Reply } {
  const rule = v2().discountRules.find((r) => r.code === code.toUpperCase());
  const invalid = (detail: string) => ({ error: problem(422, "DISCOUNT_INVALID", "Coupon not valid", detail) });
  if (!rule || !rule.active) return invalid("Cupom não encontrado");
  if ((rule.validFrom && Date.parse(rule.validFrom) > at.getTime()) || (rule.validTo && Date.parse(rule.validTo) < at.getTime())) {
    return invalid("Cupom fora da validade");
  }
  if (rule.maxUses != null && (rule.usesCount ?? 0) >= rule.maxUses) {
    return { error: problem(422, "DISCOUNT_LIMIT_REACHED", "Coupon used up") };
  }
  if (rule.minOrderTotal != null && subtotalCents < toCents(rule.minOrderTotal)) {
    const min = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(rule.minOrderTotal);
    return invalid(`Pedido mínimo de ${min}`);
  }
  return { rule };
}

type Line = S["OrderItem"];
const unavailable = (id: string) => ({ error: problem(422, "ITEM_UNAVAILABLE", "An item is unavailable", id) });
const invalidLine = (detail: string) => ({ error: problem(422, "VALIDATION_FAILED", "Validation failed", detail) });

/**
 * Prices `req` against the menu active now, named in `language`. `couponCode`
 * is applied when it is still valid for the subtotal; otherwise it is left out.
 */
export function priceBasket(
  req: S["TotalsRequest"],
  language: S["LanguageCode"],
  couponCode: string | null,
  basketId: string,
): Result {
  if (req.orderType !== "DINEIN") {
    return { error: problem(422, "ORDER_TYPE_UNAVAILABLE", "Only dine-in orders", req.orderType) };
  }
  if (!Array.isArray(req.items) || req.items.length === 0) return invalidLine("items must not be empty");
  if (req.items.length > MAX_PRODUCT_LINES) {
    return { error: problem(422, "BASKET_ITEM_LIMIT_EXCEEDED", "Too many items in the basket") };
  }
  const menu = guestMenu(now(), language);
  if (!menu) return { error: problem(422, "NO_ACTIVE_MENU", "No menu is active now") };
  const byKey = new Map<string, Entity>(menu.entities.map((e) => [key(e.type, e.id), e]));
  const product = (id: string) =>
    (["ITEM", "SIZED_ITEM", "COMBO_MEAL"] as const).map((t) => byKey.get(key(t, id))).find(isItem);

  const lines: S["CheckItem"][] = [];
  const lineCents: number[] = [];
  for (const line of req.items) {
    const entity = product(line.id);
    if (!entity || !entity.available) return unavailable(line.id);
    const priced = priceLine(line, entity, byKey);
    if ("error" in priced) return priced;
    const quantity = Math.max(1, line.quantity);
    lines.push({ ...priced.item, quantity, netTotal: toBrl(priced.cents * quantity), total: toBrl(priced.cents * quantity), specialNotes: line.specialNotes ?? null });
    lineCents.push(priced.cents * quantity);
  }

  const subtotal = lineCents.reduce((a, b) => a + b, 0);
  let discountLines = lineCents.map(() => 0);
  const discounts: S["ResponseDiscount"][] = [];
  if (couponCode) {
    const coupon = checkCoupon(couponCode, subtotal);
    if ("rule" in coupon) {
      discountLines = couponCents(coupon.rule, lineCents);
      const value = discountLines.reduce((a, b) => a + b, 0);
      const translated = language === "en" ? coupon.rule.translations?.en?.name : undefined;
      discounts.push({
        id: coupon.rule.code,
        name: translated || coupon.rule.name,
        ...(coupon.rule.type === "PERCENT" ? { rate: coupon.rule.value / 100 } : {}),
        value: toBrl(value),
        locked: false,
      });
    }
  }
  const discount = discountLines.reduce((a, b) => a + b, 0);
  return {
    lineCents,
    totals: {
      basketId,
      subTotal: toBrl(subtotal),
      discount: toBrl(discount),
      serviceChargeTotal: 0,
      tax: 0,
      total: toBrl(subtotal - discount),
      orderItems: lines,
      taxes: [],
      discounts,
    },
  };
}

/** One product line with its option tree: the priced CheckItem and one unit's cents. */
function priceLine(
  line: Line,
  entity: S["PosEntityItem"] | S["PosEntityComboMeal"],
  byKey: Map<string, Entity>,
): { item: S["CheckItem"]; cents: number } | { error: Reply } {
  const modifiers = line.modifiers ?? [];
  const children = (uniqueId: number) => modifiers.filter((m) => m.parentId === uniqueId);
  const own = (e: Entity) => (isItem(e) ? toCents(e.type === "SIZED_ITEM" ? 0 : (e.dineInPriceOverride ?? e.price)) : 0);

  const build = (node: Line, e: Entity, depth: number): { item: S["CheckItem"]; cents: number } | { error: Reply } => {
    if (depth > 8) return invalidLine(`options nested too deep under ${line.id}`);
    // Groups this entity offers: its MODIFIERS/COMBO groups, plus the size group of a sized item.
    const groups = e.links.map((l) => byKey.get(key(l.type, l.id))).filter(isGroup);
    const sizes = e.type === "SIZED_ITEM" ? e.links.filter((l) => l.type === "ITEM" || l.type === "SIZED_ITEM") : [];
    const picked = new Map<string, number>();
    const items: S["CheckItem"][] = [];
    let cents = own(e);
    for (const child of children(node.uniqueId)) {
      const isSize = sizes.some((s) => s.id === child.id);
      const group = isSize ? null : groups.find((g) => g.links.some((l) => l.id === child.id && l.type !== "IMAGE"));
      if (!isSize && !group) return invalidLine(`${child.id} is not an option of ${e.id}`);
      const optionLink = isSize ? sizes.find((s) => s.id === child.id)! : group!.links.find((l) => l.id === child.id)!;
      const option = byKey.get(key(optionLink.type, optionLink.id));
      if (!option || !isItem(option) || !option.available) return unavailable(child.id);
      const quantity = Math.max(1, child.quantity);
      const max = option.maxChoices ?? 1;
      if (!isSize && quantity > max) return invalidLine(`${child.id}: at most ${max}`);
      const groupKey = isSize ? "SIZE" : group!.id;
      picked.set(groupKey, (picked.get(groupKey) ?? 0) + quantity);
      const sub = build(child, option, depth + 1);
      if ("error" in sub) return sub;
      const total = sub.cents * quantity;
      cents += total;
      items.push({ ...sub.item, quantity, netTotal: toBrl(total), total: toBrl(total) });
    }
    if (sizes.length && picked.get("SIZE") !== 1) return invalidLine(`${e.id}: choose one size`);
    for (const g of groups) {
      const n = picked.get(g.id) ?? 0;
      if (n < g.min || n > g.max) return invalidLine(`${g.id}: choose ${g.min} to ${g.max}`);
    }
    return {
      cents,
      item: { id: e.id, name: e.name, quantity: 1, price: toBrl(own(e)), netTotal: toBrl(cents), taxTotal: 0, total: toBrl(cents), modifiers: items, taxes: [] },
    };
  };
  return build(line, entity, 0);
}
