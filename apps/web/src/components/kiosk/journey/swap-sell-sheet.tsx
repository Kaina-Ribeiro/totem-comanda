import Image from "next/image";

import { findProduct, type KioskMenu, type Product } from "@/lib/kiosk/menu-graph";
import { format, type Strings } from "@/lib/kiosk/strings";

import { productPrice } from "./menu-screen";

/**
 * The swap-sell offer right after a product is added (SPEC 5.4, MODELS 5.17):
 * "Turbine seu hambúrguer" with the product(s) the guest can switch to. Not in
 * the approved prototype: drawn in the 09-Cpf sheet style. Prices are Core's;
 * the kiosk never shows a difference it would have to compute.
 */
export function SwapSellSheet({
  menu,
  productId,
  strings,
  onSwap,
  onKeep,
}: {
  menu: KioskMenu;
  productId: string;
  strings: Strings;
  onSwap: (target: Product) => void;
  onKeep: () => void;
}) {
  const product = findProduct(menu, productId);
  const targets = (product?.swapSell?.productIds ?? [])
    .map((id) => findProduct(menu, id))
    .filter((p): p is Product => !!p && p.available);
  if (!product?.swapSell || targets.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-[#2b211c]/75" role="dialog" aria-modal>
      <div className="flex w-full flex-col gap-[48px] rounded-t-[60px] bg-surface px-[66px] pt-[72px] pb-12 text-ink">
        <h2 className="font-display text-[72px] leading-none font-semibold tracking-[-0.02em]">{product.swapSell.name}</h2>
        <div className="flex flex-col gap-[30px]">
          {targets.map((target) => (
            <button
              key={target.id}
              onClick={() => onSwap(target)}
              className="flex items-center gap-[36px] rounded-[36px] bg-wheat p-[24px] text-left"
            >
              <span className="relative size-[210px] shrink-0 overflow-hidden rounded-[27px] bg-oat">
                {target.picture ? (
                  <Image src={target.picture.url} alt="" fill sizes="210px" className="object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center font-display text-[90px] font-semibold text-ink/25">
                    {target.name.charAt(0)}
                  </span>
                )}
              </span>
              <span className="flex flex-1 flex-col gap-[12px]">
                <span className="font-display text-[51px] leading-[1.05] font-semibold">{target.name}</span>
                {target.description && <span className="text-[27px] leading-[1.4] text-muted">{target.description}</span>}
                <span className="text-[30px] font-bold text-price">{productPrice(target, strings)}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-[21px]">
          {targets.length === 1 && (
            <button
              onClick={() => onSwap(targets[0])}
              className="h-[138px] rounded-full bg-accent text-[31.5px] font-bold text-on-accent"
            >
              {format(strings["swap.accept"], { name: targets[0].name })}
            </button>
          )}
          <button onClick={onKeep} className="h-[138px] rounded-full bg-ground text-[31.5px] font-bold">
            {format(strings["swap.keep"], { name: product.name })}
          </button>
        </div>
      </div>
    </div>
  );
}
