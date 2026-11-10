"use client";

import { useEffect, useRef, useState } from "react";

import type { components } from "@/lib/core-api-v2";

type Reason = components["schemas"]["OrderCancelRequest"]["reason"];

const REASONS: { value: Reason; label: string }[] = [
  { value: "ITEM_SOLD_OUT", label: "Acabou um item" },
  { value: "CANNOT_PREPARE", label: "Não dá para preparar" },
  { value: "OTHER", label: "Outro motivo" },
];

/** What the kitchen reads when the cancel does not go through. */
export function cancelErrorText(code: string): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
    case "VALIDATION_FAILED":
      return "E-mail ou senha da dona não conferem.";
    case "INVALID_STATUS_TRANSITION":
    case "NOT_FOUND":
      return "Este pedido já saiu do quadro. Nada foi cancelado.";
    default:
      return "Não deu para cancelar agora. Verifique a conexão e tente de novo.";
  }
}

/**
 * "Cancelar pedido" (plan G-K11, decision 12): the owner confirms with the
 * back-office email and password, no PIN. The fields are not saved by the
 * browser, so the tablet never keeps the owner's password.
 */
export function CancelDialog({
  number,
  defaultReason,
  busy,
  error,
  onBack,
  onConfirm,
}: {
  number: string;
  defaultReason: Reason;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: (input: { email: string; password: string; reason: Reason }) => void;
}) {
  const [reason, setReason] = useState<Reason>(defaultReason);
  const email = useRef<HTMLInputElement>(null);

  useEffect(() => email.current?.focus(), []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(28,28,26,.45)] p-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-title"
        autoComplete="off"
        onKeyDown={(event) => {
          // Escape closes this dialog only, not the order detail under it.
          if (event.key === "Escape") {
            event.stopPropagation();
            onBack();
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          onConfirm({
            email: String(data.get("owner-email") ?? ""),
            password: String(data.get("owner-secret") ?? ""),
            reason,
          });
        }}
        className="flex w-[540px] max-w-full animate-fade-in flex-col gap-5 rounded-3xl bg-surface p-7 shadow-[0_12px_32px_rgba(28,28,26,.18)]"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="cancel-title" className="text-[26px] font-extrabold tracking-[-0.02em]">
            Cancelar o pedido {number}?
          </h2>
          <p className="text-[15px] leading-[1.4] font-semibold text-muted">
            O pedido sai do quadro e não conta no faturamento. O estorno é feito no painel do
            Mercado Pago. A dona confirma com o e-mail e a senha do painel.
          </p>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-extrabold">Motivo</legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                onClick={() => setReason(r.value)}
                className={`h-11 rounded-[14px] px-3.5 text-[15px] font-extrabold transition-transform active:scale-[.97] ${
                  reason === r.value ? "bg-accent text-on-accent" : "bg-ground text-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            E-mail da dona
            <input
              ref={email}
              name="owner-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              required
              className="h-14 rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-[17px] font-semibold outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-extrabold">
            Senha
            <input
              name="owner-secret"
              type="password"
              autoComplete="new-password"
              required
              className="h-14 rounded-[14px] border-[1.5px] border-line bg-surface px-4 text-[17px] font-semibold outline-none focus:border-accent"
            />
          </label>
          {error && (
            <p role="alert" className="text-[15px] font-bold text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBack}
            className="h-14 flex-1 rounded-2xl bg-ground text-[17px] font-extrabold transition-transform active:scale-[.97]"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-14 flex-[1.3_1_0] rounded-2xl bg-danger text-[17px] font-extrabold text-white transition-transform active:scale-[.97] disabled:opacity-60"
          >
            {busy ? "Cancelando…" : "Cancelar pedido"}
          </button>
        </div>
      </form>
    </div>
  );
}
