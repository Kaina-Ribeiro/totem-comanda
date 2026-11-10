import Image from "next/image";
import { useState } from "react";

import type { BasketLine } from "@/lib/kiosk/basket-v2";
import { canAdd, draftToLine, initialDraft } from "@/lib/kiosk/builder";
import { findProduct, type KioskMenu, type Product } from "@/lib/kiosk/menu-graph";
import type { Strings } from "@/lib/kiosk/strings";

import { Check } from "../icons";
import { productPrice } from "./menu-screen";

/**
 * "Que tal acompanhar?" after a product is added (`crossSellIds`). Not drawn
 * in the prototype: a sheet in the 09-Cpf style. Products that need no choice
 * toggle and go in together; one that needs a choice (a size) opens the
 * builder. "Não, obrigado" stops suggestions for this journey.
 */
export function CrossSellSheet({
  menu,
  productId,
  basket,
  strings,
  onAccept,
  onChoose,
  onDismiss,
}: {
  menu: KioskMenu;
  productId: string;
  basket: BasketLine[];
  strings: Strings;
  onAccept: (lines: BasketLine[]) => void;
  onChoose: (product: Product) => void;
  onDismiss: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const products = (findProduct(menu, productId)?.crossSellIds ?? [])
    .map((id) => findProduct(menu, id))
    .filter((p): p is Product => !!p && p.available && !basket.some((line) => line.productId === p.id));
  if (products.length === 0) return null;

  const ready = (p: Product) => canAdd(p, initialDraft(p));
  const toggle = (p: Product) => {
    if (!ready(p)) return onChoose(p);
    setPicked((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]));
  };
  const accept = () =>
    onAccept(
      products.filter((p) => picked.includes(p.id)).map((p) => draftToLine(p, initialDraft(p), crypto.randomUUID())),
    );

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-[#2b211c]/75" role="dialog" aria-modal>
      <div className="flex w-full flex-col gap-[48px] rounded-t-[60px] bg-surface px-[66px] pt-[72px] pb-12 text-ink">
        <h2 className="font-display text-[72px] leading-none font-semibold tracking-[-0.02em]">
          {strings["crossSell.title"]}
        </h2>
        <div className="grid grid-cols-2 gap-[30px]">
          {products.map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggle(p)}
                aria-pressed={ready(p) ? on : undefined}
                className={`flex flex-col gap-[18px] rounded-[36px] p-[18px] text-left ${on ? "bg-wheat" : "bg-ground"}`}
              >
                <div className="relative h-[240px] overflow-hidden rounded-[27px] bg-oat">
                  {p.picture && <Image src={p.picture.url} alt="" fill sizes="440px" className="object-cover" />}
                  {on && (
                    <span className="absolute top-[18px] right-[18px] flex size-[60px] items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check size={33} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <span className="px-[9px] text-[30px] font-bold">{p.name}</span>
                <span className="flex items-center justify-between px-[9px] pb-[9px] text-[28.5px] font-semibold text-price">
                  {productPrice(p, strings)}
                  {!ready(p) && <span className="text-[25.5px] font-bold text-detail-text">{strings["crossSell.choose"]}</span>}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-[30px]">
          <button onClick={onDismiss} className="h-[138px] flex-1 rounded-full bg-ground text-[31.5px] font-bold">
            {strings["crossSell.skip"]}
          </button>
          <button
            onClick={accept}
            disabled={picked.length === 0}
            className="h-[138px] flex-1 rounded-full bg-accent text-[31.5px] font-bold text-on-accent disabled:opacity-50"
          >
            {picked.length === 0 ? strings["crossSell.pick"] : strings["crossSell.add"]}
          </button>
        </div>
      </div>
    </div>
  );
}
