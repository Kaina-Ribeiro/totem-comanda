"use client";

import { Fragment, useEffect, useRef, type ReactNode } from "react";

import type { components } from "@/lib/core-api";
import { waitingMinutes, waitLabel, waitState } from "@/lib/kitchen/board";
import { historyRows, timesLine } from "@/lib/kitchen/detail";

type KitchenOrder = components["schemas"]["KitchenOrder"];

const STATUS_CHIP = {
  PAID: { label: "Novo", className: "bg-butter" },
  PREPARING: { label: "Preparando", className: "bg-wheat" },
  READY: { label: "Pronto", className: "bg-sage" },
} as const;

const WAIT_CHIP = {
  ok: "bg-sage text-ink",
  warn: "bg-butter text-detail-text",
  late: "bg-danger text-white",
} as const;

const ADVANCE_LABEL = {
  PAID: "Começar",
  PREPARING: "Pronto",
  READY: "Retirado",
} as const;

const chip =
  "flex h-[30px] items-center rounded-[15px] px-3 text-sm font-extrabold whitespace-nowrap";

/**
 * The order detail (prototype K2): a drawer over the board with every line and
 * option, the type, the times, the status history and the order's actions.
 * `lineAction` and `secondary` are slots for "Acabou" and "Voltar uma etapa".
 */
export function OrderDrawer({
  order,
  now,
  busy,
  onClose,
  onAdvance,
  secondary,
  lineAction,
  lineExtra,
  footnote,
}: {
  order: KitchenOrder;
  now: number;
  busy: boolean;
  onClose: () => void;
  onAdvance: () => void;
  /** Left footer button, next to the main one. */
  secondary?: ReactNode;
  /** Button at the end of each item line. */
  lineAction?: (line: KitchenOrder["lines"][number], index: number) => ReactNode;
  /** A panel under a line (the "Acabou" confirmation). */
  lineExtra?: (line: KitchenOrder["lines"][number], index: number) => ReactNode;
  /** Under the history: the rare actions ("Cancelar pedido"). */
  footnote?: ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);
  const column = order.status as keyof typeof STATUS_CHIP;
  const ready = column === "READY";
  const minutes = waitingMinutes(ready ? (order.readyAt ?? order.placedAt) : order.placedAt, now);
  const state = ready ? "ok" : waitState(minutes);
  const history = historyRows(order, now);

  // Focus the close button on open and give focus back to the card on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => opener?.focus();
  }, []);

  // Escape closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <button
        aria-label="Fechar pedido"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-[rgba(28,28,26,.45)]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${order.posCheckNumber}`}
        className="absolute inset-y-0 right-0 flex w-[540px] max-w-full animate-drawer-in flex-col bg-surface shadow-[-12px_0_32px_rgba(28,28,26,.18)]"
      >
        <div className="flex flex-col gap-2.5 px-7 pt-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-muted">Pedido</span>
            <button
              ref={close}
              onClick={onClose}
              aria-label="Fechar"
              className="flex size-12 items-center justify-center rounded-2xl bg-ground transition-transform active:scale-[.97]"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <span className="text-[72px] leading-[0.9] font-extrabold tracking-[-0.03em]">
              {order.posCheckNumber}
            </span>
            {STATUS_CHIP[column] && (
              <span className={`${chip} ${STATUS_CHIP[column].className}`}>
                {STATUS_CHIP[column].label}
              </span>
            )}
            <span className={`${chip} ${order.orderType === "TAKE_OUT" ? "bg-butter" : "bg-oat"}`}>
              {order.orderType === "TAKE_OUT" ? "Para viagem" : "Comer aqui"}
            </span>
            <span className={`${chip} ${WAIT_CHIP[state]}`}>
              {ready ? `pronto há ${minutes} min` : waitLabel(minutes)}
            </span>
          </div>
          <p className="text-[15px] font-semibold text-muted">{timesLine(order)}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-7 pt-[22px] pb-4">
          <section className="flex flex-col gap-1">
            <h3 className="mb-1.5 text-lg font-bold tracking-[-0.02em]">Itens</h3>
            {order.lines.map((line, i) => (
              <Fragment key={i}>
                <div
                  className={`flex min-h-14 items-center justify-between gap-4 py-2 ${
                    i < order.lines.length - 1 ? "border-b border-line" : ""
                  }`}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[19px] font-bold">
                      {line.quantity}× {line.name}
                    </span>
                    {line.options.length > 0 && (
                      <span className="text-[15px] font-semibold text-muted">
                        {line.options.join(" · ")}
                      </span>
                    )}
                  </span>
                  {lineAction?.(line, i)}
                </div>
                {lineExtra?.(line, i)}
              </Fragment>
            ))}
          </section>

          <section className="flex flex-col gap-2.5">
            <h3 className="text-lg font-bold tracking-[-0.02em]">Histórico</h3>
            <ol className="flex flex-col">
              {history.map((row, i) => (
                <li key={i} className="flex min-h-[38px] gap-3.5">
                  <span className="flex w-3.5 flex-col items-center">
                    <span
                      className={`mt-1 size-3 shrink-0 rounded-full ${row.tone === "late" ? "bg-danger" : "bg-accent"}`}
                    />
                    {i < history.length - 1 && <span className="w-0.5 grow bg-line" />}
                  </span>
                  <span className="text-[15px] font-semibold text-muted">
                    <span
                      className={`font-extrabold ${row.tone === "late" ? "text-danger" : "text-ink"}`}
                    >
                      {row.time}
                    </span>{" "}
                    · {row.label}
                  </span>
                </li>
              ))}
            </ol>
          </section>
          {footnote}
        </div>

        <div className="flex gap-3 border-t border-line px-7 pt-[18px] pb-[26px]">
          {secondary}
          {ADVANCE_LABEL[column] && (
            <button
              onClick={onAdvance}
              disabled={busy}
              className={`h-16 flex-[1.3_1_0] rounded-2xl text-[19px] font-extrabold transition-transform active:scale-[.97] disabled:opacity-60 ${
                ready ? "bg-ground text-ink" : "bg-accent text-on-accent"
              }`}
            >
              {ADVANCE_LABEL[column]}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
