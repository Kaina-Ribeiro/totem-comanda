import type { components } from "@/lib/core-api";

import type { KioskMenu, MenuGroup, Product } from "./menu-graph";

// The kiosk basket and its v2 order lines (contract OrderItem, MODELS 8.2).
// The kiosk keeps one line per distinct choice with a quantity; Core gets one
// product line per unit (`quantity: 1`) with its options flat in `modifiers`,
// the tree given by `parentId` → `uniqueId`. Ids only: Go prices every line.

type Schemas = components["schemas"];
export type OrderItem = Schemas["OrderItem"];
export type CheckItem = Schemas["CheckItem"];
export type TotalsResponse = Schemas["TotalsResponse"];

/** One picked option: its group's key (path inside the product) and how many. */
export type Pick = { groupKey: string; optionId: string; quantity: number };

export type BasketLine = {
  guid: string;
  productId: string;
  quantity: number;
  /** Picks in display order, nested ones right after their option. */
  picks: Pick[];
};

export const basketUnits = (lines: BasketLine[]) => lines.reduce((n, line) => n + line.quantity, 0);

/** The v2 order lines for the basket: one product line per unit, `uniqueId` from 1. */
export function toOrderItems(menu: KioskMenu, lines: BasketLine[]): OrderItem[] {
  let next = 1;
  const items: OrderItem[] = [];
  for (const line of lines) {
    const product = menu.products[line.productId];
    for (let unit = 0; unit < line.quantity; unit++) {
      const uniqueId = next++;
      const modifiers: OrderItem[] = [];
      const walk = (groups: MenuGroup[], parentId: number) => {
        for (const group of groups) {
          group.options.forEach((option, index) => {
            const pick = line.picks.find((p) => p.groupKey === group.key && p.optionId === option.id);
            if (!pick) return;
            const id = next++;
            modifiers.push({
              id: option.id,
              quantity: pick.quantity,
              uniqueId: id,
              parentId,
              position: index + 1,
              ...(group.modifierType ? { modifierType: group.modifierType } : {}),
            });
            walk(option.groups, id);
          });
        }
      };
      if (product) walk(product.groups, uniqueId);
      items.push({ id: line.productId, quantity: 1, uniqueId, modifiers });
    }
  }
  return items;
}

/**
 * Core's priced unit for each basket line. Core answers one CheckItem per
 * product line sent, in order, so a line of quantity 3 owns the next three; the
 * first stands for all (same choices, same price). Null if Core sent fewer.
 */
export function lineUnits(lines: BasketLine[], totals: TotalsResponse): Map<string, CheckItem | null> {
  const priced = totals.orderItems ?? [];
  const units = new Map<string, CheckItem | null>();
  let at = 0;
  for (const line of lines) {
    units.set(line.guid, priced[at] ?? null);
    at += line.quantity;
  }
  return units;
}

/**
 * The summary under a basket line ("2× Queijo extra, Molho barbecue, sem
 * Alface"): picked options in order, and the default ingredients taken out.
 */
export function pickNames(product: Product, line: BasketLine, without: (name: string) => string): string[] {
  const names: string[] = [];
  const walk = (groups: MenuGroup[]) => {
    for (const group of groups) {
      for (const option of group.options) {
        const pick = line.picks.find((p) => p.groupKey === group.key && p.optionId === option.id);
        const quantity = pick?.quantity ?? 0;
        if (group.modifierType === "INGR") {
          if (option.defaultQuantity > 0 && quantity === 0) names.push(without(option.name));
          continue;
        }
        if (!quantity) continue;
        names.push(quantity > 1 ? `${quantity}× ${option.name}` : option.name);
        walk(option.groups);
      }
    }
  };
  walk(product.groups);
  return names;
}
