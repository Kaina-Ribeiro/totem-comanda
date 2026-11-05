"use client";

import type { components } from "@/lib/core-api";

type Line = components["schemas"]["KitchenOrder"]["lines"][number];

/** What "Acabou" marks: the whole item, or one option of it. */
export type SoldOutTarget = { itemId: string; optionId: string | null; name: string };

/** Key of a target in the board's "marked today" set. */
export const soldOutKey = (t: { itemId: string; optionId: string | null }) =>
  `${t.itemId}:${t.optionId ?? ""}`;

/** The targets one order line offers: the item, then each chosen option. */
export function lineTargets(line: Line): SoldOutTarget[] {
  const seen = new Set<string>();
  const options = line.choices.filter((c) => !seen.has(c.optionId) && seen.add(c.optionId));
  return [
    { itemId: line.itemId, optionId: null, name: line.name },
    ...options.map((c) => ({ itemId: line.itemId, optionId: c.optionId, name: c.name })),
  ];
}

/** The line's "Acabou" button, or a quiet chip once the item is marked today. */
export function SoldOutButton({ marked, onPress }: { marked: boolean; onPress: () => void }) {
  if (marked) {
    return (
      <span className="flex h-11 shrink-0 items-center rounded-[14px] bg-danger-bg px-4 text-[15px] font-extrabold text-danger">
        Esgotado hoje
      </span>
    );
  }
  return (
    <button
      onClick={onPress}
      className="h-11 shrink-0 rounded-[14px] border-[1.5px] border-line bg-surface px-[18px] text-[15px] font-extrabold text-danger transition-transform active:scale-[.97]"
    >
      Acabou
    </button>
  );
}

/**
 * The confirmation under the items (prototype K2): pick the item or one of its
 * options, read what happens on the kiosk, then confirm. The order already
 * placed stays open (KDS BR-027).
 */
export function SoldOutPanel({
  line,
  target,
  marked,
  busy,
  error,
  onPick,
  onCancel,
  onConfirm,
}: {
  line: Line;
  target: SoldOutTarget;
  marked: (t: SoldOutTarget) => boolean;
  busy: boolean;
  error: string | null;
  onPick: (target: SoldOutTarget) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const targets = lineTargets(line);
  const whole = target.optionId === null;
  return (
    <div className="mt-1 ml-[18px] flex flex-col gap-2.5 rounded-2xl bg-butter py-3.5 pr-3.5 pl-[18px]">
      {targets.length > 1 && (
        <div role="radiogroup" aria-label="O que acabou" className="flex flex-wrap gap-2">
          {targets.map((t) => {
            const on = soldOutKey(t) === soldOutKey(target);
            const done = marked(t);
            return (
              <button
                key={soldOutKey(t)}
                role="radio"
                aria-checked={on}
                disabled={done}
                onClick={() => onPick(t)}
                className={`h-10 rounded-xl px-3.5 text-sm font-extrabold transition-transform active:scale-[.97] disabled:opacity-50 ${
                  on ? "bg-accent text-on-accent" : "bg-surface text-ink"
                }`}
              >
                {t.optionId === null ? `${t.name} inteiro` : t.name}
                {done && " · esgotado"}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-col gap-[3px]">
        <span className="text-base font-extrabold">{target.name} acabou?</span>
        <span className="text-sm leading-[1.4] font-semibold text-muted">
          {whole
            ? "Sai do totem até o fim do dia. Este pedido continua aberto."
            : `Sai do totem até o fim do dia. ${line.name} continua com as outras opções.`}
        </span>
        {error && (
          <span role="alert" className="text-sm font-bold text-danger">
            {error}
          </span>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="h-11 rounded-[14px] px-[18px] text-[15px] font-extrabold transition-transform active:scale-[.97]"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={busy || marked(target)}
          className="h-11 rounded-[14px] bg-danger px-5 text-[15px] font-extrabold text-white transition-transform active:scale-[.97] disabled:opacity-60"
        >
          Acabou
        </button>
      </div>
    </div>
  );
}
