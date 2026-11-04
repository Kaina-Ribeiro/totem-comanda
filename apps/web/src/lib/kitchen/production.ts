import type { components } from "@/lib/core-api";

type KitchenOrder = components["schemas"]["KitchenOrder"];

/** Which open orders the Produção tab adds up (K3). */
export type ProductionScope = "open" | "new";

export type ProductionItem = {
  name: string;
  quantity: number;
  /** Option combinations with how many of each; lines without options are left out. */
  variants: { label: string; quantity: number }[];
  /** Order numbers that need this item, in board order. */
  orders: string[];
};

const collator = new Intl.Collator("pt-BR");

/**
 * Totals to make (plan G-K6, KDS FEAT-039): Novos + Preparando, never
 * Prontos, by item name and option combination. Contract 0.1 has no item id
 * on kitchen lines, so items group by their pt-BR name.
 */
export function productionTotals(
  orders: KitchenOrder[],
  scope: ProductionScope,
): { items: ProductionItem[]; orders: string[] } {
  const statuses = scope === "new" ? ["PAID"] : ["PAID", "PREPARING"];
  const open = statuses.flatMap((status) => orders.filter((o) => o.status === status));
  const byName = new Map<string, ProductionItem>();
  for (const order of open) {
    for (const line of order.lines) {
      let item = byName.get(line.name);
      if (!item) {
        item = { name: line.name, quantity: 0, variants: [], orders: [] };
        byName.set(line.name, item);
      }
      item.quantity += line.quantity;
      if (!item.orders.includes(order.posCheckNumber)) item.orders.push(order.posCheckNumber);
      if (line.options.length === 0) continue;
      const label = line.options.join(" · ");
      const variant = item.variants.find((v) => v.label === label);
      if (variant) variant.quantity += line.quantity;
      else item.variants.push({ label, quantity: line.quantity });
    }
  }
  const items = [...byName.values()].sort((a, b) => collator.compare(a.name, b.name));
  for (const item of items) item.variants.sort((a, b) => b.quantity - a.quantity);
  return { items, orders: open.map((o) => o.posCheckNumber) };
}
