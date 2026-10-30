import { useEffect, useRef, useState } from "react";

import type { Strings } from "@/lib/kiosk/strings";

/** BR-KIOSK-11: idle checking needs a timeout of at least 1 s; 0 turns it off. */
const MIN_TIMEOUT_MS = 1_000;

/**
 * The idle warning (F-KIOSK-03, prototype 12-Idle). After `timeoutMs` with
 * no touch or key (BR-KIOSK-12) it asks "Ainda está aí?" with a countdown of
 * the same length; no answer abandons the journey (BR-KIOSK-13). `active` is
 * false where idle checking is off (attract, payment, success: BR-KIOSK-14)
 * and while another dialog is up.
 */
export function IdleGuard({
  active,
  timeoutMs,
  strings,
  onTimeout,
  onCancel,
}: {
  active: boolean;
  timeoutMs: number;
  strings: Strings;
  onTimeout: () => void;
  onCancel: () => void;
}) {
  const enabled = timeoutMs > 0;
  const timeout = Math.max(timeoutMs, MIN_TIMEOUT_MS);
  const lastActivity = useRef(0);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    if (!enabled || !active || warning) return;
    lastActivity.current = Date.now();
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ["pointerdown", "pointermove", "keydown"] as const;
    for (const name of events) window.addEventListener(name, touch, { passive: true });
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current >= timeout) setWarning(true);
    }, 1_000);
    return () => {
      for (const name of events) window.removeEventListener(name, touch);
      clearInterval(timer);
    };
  }, [enabled, active, warning, timeout]);

  if (!warning || !active) return null;
  return (
    <IdleDialog
      seconds={Math.round(timeout / 1000)}
      strings={strings}
      onContinue={() => setWarning(false)}
      onCancel={() => {
        setWarning(false);
        onCancel();
      }}
      onExpire={() => {
        setWarning(false);
        onTimeout();
      }}
    />
  );
}

function IdleDialog({
  seconds,
  strings,
  onContinue,
  onCancel,
  onExpire,
}: {
  seconds: number;
  strings: Strings;
  onContinue: () => void;
  onCancel: () => void;
  onExpire: () => void;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const timer = setInterval(() => setLeft((n) => n - 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left <= 0) onExpire();
  }, [left, onExpire]);

  const radius = 96;
  const circumference = 2 * Math.PI * radius;
  const gone = (seconds - Math.max(left, 0)) / seconds;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b211c]/75 px-[72px]"
      role="alertdialog"
      aria-modal
      aria-labelledby="idle-title"
    >
      <div className="flex w-full flex-col gap-[54px] rounded-[54px] bg-surface p-[72px] text-ink">
        <div className="flex items-center gap-[51px]">
          <div className="relative size-[210px] shrink-0">
            <svg viewBox="0 0 210 210" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="105" cy="105" r={radius} fill="none" stroke="#f3efe8" strokeWidth="12" />
              <circle
                cx="105"
                cy="105"
                r={radius}
                fill="none"
                stroke="#b07a3a"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * gone}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-[84px] font-semibold">
              {Math.max(left, 0)}
            </span>
          </div>
          <div className="flex flex-col gap-[15px]">
            <h2 id="idle-title" className="font-display text-[69px] leading-none font-semibold">
              {strings["idle.title"]}
            </h2>
            <p className="text-[28.5px] leading-[1.4] text-muted">{strings["idle.body"]}</p>
          </div>
        </div>
        <div className="flex flex-col gap-[21px]">
          <button
            onClick={onContinue}
            className="h-[150px] rounded-full bg-accent text-[33px] font-bold text-on-accent"
          >
            {strings["idle.continue"]}
          </button>
          <button
            onClick={onCancel}
            className="h-[126px] rounded-full bg-ground text-[31.5px] font-bold"
          >
            {strings["idle.cancel"]}
          </button>
        </div>
      </div>
    </div>
  );
}
