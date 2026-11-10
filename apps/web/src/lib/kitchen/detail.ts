import { waitingMinutes, waitState } from "./board";
import type { KitchenOrder, KitchenStatusChange as Change } from "./order";

const time = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "10:30" in the restaurant's timezone. */
export const clockTime = (iso: string) => time.format(Date.parse(iso));

/** Column order; a change to an earlier one is a step back (plan G-K3). */
const RANK: Partial<Record<Change["status"], number>> = {
  PAID: 0,
  PREPARING: 1,
  READY: 2,
  COLLECTED: 3,
};

const FORWARD: Partial<Record<Change["status"], string>> = {
  PREPARING: "Começou na cozinha",
  READY: "Ficou pronto",
  COLLECTED: "Retirado no balcão",
  NOT_COLLECTED: "Não retirado no fim do dia",
  CANCELLED: "Cancelado",
};

const BACK: Partial<Record<Change["status"], string>> = {
  PAID: "Voltou para Novos",
  PREPARING: "Voltou para Preparando",
  READY: "Voltou para Prontos",
};

/** Who made a change, when it is not the kitchen itself. */
const BY: Record<Change["by"], string> = {
  KIOSK: "",
  KITCHEN: "",
  OWNER: " pela dona",
  SYSTEM: " pelo sistema",
};

/** What one history entry says ("Pago no totem", "Voltou para Preparando"). */
export function changeLabel(change: Change, previous: Change | undefined): string {
  if (!previous)
    return change.status === "PAID" ? "Pago no totem" : (FORWARD[change.status] ?? change.status);
  const back = (RANK[change.status] ?? 99) < (RANK[previous.status] ?? -1);
  const label = (back ? BACK[change.status] : FORWARD[change.status]) ?? change.status;
  return label + BY[change.by];
}

export type HistoryRow = { time: string; label: string; tone: "done" | "late" };

/**
 * The detail's timeline (prototype K2): every status change, oldest first,
 * then a "now" row while the guest is still waiting for the food.
 */
export function historyRows(order: KitchenOrder, now: number): HistoryRow[] {
  const rows: HistoryRow[] = order.history.map((change, i) => ({
    time: clockTime(change.at),
    label: changeLabel(change, order.history[i - 1]),
    tone: "done",
  }));
  if (order.status === "PAID" || order.status === "PREPARING") {
    const minutes = waitingMinutes(order.placedAt, now);
    const late = waitState(minutes) === "late";
    rows.push({
      time: "Agora",
      label:
        minutes < 1
          ? "acabou de chegar"
          : `${minutes} min esperando${late ? ", passou do tempo" : ""}`,
      tone: late ? "late" : "done",
    });
  }
  return rows;
}

/** The line under the number: "Pago no totem às 10:30 · começou às 10:33". */
export function timesLine(order: KitchenOrder): string {
  const parts = [`Pago no totem às ${clockTime(order.placedAt)}`];
  const last = (status: Change["status"]) => order.history.findLast((c) => c.status === status);
  const started = last("PREPARING");
  if (started) parts.push(`começou às ${clockTime(started.at)}`);
  const ready = order.status === "READY" ? last("READY") : undefined;
  if (ready) parts.push(`pronto às ${clockTime(ready.at)}`);
  return parts.join(" · ");
}
