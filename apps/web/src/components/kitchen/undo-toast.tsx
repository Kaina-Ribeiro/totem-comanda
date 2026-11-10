"use client";

import { useEffect, useEffectEvent, useState } from "react";

/** How long "Desfazer" stays after a move (plan decision 2). */
export const UNDO_MS = 5_000;

/**
 * The toast after a move that can be undone (prototype K1): "Pedido 38
 * retirado · Desfazer · 4 s", counting down, gone after 5 s.
 */
export function UndoToast({
  label,
  busy,
  onUndo,
  onExpire,
}: {
  label: string;
  busy: boolean;
  /** Without it the toast only informs (e.g. "Pedido 41 cancelado"). */
  onUndo?: () => void;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(UNDO_MS / 1000);
  const expire = useEffectEvent(onExpire);

  useEffect(() => {
    const end = Date.now() + UNDO_MS;
    const timer = setInterval(() => {
      const seconds = Math.ceil((end - Date.now()) / 1000);
      if (seconds <= 0) expire();
      else setLeft(seconds);
    }, 250);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      role="status"
      className="fixed bottom-[18px] left-1/2 z-45 flex h-14 w-[400px] max-w-[calc(100vw-32px)] -translate-x-1/2 animate-fade-in items-center justify-between rounded-2xl bg-ink pr-2 pl-[22px] text-on-accent shadow-[0_8px_24px_rgba(28,28,26,.20)]"
    >
      <span className="text-[15px] font-bold">{label}</span>
      {onUndo ? (
        <button
          onClick={onUndo}
          disabled={busy}
          className="h-10 rounded-xl bg-toast-button px-4 text-[15px] font-extrabold text-detail-light transition-transform active:scale-[.97] disabled:opacity-60"
        >
          Desfazer · {left} s
        </button>
      ) : (
        <span className="h-10" />
      )}
    </div>
  );
}
