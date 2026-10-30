import type { ReactNode } from "react";

/**
 * Full-screen state with no guest controls (SCR-KIOSK-02..04): closed,
 * maintenance, at capacity, preparing, disabled. Not drawn in the prototype;
 * built from its tokens and the attract screen's type scale (x1.5).
 */
export function UnavailableScreen({
  brand,
  title,
  body,
  note,
}: {
  brand?: string;
  title: string;
  body?: string;
  note?: ReactNode;
}) {
  return (
    <main className="relative flex flex-1 flex-col justify-end gap-[54px] bg-[#2a1c16] px-[84px] pb-[168px] text-on-accent">
      {brand && (
        <div className="absolute top-[84px] left-[84px] font-display text-[51px] font-medium italic tracking-[-0.01em]">
          {brand}
        </div>
      )}
      <div className="flex flex-col gap-[27px]">
        <h1 className="font-display text-[132px] font-semibold leading-[0.94] tracking-[-0.03em] text-balance">
          {title}
        </h1>
        {body && (
          <p className="max-w-[810px] text-[37.5px] leading-[1.4] text-[#e6dacb]">{body}</p>
        )}
      </div>
      {note && (
        <div className="self-start rounded-full bg-on-accent/10 px-[48px] py-[27px] text-[36px] font-bold text-detail-light">
          {note}
        </div>
      )}
    </main>
  );
}
