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
} from "@/lib/kitchen/board";

import { OrderCard } from "./order-card";

type KitchenOrder = components["schemas"]["KitchenOrder"];

/** The contract's fallback when the event stream drops: poll every 2 s. */
const POLL_MS = 2_000;
/** While polling, try the stream again this often. */
const RECONNECT_MS = 30_000;

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

const clock = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/**
 * The kitchen screen (prototype K1): paid orders, oldest first, moved New →
 * Preparing → Ready → Collected with one tap. Live through the BFF's event
 * stream; falls back to polling the open orders every 2 s while it is down.
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

  // Waiting times and the clock tick every 20 s.
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
    <main className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden bg-ground text-ink tabular-nums">
      <header className="flex h-[76px] shrink-0 items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3.5">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Cozinha</h1>
          <span
            role="status"
            className={`flex h-7 items-center gap-[7px] rounded-[14px] px-3 text-[13px] font-extrabold ${
              live ? "bg-sage" : "bg-butter text-detail-text"
            }`}
          >
            <span className={`size-2 rounded-full ${live ? "bg-leaf" : "bg-detail"}`} />
            {live ? "Ao vivo" : "Reconectando… atualiza a cada 2 s"}
          </span>
        </div>
        <span className="min-w-16 text-right text-xl font-bold tracking-[-0.02em]">
          {clock.format(now)}
        </span>
      </header>

      {moveError && errorMessage && (
        <div
          role="alert"
          className="mx-6 flex min-h-14 shrink-0 items-center justify-between gap-4 rounded-xl bg-danger py-2 pr-2 pl-5 text-on-accent"
        >
          <span className="text-[17px] font-extrabold">{errorMessage.text}</span>
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

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 px-6 pt-4 pb-6">
        {COLUMNS.map((column) => {
          const list = orders.filter((o) => o.status === column);
          return (
            <section
              key={column}
              aria-label={COLUMN_LABEL[column]}
              className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl bg-tray p-3"
            >
              <h2 className="flex items-center justify-between px-1.5 pt-0.5 text-[17px] font-extrabold">
                {COLUMN_LABEL[column]}
                <span className="flex h-7 min-w-7 items-center justify-center rounded-[14px] bg-surface px-2 text-sm text-muted">
                  {list.length}
                </span>
              </h2>
              {list.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  now={now}
                  busy={pending && busy === order.id}
                  onAdvance={() => advance(order)}
                />
              ))}
            </section>
          );
        })}
      </div>
    </main>
  );
}
