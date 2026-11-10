import type { components } from "@/lib/core-api";

import type { KitchenOrder } from "./order";

/** Statuses the board shows, in column order. COLLECTED leaves the board. */
export const COLUMNS = ["PAID", "PREPARING", "READY"] as const;

const byPlacedAt = (a: KitchenOrder, b: KitchenOrder) =>
  Date.parse(a.placedAt) - Date.parse(b.placedAt);

/** The board after an event or a status answer: upsert, drop collected, oldest first. */
export function applyOrder(orders: KitchenOrder[], order: KitchenOrder): KitchenOrder[] {
  const rest = orders.filter((o) => o.number !== order.number);
  if (!(COLUMNS as readonly string[]).includes(order.status)) return rest;
  return [...rest, order].sort(byPlacedAt);
}

/**
 * What the board knows about each order it has seen, collected ones too:
 * the highest `version` and when it arrived (stale-event guard, plan G-K3).
 */
export type Seen = Map<string, { version: number; at: number }>;

/**
 * True when `order` is not older than what the board already saw; then it is
 * remembered. An event or answer for an older version is a late one: a card
 * moved back by it would show a status Go no longer has.
 */
export function accept(seen: Seen, order: KitchenOrder, at: number): boolean {
  const known = seen.get(order.number);
  if (known && order.version < known.version) return false;
  if (!known || order.version > known.version) seen.set(order.number, { version: order.version, at });
  return true;
}

/**
 * The board after a full reload that was requested at `startedAt`. The list
 * is Go's open orders at some moment after that, so a card in it older than
 * what the board saw since keeps the board's copy, and a card missing from
 * it stays only if the board learned about it after the reload started.
 * `apply` puts one order in the list: the board's columns by default, or
 * the Retirados list (`applyCollected`).
 */
export function mergeSnapshot(
  current: KitchenOrder[],
  snapshot: KitchenOrder[],
  seen: Seen,
  startedAt: number,
  at: number,
  apply: (list: KitchenOrder[], order: KitchenOrder) => KitchenOrder[] = applyOrder,
): KitchenOrder[] {
  const byId = new Map(current.map((o) => [o.number, o]));
  const listed = new Set(snapshot.map((o) => o.number));
  let board: KitchenOrder[] = [];
  for (const order of snapshot) {
    if (accept(seen, order, at)) board = apply(board, order);
    else if (byId.has(order.number)) board = apply(board, byId.get(order.number)!);
  }
  for (const order of current) {
    if (!listed.has(order.number) && (seen.get(order.number)?.at ?? 0) > startedAt) {
      board = apply(board, order);
    }
  }
  return board;
}

/** The next step for each column's button. */
export const NEXT_STATUS = {
  PAID: "PREPARING",
  PREPARING: "READY",
  READY: "COLLECTED",
} as const;

/** One step back (plan decision 2): only these two, and only the same business day (Go checks). */
export const PREVIOUS_STATUS = { READY: "PREPARING", COLLECTED: "READY" } as const;

/** Toast after a move that can be undone (prototype K1): "Pedido 38 retirado". */
export function movedLabel(order: KitchenOrder): string | null {
  if (order.status === "READY") return `Pedido ${order.customerCheckNumber} pronto`;
  if (order.status === "COLLECTED") return `Pedido ${order.customerCheckNumber} retirado`;
  return null;
}

/** Whole minutes since the order was placed. */
export function waitingMinutes(placedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000));
}

/** Waiting in 3 steps (plan G-K8): on time, attention from 5 min, late from 10 min. */
export const ATTENTION_MINUTES = 5;
export const LATE_MINUTES = 10;

export function waitState(minutes: number): "ok" | "warn" | "late" {
  if (minutes >= LATE_MINUTES) return "late";
  if (minutes >= ATTENTION_MINUTES) return "warn";
  return "ok";
}

/** "agora" under a minute, else "7 min". */
export const waitLabel = (minutes: number) => (minutes < 1 ? "agora" : `${minutes} min`);

/** A status change Go did not take. */
export type MoveError = {
  order: KitchenOrder;
  status: components["schemas"]["KitchenStatusUpdate"]["status"];
  code: string;
};

const STEP_LABEL = { PREPARING: "Preparando", READY: "Pronto", COLLECTED: "Retirado" } as const;

/**
 * What the kitchen reads when a move fails (KDS BR-012). A transition Go
 * refuses means another screen moved the order first: the board reloads and
 * there is nothing to retry. Anything else is worth one more tap.
 */
export function moveErrorMessage(error: MoveError): { text: string; retry: boolean } {
  const number = error.order.customerCheckNumber;
  if (
    error.code === "INVALID_STATUS_TRANSITION" ||
    error.code === "STALE_ORDER_VERSION" ||
    error.code === "NOT_FOUND"
  ) {
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
