"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";

import {
  cancelOrder,
  closeKitchenDay,
  moveOrder,
  readKitchenPace,
  setKitchenPace,
  setSoldOut,
} from "@/app/kitchen/actions";
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
import { closeDayError, closedDayLabel } from "@/lib/kitchen/close-day";
import { applyCollected } from "@/lib/kitchen/collected";
import { newerPace } from "@/lib/kitchen/pace";

import { CancelDialog, cancelErrorText } from "./cancel-dialog";
import { CloseDayButton, CloseDayDialog } from "./close-day-dialog";
import { CollectedView } from "./collected-view";
import { NewOrdersBar, SoundButton, SoundDialog, useNewOrderAlert } from "./new-order-alert";
import { OrderCard } from "./order-card";
import { OrderDrawer } from "./order-drawer";
import { PaceButton, PaceDialog } from "./pace-dialog";
import { ProductionView } from "./production-view";
import { lineTargets, SoldOutButton, SoldOutPanel, soldOutKey, type SoldOutTarget } from "./sold-out";
import { UndoToast } from "./undo-toast";

type KitchenOrder = components["schemas"]["KitchenOrder"];
type StorePace = components["schemas"]["StorePace"];

/** The contract's fallback when the event stream drops: poll every 2 s. */
const POLL_MS = 2_000;
/** While polling, try the stream again this often. */
const RECONNECT_MS = 30_000;
/** While live, reload the whole list this often, so a lost event cannot leave the board wrong (KDS WF-11). */
const FULL_REFRESH_MS = 60_000;
/** While polling, read the store's pace this often; live, the stream announces it (COM-121). */
const PACE_POLL_MS = 10_000;

/** Open orders, or today's collected ones, as Go has them; null while Go or the network cannot answer. */
async function fetchOrders(status: "open" | "collected"): Promise<KitchenOrder[] | null> {
  try {
    const query = status === "collected" ? "?status=collected" : "";
    const response = await fetch(`/api/kitchen/orders${query}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as KitchenOrder[]) : null;
  } catch {
    return null; // Offline: the next tick tries again.
  }
}

/** Both lists with the time the requests left, for `mergeSnapshot`; null without the open ones. */
type Snapshot = { open: KitchenOrder[]; collected: KitchenOrder[] | null; startedAt: number };

async function fetchSnapshot(): Promise<Snapshot | null> {
  const startedAt = Date.now();
  const [open, collected] = await Promise.all([fetchOrders("open"), fetchOrders("collected")]);
  return open && { open, collected, startedAt };
}

const COLUMN_LABEL = { PAID: "Novos", PREPARING: "Preparando", READY: "Prontos" } as const;
const TAB_LABEL = { orders: "Pedidos", production: "Produção", collected: "Retirados" } as const;

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
export function KitchenBoard({
  initial,
  initialCollected,
  initialPace,
}: {
  initial: KitchenOrder[];
  /** Today's collected orders, newest first ("Retirados", G-K7). */
  initialCollected: KitchenOrder[];
  /** Null when Go did not answer; the header then shows a plain "Ritmo". */
  initialPace: StorePace | null;
}) {
  const [orders, setOrders] = useState(initial);
  const [collected, setCollected] = useState(initialCollected);
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  // The last move Go did not take (KDS BR-012): shown until retried or dismissed.
  const [moveError, setMoveError] = useState<MoveError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"orders" | "production" | "collected">("orders");
  // The order open in the detail drawer (K2); it follows the board's copy.
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = orders.find((o) => o.id === openId) ?? null;
  // The last action that can be undone for 5 s (prototype K1 toast): a move or an "Acabou".
  const [undo, setUndo] = useState<{ key: string; label: string; run?: () => void } | null>(null);
  // "Cancelar pedido" (G-K11): the order asked about and the last error.
  const [cancelling, setCancelling] = useState<KitchenOrder | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // The store's pace (G-K5, K4), also set from Início: re-read with every full reload.
  const [pace, setPace] = useState(initialPace);
  const [paceOpen, setPaceOpen] = useState(false);
  const [paceError, setPaceError] = useState<string | null>(null);
  // "Encerrar o dia" (G-K9): the confirmation and its last error.
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  // "Acabou" (G-K4): the line being asked about, and what this tablet marked today.
  const [soldOutAsk, setSoldOutAsk] = useState<{ line: number; target: SoldOutTarget } | null>(
    null,
  );
  const [soldOutError, setSoldOutError] = useState<string | null>(null);
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());
  // Highest version seen per order, so late events and reloads cannot move a card back (G-K3).
  const seen = useRef<Seen>(
    new Map([...initial, ...initialCollected].map((o) => [o.id, { version: o.version, at: 0 }])),
  );
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
  const onPaceTick = useEffectEvent(() => void reloadPace());
  /** A pace from Go (stream or read); an older one than the board's is dropped. */
  const showPace = (next: StorePace) => setPace((current) => newerPace(current, next));
  const onPaceEvent = useEffectEvent((next: StorePace) => showPace(next));

  /** Puts a full reload on the board and in Retirados (the latter only if it loaded). */
  const takeSnapshot = ({ open, collected: done, startedAt }: Snapshot) => {
    const at = Date.now();
    setOrders((current) => mergeSnapshot(current, open, seen.current, startedAt, at));
    if (done) {
      setCollected((current) =>
        mergeSnapshot(current, done, seen.current, startedAt, at, applyCollected),
      );
    }
  };
  const onSnapshot = useEffectEvent((snapshot: Snapshot) => {
    takeSnapshot(snapshot);
    alert.arrived(newPaid(snapshot.open));
  });

  /** One order Go answered or announced, on the board and in Retirados. */
  const putOrder = (order: KitchenOrder) => {
    setOrders((current) => applyOrder(current, order));
    setCollected((current) => applyCollected(current, order));
  };
  const onPut = useEffectEvent((order: KitchenOrder) => putOrder(order));

  /** Reloads the open orders from Go; the board then shows where each card really is. */
  const refresh = async () => {
    const snapshot = await fetchSnapshot();
    if (snapshot) {
      takeSnapshot(snapshot);
      alert.arrived(newPaid(snapshot.open));
    }
    return snapshot !== null;
  };

  /** The header's refresh button: reloads orders and the pace and shows it is working. */
  async function refreshNow() {
    if (refreshing) return;
    setRefreshing(true);
    await Promise.all([refresh(), reloadPace()]);
    setRefreshing(false);
  }

  /** Reads the pace again; keeps the last one if Go does not answer. */
  async function reloadPace() {
    const result = await readKitchenPace().catch(() => null);
    if (result?.ok) showPace(result.data);
  }

  /** Saves the pace from the K4 dialog. */
  function choosePace(next: StorePace["pace"], pauseMinutes?: 15 | 30) {
    setPaceError(null);
    startTransition(async () => {
      const result = await setKitchenPace(next, pauseMinutes).catch(
        () => ({ ok: false, code: "NETWORK" }) as const,
      );
      if (!result.ok) {
        setPaceError("Não deu para mudar o ritmo. Verifique a conexão e tente de novo.");
        return;
      }
      setPace(result.data);
      setPaceOpen(false);
    });
  }

  /**
   * Closes the day: Go moves today's open orders to NOT_COLLECTED. The board
   * empties at once and then reloads, so anything Go still has open (an order
   * paid a second later) comes back. A failure keeps the dialog for a retry.
   */
  function closeDay() {
    setCloseError(null);
    startTransition(async () => {
      const result = await closeKitchenDay().catch(() => ({ ok: false, code: "NETWORK" }) as const);
      if (!result.ok) {
        setCloseError(closeDayError);
        await refresh();
        return;
      }
      setOrders([]);
      setCloseOpen(false);
      openOrder(null);
      setUndo({ key: `close-day:${Date.now()}`, label: closedDayLabel(result.data.count) });
      await refresh();
    });
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
      if (snapshot) onSnapshot(snapshot);
      onPaceTick();
    }, FULL_REFRESH_MS);
    return () => clearInterval(timer);
  }, [live]);

  // Event stream while it works; polling while it does not.
  useEffect(() => {
    let stream: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | undefined;
    let pacePoll: ReturnType<typeof setInterval> | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const refresh = async () => {
      const snapshot = await fetchSnapshot();
      if (snapshot) onSnapshot(snapshot);
    };

    const startPolling = () => {
      setLive(false);
      if (!poll) poll = setInterval(refresh, POLL_MS);
      if (!pacePoll) pacePoll = setInterval(onPaceTick, PACE_POLL_MS);
      retry = setTimeout(connect, RECONNECT_MS);
    };

    function connect() {
      if (closed) return;
      stream?.close();
      stream = new EventSource("/api/kitchen/stream");
      const onOrder = (event: MessageEvent<string>) => {
        const order = JSON.parse(event.data) as KitchenOrder;
        if (!accept(seen.current, order, Date.now())) return; // A late event.
        onPut(order);
        onIncoming([order]);
      };
      stream.addEventListener("order.paid", onOrder);
      stream.addEventListener("order.status_changed", onOrder);
      // The pace set from Início, or Go's automatic resume after a pause (COM-121).
      stream.addEventListener("store.pace_changed", (event: MessageEvent<string>) =>
        onPaceEvent(JSON.parse(event.data) as StorePace),
      );
      stream.onopen = () => {
        setLive(true);
        clearInterval(poll);
        clearInterval(pacePoll);
        poll = undefined;
        pacePoll = undefined;
        // Catch up on anything missed while disconnected, the pace included.
        void refresh();
        onPaceTick();
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
      clearInterval(pacePoll);
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
        if (accept(seen.current, result.data, Date.now())) putOrder(result.data);
        const label = !back && movedLabel(result.data);
        const moved = result.data;
        if (label) {
          setUndo({ key: `${moved.id}:${moved.version}`, label, run: () => stepBack(moved) });
        } else if (back && order.status === "COLLECTED") {
          setUndo({
            key: `${moved.id}:${moved.version}`,
            label: `Pedido ${moved.posCheckNumber} voltou para Prontos`,
          });
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

  /** Cancels `order` with the owner's login; it leaves the board on success. */
  function confirmCancel(
    order: KitchenOrder,
    input: { email: string; password: string; reason: Parameters<typeof cancelOrder>[3] },
  ) {
    setCancelError(null);
    startTransition(async () => {
      const result = await cancelOrder(order.id, input.email, input.password, input.reason).catch(
        () => ({ ok: false, code: "NETWORK" }) as const,
      );
      if (!result.ok) {
        setCancelError(cancelErrorText(result.code));
        if (result.code === "INVALID_STATUS_TRANSITION" || result.code === "NOT_FOUND") {
          await refresh();
        }
        return;
      }
      if (accept(seen.current, result.data, Date.now())) {
        setOrders((current) => applyOrder(current, result.data));
      }
      setCancelling(null);
      openOrder(null);
      setUndo({ key: `cancel:${order.id}`, label: `Pedido ${order.posCheckNumber} cancelado` });
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
          {(["orders", "production", "collected"] as const).map((tab) => {
            const on = view === tab;
            const count =
              tab === "orders" ? orders.length : tab === "collected" ? collected.length : null;
            return (
              <button
                key={tab}
                onClick={() => setView(tab)}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center gap-2 rounded-[14px] text-[15px] font-extrabold transition-transform active:scale-[.97] ${
                  count === null ? "px-[18px]" : "pr-2.5 pl-[18px]"
                } ${on ? "bg-accent text-on-accent" : "text-muted"}`}
              >
                {TAB_LABEL[tab]}
                {count !== null && (
                  <span
                    className={`flex h-[26px] min-w-[26px] items-center justify-center rounded-[13px] px-[7px] text-[13px] ${
                      on ? "bg-detail-light text-ink" : "bg-ground text-ink"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-2.5">
          <PaceButton
            pace={pace}
            onPress={() => {
              setPaceError(null);
              setPaceOpen(true);
              void reloadPace();
            }}
          />
          <SoundButton on={alert.soundOn} onPress={alert.openDialog} />
          <CloseDayButton
            disabled={orders.length === 0}
            onPress={() => {
              setCloseError(null);
              setCloseOpen(true);
            }}
          />
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
      ) : view === "collected" ? (
        <CollectedView
          orders={collected}
          busyId={pending ? busy : null}
          onBack={(order) => move(order, "READY", { back: true })}
        />
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
          footnote={
            <button
              onClick={() => {
                setCancelError(null);
                setCancelling(opened);
              }}
              className="self-start rounded-xl px-1 py-2 text-[15px] font-extrabold text-danger underline-offset-4 transition-colors hover:underline active:text-detail-text"
            >
              Não dá para fazer? Cancelar pedido
            </button>
          }
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
      {paceOpen && pace && (
        <PaceDialog
          pace={pace}
          busy={pending}
          error={paceError}
          onCancel={() => setPaceOpen(false)}
          onConfirm={choosePace}
        />
      )}
      {closeOpen && (
        <CloseDayDialog
          count={orders.length}
          busy={pending}
          error={closeError}
          onCancel={() => setCloseOpen(false)}
          onConfirm={closeDay}
        />
      )}
      {cancelling && (
        <CancelDialog
          number={cancelling.posCheckNumber}
          defaultReason={
            cancelling.lines.some((l) => lineTargets(l).some((t) => marked.has(soldOutKey(t))))
              ? "ITEM_SOLD_OUT"
              : "CANNOT_PREPARE"
          }
          busy={pending}
          error={cancelError}
          onBack={() => setCancelling(null)}
          onConfirm={(input) => confirmCancel(cancelling, input)}
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
