import Image from "next/image";

import hero from "../../../public/kiosk/hero.jpg";

// Prototype 01-Main at 1080x1920 (canvas sizes x1.5). Starting the journey on
// tap is phase 2; until then the screen is static.
export function AttractScreen({ brand }: { brand: string }) {
  return (
    <main className="relative flex flex-1 flex-col justify-end overflow-hidden bg-[#2a1c16] text-on-accent">
      <Image
        src={hero}
        alt=""
        fill
        priority
        sizes="1080px"
        placeholder="blur"
        className="object-cover object-[42%_50%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(42,28,22,0.95)_0%,rgba(42,28,22,0.75)_30%,rgba(42,28,22,0.12)_58%,rgba(42,28,22,0)_75%)]" />
      <div className="absolute inset-x-0 top-0 h-[330px] bg-[linear-gradient(to_bottom,rgba(42,28,22,0.55),rgba(42,28,22,0))]" />

      <div className="absolute inset-x-[84px] top-[84px] flex items-baseline justify-between">
        <div className="font-display text-[51px] font-medium italic tracking-[-0.01em]">
          {brand}
        </div>
        <div className="text-[25.5px] font-semibold text-[#e6dacb]">Pães, doces e café</div>
      </div>

      <div className="relative flex flex-col gap-[54px] px-[84px] pb-[84px]">
        <div className="flex flex-col gap-[27px]">
          <h1 className="font-display text-[150px] font-semibold leading-[0.94] tracking-[-0.03em] text-balance">
            Fornada fresca,
            <br />
            sem fila.
          </h1>
          <p className="max-w-[810px] text-[37.5px] leading-[1.4] text-[#e6dacb]">
            Escolha seus pães, doces e café aqui e retire no balcão.
          </p>
        </div>
        <div className="flex h-[180px] items-center justify-between rounded-full bg-on-accent pr-6 pl-[66px] text-ink">
          <span className="text-[48px] font-bold tracking-[-0.01em]">Toque para começar</span>
          <span className="flex size-[132px] items-center justify-center rounded-full bg-accent text-on-accent">
            <svg
              width="57"
              height="57"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
              <path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2" />
              <path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-1.6-2.5a1.5 1.5 0 0 1 2.4-1.8L9 15.5" />
            </svg>
          </span>
        </div>
      </div>
    </main>
  );
}
