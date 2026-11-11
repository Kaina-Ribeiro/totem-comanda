import { kitchenLines, type KitchenOrder } from "./order";

/** Which open orders the Produção tab adds up (K3). */
export type ProductionScope = "open" | "new";

export type ProductionItem = {
  itemId: string;
  name: string;
  quantity: number;
  /** Option combinations with how many of each; lines without options are left out. */
  variants: { key: string; label: string; quantity: number }[];
  /** Order numbers that need this item, in board order. */
  orders: string[];
};

const collator = new Intl.Collator("pt-BR");

/**
 * Totals to make (plan G-K6, KDS FEAT-039): Novos + Preparando, never
 * Prontos, by item and option combination. Grouped by ids (the line's `id`
 * and its options' ids), so two items with the same name stay apart and an
 * item renamed during the day stays together.
 */
export function productionTotals(
  orders: KitchenOrder[],
  scope: ProductionScope,
): { items: ProductionItem[]; orders: string[] } {
  const statuses = scope === "new" ? ["PAID"] : ["PAID", "PREPARING"];
  const open = statuses.flatMap((status) => orders.filter((o) => o.status === status));
  const byId = new Map<string, ProductionItem>();
  for (const order of open) {
    for (const line of kitchenLines(order)) {
      let item = byId.get(line.id);
      if (!item) {
        item = { itemId: line.id, name: line.name, quantity: 0, variants: [], orders: [] };
        byId.set(line.id, item);
      }
      item.quantity += line.quantity;
      if (!item.orders.includes(order.customerCheckNumber)) item.orders.push(order.customerCheckNumber);
      if (line.options.length === 0) continue;
      const key = line.variant;
      const variant = item.variants.find((v) => v.key === key);
      if (variant) variant.quantity += line.quantity;
      else item.variants.push({ key, label: line.options.join(" · "), quantity: line.quantity });
    }
  }
  const items = [...byId.values()].sort((a, b) => collator.compare(a.name, b.name));
  for (const item of items) item.variants.sort((a, b) => b.quantity - a.quantity);
  return { items, orders: open.map((o) => o.customerCheckNumber) };
}
