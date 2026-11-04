import type { components } from "@/lib/core-api";
import { waitLabel, waitState, waitingMinutes } from "@/lib/kitchen/board";

type KitchenOrder = components["schemas"]["KitchenOrder"];

const BUTTON_LABEL = { PAID: "Começar", PREPARING: "Pronto", READY: "Retirado" } as const;

/** Waiting chip per state (prototype K1): on time, attention from 5 min, late from 10. */
const WAIT_CHIP = {
  ok: "bg-sage text-ink",
  warn: "bg-butter text-detail-text",
  late: "bg-danger text-white",
} as const;
const WAIT_NAME = { ok: "no prazo", warn: "atenção", late: "atrasado" } as const;

const CARD_RING = {
  ok: "shadow-[0_1px_2px_rgba(28,28,26,.08)]",
  warn: "shadow-[0_1px_2px_rgba(28,28,26,.08)]",
  late: "shadow-[0_0_0_2px_var(--color-danger)]",
} as const;

const chip = "flex h-[26px] items-center rounded-[13px] px-2.5 text-[13px] font-extrabold whitespace-nowrap";

/** One order on the board: number, type, waiting time, lines and the next step. */
export function OrderCard({
  order,
  now,
  busy,
  isNew = false,
  onAdvance,
}: {
  order: KitchenOrder;
  now: number;
  busy: boolean;
  /** Arrived after the board loaded and nobody touched the screen since (G-K1). */
  isNew?: boolean;
  onAdvance: () => void;
}) {
  const column = order.status as keyof typeof BUTTON_LABEL;
  const ready = column === "READY";
  // Ready orders count from readyAt and no longer age: the guest is the one waiting.
  const minutes = waitingMinutes(ready ? (order.readyAt ?? order.placedAt) : order.placedAt, now);
  const state = ready ? "ok" : waitState(minutes);
  return (
    <article
      className={`flex shrink-0 flex-col gap-3 rounded-xl bg-surface px-4 pt-3.5 pb-4 ${
        isNew ? "shadow-[0_0_0_3px_var(--color-detail-light)]" : CARD_RING[state]
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[38px] leading-none font-extrabold tracking-[-0.02em]">
            {order.posCheckNumber}
          </span>
          {isNew && (
            <span className="flex h-6 items-center gap-[5px] rounded-xl bg-wheat px-[9px] text-xs font-semibold">
              <span className="size-1.5 rounded-full bg-detail" />
              Novo
            </span>
          )}
          <span className={`${chip} ${order.orderType === "TAKE_OUT" ? "bg-butter" : "bg-oat"}`}>
            {order.orderType === "TAKE_OUT" ? "Para viagem" : "Comer aqui"}
          </span>
        </div>
        <span className={`${chip} ${WAIT_CHIP[state]}`}>
          {ready ? `pronto há ${minutes} min` : waitLabel(minutes)}
          {!ready && <span className="sr-only">, {WAIT_NAME[state]}</span>}
        </span>
      </div>
      <ul className="flex flex-col gap-[7px]">
        {order.lines.map((line, i) => (
          <li key={i} className="flex flex-col gap-px">
            <span className="text-[17px] font-bold">
              {line.quantity}× {line.name}
            </span>
            {line.options.length > 0 && (
              <span className="text-sm font-semibold text-muted">{line.options.join(" · ")}</span>
            )}
          </li>
        ))}
      </ul>
      <button
        onClick={onAdvance}
        disabled={busy}
        className={`h-[52px] rounded-2xl text-[17px] font-extrabold transition-transform active:scale-[.97] disabled:opacity-60 ${
          ready ? "bg-ground text-ink" : "bg-accent text-on-accent"
        }`}
      >
        {BUTTON_LABEL[column]}
      </button>
    </article>
  );
}
