import { useEffect, useState } from "react";

import type { SubmitOrderResponse } from "@/app/kiosk/actions";
import { format, type Strings } from "@/lib/kiosk/strings";

import { Check } from "../icons";

/** The kiosk goes back to the start by itself. */
const AUTO_RETURN_S = 15;

/**
 * Prototype 08-Success: the short order number Go assigned
 * (`customerCheckNumber`), the wait for the store's pace, and the invoice
 * notice (no NFC-e in the pilot, SPEC D-10). A countdown back to the start.
 */
export function SuccessScreen({
  placed,
  waitMinutes,
  invoiceNotice,
  strings,
  onDone,
}: {
  placed: SubmitOrderResponse;
  /** Minutes for the current pace (NORMAL or BUSY), when the store has them. */
  waitMinutes: number | null;
  /** The store's `invoiceNotice` in the guest's language. */
  invoiceNotice: string;
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
    <main className="flex h-full flex-col items-center bg-ground px-[18px] pt-[108px] pb-[72px] text-ink">
      <span className="flex h-[84px] items-center gap-[18px] rounded-full bg-surface pr-[33px] pl-[15px] text-[28.5px] font-bold">
        <span className="flex size-[54px] items-center justify-center rounded-full bg-accent text-on-accent">
          <Check size={30} strokeWidth={3} />
        </span>
        {strings["success.tag"]}
      </span>
      <div className="mt-auto flex flex-col items-center">
        <span className="font-display text-[60px] font-medium text-muted italic">{strings["success.lead"]}</span>
        <span
          className="font-display text-[420px] leading-[0.9] font-semibold tracking-[-0.04em] text-accent"
          aria-live="polite"
        >
          {placed.customerCheckNumber}
        </span>
        <p className="mt-[54px] max-w-[720px] text-center text-[34.5px] leading-[1.45]">{strings["success.body"]}</p>
        {waitMinutes !== null && (
          <p className="mt-[18px] text-[28.5px] text-muted">{format(strings["success.wait"], { n: waitMinutes })}</p>
        )}
        <p className="mt-[54px] rounded-[30px] bg-butter px-[42px] py-[24px] text-center text-[28.5px] font-semibold text-detail-text">
          {invoiceNotice}
        </p>
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
