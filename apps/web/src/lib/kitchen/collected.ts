import type { components } from "@/lib/core-api";

type KitchenOrder = components["schemas"]["KitchenOrder"];

const newestFirst = (a: KitchenOrder, b: KitchenOrder) =>
  Date.parse(b.updatedAt) - Date.parse(a.updatedAt);

/**
 * "Retirados hoje" (plan G-K7) after an event or a status answer: a collected
 * order goes in, newest hand-over first; one that moved back leaves.
 */
export function applyCollected(list: KitchenOrder[], order: KitchenOrder): KitchenOrder[] {
  const rest = list.filter((o) => o.id !== order.id);
  if (order.status !== "COLLECTED") return rest;
  return [...rest, order].sort(newestFirst);
}

/** The orders whose number starts with what the kitchen typed; all of them while empty. */
export function findByNumber(list: KitchenOrder[], query: string): KitchenOrder[] {
  const typed = query.trim();
  return typed ? list.filter((o) => o.posCheckNumber.startsWith(typed)) : list;
}
