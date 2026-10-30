import type { components } from "@/lib/core-api";

type KitchenOrder = components["schemas"]["KitchenOrder"];

/** Statuses the board shows, in column order. COLLECTED leaves the board. */
export const COLUMNS = ["PAID", "PREPARING", "READY"] as const;

const byPlacedAt = (a: KitchenOrder, b: KitchenOrder) =>
  Date.parse(a.placedAt) - Date.parse(b.placedAt);

/** The board after an event or a status answer: upsert, drop collected, oldest first. */
export function applyOrder(orders: KitchenOrder[], order: KitchenOrder): KitchenOrder[] {
  const rest = orders.filter((o) => o.id !== order.id);
  if (!(COLUMNS as readonly string[]).includes(order.status)) return rest;
  return [...rest, order].sort(byPlacedAt);
}

/** The next step for each column's button. */
export const NEXT_STATUS = {
  PAID: "PREPARING",
  PREPARING: "READY",
  READY: "COLLECTED",
} as const;

/** Whole minutes since the order was placed. */
export function waitingMinutes(placedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000));
}
