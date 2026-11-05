"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useReducer, useState, useTransition } from "react";

import { beginJourney, quoteBasket, recordJourneyEvent, switchLanguage } from "@/app/kiosk/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { basketDisplayTotal, basketUnits, findItem } from "@/lib/kiosk/menu-view";
import { BUNDLED, type Language } from "@/lib/kiosk/strings";

import { Globe } from "../icons";
import { BasketScreen, CancelDialog } from "./basket-screen";
import { CheckoutFlow } from "./checkout-flow";
import { CouponRow, CouponSheet } from "./coupon-sheet";
import { CrossSellSheet } from "./cross-sell-sheet";
import { IdleGuard } from "./idle-guard";
import { ItemScreen } from "./item-screen";
import {
  currentQuote,
  initialJourney,
  type Journey,
  journeyReducer,
  type OrderType,
  quoteKey,
} from "./journey-state";
import { MenuScreen } from "./menu-screen";
import { OrderTypeScreen } from "./order-type-screen";
import { SuccessScreen } from "./success-screen";
import { TaxIdRow, TaxIdSheet } from "./tax-id-sheet";

export type KioskSettings = {
  brand: string;
  defaultLanguage: Language;
  languages: Language[];
  orderTypes: OrderType[];
  /** posCheckNumberDisplayLength (BR-POST-01). */
  checkNumberDigits: number;
  /** idleTimerIntervalMilliseconds; 0 turns the idle warning off (BR-KIOSK-11). */
  idleMs: number;
};

/** Phases where idle checking runs (BR-KIOSK-14: not on attract, payment or success). */
const IDLE_PHASES = new Set(["startFailed", "orderType", "menu", "item", "basket", "checkout"]);

/** FR-137: the attract screen re-reads the config every 45 s, so the kiosk closes by itself. */
const GATE_RECHECK_MS = 45_000;
/** BR-START-03: a language changed on the attract screen reverts after 30 s. */
const LANGUAGE_RESET_MS = 30_000;

/**
 * The guest journey, from the tap on the attract screen on. Everything after
 * the tap is one client-side flow over the menu loaded at start; the server is
 * called only through the kiosk's Server Actions. `attract` holds the attract
 * screen (a Server Component) rendered once per language.
 */
export function KioskJourney({
  settings,
  attract,
}: {
  settings: KioskSettings;
  attract: Record<Language, ReactNode>;
}) {
  const router = useRouter();
  const [journey, dispatch] = useReducer(journeyReducer, settings.defaultLanguage, initialJourney);
  const [, startTransition] = useTransition();
  const { phase, language } = journey;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [taxIdOpen, setTaxIdOpen] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  // FR-213: a failed language change says so and offers to try the same change again.
  // Kept with the screen it failed on, so it goes away once the guest moves on.
  const [languageError, setLanguageError] = useState<{ language: Language; phase: string } | null>(
    null,
  );
  // True while the checkout waits on the terminal or the Core API (no idle reset there).
  const [paying, setPaying] = useState(false);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const key = quoteKey(journey);
  const needsQuote = phase === "basket" && journey.basket.length > 0;

  // OP-BASKET-01: the basket's totals come from the Core API after every change.
  useEffect(() => {
    if (!needsQuote || !journey.orderType) return;
    let live = true;
    const { orderType, basket, discountCode } = journey;
    quoteBasket({ orderType, orderItems: basket, discountCode }).then((result) => {
      if (live) dispatch({ type: "quoted", key, result });
    });
    return () => {
      live = false;
    };
    // `key` covers order type, lines and discount; `quoteAttempt` is the retry button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsQuote, key, quoteAttempt]);

  useEffect(() => {
    if (phase !== "attract" || language === settings.defaultLanguage) return;
    const timer = setTimeout(
      () => dispatch({ type: "language", language: settings.defaultLanguage }),
      LANGUAGE_RESET_MS,
    );
    return () => clearTimeout(timer);
  }, [phase, language, settings.defaultLanguage]);

  function start() {
    if (phase !== "attract" && phase !== "startFailed") return;
    dispatch({ type: "start" });
    startTransition(async () => {
      const result = await beginJourney(language);
      if (result.ok) {
        const only = settings.orderTypes.length === 1 ? settings.orderTypes[0] : null;
        dispatch({ type: "started", ...result.data, orderType: only });
      } else if (result.code === "NO_ACTIVE_MENU") {
        // Closed since the last config check: the gate shows Lane Closed.
        dispatch({ type: "reset", language: settings.defaultLanguage });
        router.refresh();
      } else {
        dispatch({ type: "startFailed" });
      }
    });
  }

  function reset() {
    setConfirmCancel(false);
    setPaying(false);
    setTaxIdOpen(false);
    setCouponOpen(false);
    dispatch({ type: "reset", language: settings.defaultLanguage });
  }

  /** Ends a journey that produced no order and records why (OP-KIOSK-01/02). */
  function endJourney(type: "RESET" | "IDLE_TIMEOUT" | "CANCELLED_BY_GUEST") {
    if (journey.orderNonce) {
      void recordJourneyEvent(journey.orderNonce, type, orderTotalNow(journey));
    }
    reset();
  }

  /** The cancel button: an empty order just ends, anything else asks first (F-BASKET-04). */
  function askCancel() {
    if (journey.basket.length === 0) endJourney("CANCELLED_BY_GUEST");
    else setConfirmCancel(true);
  }

  function changeLanguage(next: Language) {
    if (next === language) return;
    if (!journey.menu) {
      dispatch({ type: "language", language: next });
      return;
    }
    setLanguageError(null);
    startTransition(async () => {
      // A Server Action that never reached the BFF (kiosk offline) rejects: same as a failure.
      const result = await switchLanguage(next).catch(() => null);
      if (result?.ok) dispatch({ type: "relocalized", language: next, ...result.data });
      else setLanguageError({ language: next, phase });
    });
  }

  const otherLanguage = settings.languages.find((code) => code !== language);
  const strings = journey.strings ?? BUNDLED[language];
  const languageButton = otherLanguage ? (
    <LanguageButton
      label={BUNDLED[language]["language.button"]}
      onPress={() => changeLanguage(otherLanguage)}
    />
  ) : null;

  return (
    <>
      {screen()}
      {languageError?.phase === phase && (
        <LanguageErrorNotice
          message={strings["language.error"]}
          retryLabel={strings["language.retry"]}
          onRetry={() => changeLanguage(languageError.language)}
        />
      )}
      <IdleGuard
        active={IDLE_PHASES.has(phase) && !(phase === "checkout" && paying) && !confirmCancel}
        timeoutMs={settings.idleMs}
        strings={strings}
        onTimeout={() => endJourney("IDLE_TIMEOUT")}
        onCancel={() => endJourney("CANCELLED_BY_GUEST")}
      />
      {confirmCancel && (
        <CancelDialog
          units={basketUnits(journey.basket)}
          strings={strings}
          onKeep={() => setConfirmCancel(false)}
          onConfirm={() => endJourney("CANCELLED_BY_GUEST")}
        />
      )}
      {journey.crossSell && phase === "menu" && journey.menu && journey.orderType && (
        <CrossSellSheet
          menu={journey.menu}
          groupId={journey.crossSell.groupId}
          orderType={journey.orderType}
          strings={strings}
          onAccept={(lines) => dispatch({ type: "crossSellAccepted", lines })}
          onDismiss={() => dispatch({ type: "crossSellDismissed" })}
        />
      )}
      {couponOpen && phase === "basket" && journey.orderType && (
        <CouponSheet
          current={journey.discountCode}
          orderType={journey.orderType}
          basket={journey.basket}
          strings={strings}
          onClose={() => setCouponOpen(false)}
          onApplied={(discount) => {
            dispatch({ type: "discount", code: discount.value });
            setCouponOpen(false);
          }}
        />
      )}
      {taxIdOpen && phase === "basket" && (
        <TaxIdSheet
          initial={journey.cpfCnpj}
          strings={strings}
          onSkip={() => setTaxIdOpen(false)}
          onConfirm={(cpfCnpj) => {
            dispatch({ type: "taxId", cpfCnpj });
            setTaxIdOpen(false);
          }}
        />
      )}
    </>
  );

  function screen() {
    switch (phase) {
      case "attract":
      case "starting":
        return (
          <>
            <div
              className="relative flex flex-1 cursor-pointer flex-col"
              onClick={start}
              onKeyDown={start}
              role="button"
              tabIndex={0}
              aria-label={strings["attract.cta"]}
            >
              {attract[language]}
              {languageButton && (
                <div
                  className="absolute top-[72px] right-[84px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {languageButton}
                </div>
              )}
            </div>
            {phase === "starting" && <LoadingOverlay label={strings.starting} />}
            {phase === "attract" && <AutoRefresh everyMs={GATE_RECHECK_MS} />}
          </>
        );
      case "startFailed":
        return (
          <main className="flex flex-1 flex-col justify-end gap-[54px] bg-[#2a1c16] px-[84px] pb-[168px] text-on-accent">
            <h1 className="font-display text-[110px] leading-[0.98] font-semibold tracking-[-0.03em] text-balance">
              {strings["startFailed.title"]}
            </h1>
            <p className="max-w-[810px] text-[37.5px] leading-[1.4] text-[#e6dacb]">
              {strings["startFailed.body"]}
            </p>
            <div className="flex gap-6">
              <button
                onClick={start}
                className="h-button flex-1 rounded-full bg-on-accent text-[40px] font-bold text-ink"
              >
                {strings.startOver}
              </button>
              <button
                onClick={reset}
                className="h-button rounded-full px-16 text-[36px] font-bold text-detail-light"
              >
                {strings["nav.home"]}
              </button>
            </div>
          </main>
        );
      case "orderType":
        return (
          <OrderTypeScreen
            strings={strings}
            orderTypes={settings.orderTypes}
            languageButton={languageButton}
            onBack={() => endJourney("RESET")}
            onChoose={(orderType) => dispatch({ type: "orderType", orderType })}
          />
        );
      case "menu":
        return (
          <MenuScreen
            brand={settings.brand}
            journey={journey}
            strings={strings}
            canChangeOrderType={settings.orderTypes.length > 1}
            onChangeOrderType={() => dispatch({ type: "changeOrderType" })}
            onPickCategory={(categoryId) => dispatch({ type: "pickCategory", categoryId })}
            onPickItem={(item) => {
              // Items with nothing to choose go straight in (F-MENU-03).
              if ((item.optionGroups ?? []).length === 0) {
                dispatch({
                  type: "addLine",
                  line: { guid: crypto.randomUUID(), itemId: item.id, quantity: 1, options: [] },
                });
              } else {
                dispatch({ type: "openItem", itemId: item.id });
              }
            }}
            onOpenBasket={() => dispatch({ type: "openBasket" })}
            onCancel={askCancel}
          />
        );
      case "item": {
        const item = journey.item && journey.menu && findItem(journey.menu, journey.item.itemId);
        if (!item) return null;
        const editGuid = journey.item?.editGuid;
        return (
          <ItemScreen
            key={`${item.id}:${editGuid ?? "new"}`}
            menu={journey.menu!}
            item={item}
            editing={journey.basket.find((line) => line.guid === editGuid) ?? null}
            orderType={journey.orderType ?? "DINEIN"}
            strings={strings}
            backLabel={
              journey.item?.returnTo === "basket" ? strings["basket.title"] : strings["nav.menu"]
            }
            onBack={() => dispatch({ type: "closeItem" })}
            onSave={(line) => dispatch({ type: "saveItem", line })}
          />
        );
      }
      case "basket":
        return (
          <BasketScreen
            journey={journey}
            strings={strings}
            extras={
              <>
                <CouponRow
                  code={journey.discountCode}
                  title={currentQuote(journey)?.discount?.title ?? null}
                  strings={strings}
                  onOpen={() => setCouponOpen(true)}
                  onRemove={() => dispatch({ type: "discount", code: null })}
                />
                <TaxIdRow
                  digits={journey.cpfCnpj}
                  strings={strings}
                  onOpen={() => setTaxIdOpen(true)}
                />
              </>
            }
            onBack={() => dispatch({ type: "openMenu" })}
            onCancel={askCancel}
            onEdit={(line) =>
              dispatch({ type: "openItem", itemId: line.itemId, editGuid: line.guid })
            }
            onQuantity={(line, quantity) =>
              dispatch({ type: "lineQuantity", guid: line.guid, quantity })
            }
            onRemove={(line) => dispatch({ type: "removeLine", guid: line.guid })}
            onRetryQuote={() => setQuoteAttempt((n) => n + 1)}
            onPay={() =>
              dispatch({
                type: "openCheckout",
                orderKey: crypto.randomUUID(),
                placeKey: crypto.randomUUID(),
              })
            }
          />
        );
      case "checkout":
        return (
          <CheckoutFlow
            journey={journey}
            strings={strings}
            onOrderCreated={(order) => dispatch({ type: "orderCreated", order })}
            onPlaced={(placed) => dispatch({ type: "placed", placed })}
            onBack={() => dispatch({ type: "openBasket" })}
            onCancelOrder={askCancel}
            onBusy={setPaying}
          />
        );
      case "success":
        return journey.placed ? (
          <SuccessScreen
            placed={journey.placed}
            displayLength={settings.checkNumberDigits}
            strings={strings}
            onDone={reset}
          />
        ) : null;
    }
  }
}

/** The basket total for journey events: the quote when current, else the display sum. */
function orderTotalNow(journey: Journey): number {
  const quote = currentQuote(journey);
  if (quote) return quote.total;
  return journey.menu && journey.orderType
    ? basketDisplayTotal(journey.menu, journey.basket, journey.orderType)
    : 0;
}

function LanguageButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="flex h-[84px] items-center gap-4 rounded-full bg-surface/90 pr-9 pl-6 text-[28px] font-bold text-ink"
    >
      <Globe size={36} />
      {label}
    </button>
  );
}

/** FR-213: the language could not be loaded; the button repeats the same change. */
function LanguageErrorNotice({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="fixed inset-x-12 bottom-12 z-40 flex items-center justify-between gap-6 rounded-card-sm bg-ink px-[42px] py-[33px] text-[28.5px] font-semibold text-on-accent"
    >
      <span>{message}</span>
      <button onClick={onRetry} className="shrink-0 font-bold text-detail-light underline">
        {retryLabel}
      </button>
    </div>
  );
}

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a1c16]/70"
      role="status"
    >
      <div className="flex items-center gap-8 rounded-full bg-on-accent px-[60px] py-[36px] text-[36px] font-bold text-ink">
        <span className="size-[42px] animate-spin rounded-full border-[5px] border-line border-t-accent" />
        {label}
      </div>
    </div>
  );
}
