"use client";

import { useState } from "react";

import type { KitchenOrder } from "@/lib/kitchen/order";
import { type ProductionScope, productionTotals } from "@/lib/kitchen/production";

const SCOPES: { id: ProductionScope; label: string }[] = [
  { id: "open", label: "Novos + preparando" },
  { id: "new", label: "Só novos" },
];

/** Produção (prototype K3): what to make now across the open orders. */
export function ProductionView({ orders }: { orders: KitchenOrder[] }) {
  const [scope, setScope] = useState<ProductionScope>("open");
  const totals = productionTotals(orders, scope);
  const count = totals.orders.length;
  return (
    <section aria-labelledby="production-title" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end justify-between gap-4 px-6 pt-2">
        <div className="flex flex-col gap-1">
          <h2 id="production-title" className="text-[26px] font-bold tracking-[-0.02em]">
            Para fazer agora
          </h2>
          <p className="text-[15px] font-semibold text-muted">
            {count === 0
              ? "Nenhum pedido aberto."
              : `Soma de ${count} ${count === 1 ? "pedido aberto" : "pedidos abertos"} (${totals.orders.join(", ")}). Atualiza sozinho quando chega pedido.`}
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Quais pedidos somar"
          className="flex gap-1 rounded-2xl bg-tabs p-1"
        >
          {SCOPES.map((option) => (
            <button
              key={option.id}
              role="radio"
              aria-checked={scope === option.id}
              onClick={() => setScope(option.id)}
              className={`h-11 rounded-[14px] px-[18px] text-[15px] font-extrabold transition-transform active:scale-[.97] ${
                scope === option.id ? "bg-surface text-ink" : "text-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-4 content-start gap-3.5 overflow-y-auto px-6 pt-[18px] pb-6">
        {totals.items.map((item) => (
          <article
            key={item.itemId}
            className="flex min-h-[200px] flex-col gap-2.5 rounded-[14px] bg-surface px-5 py-[18px] shadow-[0_1px_2px_rgba(28,28,26,.08)]"
          >
            <div className="flex items-baseline gap-2.5">
              <span className="text-[52px] leading-[0.95] font-extrabold tracking-[-0.03em]">
                {item.quantity}
              </span>
              <span className="text-[22px] font-bold tracking-[-0.02em] text-muted">×</span>
            </div>
            <span className="text-[19px] leading-[1.2] font-extrabold">{item.name}</span>
            {item.variants.length > 0 && (
              <ul className="flex flex-col gap-[5px]">
                {item.variants.map((variant) => (
                  <li
                    key={variant.key}
                    className="flex gap-2 text-[15px] font-semibold text-muted"
                  >
                    <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-[11px] bg-wheat text-xs font-extrabold text-ink">
                      {variant.quantity}
                    </span>
                    {variant.label}
                  </li>
                ))}
              </ul>
            )}
            <span className="mt-auto text-[13px] font-bold text-muted">
              {item.orders.length === 1 ? "Pedido" : "Pedidos"} {item.orders.join(", ")}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
