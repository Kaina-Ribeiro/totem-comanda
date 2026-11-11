import { type ReactNode, Suspense } from "react";

import { Card } from "@/components/admin/ui";

/*
 * Back office skeletons (COM-141): the page's real shape while its data streams in. Labels
 * and headings that do not depend on data are real text; only values are bones. Motion in
 * app/admin/(panel)/admin.css: bones breathe (opacity), and what arrives fades in where the
 * skeleton was, without sliding (the slide is what made npac drop its skeletons).
 */

/**
 * A page part that streams in: `fallback` while it loads, then the content fades in at the
 * same spot. Use instead of a bare <Suspense> in the back office pages.
 */
export function Streamed({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <div className="streamed contents">
      <Suspense fallback={fallback}>{children}</Suspense>
    </div>
  );
}

/** One placeholder bar or block; size it with `className`. */
export function Bone({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton-bone block rounded-md bg-oat ${className}`} />;
}

/** Announces the wait once for screen readers; the bones are hidden from them. */
function Busy({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="contents">
      <span className="sr-only">Carregando…</span>
      {children}
    </div>
  );
}

const H2 = "text-lg font-bold tracking-[-0.01em]";

/** Relatório do dia: date filter, three numbers, dine-in × take-out, best sellers. */
export function ReportSkeleton() {
  return (
    <Busy>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Dia</span>
          <Bone className="h-11 w-44 rounded-[10px]" />
        </div>
        <Bone className="h-10 w-14 rounded-[10px]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {["Pedidos", "Faturamento", "Ticket médio"].map((label) => (
          <Card key={label} className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-muted">{label}</span>
            <Bone className="my-1 h-7 w-28" />
          </Card>
        ))}
      </div>
      <Card className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        {["Descontos de cupom", "Cancelados", "Não retirados"].map((label) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-muted">{label}</span>
            <Bone className="my-1 h-5 w-24" />
            <Bone className="h-3 w-36" />
          </div>
        ))}
      </Card>
      <Card className="p-0">
        <h2 className={`px-5 pt-5 ${H2}`}>Mais vendidos</h2>
        <div className="mt-2 pb-1">
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center gap-6 border-t border-line px-5 py-2.5">
              <Bone className="h-4 flex-1" />
              <Bone className="h-4 w-10" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </Busy>
  );
}

const HOME_CARD = "flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-5 py-[18px]";

/** Início: greeting, the dark status band, today's numbers, devices and sold out. */
export function HomeSkeleton() {
  return (
    <Busy>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-2">
          {/* The title is 24 px on phones, 28 px from 821 px (PageHeader). */}
          <Bone className="h-7 w-40 min-[821px]:h-8" />
          <Bone className="h-4 w-64 max-w-full" />
        </div>
        <Bone className="h-10 w-44 rounded-[10px]" />
      </header>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl bg-night px-[22px] py-5">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
          <Bone className="h-3.5 w-24 bg-white/15" />
          <Bone className="h-[30px] w-56 max-w-full bg-white/15" />
          <Bone className="h-4 w-44 bg-white/15" />
        </div>
        {/* "Ritmo da cozinha" and its three-way switch. */}
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <Bone className="h-3.5 w-28 bg-white/15" />
          <Bone className="h-[56px] rounded-xl bg-white/10" />
        </div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line">
        {["Faturamento hoje", "Pedidos", "Ticket médio"].map((label) => (
          <div key={label} className="flex flex-col gap-1 bg-surface px-5 py-4">
            <span className="text-[13px] font-semibold text-muted">{label}</span>
            {/* The value is clamp(24px, 2.3vw, 30px) in Kpi. */}
            <Bone className="my-0.5 h-7 w-28 min-[1300px]:my-1" />
            <Bone className="my-0.5 h-3.5 w-36" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-3.5">
        {["Aparelhos agora", "Esgotados hoje"].map((title) => (
          <div key={title} className={HOME_CARD}>
            <div className="flex min-h-7 items-center">
              <span className="text-base font-bold tracking-[-0.01em]">{title}</span>
            </div>
            <div className="flex flex-col divide-y divide-line">
              {[0, 1].map((row) => (
                <div key={row} className="flex min-h-[42px] items-center justify-between gap-3">
                  <Bone className="h-4 w-36" />
                  <Bone className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** Itens: one card, a row per item with photo, name and price. */
export function ItemListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Busy>
      <Card className="p-0">
        <div className="divide-y divide-line">
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="flex items-center gap-4 px-5 py-3">
              <Bone className="size-12 shrink-0 rounded-lg" />
              <Bone className="h-4 flex-1 sm:max-w-64" />
              <Bone className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </Busy>
  );
}

/** Esgotados: a row per item with photo, name and its button. */
export function SoldOutSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Busy>
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3"
          >
            <Bone className="size-12 shrink-0 rounded-lg" />
            <Bone className="h-4 flex-1 sm:max-w-64" />
            <Bone className="h-10 w-20 rounded-[10px]" />
          </div>
        ))}
      </div>
    </Busy>
  );
}

/** A page whose title is data too (an item's name): header bones, then a form. */
export function TitledFormSkeleton() {
  return (
    <Busy>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <Bone className="h-8 w-56 max-w-full" />
        <Bone className="h-4 w-16" />
      </header>
      <FormCards cards={2} fields={6} />
    </Busy>
  );
}

/** Form pages: `cards` cards, each a title and a grid of labelled fields with a button. */
export function FormSkeleton({ cards = 2, fields = 6 }: { cards?: number; fields?: number }) {
  return (
    <Busy>
      <FormCards cards={cards} fields={fields} />
    </Busy>
  );
}

function FormCards({ cards, fields }: { cards: number; fields: number }) {
  return (
    <>
      {Array.from({ length: cards }, (_, card) => (
        <Card key={card} className="flex flex-col gap-4">
          <Bone className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: fields }, (_, field) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Bone className="h-3.5 w-20" />
                <Bone className="h-11 rounded-[10px]" />
              </div>
            ))}
          </div>
          <Bone className="h-10 w-32 rounded-[10px]" />
        </Card>
      ))}
    </>
  );
}
