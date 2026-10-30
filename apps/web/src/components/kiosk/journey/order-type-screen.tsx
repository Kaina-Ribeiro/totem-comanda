import type { ReactNode } from "react";

import type { Strings } from "@/lib/kiosk/strings";

import { ArrowUpRight, Bag, ChevronLeft, Cup } from "../icons";
import type { OrderType } from "./journey-state";

/** Prototype 02-OrderType at 1080x1920 (canvas x1.5). Back resets the journey (BR-START-19). */
export function OrderTypeScreen({
  strings,
  orderTypes,
  languageButton,
  onBack,
  onChoose,
}: {
  strings: Strings;
  orderTypes: OrderType[];
  languageButton: ReactNode;
  onBack: () => void;
  onChoose: (orderType: OrderType) => void;
}) {
  return (
    <main className="flex flex-1 flex-col bg-ground text-ink">
      <header className="flex h-[300px] shrink-0 flex-col gap-[30px] px-[84px] pt-[72px]">
        <div className="flex items-center justify-between">
          <BackPill label={strings["nav.home"]} onPress={onBack} />
          {languageButton}
        </div>
        <h1 className="font-display text-[75px] font-semibold tracking-[-0.02em]">{strings["orderType.title"]}</h1>
      </header>
      <div className="flex flex-1 flex-col gap-6 px-12 pt-9 pb-12">
        {orderTypes.map((type) => (
          <OrderTypeCard key={type} type={type} strings={strings} onPress={() => onChoose(type)} />
        ))}
      </div>
    </main>
  );
}

function OrderTypeCard({ type, strings, onPress }: { type: OrderType; strings: Strings; onPress: () => void }) {
  const dark = type === "DINEIN";
  return (
    <button
      onClick={onPress}
      className={`flex flex-1 flex-col justify-between rounded-card px-[72px] py-[66px] text-left transition-transform active:scale-[0.99] ${
        dark ? "bg-accent text-on-accent" : "bg-butter text-ink"
      }`}
    >
      <div className="flex items-start justify-between">
        {dark ? (
          <Cup size={108} strokeWidth={1.4} className="text-detail-light" />
        ) : (
          <Bag size={108} strokeWidth={1.4} className="text-detail-text" />
        )}
        <span
          className={`flex size-24 items-center justify-center rounded-full ${
            dark ? "bg-on-accent/16 text-on-accent" : "bg-surface text-ink"
          }`}
        >
          <ArrowUpRight size={48} />
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <span className="font-display text-[114px] leading-none font-semibold tracking-[-0.03em]">
          {strings[`orderType.${type}`]}
        </span>
        <span className={`text-[34.5px] ${dark ? "text-on-accent-muted" : "text-muted"}`}>
          {strings[`orderType.${type}.body`]}
        </span>
      </div>
    </button>
  );
}

export function BackPill({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      onClick={onPress}
      className="flex h-[78px] items-center gap-3 self-start rounded-full bg-surface pr-[30px] pl-[18px] text-[28.5px] font-bold text-ink"
    >
      <ChevronLeft size={36} />
      {label}
    </button>
  );
}
