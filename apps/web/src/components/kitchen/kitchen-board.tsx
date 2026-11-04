"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

import { moveOrder, setSoldOut } from "@/app/kitchen/actions";
import type { components } from "@/lib/core-api";
import {
  accept,
  applyOrder,
  COLUMNS,
  mergeSnapshot,
  moveErrorMessage,
  movedLabel,
  type MoveError,
  NEXT_STATUS,
  PREVIOUS_STATUS,
  type Seen,
} from "@/lib/kitchen/board";

import { NewOrdersBar, SoundButton, SoundDialog, useNewOrderAlert } from "./new-order-alert";
import { OrderCard } from "./order-card";
import { OrderDrawer } from "./order-drawer";
import { ProductionView } from "./production-view";
import { lineTargets, SoldOutButton, SoldOutPanel, soldOutKey, type SoldOutTarget } from "./sold-out";
import { UndoToast } from "./undo-toast";

type KitchenOrder = components["schemas"]["KitchenOrder"];

/** The contract's fallback when the event stream drops: poll every 2 s. */
const POLL_MS = 2_000;
/** While polling, try the stream again this often. */
const RECONNECT_MS = 30_000;
/** While live, reload the whole list this often, so a lost event cannot leave the board wrong (KDS WF-11). */
const FULL_REFRESH_MS = 60_000;

/** The open orders as Go has them; null while Go or the network cannot answer. */
async function fetchOpenOrders(): Promise<KitchenOrder[] | null> {
  try {
    const response = await fetch("/api/kitchen/orders", { cache: "no-store" });
    return response.ok ? ((await response.json()) as KitchenOrder[]) : null;
  } catch {
    return null; // Offline: the next tick tries again.
  }
}

/** The open orders with the time the request left, for `mergeSnapshot`. */
async function fetchSnapshot(): Promise<{ open: KitchenOrder[]; startedAt: number } | null> {
  const startedAt = Date.now();
  const open = await fetchOpenOrders();
  return open && { open, startedAt };
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
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"orders" | "production">("orders");
  // The order open in the detail drawer (K2); it follows the board's copy.
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = orders.find((o) => o.id === openId) ?? null;
  // The last action that can be undone for 5 s (prototype K1 toast): a move or an "Acabou".
  const [undo, setUndo] = useState<{ key: string; label: string; run: () => void } | null>(null);
  // "Acabou" (G-K4): the line being asked about, and what this tablet marked today.
  const [soldOutAsk, setSoldOutAsk] = useState<{ line: number; target: SoldOutTarget } | null>(
    null,
  );
  const [soldOutError, setSoldOutError] = useState<string | null>(null);
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());
  // Highest version seen per order, so late events and reloads cannot move a card back (G-K3).
  const seen = useRef<Seen>(new Map(initial.map((o) => [o.id, { version: o.version, at: 0 }])));
  const alert = useNewOrderAlert();
  // Orders the board has shown; a PAID one not in here is new (G-K1).
  const known = useRef(new Set(initial.map((o) => o.id)));

  /** Paid orders the board has not shown yet; remembers every order it sees. */
  const newPaid = (list: KitchenOrder[]) => {
    const ids = list.filter((o) => o.status === "PAID" && !known.current.has(o.id)).map((o) => o.id);
    for (const o of list) known.current.add(o.id);
    return ids;
  };
  const onIncoming = useEffectEvent((list: KitchenOrder[]) => alert.arrived(newPaid(list)));

  /** Reloads the open orders from Go; the board then shows where each card really is. */
  const refresh = async () => {
    const snapshot = await fetchSnapshot();
    if (snapshot) {
      const { open, startedAt } = snapshot;
      setOrders((current) => mergeSnapshot(current, open, seen.current, startedAt, Date.now()));
      alert.arrived(newPaid(open));
    }
    return snapshot !== null;
  };

  /** The header's refresh button: reloads and shows it is working. */
  async function refreshNow() {
    if (refreshing) return;
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // Waiting times and the clock tick every 20 s.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);

  // While live, a full reload every 60 s; while polling, the 2 s poll already does it.
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(async () => {
      const snapshot = await fetchSnapshot();
      if (snapshot) {
        const { open, startedAt } = snapshot;
        setOrders((current) => mergeSnapshot(current, open, seen.current, startedAt, Date.now()));
        onIncoming(open);
      }
    }, FULL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [live]);

  // Event stream while it works; polling while it does not.
  useEffect(() => {
    let stream: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const refresh = async () => {
      const snapshot = await fetchSnapshot();
      if (snapshot) {
        const { open, startedAt } = snapshot;
        setOrders((current) => mergeSnapshot(current, open, seen.current, startedAt, Date.now()));
        onIncoming(open);
      }
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
      const onOrder = (event: MessageEvent<string>) => {
        const order = JSON.parse(event.data) as KitchenOrder;
        if (!accept(seen.current, order, Date.now())) return; // A late event.
        setOrders((current) => applyOrder(current, order));
        onIncoming([order]);
      };
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

  /**
   * Moves `order` to `status` if Go still has the version the board shows; a
   * failure is shown and the board reloads from Go. A forward move to Pronto
   * or Retirado offers "Desfazer" for 5 s.
   */
  function move(order: KitchenOrder, status: MoveError["status"], { back = false } = {}) {
    setBusy(order.id);
    setMoveError(null);
    setUndo(null);
    startTransition(async () => {
      // A tablet that lost the network rejects instead of answering.
      const result = await moveOrder(order.id, status, order.version).catch(
        () => ({ ok: false, code: "NETWORK" }) as const,
      );
      if (result.ok) {
        if (accept(seen.current, result.data, Date.now())) {
          setOrders((current) => applyOrder(current, result.data));
        }
        const label = !back && movedLabel(result.data);
        const moved = result.data;
        if (label) {
          setUndo({ key: `${moved.id}:${moved.version}`, label, run: () => stepBack(moved) });
        }
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

  /** Opens or closes an order's detail; a pending "Acabou" question goes with it. */
  function openOrder(id: string | null) {
    setOpenId(id);
    setSoldOutAsk(null);
    setSoldOutError(null);
  }

  /**
   * Marks `target` sold out for today (or back, for the undo). The order on
   * screen stays open (KDS BR-027); the kiosk loses the item on its next menu load.
   */
  function markSoldOut(target: SoldOutTarget, soldOut: boolean) {
    setSoldOutError(null);
    startTransition(async () => {
      const result = await setSoldOut(target.itemId, target.optionId, soldOut).catch(
        () => ({ ok: false, code: "NETWORK" }) as const,
      );
      if (!result.ok) {
        if (soldOut) setSoldOutError("Não deu para marcar. Verifique a conexão e tente de novo.");
        else {
          setUndo({
            key: `sold-out-retry:${soldOutKey(target)}:${Date.now()}`,
            label: `Não deu para desfazer: ${target.name}`,
            run: () => markSoldOut(target, false),
          });
        }
        return;
      }
      const key = soldOutKey(target);
      setMarked((current) => {
        const next = new Set(current);
        if (soldOut) next.add(key);
        else next.delete(key);
        return next;
      });
      if (soldOut) {
        setSoldOutAsk(null);
        setUndo({
          key: `sold-out:${key}`,
          label: `${target.name}: esgotado hoje`,
          run: () => markSoldOut(target, false),
        });
      } else {
        setUndo(null);
      }
    });
  }

  /** One step back: "Desfazer" after a move, or "Voltar uma etapa" in the detail. */
  function stepBack(order: KitchenOrder) {
    const status = PREVIOUS_STATUS[order.status as keyof typeof PREVIOUS_STATUS];
    if (status) move(order, status, { back: true });
  }

  const errorMessage = moveError && moveErrorMessage(moveError);

  return (
    <main className="flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-ground text-ink tabular-nums">
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
        <nav aria-label="Telas da cozinha" className="flex gap-1 rounded-2xl bg-tabs p-1">
          {(["orders", "production"] as const).map((tab) => {
            const on = view === tab;
            return (
              <button
                key={tab}
                onClick={() => setView(tab)}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center gap-2 rounded-[14px] text-[15px] font-extrabold transition-transform active:scale-[.97] ${
                  tab === "orders" ? "pr-2.5 pl-[18px]" : "px-[18px]"
                } ${on ? "bg-accent text-on-accent" : "text-muted"}`}
              >
                {tab === "orders" ? "Pedidos" : "Produção"}
                {tab === "orders" && (
                  <span
                    className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-[13px] px-[7px] text-[13px] ${
                      on ? "bg-detail-light text-ink" : "bg-ground text-ink"
                    }`}
                  >
                    {orders.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5">
          <SoundButton on={alert.soundOn} onPress={alert.openDialog} />
          <button
            onClick={refreshNow}
            disabled={refreshing}
            aria-label="Atualizar pedidos"
            title="Atualizar pedidos"
            className="flex size-11 items-center justify-center rounded-[14px] bg-surface transition-transform active:scale-[.97] disabled:opacity-60"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={refreshing ? "animate-spin" : undefined}
            >
              <path d="M20 11a8 8 0 10-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
          </button>
          <span className="min-w-16 text-right text-xl font-bold tracking-[-0.02em]">
            {clock.format(now)}
          </span>
        </div>
      </header>

      {alert.unseen.length > 0 && (
        <NewOrdersBar
          numbers={orders.filter((o) => alert.unseen.includes(o.id)).map((o) => o.posCheckNumber)}
          repeating={alert.soundOn && alert.settings.repeat}
          onSeen={alert.acknowledge}
        />
      )}
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

      {view === "production" ? (
        <ProductionView orders={orders} />
      ) : (
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
                    isNew={alert.unseen.includes(order.id)}
                    onOpen={() => openOrder(order.id)}
                    onAdvance={() => advance(order)}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
      {opened && (
        <OrderDrawer
          order={opened}
          now={now}
          busy={pending && busy === opened.id}
          onClose={() => openOrder(null)}
          lineAction={(line, index) => (
            <SoldOutButton
              marked={marked.has(soldOutKey({ itemId: line.itemId, optionId: null }))}
              onPress={() => {
                setSoldOutError(null);
                const first = lineTargets(line).find((t) => !marked.has(soldOutKey(t)))!;
                setSoldOutAsk({ line: index, target: first });
              }}
            />
          )}
          lineExtra={(line, index) =>
            soldOutAsk?.line === index && (
              <SoldOutPanel
                line={line}
                target={soldOutAsk.target}
                marked={(t) => marked.has(soldOutKey(t))}
                busy={pending}
                error={soldOutError}
                onPick={(target) => setSoldOutAsk({ line: index, target })}
                onCancel={() => setSoldOutAsk(null)}
                onConfirm={() => markSoldOut(soldOutAsk.target, true)}
              />
            )
          }
          onAdvance={() => advance(opened)}
          secondary={
            opened.status === "READY" && (
              <button
                onClick={() => stepBack(opened)}
                disabled={pending && busy === opened.id}
                className="flex h-16 flex-[1_1_0] items-center justify-center gap-2 rounded-2xl bg-ground text-[17px] font-extrabold transition-transform active:scale-[.97] disabled:opacity-60"
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
                Voltar uma etapa
              </button>
            )
          }
        />
      )}
      {undo && (
        <UndoToast
          key={undo.key}
          label={undo.label}
          busy={pending}
          onUndo={undo.run}
          onExpire={() => setUndo(null)}
        />
      )}
      {alert.dialogOpen && <SoundDialog {...alert.dialogProps} />}
    </main>
  );
}
