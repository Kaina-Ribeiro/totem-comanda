import { useEffect, useState } from "react";

import {
  cancelPayment,
  createOrder,
  type Order,
  type Payment,
  type PaymentMethod,
  placeOrder,
  pollPayment,
  type PlacedOrder,
  startPayment,
} from "@/app/kiosk/actions";
import { formatBRL } from "@/lib/format/money";
import type { Result } from "@/lib/kiosk/core";
import { format, type Strings } from "@/lib/kiosk/strings";

import { ChevronLeft } from "../icons";
import { currentQuote, type Journey } from "./journey-state";

/** OP-PAY-02: poll at most once per second. */
const POLL_MS = 1_000;
const METHODS: PaymentMethod[] = ["PIX", "CREDIT", "DEBIT"];

type Step =
  | { kind: "method" }
  | { kind: "working"; method: PaymentMethod; label: "pay.preparing" | "pay.placing" }
  | { kind: "authorising"; method: PaymentMethod; payment: Payment; cancelling: boolean }
  | { kind: "declined"; method: PaymentMethod }
  | { kind: "error"; method: PaymentMethod; basket: boolean };

/** Codes that mean the basket itself must change before paying. */
const BASKET_CODES = new Set([
  "ITEM_UNAVAILABLE",
  "BASKET_ITEM_LIMIT_EXCEEDED",
  "INVALID_COUPON",
  "ORDER_TYPE_UNAVAILABLE",
  "NO_ACTIVE_MENU",
  "VALIDATION_FAILED",
]);

/**
 * Simulated payment (06-Payment, 07-Authorizing, 11-PaymentError): create
 * the order once, start a payment per attempt, poll it, place it when
 * authorised. Every write carries an Idempotency-Key, so retrying after a
 * lost answer continues the same order instead of making another.
 */
export function CheckoutFlow({
  journey,
  strings,
  onOrderCreated,
  onPlaced,
  onBack,
  onCancelOrder,
  onBusy,
}: {
  journey: Journey;
  strings: Strings;
  onOrderCreated: (order: Order) => void;
  onPlaced: (placed: PlacedOrder) => void;
  onBack: () => void;
  onCancelOrder: () => void;
  /** Told while waiting on the terminal or the Core API, when idle checking stops. */
  onBusy: (busy: boolean) => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "method" });
  const busy = step.kind === "working" || step.kind === "authorising";
  useEffect(() => onBusy(busy), [busy, onBusy]);
  // One key per payment attempt; a retry after an error reuses it, a new attempt gets a new one.
  const [paymentKey, setPaymentKey] = useState(() => crypto.randomUUID());
  const checkout = journey.checkout!;
  const total = checkout.order?.orderTotal.total ?? currentQuote(journey)?.total ?? 0;

  const fail = (method: PaymentMethod, result: Result<unknown>) => {
    if (!result.ok) console.warn(`Checkout step failed: ${result.code}`);
    setStep({ kind: "error", method, basket: !result.ok && BASKET_CODES.has(result.code) });
  };

  async function place(method: PaymentMethod, order: Order) {
    setStep({ kind: "working", method, label: "pay.placing" });
    const placed = await placeOrder(order.id, checkout.placeKey);
    if (placed.ok) onPlaced(placed.data);
    else fail(method, placed);
  }

  async function pay(method: PaymentMethod, key: string) {
    setStep({ kind: "working", method, label: "pay.preparing" });
    let order = checkout.order;
    if (!order) {
      const created = await createOrder(checkout.orderKey, {
        orderNonce: journey.orderNonce!,
        orderType: journey.orderType!,
        language: journey.language,
        orderItems: journey.basket,
        discountCode: journey.discountCode,
        cpfCnpj: journey.cpfCnpj,
        journeyStartedTimestamp: journey.journeyStartedTimestamp,
      });
      if (!created.ok) return fail(method, created);
      order = created.data;
      onOrderCreated(order);
    }
    const started = await startPayment(order.id, method, key);
    if (started.ok) {
      setStep({ kind: "authorising", method, payment: started.data, cancelling: false });
    } else if (started.code === "ORDER_NOT_AWAITING_PAYMENT") {
      // Paid already (an earlier answer was lost): placing is idempotent.
      await place(method, order);
    } else {
      fail(method, started);
    }
  }

  const newAttempt = (method: PaymentMethod) => {
    const key = crypto.randomUUID();
    setPaymentKey(key);
    void pay(method, key);
  };

  // Polls the payment until it is final.
  const polling = step.kind === "authorising" ? step.payment.id : null;
  useEffect(() => {
    if (!polling) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const result = await pollPayment(polling);
      if (!live) return;
      if (result.ok) {
        const payment = result.data;
        switch (payment.paymentStatus) {
          case "AUTHORISED":
            return void place(payment.method, checkout.order!);
          case "FAILED":
            return setStep({ kind: "declined", method: payment.method });
          case "CANCELLED":
            return setStep({ kind: "method" });
          case "AUTHORISING":
            setStep((s) => (s.kind === "authorising" ? { ...s, payment } : s));
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `place` and `checkout` are stable for one payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling]);

  async function cancel() {
    if (step.kind !== "authorising") return;
    setStep({ ...step, cancelling: true });
    const result = await cancelPayment(step.payment.id);
    // Already final: the poll reports how it ended.
    if (result.ok) setStep({ kind: "method" });
  }

  switch (step.kind) {
    case "method":
      return (
        <MethodScreen
          total={total}
          strings={strings}
          onBack={onBack}
          onChoose={(method) => newAttempt(method)}
        />
      );
    case "working":
      return (
        <TerminalScreen
          method={step.method}
          total={total}
          strings={strings}
          status={strings[step.label]}
        />
      );
    case "authorising":
      return (
        <TerminalScreen
          method={step.method}
          total={total}
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
          body={format(strings["pay.declinedBody"], { total: formatBRL(total) })}
          primary={{ label: strings["pay.retry"], onPress: () => newAttempt(step.method) }}
          secondary={{ label: strings["pay.other"], onPress: () => setStep({ kind: "method" }) }}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
    case "error":
      return step.basket ? (
        <ProblemScreen
          tag={strings["pay.errorTag"]}
          title={strings["pay.basketTitle"]}
          body={strings["pay.basketBody"]}
          primary={{ label: strings["pay.toBasket"], onPress: onBack }}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      ) : (
        <ProblemScreen
          tag={strings["pay.errorTag"]}
          title={strings["pay.errorTitle"]}
          body={strings["pay.errorBody"]}
          primary={{
            label: strings["pay.retry"],
            onPress: () => void pay(step.method, paymentKey),
          }}
          secondary={{ label: strings["pay.other"], onPress: () => setStep({ kind: "method" }) }}
          cancelLabel={strings["menu.cancel"]}
          onCancelOrder={onCancelOrder}
        />
      );
  }
}

const METHOD_ICON: Record<PaymentMethod, { bg: string; path: React.ReactNode }> = {
  PIX: {
    bg: "bg-accent text-on-accent",
    path: <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3z" />,
  },
  CREDIT: {
    bg: "bg-butter text-ink",
    path: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
  },
  DEBIT: {
    bg: "bg-sage text-ink",
    path: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
        <circle cx="16" cy="14.5" r="1" />
      </>
    ),
  },
};

function MethodScreen({
  total,
  strings,
  onBack,
  onChoose,
}: {
  total: number;
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
        <span className="font-display text-[54px] font-semibold text-ink">{formatBRL(total)}</span>
      </p>
      <ul className="mt-[66px] flex flex-col rounded-card-sm bg-surface px-12">
        {METHODS.map((method) => (
          <li key={method} className="border-b border-line last:border-0">
            <button
              onClick={() => onChoose(method)}
              className="flex w-full items-center gap-[36px] py-[48px] text-left"
            >
              <span
                className={`flex size-[126px] shrink-0 items-center justify-center rounded-full ${METHOD_ICON[method].bg}`}
              >
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
                  {METHOD_ICON[method].path}
                </svg>
              </span>
              <span className="flex flex-1 flex-col gap-[6px]">
                <span className="flex items-center gap-[18px]">
                  <span className="font-display text-[60px] leading-none font-semibold">
                    {strings[`pay.${method}`]}
                  </span>
                  {method === "PIX" && (
                    <span className="rounded-[12px] bg-butter px-[15px] py-[6px] text-[21px] font-bold text-detail-text">
                      {strings["pay.PIX.badge"]}
                    </span>
                  )}
                </span>
                <span className="text-[27px] text-muted">{strings[`pay.${method}.body`]}</span>
              </span>
              <ChevronLeft size={36} className="rotate-180 text-muted" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-auto text-[27px] text-muted">{strings["pay.cash"]}</p>
    </main>
  );
}

function TerminalScreen({
  method,
  total,
  strings,
  status,
  onCancel,
}: {
  method: PaymentMethod;
  total: number;
  strings: Strings;
  status: string;
  onCancel?: () => void;
}) {
  return (
    <main className="flex h-full flex-col bg-accent px-[84px] pt-[108px] pb-[72px] text-on-accent">
      <span className="text-[30px] font-semibold text-on-accent-muted">
        {strings[`pay.${method}`]}, {formatBRL(total)}
      </span>
      <h1 className="mt-[27px] font-display text-[108px] leading-[0.98] font-semibold tracking-[-0.03em] whitespace-pre-line">
        {strings["pay.terminalTitle"]}
      </h1>
      <p className="mt-[30px] max-w-[780px] text-[33px] leading-[1.45] text-on-accent-muted">
        {strings["pay.terminalBody"]}
      </p>
      <div className="mt-auto flex flex-col items-center gap-[54px]">
        <div className="flex w-[396px] flex-col gap-[24px] rounded-[54px] bg-[#231a16] p-[33px] pb-[78px]">
          <div className="flex flex-col items-center gap-[12px] rounded-[30px] bg-ground py-[42px] text-ink">
            <span className="text-[22px] text-muted">{strings["pay.terminalValue"]}</span>
            <span className="font-display text-[54px] font-semibold">{formatBRL(total)}</span>
            <span className="text-[20px] text-muted">{strings["pay.terminalHint"]}</span>
          </div>
          <div className="grid grid-cols-3 gap-[15px]">
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                className={`h-[60px] rounded-[18px] ${i === 8 ? "bg-detail-light" : "bg-[#3b2d26]"}`}
              />
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
          <button
            onClick={onCancel}
            className="h-full w-full rounded-full border-[3px] border-on-accent/40 text-[31.5px] font-bold"
          >
            {strings["pay.cancel"]}
          </button>
        )}
      </div>
    </main>
  );
}

function ProblemScreen({
  tag,
  title,
  body,
  primary,
  secondary,
  cancelLabel,
  onCancelOrder,
}: {
  tag: string;
  title: string;
  body: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  cancelLabel: string;
  onCancelOrder: () => void;
}) {
  return (
    <main className="flex h-full flex-col bg-ground px-[84px] pt-[108px] pb-[72px] text-ink">
      <span className="flex items-center gap-[21px] text-[31.5px] font-bold">
        <span className="flex size-[66px] items-center justify-center rounded-full bg-danger text-on-accent">
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </span>
        {tag}
      </span>
      <h1 className="mt-auto font-display text-[120px] leading-[0.95] font-semibold tracking-[-0.03em] whitespace-pre-line">
        {title}
      </h1>
      <p className="mt-[36px] max-w-[810px] text-[33px] leading-[1.45] text-muted">{body}</p>
      <div className="mt-auto flex flex-col items-center gap-[21px]">
        <button
          onClick={primary.onPress}
          className="h-button w-full rounded-full bg-ink text-[39px] font-bold text-on-accent"
        >
          {primary.label}
        </button>
        {secondary && (
          <button
            onClick={secondary.onPress}
            className="h-[138px] w-full rounded-full bg-surface text-[31.5px] font-bold"
          >
            {secondary.label}
          </button>
        )}
        <button onClick={onCancelOrder} className="mt-[24px] text-[28.5px] font-bold text-danger">
          {cancelLabel}
        </button>
      </div>
    </main>
  );
}
