"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useReducer, useState, useTransition } from "react";

import { beginJourney, priceBasket, recordJourneyEvent, removeCoupon, switchLanguage } from "@/app/kiosk/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { basketUnits, toOrderItems } from "@/lib/kiosk/basket";
import { swapTo } from "@/lib/kiosk/builder";
import { findProduct, readMenu } from "@/lib/kiosk/menu-graph";
import { BUNDLED, type Language } from "@/lib/kiosk/strings";

import { Globe } from "../icons";
import { BasketScreen, CancelDialog } from "./basket-screen";
import { CheckoutFlow } from "./checkout-flow";
import { CouponRow, CouponSheet } from "./coupon-sheet";
import { CrossSellSheet } from "./cross-sell-sheet";
import { IdleGuard } from "./idle-guard";
import { ItemScreen } from "./item-screen";
import { currentTotals, initialJourney, journeyReducer, lastTotal, totalsKey } from "./journey-state";
import { MenuScreen } from "./menu-screen";
import { SuccessScreen } from "./success-screen";
import { SwapSellSheet } from "./swap-sell-sheet";

export type KioskSettings = {
  brand: string;
  defaultLanguage: Language;
  languages: Language[];
  /** idleTimerIntervalMilliseconds; 0 turns the idle warning off. */
  idleMs: number;
  /** A Point terminal is set for this kiosk (`paymentTerminalId`). */
  cardAvailable: boolean;
  /** Minutes told to the guest for the store's current pace, if any. */
  waitMinutes: number | null;
  /** The store's invoice notice per language (no NFC-e in the pilot). */
  invoiceNotice: Record<Language, string>;
};

/** Phases where idle checking runs (not on attract, payment or success). */
const IDLE_PHASES = new Set(["startFailed", "menu", "item", "basket", "checkout"]);
/** Phases where the basket is priced by Go after every change. */
const PRICED_PHASES = new Set(["menu", "item", "basket"]);
/** Waits for the guest to stop tapping before pricing the basket. */
const TOTALS_DEBOUNCE_MS = 400;

/** The attract screen re-reads the config every 45 s, so the kiosk closes by itself. */
const GATE_RECHECK_MS = 45_000;
/** A language changed on the attract screen reverts after 30 s. */
const LANGUAGE_RESET_MS = 30_000;

/**
 * The guest journey on Core v2, from the tap on the attract screen on. Every
 * step after the tap is one client-side flow over the menu loaded at start;
 * the server is called only through the kiosk's Server Actions, and every
 * amount on screen comes back from `POST /v2/totals`. `attract` holds the
 * attract screen (a Server Component) rendered once per language.
 */
export function KioskJourney({ settings, attract }: { settings: KioskSettings; attract: Record<Language, ReactNode> }) {
  const router = useRouter();
  const [journey, dispatch] = useReducer(journeyReducer, settings.defaultLanguage, initialJourney);
  const [, startTransition] = useTransition();
  const { phase, language } = journey;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [couponOpen, setCouponOpen] = useState(false);
  // A failed language change says so and offers to try the same change again,
  // on the screen it failed on.
  const [languageError, setLanguageError] = useState<{ language: Language; phase: string } | null>(null);
  // True while the checkout waits on Go, the guest's phone or the terminal (no idle reset there).
  const [paying, setPaying] = useState(false);
  const [totalsAttempt, setTotalsAttempt] = useState(0);
  const key = totalsKey(journey);
  const needsTotals = PRICED_PHASES.has(phase) && journey.basket.length > 0;

  // Go prices the basket after every change (SPEC 5.5); the kiosk never adds prices.
  useEffect(() => {
    if (!needsTotals || !journey.menu) return;
    let live = true;
    const { menu, basket, basketId } = journey;
    const timer = setTimeout(() => {
      priceBasket({ basketId, items: toOrderItems(menu, basket), language })
        .catch(() => ({ ok: false as const, code: "CORE_UNAVAILABLE" as const }))
        .then((result) => {
          if (!live) return;
          if (!result.ok && result.code === "NOT_FOUND" && basketId) {
            // Go forgot the basket: start a new one (the coupon went with it).
            dispatch({ type: "basketLost" });
            setTotalsAttempt((n) => n + 1);
          } else {
            dispatch({ type: "priced", key, result });
          }
        });
    }, TOTALS_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `key` covers lines, coupon and language; `totalsAttempt` is the retry button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsTotals, key, totalsAttempt]);

  useEffect(() => {
    if (phase !== "attract" || language === settings.defaultLanguage) return;
    const timer = setTimeout(() => dispatch({ type: "language", language: settings.defaultLanguage }), LANGUAGE_RESET_MS);
    return () => clearTimeout(timer);
  }, [phase, language, settings.defaultLanguage]);

  function start() {
    if (phase !== "attract" && phase !== "startFailed") return;
    dispatch({ type: "start" });
    startTransition(async () => {
      const result = await beginJourney(language).catch(() => null);
      if (result?.ok) {
        const { menu, ...rest } = result.data;
        dispatch({ type: "started", ...rest, menu: readMenu(menu) });
      } else if (result?.code === "NO_ACTIVE_MENU") {
        // Closed since the last config check: the gate shows the closed screen.
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
    setCouponOpen(false);
    dispatch({ type: "reset", language: settings.defaultLanguage });
  }

  /** Ends a journey that produced no order and records why. */
  function endJourney(type: "RESET" | "IDLE_TIMEOUT" | "CANCELLED_BY_GUEST") {
    if (journey.orderNonce) void recordJourneyEvent(journey.orderNonce, type, lastTotal(journey)).catch(() => {});
    reset();
  }

  /** The cancel button: an empty order just ends, anything else asks first. */
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
      if (result?.ok) {
        dispatch({ type: "relocalized", language: next, menu: readMenu(result.data.menu), strings: result.data.strings });
      } else {
        setLanguageError({ language: next, phase });
      }
    });
  }

  /**
   * Takes the coupon off Go's basket first, and only then off the screen, so
   * the next totals never carry a discount the guest no longer sees. If Go
   * cannot answer, the coupon stays (the guest can tap Remover again).
   */
  async function dropCoupon() {
    const { basketId, coupon, menu, basket } = journey;
    if (basketId && coupon && menu) {
      const removed = await removeCoupon({ basketId, items: toOrderItems(menu, basket), code: coupon }).catch(() => null);
      if (!removed?.ok) return;
    }
    dispatch({ type: "coupon", code: null });
  }

  const otherLanguage = settings.languages.find((code) => code !== language);
  const strings = journey.strings ?? BUNDLED[language];
  const languageButton = otherLanguage ? (
    <LanguageButton label={BUNDLED[language]["language.button"]} onPress={() => changeLanguage(otherLanguage)} />
  ) : null;
  const totals = currentTotals(journey);
  const couponLine = journey.coupon ? totals?.discounts?.find((d) => d.id === journey.coupon) : undefined;

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
      {journey.offer?.kind === "swap" && phase === "menu" && journey.menu && (
        <SwapSellSheet
          menu={journey.menu}
          productId={journey.offer.productId}
          strings={strings}
          onKeep={() => dispatch({ type: "swapDone" })}
          onSwap={(target) => {
            const offer = journey.offer;
            const line = offer?.kind === "swap" ? journey.basket.find((l) => l.guid === offer.guid) : undefined;
            if (!line) return dispatch({ type: "swapDone" });
            const swapped = swapTo(target, line);
            dispatch({ type: "swapped", line: swapped.line });
            // The target needs a choice the old product did not have: ask for it.
            if (!swapped.ready) dispatch({ type: "openItem", productId: target.id, editGuid: line.guid });
          }}
        />
      )}
      {journey.offer?.kind === "crossSell" && phase === "menu" && journey.menu && (
        <CrossSellSheet
          menu={journey.menu}
          productId={journey.offer.productId}
          basket={journey.basket}
          strings={strings}
          onAccept={(lines) => dispatch({ type: "crossSellAccepted", lines })}
          onChoose={(product) => dispatch({ type: "openItem", productId: product.id })}
          onDismiss={() => dispatch({ type: "crossSellDismissed" })}
        />
      )}
      {couponOpen && phase === "basket" && journey.basketId && journey.menu && (
        <CouponSheet
          current={journey.coupon}
          basketId={journey.basketId}
          items={toOrderItems(journey.menu, journey.basket)}
          language={language}
          strings={strings}
          onClose={() => setCouponOpen(false)}
          onApplied={(code) => {
            dispatch({ type: "coupon", code });
            setCouponOpen(false);
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
                <div className="absolute top-[72px] right-[84px]" onClick={(e) => e.stopPropagation()}>
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
            <p className="max-w-[810px] text-[37.5px] leading-[1.4] text-[#e6dacb]">{strings["startFailed.body"]}</p>
            <div className="flex gap-6">
              <button onClick={start} className="h-button flex-1 rounded-full bg-on-accent text-[40px] font-bold text-ink">
                {strings.startOver}
              </button>
              <button onClick={reset} className="h-button rounded-full px-16 text-[36px] font-bold text-detail-light">
                {strings["nav.home"]}
              </button>
            </div>
          </main>
        );
      case "menu":
        return (
          <MenuScreen
            brand={settings.brand}
            journey={journey}
            strings={strings}
            onPickSection={(sectionId) => dispatch({ type: "pickSection", sectionId })}
            onPickProduct={(product) => {
              // Products with nothing to choose go straight in.
              if (product.groups.length === 0) {
                dispatch({
                  type: "addLine",
                  line: { guid: crypto.randomUUID(), productId: product.id, quantity: 1, picks: [] },
                });
              } else {
                dispatch({ type: "openItem", productId: product.id });
              }
            }}
            onOpenBasket={() => dispatch({ type: "openBasket" })}
            onCancel={askCancel}
          />
        );
      case "item": {
        const product = journey.item && journey.menu && findProduct(journey.menu, journey.item.productId);
        if (!product) return null;
        const editGuid = journey.item?.editGuid;
        return (
          <ItemScreen
            key={`${product.id}:${editGuid ?? "new"}`}
            product={product}
            editing={journey.basket.find((line) => line.guid === editGuid) ?? null}
            strings={strings}
            backLabel={journey.item?.returnTo === "basket" ? strings["basket.title"] : strings["nav.menu"]}
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
              <CouponRow
                code={journey.coupon}
                title={couponLine?.name ?? null}
                gone={!!totals && !couponLine}
                strings={strings}
                onOpen={() => setCouponOpen(true)}
                onRemove={dropCoupon}
              />
            }
            onBack={() => dispatch({ type: "openMenu" })}
            onCancel={askCancel}
            onEdit={(line) => dispatch({ type: "openItem", productId: line.productId, editGuid: line.guid })}
            onQuantity={(line, quantity) => dispatch({ type: "lineQuantity", guid: line.guid, quantity })}
            onRemove={(line) => dispatch({ type: "removeLine", guid: line.guid })}
            onRetryTotals={() => setTotalsAttempt((n) => n + 1)}
            onPay={() => dispatch({ type: "openCheckout", orderKey: crypto.randomUUID() })}
          />
        );
      case "checkout":
        return (
          <CheckoutFlow
            journey={journey}
            strings={strings}
            cardAvailable={settings.cardAvailable}
            onRepriced={(result) => dispatch({ type: "priced", key, result })}
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
            waitMinutes={settings.waitMinutes}
            invoiceNotice={settings.invoiceNotice[language]}
            strings={strings}
            onDone={reset}
          />
        ) : null;
    }
  }
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
