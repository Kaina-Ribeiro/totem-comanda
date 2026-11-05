"use client";

import { useState } from "react";

import type { components } from "@/lib/core-api";
import { findByNumber } from "@/lib/kitchen/collected";

type KitchenOrder = components["schemas"]["KitchenOrder"];

const clock = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const chip = "flex h-[26px] items-center rounded-[13px] px-2.5 text-[13px] font-extrabold whitespace-nowrap";

/**
 * "Retirados hoje" (plan G-K7, KDS FEAT-042, tab in prototype K3): today's
 * collected orders, newest first, found by number and moved back to Prontos
 * when "Retirado" was tapped by mistake.
 */
export function CollectedView({
  orders,
  busyId,
  onBack,
}: {
  orders: KitchenOrder[];
  /** The order whose move back is on its way. */
  busyId: string | null;
  onBack: (order: KitchenOrder) => void;
}) {
  const [query, setQuery] = useState("");
  const shown = findByNumber(orders, query);
  const typed = query.trim();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 pt-4 pb-6">
      <div className="flex shrink-0 items-center gap-4">
        <label className="flex h-14 w-[380px] max-w-full items-center gap-3 rounded-2xl bg-surface px-[18px] shadow-[0_1px_2px_rgba(28,28,26,.08)] focus-within:shadow-[0_0_0_2px_var(--color-accent)]">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
            className="shrink-0 text-muted"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">Buscar pelo número do pedido</span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value.replace(/\D/g, ""))}
            placeholder="Buscar pelo número"
            className="h-full min-w-0 grow bg-transparent text-[19px] font-extrabold outline-none placeholder:font-semibold placeholder:text-muted"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition-transform active:scale-[.95]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </label>
        <p className="text-[15px] font-semibold text-muted">
          {orders.length === 1 ? "1 pedido retirado hoje" : `${orders.length} pedidos retirados hoje`}{" "}
          · mais recentes primeiro
        </p>
      </div>

      <section
        aria-label="Retirados hoje"
        className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-tray p-3"
      >
        {shown.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1.5 text-center">
            <p className="text-[19px] font-extrabold">
              {typed ? `Nenhum pedido retirado com o número ${typed}` : "Nenhum pedido retirado hoje"}
            </p>
            <p className="text-[15px] font-semibold text-muted">
              {typed
                ? "Confira o número no comprovante do cliente."
                : "Os pedidos marcados como Retirado aparecem aqui até o fim do dia."}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-3 content-start gap-3">
            {shown.map((order) => (
              <li
                key={order.id}
                className="flex flex-col gap-3 rounded-xl bg-surface px-4 pt-3.5 pb-4 shadow-[0_1px_2px_rgba(28,28,26,.08)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <span className="text-[38px] leading-none font-extrabold tracking-[-0.02em]">
                      {order.posCheckNumber}
                    </span>
                    <span className={`${chip} ${order.orderType === "TAKE_OUT" ? "bg-butter" : "bg-oat"}`}>
                      {order.orderType === "TAKE_OUT" ? "Para viagem" : "Comer aqui"}
                    </span>
                  </span>
                  <span className={`${chip} bg-sage`}>retirado {clock.format(Date.parse(order.updatedAt))}</span>
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
                  onClick={() => onBack(order)}
                  disabled={busyId === order.id}
                  className="mt-auto flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-ground text-[17px] font-extrabold transition-transform active:scale-[.97] disabled:opacity-60"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 14L4 9l5-5" />
                    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
                  </svg>
                  {busyId === order.id ? "Voltando…" : "Voltar para Prontos"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
