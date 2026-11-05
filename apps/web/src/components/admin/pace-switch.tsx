"use client";

import { useActionState } from "react";

import type { FormState } from "@/lib/admin/form";

type Pace = "NORMAL" | "BUSY" | "PAUSED";

/**
 * "Ritmo da cozinha" on the Início band (prototype A1): Normal, Movimentado
 * or Pausar for 15 min. The same store pace the kitchen sets (decision 3).
 */
export function PaceSwitch({
  pace,
  waitMinutes,
  action,
}: {
  pace: Pace;
  waitMinutes: { NORMAL: number; BUSY: number };
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const options: { value: Pace; label: string; hint: string }[] = [
    { value: "NORMAL", label: pace === "PAUSED" ? "Retomar" : "Normal", hint: `~${waitMinutes.NORMAL} min` },
    { value: "BUSY", label: "Movimentado", hint: `~${waitMinutes.BUSY} min` },
    { value: "PAUSED", label: "Pausar", hint: "por 15 min" },
  ];
  return (
    <form action={submit} className="flex flex-col gap-2">
      <span id="pace-label" className="text-[13px] font-semibold text-[#cdbfb2]">
        Ritmo da cozinha
      </span>
      <div
        role="radiogroup"
        aria-labelledby="pace-label"
        className="grid grid-cols-3 gap-1 rounded-xl bg-white/10 p-1"
      >
        {options.map((option) => {
          const on = option.value === pace;
          return (
            <button
              key={option.value}
              name="pace"
              value={option.value}
              role="radio"
              aria-checked={on}
              disabled={pending || on}
              className={`flex min-h-12 flex-col items-center justify-center rounded-[10px] px-2 py-1.5 transition-[transform,background-color] active:scale-[.98] disabled:cursor-default ${
                on ? "bg-on-accent text-ink" : "text-[#e9dfd4] hover:bg-white/10"
              } ${pending && !on ? "opacity-60" : ""}`}
            >
              <b className="text-sm font-extrabold">{option.label}</b>
              <small className="text-xs font-semibold opacity-80">{option.hint}</small>
            </button>
          );
        })}
      </div>
      {state.error && (
        <span role="alert" className="text-[13px] font-bold text-detail-light">
          {state.error}
        </span>
      )}
    </form>
  );
}
