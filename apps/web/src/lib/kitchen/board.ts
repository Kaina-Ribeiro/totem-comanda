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

/** A status change Go did not take. */
export type MoveError = {
  order: KitchenOrder;
  status: (typeof NEXT_STATUS)[keyof typeof NEXT_STATUS];
  code: string;
};

const STEP_LABEL = { PREPARING: "Preparando", READY: "Pronto", COLLECTED: "Retirado" } as const;

/**
 * What the kitchen reads when a move fails (KDS BR-012). A transition Go
 * refuses means another screen moved the order first: the board reloads and
 * there is nothing to retry. Anything else is worth one more tap.
 */
export function moveErrorMessage(error: MoveError): { text: string; retry: boolean } {
  const number = error.order.posCheckNumber;
  if (error.code === "INVALID_STATUS_TRANSITION" || error.code === "NOT_FOUND") {
    return {
      text: `O pedido ${number} já mudou em outro aparelho. O quadro foi atualizado.`,
      retry: false,
    };
  }
  return {
    text: `Não deu para marcar o pedido ${number} como ${STEP_LABEL[error.status]}. Verifique a conexão.`,
    retry: true,
  };
}
