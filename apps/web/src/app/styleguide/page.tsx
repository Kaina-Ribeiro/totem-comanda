import { notFound } from "next/navigation";

// Development check that the theme matches docs/prototype: colours, fonts and
// the attract screen's type scale at 1080x1920 (prototype sizes x 1.5).
const swatches = [
  ["ground", "bg-ground"],
  ["surface", "bg-surface"],
  ["ink", "bg-ink"],
  ["muted", "bg-muted"],
  ["line", "bg-line"],
  ["accent", "bg-accent"],
  ["onAccent", "bg-on-accent"],
  ["onAccentMuted", "bg-on-accent-muted"],
  ["detail", "bg-detail"],
  ["detailLight", "bg-detail-light"],
  ["detailText", "bg-detail-text"],
  ["price", "bg-price"],
  ["danger", "bg-danger"],
  ["wheat", "bg-wheat"],
  ["butter", "bg-butter"],
  ["sage", "bg-sage"],
  ["oat", "bg-oat"],
  ["imageBg", "bg-image-bg"],
] as const;

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-16 py-16">
      <section className="flex flex-col gap-[54px] bg-ink px-[84px] py-[84px] text-on-accent">
        <div className="font-display text-[51px] font-medium italic tracking-[-0.01em]">
          [Nome da padaria]
        </div>
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
        <div className="flex h-[180px] items-center justify-between rounded-full bg-on-accent pl-[66px] pr-6 text-ink">
          <span className="text-[48px] font-bold tracking-[-0.01em]">
            Toque para começar
          </span>
          <span className="size-[132px] rounded-full bg-accent" />
        </div>
      </section>

      <section className="flex flex-col gap-6 px-[84px]">
        <h2 className="font-display text-[75px] font-semibold">
          Onde você vai comer?
        </h2>
        <p className="text-[37.5px] font-medium text-muted">
          Manrope 500, 600, 700 e 800
        </p>
        <div className="flex flex-col gap-2 text-[42px]">
          <span className="font-medium">Croque monsieur R$ 34,90</span>
          <span className="font-semibold">Croque monsieur R$ 34,90</span>
          <span className="font-bold text-price">Croque monsieur R$ 34,90</span>
          <span className="font-extrabold">Croque monsieur R$ 34,90</span>
        </div>
        <button
          type="button"
          className="mt-6 h-button w-full rounded-full bg-accent text-[42px] font-semibold text-on-accent"
        >
          Escolher como pagar
        </button>
        <div className="flex h-[300px] items-end rounded-card bg-butter p-[60px]">
          <span className="font-display text-[96px] font-semibold leading-none">
            Para viagem
          </span>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-6 px-[84px]">
        {swatches.map(([name, className]) => (
          <div key={name} className="flex flex-col gap-2">
            <div
              className={`h-[120px] rounded-card-sm border border-line ${className}`}
            />
            <span className="text-[24px] font-semibold">{name}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
