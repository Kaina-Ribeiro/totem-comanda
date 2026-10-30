"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useReducer, useTransition } from "react";

import { beginJourney, switchLanguage } from "@/app/kiosk/actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { findItem } from "@/lib/kiosk/menu-view";
import { BUNDLED, type Language } from "@/lib/kiosk/strings";

import { Globe } from "../icons";
import { ItemScreen } from "./item-screen";
import { initialJourney, journeyReducer, type OrderType } from "./journey-state";
import { MenuScreen } from "./menu-screen";
import { OrderTypeScreen } from "./order-type-screen";

export type KioskSettings = {
  brand: string;
  defaultLanguage: Language;
  languages: Language[];
  orderTypes: OrderType[];
};

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
    dispatch({ type: "reset", language: settings.defaultLanguage });
  }

  function changeLanguage(next: Language) {
    if (next === language) return;
    if (!journey.menu) {
      dispatch({ type: "language", language: next });
      return;
    }
    startTransition(async () => {
      const result = await switchLanguage(next);
      if (result.ok) dispatch({ type: "relocalized", language: next, ...result.data });
    });
  }

  const otherLanguage = settings.languages.find((code) => code !== language);
  const strings = journey.strings ?? BUNDLED[language];
  const languageButton = otherLanguage ? (
    <LanguageButton label={BUNDLED[language]["language.button"]} onPress={() => changeLanguage(otherLanguage)} />
  ) : null;

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
            <button
              onClick={start}
              className="h-button flex-1 rounded-full bg-on-accent text-[40px] font-bold text-ink"
            >
              {strings.startOver}
            </button>
            <button onClick={reset} className="h-button rounded-full px-16 text-[36px] font-bold text-detail-light">
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
          onBack={reset}
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
          onOpenBasket={() => {}}
          onCancel={reset}
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
          backLabel={strings["nav.menu"]}
          onBack={() => dispatch({ type: "closeItem" })}
          onSave={(line) => dispatch({ type: "saveItem", line })}
        />
      );
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

function LoadingOverlay({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2a1c16]/70" role="status">
      <div className="flex items-center gap-8 rounded-full bg-on-accent px-[60px] py-[36px] text-[36px] font-bold text-ink">
        <span className="size-[42px] animate-spin rounded-full border-[5px] border-line border-t-accent" />
        {label}
      </div>
    </div>
  );
}
