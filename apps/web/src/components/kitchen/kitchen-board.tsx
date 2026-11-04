"use client";

import { useEffect, useState, useTransition } from "react";

import { moveOrder } from "@/app/kitchen/actions";
import type { components } from "@/lib/core-api";
import {
  applyOrder,
  COLUMNS,
  moveErrorMessage,
  type MoveError,
  NEXT_STATUS,
  waitingMinutes,
} from "@/lib/kitchen/board";

type KitchenOrder = components["schemas"]["KitchenOrder"];

/** The contract's fallback when the event stream drops: poll every 2 s. */
const POLL_MS = 2_000;
/** While polling, try the stream again this often. */
const RECONNECT_MS = 30_000;
/** Waiting time turns to a warning after this many minutes. */
const LATE_MINUTES = 10;

/** The open orders as Go has them; null while Go or the network cannot answer. */
async function fetchOpenOrders(): Promise<KitchenOrder[] | null> {
  try {
    const response = await fetch("/api/kitchen/orders", { cache: "no-store" });
    return response.ok ? ((await response.json()) as KitchenOrder[]) : null;
  } catch {
    return null; // Offline: the next tick tries again.
  }
}

const COLUMN_LABEL = { PAID: "Novos", PREPARING: "Preparando", READY: "Prontos" } as const;
const BUTTON_LABEL = { PAID: "Começar", PREPARING: "Pronto", READY: "Retirado" } as const;

/**
 * The kitchen screen: paid orders, oldest first, moved New → Preparing →
 * Ready → Collected with one tap. Live through the BFF's event stream;
 * falls back to polling the open orders every 2 s while the stream is down.
 */
export function KitchenBoard({ initial }: { initial: KitchenOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  // The last move Go did not take (KDS BR-012): shown until retried or dismissed.
  const [moveError, setMoveError] = useState<MoveError | null>(null);

  /** Reloads the open orders from Go; the board then shows where each card really is. */
  const refresh = async () => {
    const open = await fetchOpenOrders();
    if (open) setOrders(open);
  };

  // Waiting times tick every 20 s.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);

  // Event stream while it works; polling while it does not.
  useEffect(() => {
    let stream: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const refresh = async () => {
      const open = await fetchOpenOrders();
      if (open) setOrders(open);
    };

    const startPolling = () => {
      setLive(false);
      if (!poll) poll = setInterval(refresh, POLL_MS);
      retry = setTimeout(connect, RECONNECT_MS);
    };

    function connect() {
      if (closed) return;
      stream?.close();
      stream = new EventSource("/api/kitchen/stream");
      const onOrder = (event: MessageEvent<string>) =>
        setOrders((current) => applyOrder(current, JSON.parse(event.data) as KitchenOrder));
      stream.addEventListener("order.paid", onOrder);
      stream.addEventListener("order.status_changed", onOrder);
      stream.onopen = () => {
        setLive(true);
        clearInterval(poll);
        poll = undefined;
        // Catch up on anything missed while disconnected.
        void refresh();
      };
      stream.onerror = () => {
        stream?.close();
        startPolling();
      };
    }

    connect();
    return () => {
      closed = true;
      stream?.close();
      clearInterval(poll);
      clearTimeout(retry);
    };
  }, []);

  /** Moves `order` to `status`; a failure is shown, and the board reloads from Go. */
  function move(order: KitchenOrder, status: MoveError["status"]) {
    setBusy(order.id);
    setMoveError(null);
    startTransition(async () => {
      // A tablet that lost the network rejects instead of answering.
      const result = await moveOrder(order.id, status).catch(
        () => ({ ok: false, code: "NETWORK" }) as const,
      );
      if (result.ok) {
        setOrders((current) => applyOrder(current, result.data));
      } else {
        setMoveError({ order, status, code: result.code });
        await refresh();
      }
      setBusy(null);
    });
  }

  function advance(order: KitchenOrder) {
    const status = NEXT_STATUS[order.status as keyof typeof NEXT_STATUS];
    if (status) move(order, status);
  }

  const errorMessage = moveError && moveErrorMessage(moveError);

  return (
    <main className="flex min-h-dvh flex-1 flex-col gap-4 bg-ground p-4 text-ink">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold">Cozinha</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            live ? "bg-sage text-ink" : "bg-butter text-detail-text"
          }`}
          role="status"
        >
          {live ? "Ao vivo" : "Reconectando… (atualiza a cada 2 s)"}
        </span>
      </header>
      {moveError && errorMessage && (
        <div
          role="alert"
          className="flex min-h-14 items-center justify-between gap-4 rounded-xl bg-danger py-2 pr-2 pl-5 text-on-accent"
        >
          <span className="text-base font-bold">{errorMessage.text}</span>
          <span className="flex shrink-0 gap-2">
            {errorMessage.retry && (
              <button
                onClick={() => move(moveError.order, moveError.status)}
                disabled={pending}
                className="h-10 rounded-xl bg-on-accent px-5 text-[15px] font-extrabold text-danger transition-transform active:scale-[.97] disabled:opacity-60"
              >
                Tentar de novo
              </button>
            )}
            <button
              onClick={() => setMoveError(null)}
              aria-label="Fechar aviso"
              className="h-10 rounded-xl px-4 text-[15px] font-extrabold text-on-accent transition-transform active:scale-[.97]"
            >
              Fechar
            </button>
          </span>
        </div>
      )}
      <div className="grid flex-1 grid-cols-3 gap-4">
        {COLUMNS.map((column) => {
          const list = orders.filter((o) => o.status === column);
          return (
            <section key={column} className="flex flex-col gap-3 rounded-2xl bg-surface/60 p-3">
              <h2 className="flex items-center justify-between px-1 text-lg font-bold">
                {COLUMN_LABEL[column]}
                <span className="rounded-full bg-surface px-2.5 text-sm text-muted">
                  {list.length}
                </span>
              </h2>
              {list.map((order) => {
                const minutes = waitingMinutes(order.placedAt, now);
                return (
                  <article
                    key={order.id}
                    className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-4xl font-semibold">
                        {order.posCheckNumber}
                      </span>
                      <span
                        className={`text-sm font-bold ${minutes >= LATE_MINUTES ? "text-danger" : "text-muted"}`}
                      >
                        {minutes} min
                      </span>
                    </div>
                    <span
                      className={`self-start rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        order.orderType === "TAKE_OUT" ? "bg-butter" : "bg-oat"
                      }`}
                    >
                      {order.orderType === "TAKE_OUT" ? "Para viagem" : "Comer aqui"}
                    </span>
                    <ul className="flex flex-col gap-1.5">
                      {order.lines.map((line, i) => (
                        <li key={i} className="flex flex-col">
                          <span className="font-semibold">
                            {line.quantity}× {line.name}
                          </span>
                          {line.options.length > 0 && (
                            <span className="text-sm text-muted">{line.options.join(", ")}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => advance(order)}
                      disabled={pending && busy === order.id}
                      className={`h-12 rounded-full text-base font-bold disabled:opacity-60 ${
                        column === "READY" ? "bg-ground text-ink" : "bg-accent text-on-accent"
                      }`}
                    >
                      {BUTTON_LABEL[column]}
                    </button>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </main>
  );
}
