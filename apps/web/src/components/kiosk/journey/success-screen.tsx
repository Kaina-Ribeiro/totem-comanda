import { useEffect, useState } from "react";

import type { PlacedOrder } from "@/app/kiosk/actions";
import { displayCheckNumber } from "@/lib/kiosk/check-number";
import { format, type Strings } from "@/lib/kiosk/strings";

import { Check } from "../icons";

/** F-POST-05: the kiosk goes back to the start by itself. */
const AUTO_RETURN_S = 15;

/**
 * Prototype 08-Success: the order number from the Core API. No printing line
 * until phase 4 (no printer yet); a countdown back to the start.
 */
export function SuccessScreen({
  placed,
  displayLength,
  strings,
  onDone,
}: {
  placed: PlacedOrder;
  displayLength: number;
  strings: Strings;
  onDone: () => void;
}) {
  const [left, setLeft] = useState(AUTO_RETURN_S);

  useEffect(() => {
    const timer = setInterval(() => setLeft((n) => n - 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left <= 0) onDone();
  }, [left, onDone]);

  return (
    <main className="flex h-dvh flex-col items-center bg-ground px-[18px] pt-[108px] pb-[72px] text-ink">
      <span className="flex h-[84px] items-center gap-[18px] rounded-full bg-surface pr-[33px] pl-[15px] text-[28.5px] font-bold">
        <span className="flex size-[54px] items-center justify-center rounded-full bg-accent text-on-accent">
          <Check size={30} strokeWidth={3} />
        </span>
        {strings["success.tag"]}
      </span>
      <div className="mt-auto flex flex-col items-center">
        <span className="font-display text-[60px] font-medium text-muted italic">
          {strings["success.lead"]}
        </span>
        <span
          className="font-display text-[420px] leading-[0.9] font-semibold tracking-[-0.04em] text-accent"
          aria-live="polite"
        >
          {displayCheckNumber(placed.posCheckNumber, displayLength)}
        </span>
        <p className="mt-[54px] max-w-[720px] text-center text-[34.5px] leading-[1.45]">
          {strings["success.body"]}
        </p>
        {placed.waitTime !== null && (
          <p className="mt-[18px] text-[28.5px] text-muted">
            {format(strings["success.wait"], { n: placed.waitTime })}
          </p>
        )}
      </div>
      <button
        onClick={onDone}
        className="mt-auto flex h-button w-full items-center justify-between rounded-full bg-ink px-[66px] text-on-accent"
      >
        <span className="text-[42px] font-bold">{strings["success.done"]}</span>
        <span className="text-[25.5px] font-semibold text-on-accent-muted">
          {format(strings["success.countdown"], { n: Math.max(left, 0) })}
        </span>
      </button>
    </main>
  );
}
