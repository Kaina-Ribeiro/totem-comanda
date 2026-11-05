"use client";

import { useEffect, useState } from "react";

import type { components } from "@/lib/core-api";

type StorePace = components["schemas"]["StorePace"];
type Pace = StorePace["pace"];

const clock = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "10:57" in the restaurant's timezone. */
const hhmm = (at: number | string) => clock.format(typeof at === "string" ? Date.parse(at) : at);

const DOT = { NORMAL: "bg-leaf", BUSY: "bg-detail", PAUSED: "bg-danger" } as const;

/** The header button (prototype K1): "Ritmo normal ~8 min", "Pausado até 10:57". */
export function PaceButton({ pace, onPress }: { pace: StorePace | null; onPress: () => void }) {
  const label = !pace
    ? "Ritmo"
    : pace.pace === "PAUSED"
      ? "Pausado"
      : pace.pace === "BUSY"
        ? "Movimentado"
        : "Ritmo normal";
  const hint = !pace
    ? null
    : pace.pace === "PAUSED"
      ? pace.pausedUntil && `até ${hhmm(pace.pausedUntil)}`
      : `~${pace.waitMinutes[pace.pace]} min`;
  return (
    <button
      onClick={onPress}
      className={`flex h-11 items-center gap-2 rounded-[14px] px-4 text-[15px] font-extrabold transition-transform active:scale-[.97] ${
        pace?.pace === "PAUSED" ? "bg-danger-bg text-danger" : "bg-surface"
      }`}
    >
      <span className={`size-2.5 rounded-full ${pace ? DOT[pace.pace] : "bg-line"}`} />
      {label}
      {hint && <span className="font-semibold text-muted">{hint}</span>}
    </button>
  );
}

/**
 * "Ritmo da cozinha" (prototype K4, plan G-K5): Normal, Movimentado, or pause
 * the kiosk for 15 or 30 minutes (contract: no open-ended pause; Go resumes by
 * itself). One store-level pace, also on the back office's Início.
 */
export function PaceDialog({
  pace,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  pace: StorePace;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (pace: Pace, pauseMinutes?: 15 | 30) => void;
}) {
  const [picked, setPicked] = useState<Pace>(pace.pace);
  const [minutes, setMinutes] = useState<15 | 30>(15);
  // The resume time moves with the clock while the dialog is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const options: { value: Pace; title: string; desc: string; badge: string; tone: string }[] = [
    {
      value: "NORMAL",
      title: "Normal",
      desc: `Pedido pronto em cerca de ${pace.waitMinutes.NORMAL} min.`,
      badge: `~${pace.waitMinutes.NORMAL} min`,
      tone: "bg-sage",
    },
    {
      value: "BUSY",
      title: "Movimentado",
      desc: "O totem avisa que vai demorar um pouco mais.",
      badge: `~${pace.waitMinutes.BUSY} min`,
      tone: "bg-butter",
    },
    {
      value: "PAUSED",
      title: "Pausar pedidos no totem",
      desc: "O totem mostra “Estamos com muitos pedidos” e indica o balcão.",
      badge: "Pausado",
      tone: "bg-danger-bg",
    },
  ];
  const paused = picked === "PAUSED";
  const until = pace.pace === "PAUSED" && pace.pausedUntil ? hhmm(pace.pausedUntil) : null;
  const confirmLabel = paused
    ? `Pausar por ${minutes} min`
    : picked === pace.pace
      ? "Manter"
      : picked === "BUSY"
        ? "Mudar para movimentado"
        : pace.pace === "PAUSED"
          ? "Retomar agora"
          : "Voltar ao normal";

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-[rgba(28,28,26,.45)] px-4 pt-16">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pace-title"
        className="flex w-[700px] max-w-full animate-fade-in flex-col gap-5 rounded-2xl bg-surface px-9 pt-8 pb-[30px] shadow-[0_24px_60px_rgba(28,28,26,.25)]"
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="pace-title" className="text-[28px] font-bold tracking-[-0.02em]">
            Ritmo da cozinha
          </h2>
          <p className="text-base leading-[1.45] font-semibold text-muted">
            O totem mostra ao cliente quanto vai demorar. Vale para a loja toda e aparece também no
            Início do back office.
          </p>
        </div>

        <div role="radiogroup" aria-label="Ritmo" className="flex flex-col gap-2.5">
          {options.map((option) => {
            const on = option.value === picked;
            const current = option.value === pace.pace;
            return (
              <button
                key={option.value}
                role="radio"
                aria-checked={on}
                onClick={() => setPicked(option.value)}
                className={`flex min-h-[76px] items-center gap-4 rounded-xl px-[18px] py-3 text-left transition-transform active:scale-[.99] ${
                  on ? "border-2 border-accent bg-[#fbf8f3]" : "border-[1.5px] border-line bg-surface"
                }`}
              >
                <span
                  className={`flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 ${
                    on ? "border-accent" : "border-[#b5ada3]"
                  }`}
                >
                  <span className={`size-3 rounded-full ${on ? "bg-accent" : ""}`} />
                </span>
                <span className="flex grow flex-col gap-[3px]">
                  <span className="text-[19px] font-extrabold">
                    {option.title}
                    {current && (option.value === "PAUSED" && until ? ` · até ${until}` : " · agora")}
                  </span>
                  <span className="text-[15px] font-semibold text-muted">{option.desc}</span>
                </span>
                <span
                  className={`flex h-[30px] items-center rounded-[15px] px-3 text-sm font-extrabold whitespace-nowrap ${option.tone}`}
                >
                  {option.badge}
                </span>
              </button>
            );
          })}
        </div>

        {paused && (
          <div className="flex flex-col gap-2.5 rounded-xl bg-ground px-[18px] py-4">
            <span className="text-[15px] font-extrabold">Por quanto tempo?</span>
            <div role="radiogroup" aria-label="Duração da pausa" className="flex gap-2">
              {([15, 30] as const).map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={m === minutes}
                  onClick={() => setMinutes(m)}
                  className={`h-12 rounded-2xl px-5 text-[15px] font-extrabold transition-transform active:scale-[.97] ${
                    m === minutes
                      ? "bg-accent text-on-accent"
                      : "border-[1.5px] border-line bg-surface text-ink"
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold text-muted">
              Volta sozinho para Normal às {hhmm(now + minutes * 60_000)}. Dá para retomar antes,
              aqui ou no Início.
            </span>
          </div>
        )}

        {error && (
          <p role="alert" className="text-[15px] font-bold text-danger">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="h-[60px] flex-1 rounded-[30px] bg-ground text-[17px] font-extrabold transition-transform active:scale-[.97]"
          >
            Cancelar
          </button>
          <button
            onClick={() =>
              picked === pace.pace && !paused ? onCancel() : onConfirm(picked, paused ? minutes : undefined)
            }
            disabled={busy}
            className="h-[60px] flex-[1.6_1_0] rounded-[30px] bg-accent text-[17px] font-extrabold text-on-accent transition-transform active:scale-[.97] disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
