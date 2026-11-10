import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";

import {
  cancelPayment,
  type PaymentMethod,
  type PaymentSession,
  pollPayment,
  priceBasket,
  startPayment,
  submitOrder,
  type SubmitOrderResponse,
  type TotalsResponse,
} from "@/app/kiosk/actions";
import { formatMoney } from "@/lib/format/money";
import { toOrderItems } from "@/lib/kiosk/basket-v2";
import type { Result } from "@/lib/kiosk/core-v2";
import { nameOf } from "@/lib/kiosk/menu-graph";
import { format, type Strings } from "@/lib/kiosk/strings";

import { ChevronLeft } from "../icons";
import { currentTotals, type Journey } from "./journey-state";

/** Poll a payment at most once per second (contract getPayment). */
const POLL_MS = 1_000;
/** A card terminal that has not answered by then is cancelled as expired. */
const CARD_TIMEOUT_MS = 120_000;
/** Go turns a Pix still PENDING at `expiresAt` into EXPIRED; past this grace the kiosk cancels it. */
const PIX_GRACE_MS = 10_000;
/** While an order's placement is unknown, how long to wait between checks. */
const VERIFY_RETRY_MS = 5_000;
/** After this long verifying, the screen also offers the counter. */
const VERIFY_SLOW_MS = 60_000;

/** Wall-clock time, read only inside effects and handlers (deadlines of the polls). */
const clock = () => Date.now();

/** A Server Action that never reached the BFF (kiosk offline) has an unknown outcome. */
function settle<T>(call: Promise<Result<T>>): Promise<Result<T>> {
  return call.catch((): Result<T> => ({ ok: false, code: "CORE_UNAVAILABLE" }));
}

type Step =
  | { kind: "method" }
  | { kind: "working"; label: "pay.preparing" | "pay.placing" | "pay.cancelling" }
  | { kind: "pix"; session: PaymentSession; cancelling: boolean }
  | { kind: "card"; session: PaymentSession; cancelling: boolean }
  | { kind: "declined"; method: PaymentMethod }
  | { kind: "expired"; method: PaymentMethod }
  | { kind: "terminalOff" }
  /** BASKET_CHANGED: Go re-priced the basket; the guest confirms the new total (Review Focus 2). */
  | { kind: "changed"; method: PaymentMethod }
  /** The basket itself must change (an item went unavailable): back to it. */
  | { kind: "basket"; name: string | null }
  | { kind: "error"; method: PaymentMethod; key: string }
  /** Paid, and Go has not said whether the order was placed: keep asking with the same key. */
  | { kind: "verifying"; slow: boolean }
  /** Paid, but the order was refused: only the counter can sort it out (Review Focus 1). */
  | { kind: "placeFailed"; ref: string | null };

/**
 * Pays the basket with Mercado Pago through Go (SPEC 4.6): "Como você quer
 * pagar?" → Pix (QR, copia e cola, 5-minute countdown) or card (the Point
 * terminal) → poll → APPROVED places the order (`POST /v2/orders`, one key per
 * basket, idempotent on `basketId`). Payment comes before the order, so a
 * failed attempt never leaves an order behind; the basket is kept.
 */
export function CheckoutFlow({
  journey,
  strings,
  cardAvailable,
  onRepriced,
  onPlaced,
  onBack,
  onCancelOrder,
  onBusy,
}: {
  journey: Journey;
  strings: Strings;
  /** False when no Point terminal is set for this kiosk (`paymentTerminalId` null). */
  cardAvailable: boolean;
  /** Go's new totals after BASKET_CHANGED, for the journey to keep. */
  onRepriced: (result: Result<TotalsResponse>) => void;
  onPlaced: (placed: SubmitOrderResponse) => void;
  onBack: () => void;
  onCancelOrder: () => void;
  /** Told while waiting on Go or the guest's phone or card, when idle checking stops. */
  onBusy: (busy: boolean) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "method" });
  const busy = ["working", "pix", "card", "verifying", "placeFailed"].includes(step.kind);
  useEffect(() => onBusy(busy), [busy, onBusy]);
  // Set while an attempt runs, so a double tap cannot start a second payment.
  const attempting = useRef(false);
  // The approved session, kept for retries of the order placement.
  const approved = useRef<PaymentSession | null>(null);
  const total = currentTotals(journey)?.total ?? 0;
  const basketId = journey.basketId!;
  const orderKey = journey.checkout!.orderKey;
  const items = () => toOrderItems(journey.menu!, journey.basket);

  async function place(session: PaymentSession | null) {
    if (session) approved.current = session;
    setStep({ kind: "working", label: "pay.placing" });
    const placed = await settle(submitOrder({ basketId, items: items(), payment: approved.current }, orderKey));
    if (placed.ok) return onPlaced(placed.data);
    // The payment is taken: never offer another payment or a basket change.
    console.warn(`Order not placed after payment: ${placed.code}`);
    // No answer within the 15 s budget is not a failure: the order may exist.
    setStep(
      placed.code === "CORE_UNAVAILABLE"
        ? { kind: "verifying", slow: false }
        : { kind: "placeFailed", ref: approved.current?.tenderRef ?? null },
    );
  }

  // While placement is unknown, ask again with the same key until Go answers.
  const verifying = step.kind === "verifying";
  useEffect(() => {
    if (!verifying) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const slowAt = clock() + VERIFY_SLOW_MS;
    const check = async () => {
      const placed = await settle(submitOrder({ basketId, items: items(), payment: approved.current }, orderKey));
      if (!live) return;
      if (placed.ok) return onPlaced(placed.data);
      if (placed.code !== "CORE_UNAVAILABLE") {
        return setStep({ kind: "placeFailed", ref: approved.current?.tenderRef ?? null });
      }
      if (Date.now() >= slowAt) setStep((s) => (s.kind === "verifying" && !s.slow ? { ...s, slow: true } : s));
      timer = setTimeout(check, VERIFY_RETRY_MS);
    };
    timer = setTimeout(check, VERIFY_RETRY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // One basket, one key: the inputs do not change while verifying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifying]);

  async function pay(method: PaymentMethod, key: string) {
    if (attempting.current) return;
    attempting.current = true;
    try {
      await attempt(method, key);
    } finally {
      attempting.current = false;
    }
  }

  async function attempt(method: PaymentMethod, key: string) {
    setStep({ kind: "working", label: "pay.preparing" });
    const started = await settle(startPayment({ basketId, method, amount: total }, key));
    if (started.ok) {
      const session = started.data;
      return setStep({ kind: method === "PIX" ? "pix" : "card", session, cancelling: false });
    }
    switch (started.code) {
      case "BASKET_ALREADY_PAID":
        // An earlier session was approved (a Pix paid after "Gerar novo"): place it (Review Focus 4).
        return place(null);
      case "BASKET_CHANGED": {
        // Never charge the old total: re-price, then ask the guest (Review Focus 2).
        const repriced = await settle(priceBasket({ basketId, items: items(), language: journey.language }));
        onRepriced(repriced);
        if (repriced.ok) return setStep({ kind: "changed", method });
        return setStep({ kind: "basket", name: repriced.detail ? nameOf(journey.menu!, repriced.detail) : null });
      }
      case "PAYMENT_TERMINAL_UNAVAILABLE":
        return setStep({ kind: "terminalOff" });
      case "ITEM_UNAVAILABLE":
      case "NOT_FOUND":
      case "VALIDATION_FAILED":
      case "NO_ACTIVE_MENU":
        return setStep({ kind: "basket", name: started.detail ? nameOf(journey.menu!, started.detail) : null });
      default:
        // Unknown outcome: retrying with the same key returns the same session.
        console.warn(`Payment not started: ${started.code}`);
        return setStep({ kind: "error", method, key });
    }
  }

  const newAttempt = (method: PaymentMethod) => void pay(method, crypto.randomUUID());

  // Polls the session until it is final; a card that never answers is cancelled.
  const session = step.kind === "pix" || step.kind === "card" ? step.session : null;
  const polling = session?.id ?? null;
  useEffect(() => {
    if (!session || !polling) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const deadline =
      session.method === "PIX" && session.expiresAt
        ? Date.parse(session.expiresAt) + PIX_GRACE_MS
        : clock() + CARD_TIMEOUT_MS;
    let cancelAt = deadline;

    const tick = async () => {
      // A rejected call (kiosk offline) is no answer: keep polling.
      const result = await settle(pollPayment(polling));
      if (!live) return;
      if (result.ok) {
        const current = result.data;
        switch (current.status) {
          case "APPROVED":
            return void place(current);
          case "DECLINED":
            return setStep({ kind: "declined", method: current.method });
          case "EXPIRED":
            return setStep({ kind: "expired", method: current.method });
          case "CANCELLED":
            return setStep({ kind: "method" });
        }
      }
      if (Date.now() >= cancelAt) {
        cancelAt = Date.now() + POLL_MS * 10;
        const cancelled = await settle(cancelPayment(polling));
        if (!live) return;
        if (cancelled.ok) return setStep({ kind: "expired", method: session.method });
        // Already final: the next poll says how it ended.
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `session` is fixed for one `polling` id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling]);

  /** "Trocar forma de pagamento" / cancel on the card screen: cancel the session, keep the basket. */
  async function cancel() {
    if (step.kind !== "pix" && step.kind !== "card") return;
    setStep({ ...step, cancelling: true });
    const result = await settle(cancelPayment(step.session.id));
    if (result.ok) return setStep({ kind: "method" });
    // Already final: the poll reports how it ended. Any other failure brings the button back.
    if (result.code !== "PAYMENT_NOT_CANCELLABLE") {
      setStep((s) => (s.kind === "pix" || s.kind === "card" ? { ...s, cancelling: false } : s));
    }
  }

  const toMethod = () => setStep({ kind: "method" });
  const otherMethod = { label: strings["pay.other"], onPress: toMethod };

  switch (step.kind) {
    case "method":
      return (
        <MethodScreen
          total={total}
          cardAvailable={cardAvailable}
          strings={strings}
          onBack={onBack}
          onChoose={newAttempt}
        />
      );
    case "working":
      return <WorkingScreen label={strings[step.label]} />;
    case "pix":
      return (
        <PixScreen
          session={step.session}
          strings={strings}
          cancelling={step.cancelling}
          onNew={() => newAttempt("PIX")}
          onOther={cancel}
        />
      );
    case "card":
      return (
        <TerminalScreen
          total={step.session.amount}
          strings={strings}
          status={step.cancelling ? strings["pay.cancelling"] : strings["pay.waiting"]}
          onCancel={step.cancelling ? undefined : cancel}
        />
      );
    case "declined":
      return (
        <ProblemScreen
          tag={strings["pay.declinedTag"]}
          title={strings["pay.declinedTitle"]}
          body={format(strings["pay.declinedBody"], { total: formatMoney(total) })}
          primary={{ label: strings["pay.retry"], onPress: () => newAttempt(step.method) }}
          secondary={otherMethod}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
    case "expired":
      return step.method === "PIX" ? (
        <ProblemScreen
          tag={strings["pix.expiredTag"]}
          title={strings["pix.expiredTitle"]}
          body={strings["pix.expiredBody"]}
          primary={{ label: strings["pix.new"], onPress: () => newAttempt("PIX") }}
          secondary={otherMethod}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      ) : (
        <ProblemScreen
          tag={strings["pay.expiredTag"]}
          title={strings["pay.expiredTitle"]}
          body={strings["pay.expiredBody"]}
          primary={{ label: strings["pay.retry"], onPress: () => newAttempt("CARD") }}
          secondary={otherMethod}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
    case "terminalOff":
      return (
        <ProblemScreen
          tag={strings["pay.terminalOffTag"]}
          title={strings["pay.terminalOffTitle"]}
          body={strings["pay.terminalOffBody"]}
          primary={{ label: strings["pay.PIX"], onPress: () => newAttempt("PIX") }}
          secondary={otherMethod}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
    case "changed":
      return (
        <ProblemScreen
          tone="info"
          tag={strings["pay.changedTag"]}
          title={strings["pay.changedTitle"]}
          body={format(strings["pay.changedBody"], { total: formatMoney(total) })}
          primary={{
            label: format(strings["pay.changedConfirm"], { total: formatMoney(total) }),
            onPress: () => newAttempt(step.method),
          }}
          secondary={{ label: strings["pay.toBasket"], onPress: onBack }}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
    case "basket":
      return (
        <ProblemScreen
          tag={strings["pay.errorTag"]}
          title={strings["pay.basketTitle"]}
          body={step.name ? format(strings["pay.basketBody"], { name: step.name }) : strings["basket.unavailableGeneric"]}
          primary={{ label: strings["pay.toBasket"], onPress: onBack }}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
    case "error":
      return (
        <ProblemScreen
          tag={strings["pay.errorTag"]}
          title={strings["pay.errorTitle"]}
          body={strings["pay.errorBody"]}
          primary={{ label: strings["pay.retry"], onPress: () => void pay(step.method, step.key) }}
          secondary={otherMethod}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
    case "verifying":
      return (
        <VerifyingScreen
          tag={strings["pay.verifyingTag"]}
          title={strings["pay.verifyingTitle"]}
          body={strings["pay.verifyingBody"]}
          slow={step.slow ? strings["pay.verifyingSlow"] : null}
        />
      );
    case "placeFailed":
      return (
        <ProblemScreen
          tone="paid"
          tag={strings["pay.placeFailedTag"]}
          title={strings["pay.placeFailedTitle"]}
          body={strings["pay.placeFailedBody"]}
          note={step.ref ? format(strings["pay.placeFailedRef"], { ref: step.ref }) : undefined}
          primary={{ label: strings["pay.placeRetry"], onPress: () => void place(null) }}
        />
      );
  }
}

const METHODS: { method: PaymentMethod; bg: string; icon: ReactNode }[] = [
  {
    method: "PIX",
    bg: "bg-accent text-on-accent",
    icon: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3z" />,
  },
  {
    method: "CARD",
    bg: "bg-butter text-ink",
    icon: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  },
];

/** Prototype 06-Payment: Pix or card (the pilot's two Mercado Pago methods). */
function MethodScreen({
  total,
  cardAvailable,
  strings,
  onBack,
  onChoose,
}: {
  total: number;
  cardAvailable: boolean;
  strings: Strings;
  onBack: () => void;
  onChoose: (method: PaymentMethod) => void;
}) {
  return (
    <main className="flex h-full flex-col bg-ground px-[66px] pt-[42px] pb-[96px] text-ink">
      <button
        onClick={onBack}
        className="flex h-[84px] items-center gap-3 self-start rounded-full bg-surface pr-[33px] pl-[21px] text-[28.5px] font-bold"
      >
        <ChevronLeft size={36} />
        {strings["pay.back"]}
      </button>
      <h1 className="mt-[66px] font-display text-[96px] leading-[1.02] font-semibold tracking-[-0.03em] whitespace-pre-line">
        {strings["pay.title"]}
      </h1>
      <p className="mt-[18px] flex items-baseline gap-[18px] text-[33px] text-muted">
        {strings["pay.totalOf"]}
        <span className="font-display text-[54px] font-semibold text-ink">{formatMoney(total)}</span>
      </p>
      <ul className="mt-[66px] flex flex-col rounded-card-sm bg-surface px-12">
        {METHODS.map(({ method, bg, icon }) => {
          const off = method === "CARD" && !cardAvailable;
          return (
            <li key={method} className="border-b border-line last:border-0">
              <button
                onClick={() => onChoose(method)}
                disabled={off}
                className="flex w-full items-center gap-[36px] py-[48px] text-left disabled:opacity-45"
              >
                <span className={`flex size-[126px] shrink-0 items-center justify-center rounded-full ${bg}`}>
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {icon}
                  </svg>
                </span>
                <span className="flex flex-1 flex-col gap-[6px]">
                  <span className="flex items-center gap-[18px]">
                    <span className="font-display text-[60px] leading-none font-semibold">{strings[`pay.${method}`]}</span>
                    {method === "PIX" && (
                      <span className="rounded-[12px] bg-butter px-[15px] py-[6px] text-[21px] font-bold text-detail-text">
                        {strings["pay.PIX.badge"]}
                      </span>
                    )}
                  </span>
                  <span className="text-[27px] text-muted">
                    {off ? strings["pay.CARD.off"] : strings[`pay.${method}.body`]}
                  </span>
                </span>
                {!off && <ChevronLeft size={36} className="rotate-180 text-muted" />}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto text-[27px] text-muted">{strings["pay.cash"]}</p>
    </main>
  );
}

/** "Expira em 4:59", counting down to `expiresAt` (Pix lasts 5 minutes). */
function useCountdown(expiresAt: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  if (!expiresAt) return null;
  const left = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1_000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}

/**
 * Pix (new screen, approved kiosk style; layout after the canvas proposal
 * Q8-Pagar): QR, copia e cola, countdown, "Gerar novo" and "Trocar forma".
 */
function PixScreen({
  session,
  strings,
  cancelling,
  onNew,
  onOther,
}: {
  session: PaymentSession;
  strings: Strings;
  cancelling: boolean;
  onNew: () => void;
  onOther: () => void;
}) {
  const left = useCountdown(session.expiresAt);
  return (
    <main className="flex h-full flex-col bg-ground px-[84px] pt-[96px] pb-[72px] text-ink">
      <span className="text-[30px] font-semibold text-muted">
        {strings["pay.PIX"]}, {formatMoney(session.amount)}
      </span>
      <h1 className="mt-[21px] font-display text-[96px] leading-[1] font-semibold tracking-[-0.03em]">
        {strings["pix.title"]}
      </h1>
      <p className="mt-[24px] max-w-[810px] text-[33px] leading-[1.45] text-muted">{strings["pix.body"]}</p>

      <div className="mt-[54px] flex flex-col items-center gap-[30px] rounded-[54px] bg-surface px-[54px] pt-[54px] pb-[42px]">
        <div className="relative size-[540px] overflow-hidden rounded-[24px] bg-surface">
          {session.qrCode && (
            <Image
              src={session.qrCode}
              alt="QR Code Pix"
              fill
              unoptimized
              className="object-contain [image-rendering:pixelated]"
            />
          )}
        </div>
        {left && (
          <span className="rounded-full bg-butter px-[30px] py-[12px] text-[28.5px] font-bold text-detail-text" role="timer">
            {format(strings["pix.expiresIn"], { time: left })}
          </span>
        )}
        {session.copyPaste && (
          <div className="flex w-full flex-col gap-[9px]">
            <span className="text-[22.5px] font-bold text-muted">{strings["pix.copyPaste"]}</span>
            <span className="line-clamp-2 font-mono text-[21px] leading-[1.4] break-all text-muted">
              {session.copyPaste}
            </span>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-[21px]">
        <div className="flex items-center justify-center gap-[21px] pb-[18px] text-[30px] font-bold" role="status">
          <span className="size-[36px] animate-spin rounded-full border-[4.5px] border-line border-t-accent" />
          {cancelling ? strings["pay.cancelling"] : strings["pay.waiting"]}
        </div>
        <button
          onClick={onNew}
          disabled={cancelling}
          className="h-[138px] rounded-full bg-surface text-[31.5px] font-bold disabled:opacity-50"
        >
          {strings["pix.new"]}
        </button>
        <button
          onClick={onOther}
          disabled={cancelling}
          className="h-[138px] rounded-full border-[3px] border-line text-[31.5px] font-bold disabled:opacity-50"
        >
          {strings["pix.other"]}
        </button>
      </div>
    </main>
  );
}

/** Prototype 07-Authorizing: the Point terminal next to the kiosk. */
function TerminalScreen({
  total,
  strings,
  status,
  onCancel,
}: {
  total: number;
  strings: Strings;
  status: string;
  onCancel?: () => void;
}) {
  return (
    <main className="flex h-full flex-col bg-accent px-[84px] pt-[108px] pb-[72px] text-on-accent">
      <span className="text-[30px] font-semibold text-on-accent-muted">
        {strings["pay.CARD"]}, {formatMoney(total)}
      </span>
      <h1 className="mt-[27px] font-display text-[108px] leading-[0.98] font-semibold tracking-[-0.03em] whitespace-pre-line">
        {strings["pay.terminalTitle"]}
      </h1>
      <p className="mt-[30px] max-w-[780px] text-[33px] leading-[1.45] text-on-accent-muted">{strings["pay.terminalBody"]}</p>
      <div className="mt-auto flex flex-col items-center gap-[54px]">
        <div className="flex w-[396px] flex-col gap-[24px] rounded-[54px] bg-[#231a16] p-[33px] pb-[78px]">
          <div className="flex flex-col items-center gap-[12px] rounded-[30px] bg-ground py-[42px] text-ink">
            <span className="text-[22px] text-muted">{strings["pay.terminalValue"]}</span>
            <span className="font-display text-[54px] font-semibold">{formatMoney(total)}</span>
            <span className="text-[20px] text-muted">{strings["pay.terminalHint"]}</span>
          </div>
          <div className="grid grid-cols-3 gap-[15px]">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={`h-[60px] rounded-[18px] ${i === 8 ? "bg-detail-light" : "bg-[#3b2d26]"}`} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-[21px] text-[30px] font-bold" role="status">
          <span className="size-[36px] animate-spin rounded-full border-[4.5px] border-on-accent/20 border-t-detail-light" />
          {status}
        </div>
      </div>
      <div className="mt-[96px] h-[138px]">
        {onCancel && (
          <button onClick={onCancel} className="h-full w-full rounded-full border-[3px] border-on-accent/40 text-[31.5px] font-bold">
            {strings["pay.cancel"]}
          </button>
        )}
      </div>
    </main>
  );
}

function WorkingScreen({ label }: { label: string }) {
  return (
    <main className="flex h-full flex-col items-center justify-center gap-[42px] bg-ground text-ink" role="status">
      <span className="size-[72px] animate-spin rounded-full border-[6px] border-line border-t-accent" />
      <span className="text-[36px] font-bold">{label}</span>
    </main>
  );
}

const TONE = {
  problem: { bg: "bg-danger text-on-accent", path: <path d="M18 6L6 18M6 6l12 12" /> },
  info: { bg: "bg-butter text-ink", path: <path d="M12 7v6M12 17h.01" /> },
  paid: { bg: "bg-sage text-ink", path: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
} as const;

function ProblemScreen({
  tone = "problem",
  tag,
  title,
  body,
  note,
  primary,
  secondary,
  cancelLabel,
  onCancelOrder,
}: {
  tone?: keyof typeof TONE;
  tag: string;
  title: string;
  body: string;
  /** A line to show at the counter (the payment code). */
  note?: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  /** Left out where cancelling would lose a paid order. */
  cancelLabel?: string;
  onCancelOrder?: () => void;
}) {
  return (
    <main className="flex h-full flex-col bg-ground px-[84px] pt-[108px] pb-[72px] text-ink">
      <span className="flex items-center gap-[21px] text-[31.5px] font-bold">
        <span className={`flex size-[66px] items-center justify-center rounded-full ${TONE[tone].bg}`}>
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {TONE[tone].path}
          </svg>
        </span>
        {tag}
      </span>
      <h1 className="mt-auto font-display text-[120px] leading-[0.95] font-semibold tracking-[-0.03em] whitespace-pre-line">
        {title}
      </h1>
      <p className="mt-[36px] max-w-[810px] text-[33px] leading-[1.45] text-muted">{body}</p>
      {note && (
        <p className="mt-[36px] self-start rounded-[24px] bg-surface px-[36px] py-[24px] font-mono text-[33px] font-bold">
          {note}
        </p>
      )}
      <div className="mt-auto flex flex-col items-center gap-[21px]">
        <button onClick={primary.onPress} className="h-button w-full rounded-full bg-ink text-[39px] font-bold text-on-accent">
          {primary.label}
        </button>
        {secondary && (
          <button onClick={secondary.onPress} className="h-[138px] w-full rounded-full bg-surface text-[31.5px] font-bold">
            {secondary.label}
          </button>
        )}
        {onCancelOrder && (
          <button onClick={onCancelOrder} className="mt-[24px] text-[28.5px] font-bold text-danger">
            {cancelLabel}
          </button>
        )}
      </div>
    </main>
  );
}

/** Paid, placement unknown: no buttons, since nothing the guest taps can help. */
function VerifyingScreen({ tag, title, body, slow }: { tag: string; title: string; body: string; slow: string | null }) {
  return (
    <main className="flex h-full flex-col bg-ground px-[84px] pt-[108px] pb-[72px] text-ink">
      <span className="flex items-center gap-[21px] text-[31.5px] font-bold">
        <span className="flex size-[66px] items-center justify-center rounded-full bg-sage text-ink">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        {tag}
      </span>
      <h1 className="mt-auto font-display text-[120px] leading-[0.95] font-semibold tracking-[-0.03em] whitespace-pre-line">
        {title}
      </h1>
      <p className="mt-[36px] max-w-[810px] text-[33px] leading-[1.45] text-muted">{body}</p>
      <div className="mt-auto flex min-h-[200px] flex-col items-center gap-[36px]" role="status">
        <span className="size-[72px] animate-spin rounded-full border-[6px] border-line border-t-accent" />
        {slow && <p className="max-w-[810px] text-center text-[30px] leading-[1.45] font-semibold">{slow}</p>}
      </div>
    </main>
  );
}
