import Image from "next/image";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/format/money";
import { type BasketLine, type CheckItem, lineUnits, pickNames } from "@/lib/kiosk/basket-v2";
import { findProduct, type KioskMenu, nameOf } from "@/lib/kiosk/menu-graph";
import { format, type Strings } from "@/lib/kiosk/strings";

import { ChevronLeft, Minus, Plus } from "../icons";
import { currentTotals, currentTotalsFailure, type Journey, lastTotal } from "./journey-state";

export { CancelDialog } from "./cancel-dialog";

/**
 * Prototype 05-Cart at 1080x1920. Lines with edit, remove and quantity; every
 * amount (line prices, discount, total) is Go's, from `POST /v2/totals` for
 * exactly this basket, and paying waits for it. A line of 2 shows "2 × R$ X".
 */
export function BasketScreen({
  journey,
  strings,
  extras,
  onBack,
  onCancel,
  onEdit,
  onQuantity,
  onRemove,
  onRetryTotals,
  onPay,
}: {
  journey: Journey;
  strings: Strings;
  /** Rows between the lines and the total: the coupon. */
  extras?: ReactNode;
  onBack: () => void;
  onCancel: () => void;
  onEdit: (line: BasketLine) => void;
  onQuantity: (line: BasketLine, quantity: number) => void;
  onRemove: (line: BasketLine) => void;
  onRetryTotals: () => void;
  onPay: () => void;
}) {
  const menu = journey.menu!;
  const totals = currentTotals(journey);
  const failed = currentTotalsFailure(journey);
  const stale = !totals && !failed;
  const empty = journey.basket.length === 0;
  const units = totals ? lineUnits(journey.basket, totals) : null;
  const shown = totals?.total ?? lastTotal(journey);

  return (
    <div className="flex h-full flex-col bg-ground text-ink">
      <header className="flex shrink-0 items-center justify-between px-12 pt-[42px]">
        <button
          onClick={onBack}
          className="flex h-[84px] items-center gap-3 rounded-full bg-surface pr-[33px] pl-[21px] text-[28.5px] font-bold"
        >
          <ChevronLeft size={36} />
          {strings["nav.menu"]}
        </button>
        <button onClick={onCancel} className="text-[28.5px] font-bold text-danger">
          {strings["menu.cancel"]}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-[30px] overflow-y-auto px-12 pt-[54px] pb-6">
        <div className="flex items-baseline justify-between px-[18px]">
          <h1 className="font-display text-[84px] font-semibold tracking-[-0.03em]">{strings["basket.title"]}</h1>
          <span className="text-[28.5px] font-semibold text-muted">{strings["menu.dineIn"]}</span>
        </div>

        {empty ? (
          <p className="rounded-card-sm bg-surface p-12 text-[33px] text-muted">{strings["basket.empty"]}</p>
        ) : (
          <ul className="flex flex-col rounded-card-sm bg-surface px-[42px]">
            {journey.basket.map((line) => (
              <LineRow
                key={line.guid}
                line={line}
                menu={menu}
                unit={units?.get(line.guid) ?? null}
                strings={strings}
                onEdit={() => onEdit(line)}
                onQuantity={(quantity) => onQuantity(line, quantity)}
                onRemove={() => onRemove(line)}
              />
            ))}
          </ul>
        )}

        {extras}

        {failed && (
          <div className="flex items-center justify-between gap-6 rounded-card-sm bg-danger/10 px-[42px] py-[33px] text-[28.5px] font-semibold text-danger">
            <span>{totalsErrorMessage(failed.code, failed.detail, menu, strings)}</span>
            {!["ITEM_UNAVAILABLE", "BASKET_ITEM_LIMIT_EXCEEDED"].includes(failed.code) && (
              <button onClick={onRetryTotals} className="shrink-0 underline">
                {strings["basket.retry"]}
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-col gap-[30px] px-12 pt-6 pb-12">
        {totals && (totals.discount ?? 0) > 0 && (
          <div className="flex flex-col gap-2 px-[18px] text-[28.5px] text-muted">
            <div className="flex justify-between">
              <span>{strings["basket.subtotal"]}</span>
              <span>{formatMoney(totals.subTotal)}</span>
            </div>
            <div className="flex justify-between text-detail-text">
              <span>{totals.discounts?.[0]?.name ?? strings["basket.discount"]}</span>
              <span>− {formatMoney(totals.discount ?? 0)}</span>
            </div>
          </div>
        )}
        <div className="flex items-baseline justify-between px-[18px]">
          <span className="text-[33px] font-semibold text-muted">
            {stale && !empty ? strings["basket.updating"] : strings["basket.total"]}
          </span>
          <span
            className={`font-display text-[84px] font-semibold tracking-[-0.03em] transition-opacity ${stale ? "opacity-40" : ""}`}
          >
            {shown !== null ? formatMoney(shown) : "—"}
          </span>
        </div>
        <button
          onClick={onPay}
          disabled={!totals || empty}
          className="h-button w-full rounded-full bg-accent text-[39px] font-bold text-on-accent transition-opacity disabled:opacity-50"
        >
          {strings["basket.pay"]}
        </button>
      </footer>
    </div>
  );
}

/** The basket's error line for a totals failure; Core names the unavailable id in `detail`. */
export function totalsErrorMessage(code: string, detail: string | undefined, menu: KioskMenu, strings: Strings): string {
  switch (code) {
    case "ITEM_UNAVAILABLE": {
      const name = detail ? nameOf(menu, detail) : null;
      return name ? format(strings["basket.unavailable"], { name }) : strings["basket.unavailableGeneric"];
    }
    case "BASKET_ITEM_LIMIT_EXCEEDED":
      return strings["basket.limit"];
    default:
      return strings["basket.error"];
  }
}

function LineRow({
  line,
  menu,
  unit,
  strings,
  onEdit,
  onQuantity,
  onRemove,
}: {
  line: BasketLine;
  menu: KioskMenu;
  unit: CheckItem | null;
  strings: Strings;
  onEdit: () => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const product = findProduct(menu, line.productId);
  // Off the menu since it was added (a language change reloads it): the line
  // still blocks the totals, so the guest must see it to remove it.
  if (!product) return <GoneLineRow strings={strings} onRemove={onRemove} />;
  const summary = pickNames(product, line, (name) => format(strings["item.without"], { name })).join(", ");
  const editable = product.groups.length > 0;
  const price =
    unit?.total == null
      ? null
      : line.quantity === 1
        ? formatMoney(unit.total)
        : format(strings["basket.unit"], { n: line.quantity, price: formatMoney(unit.total) });
  return (
    <li className="flex gap-[30px] border-b border-line py-[42px] last:border-0">
      <div className="relative size-[132px] shrink-0 overflow-hidden rounded-[24px] bg-wheat">
        {product.picture ? (
          <Image src={product.picture.url} alt="" fill sizes="132px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-[60px] font-semibold text-ink/25">
            {product.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-[31.5px] font-bold">{product.name}</span>
          <span className={`shrink-0 text-[31.5px] font-bold transition-opacity ${price ? "" : "opacity-0"}`}>
            {price ?? "—"}
          </span>
        </div>
        {summary && <span className="text-[25.5px] text-muted">{summary}</span>}
        <div className="mt-[9px] flex items-center justify-between">
          <div className="flex gap-[30px] text-[25.5px] font-bold">
            {editable && (
              <button onClick={onEdit} className="text-detail-text">
                {strings["basket.edit"]}
              </button>
            )}
            <button onClick={onRemove} className="text-muted">
              {strings["basket.remove"]}
            </button>
          </div>
          <div className="flex items-center gap-[9px] rounded-full border-[4.5px] border-ground p-[6px]">
            <button
              onClick={() => onQuantity(line.quantity - 1)}
              disabled={line.quantity <= 1}
              aria-label={strings["item.less"]}
              className="flex size-[66px] items-center justify-center rounded-full bg-ground disabled:opacity-40"
            >
              <Minus size={27} />
            </button>
            <span className="w-[54px] text-center text-[30px] font-bold">{line.quantity}</span>
            <button
              onClick={() => onQuantity(line.quantity + 1)}
              aria-label={strings["item.more"]}
              className="flex size-[66px] items-center justify-center rounded-full bg-ground"
            >
              <Plus size={27} />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

/** A basket line whose product is no longer on the menu: no price or options, only Remove. */
function GoneLineRow({ strings, onRemove }: { strings: Strings; onRemove: () => void }) {
  return (
    <li className="flex gap-[30px] border-b border-line py-[42px] last:border-0">
      <span className="flex size-[132px] shrink-0 items-center justify-center rounded-[24px] bg-wheat font-display text-[60px] font-semibold text-ink/25">
        ?
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
        <span className="text-[31.5px] font-bold">{strings["basket.goneLine"]}</span>
        <span className="text-[25.5px] text-muted">{strings["basket.goneLineBody"]}</span>
        <div className="mt-[9px] flex text-[25.5px] font-bold">
          <button onClick={onRemove} className="text-detail-text">
            {strings["basket.remove"]}
          </button>
        </div>
      </div>
    </li>
  );
}
