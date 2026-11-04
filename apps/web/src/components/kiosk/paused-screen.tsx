"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Prototype T3, in both kiosk languages. */
const COPY = {
  "pt-BR": {
    title: "Estamos com muitos pedidos",
    body: "Peça no balcão ou volte em alguns minutos.",
    back: "O totem volta às {time}",
    soon: "O totem volta em instantes",
    counter: "Balcão ao lado",
    other: "EN",
    otherLabel: "Change language to English",
  },
  en: {
    title: "We have lots of orders right now",
    body: "Order at the counter or come back in a few minutes.",
    back: "The kiosk is back at {time}",
    soon: "The kiosk is back in a moment",
    counter: "Counter next to you",
    other: "PT",
    otherLabel: "Mudar o idioma para português",
  },
} as const;

/** A little after Go's resume time, so the next config is already NORMAL. */
const AFTER_RESUME_MS = 3_000;

/**
 * The store is paused (plan G-T3 with G-K5): no ordering until `pausedUntil`,
 * when Go goes back to NORMAL by itself. The screen re-reads the config right
 * after that time, so the kiosk is back without waiting for the 45 s check.
 */
export function PausedScreen({
  brand,
  pausedUntil,
  timeZone,
  languages,
  defaultLanguage,
}: {
  brand: string;
  pausedUntil: string | null;
  timeZone: string;
  languages: ("pt-BR" | "en")[];
  defaultLanguage: "pt-BR" | "en";
}) {
  const router = useRouter();
  const [language, setLanguage] = useState(defaultLanguage);
  const copy = COPY[language];
  const other = language === "pt-BR" ? "en" : "pt-BR";

  useEffect(() => {
    if (!pausedUntil) return;
    const wait = Math.max(0, Date.parse(pausedUntil) - Date.now()) + AFTER_RESUME_MS;
    const timer = setTimeout(() => router.refresh(), wait);
    return () => clearTimeout(timer);
  }, [pausedUntil, router]);

  const time =
    pausedUntil &&
    new Intl.DateTimeFormat(language, { timeZone, hour: "2-digit", minute: "2-digit" }).format(
      new Date(pausedUntil),
    );

  return (
    <main
      lang={language}
      className="relative flex flex-1 flex-col justify-end gap-[54px] bg-night px-[84px] pb-[168px] text-on-accent"
    >
      <div className="absolute top-[84px] right-[84px] left-[84px] flex items-center justify-between">
        <span className="font-display text-[51px] font-medium tracking-[-0.01em] italic">{brand}</span>
        {languages.includes(other) && (
          <button
            onClick={() => setLanguage(other)}
            aria-label={copy.otherLabel}
            className="h-[78px] rounded-full border-[2.25px] border-on-accent/30 px-[30px] text-[27px] font-extrabold transition-transform active:scale-[.97]"
          >
            {copy.other}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-[27px]">
        <h1 className="font-display text-[132px] leading-[0.94] font-semibold tracking-[-0.03em] text-balance">
          {copy.title}
        </h1>
        <p className="max-w-[810px] text-[37.5px] leading-[1.4] text-[#e6dacb]">{copy.body}</p>
      </div>
      <div className="flex flex-wrap gap-[21px]">
        <span className="rounded-full bg-on-accent/10 px-[48px] py-[27px] text-[36px] font-bold text-detail-light">
          {time ? copy.back.replace("{time}", time) : copy.soon}
        </span>
        <span className="rounded-full bg-on-accent/10 px-[48px] py-[27px] text-[36px] font-bold text-detail-light">
          {copy.counter}
        </span>
      </div>
    </main>
  );
}
