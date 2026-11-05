"use client";

import { useEffect } from "react";

import { closeDayQuestion } from "@/lib/kitchen/close-day";

/** The header button: off while the board has nothing open (KDS FEAT-033). */
export function CloseDayButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      title={disabled ? "Nenhum pedido aberto" : undefined}
      className="flex h-11 items-center gap-2 rounded-[14px] bg-surface px-4 text-[15px] font-extrabold transition-transform active:scale-[.97] disabled:text-muted disabled:opacity-60 disabled:active:scale-100"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
      </svg>
      Encerrar o dia
    </button>
  );
}

/**
 * "Encerrar o dia?" (plan G-K9, no artboard; styled like K4): the count of
 * open orders that leave the board as "não retirado", never as "Retirado".
 * A failure keeps the dialog open with the error so the kitchen can retry.
 */
export function CloseDayDialog({
  count,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-[rgba(28,28,26,.45)] px-4 pt-16">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="close-day-title"
        aria-describedby="close-day-count"
        className="flex w-[560px] max-w-full animate-fade-in flex-col gap-5 rounded-2xl bg-surface px-9 pt-8 pb-[30px] shadow-[0_24px_60px_rgba(28,28,26,.25)]"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="close-day-title" className="text-[28px] font-bold tracking-[-0.02em]">
            Encerrar o dia?
          </h2>
          <p className="text-base leading-[1.45] font-semibold text-muted">
            Use no fim do expediente, quando ninguém mais vai buscar pedidos.
          </p>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-butter px-5 py-4">
          <span className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-2xl bg-surface px-3 text-[30px] leading-none font-extrabold tracking-[-0.02em]">
            {count}
          </span>
          <span className="flex flex-col gap-1">
            <span id="close-day-count" className="text-[19px] font-extrabold">
              {closeDayQuestion(count)}
            </span>
            <span className="text-[15px] font-semibold text-detail-text">
              Eles saem do quadro e não contam como entregues.
            </span>
          </span>
        </div>

        {error && (
          <p role="alert" className="text-[15px] font-bold text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={busy}
            className="h-[60px] flex-1 rounded-[30px] bg-ground text-[17px] font-extrabold transition-transform active:scale-[.97] disabled:opacity-60"
          >
            Voltar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="h-[60px] flex-[1.6_1_0] rounded-[30px] bg-accent text-[17px] font-extrabold text-on-accent transition-transform active:scale-[.97] disabled:opacity-60"
          >
            {busy ? "Encerrando…" : error ? "Tentar de novo" : "Encerrar o dia"}
          </button>
        </div>
      </div>
    </div>
  );
}
