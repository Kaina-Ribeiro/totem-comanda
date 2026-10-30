import Image from "next/image";
import type { ReactNode } from "react";

import { formatBRL } from "@/lib/format/money";
import {
  type BasketLine,
  findItem,
  type Menu,
  optionNames,
  type OrderType,
  unitPrice,
} from "@/lib/kiosk/menu-view";
import { format, type Strings } from "@/lib/kiosk/strings";

import { ChevronLeft, Minus, Plus } from "../icons";
import { currentQuote, type Journey } from "./journey-state";

/**
 * Prototype 05-Cart at 1080x1920. Lines with edit, remove and quantity; the
 * total is the Core API's quote for exactly this basket, and paying waits for
 * it. Line prices are display-only, from the menu loaded at start.
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
  onRetryQuote,
  onPay,
}: {
  journey: Journey;
  strings: Strings;
  /** Rows between the lines and the total: CPF (COM-37) and coupon (COM-38). */
  extras?: ReactNode;
  onBack: () => void;
  onCancel: () => void;
  onEdit: (line: BasketLine) => void;
  onQuantity: (line: BasketLine, quantity: number) => void;
  onRemove: (line: BasketLine) => void;
  onRetryQuote: () => void;
  onPay: () => void;
}) {
  const menu = journey.menu!;
  const orderType = journey.orderType ?? "DINEIN";
  const quote = currentQuote(journey);
  const failed = journey.quote && !journey.quote.result.ok ? journey.quote.result : null;
  const stale = !quote && !failed;
  const empty = journey.basket.length === 0;

  return (
    <div className="flex h-dvh flex-col bg-ground text-ink">
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
          <h1 className="font-display text-[84px] font-semibold tracking-[-0.03em]">
            {strings["basket.title"]}
          </h1>
          <span className="text-[28.5px] font-semibold text-muted">
            {strings[`orderType.${orderType}`]}
          </span>
        </div>

        {empty ? (
          <p className="rounded-card-sm bg-surface p-12 text-[33px] text-muted">
            {strings["basket.empty"]}
          </p>
        ) : (
          <ul className="flex flex-col rounded-card-sm bg-surface px-[42px]">
            {journey.basket.map((line) => (
              <LineRow
                key={line.guid}
                line={line}
                menu={menu}
                orderType={orderType}
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
            <span>{quoteErrorMessage(failed.code, failed.detail, strings)}</span>
            {failed.code !== "ITEM_UNAVAILABLE" && failed.code !== "BASKET_ITEM_LIMIT_EXCEEDED" && (
              <button onClick={onRetryQuote} className="shrink-0 underline">
                {strings["basket.retry"]}
              </button>
            )}
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-col gap-[30px] px-12 pt-6 pb-12">
        {quote && quote.discountTotal > 0 && (
          <div className="flex flex-col gap-2 px-[18px] text-[28.5px] text-muted">
            <div className="flex justify-between">
              <span>{strings["basket.subtotal"]}</span>
              <span>{formatBRL(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-detail-text">
              <span>{quote.discount?.title ?? strings["basket.discount"]}</span>
              <span>− {formatBRL(quote.discountTotal)}</span>
            </div>
          </div>
        )}
        <div className="flex items-baseline justify-between px-[18px]">
          <span className="text-[33px] font-semibold text-muted">
            {stale && !empty ? strings["basket.updating"] : strings["basket.total"]}
          </span>
          <span
            className={`font-display text-[84px] font-semibold tracking-[-0.03em] transition-opacity ${
              stale ? "opacity-40" : ""
            }`}
          >
            {quote
              ? formatBRL(quote.total)
              : journey.quote?.result.ok
                ? formatBRL(journey.quote.result.data.total)
                : "—"}
          </span>
        </div>
        <button
          onClick={onPay}
          disabled={!quote || empty}
          className="h-button w-full rounded-full bg-accent text-[39px] font-bold text-on-accent transition-opacity disabled:opacity-50"
        >
          {strings["basket.pay"]}
        </button>
      </footer>
    </div>
  );
}

function quoteErrorMessage(code: string, detail: string | undefined, strings: Strings): string {
  switch (code) {
    case "ITEM_UNAVAILABLE":
      return detail
        ? format(strings["basket.unavailable"], { name: detail })
        : strings["basket.unavailableGeneric"];
    case "BASKET_ITEM_LIMIT_EXCEEDED":
      return strings["basket.limit"];
    default:
      return strings["basket.error"];
  }
}

function LineRow({
  line,
  menu,
  orderType,
  strings,
  onEdit,
  onQuantity,
  onRemove,
}: {
  line: BasketLine;
  menu: Menu;
  orderType: OrderType;
  strings: Strings;
  onEdit: () => void;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
}) {
  const item = findItem(menu, line.itemId);
  if (!item) return null;
  const summary = optionNames(item, line.options).join(", ");
  const editable = (item.optionGroups ?? []).length > 0;
  return (
    <li className="flex gap-[30px] border-b border-line py-[42px] last:border-0">
      <div className="relative size-[132px] shrink-0 overflow-hidden rounded-[24px] bg-wheat">
        {item.image ? (
          <Image src={item.image} alt="" fill sizes="132px" className="object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center font-display text-[60px] font-semibold text-ink/25">
            {item.name.charAt(0)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-[9px]">
        <div className="flex items-baseline justify-between gap-6">
          <span className="text-[31.5px] font-bold">{item.name}</span>
          <span className="shrink-0 text-[31.5px] font-bold">
            {formatBRL(unitPrice(item, line.options, orderType) * line.quantity)}
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

/** Prototype 10-Cancel: confirm before throwing the order away (F-BASKET-04). */
export function CancelDialog({
  units,
  strings,
  onKeep,
  onConfirm,
}: {
  units: number;
  strings: Strings;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#2b211c]/75 px-[72px]"
      role="dialog"
      aria-modal
    >
      <div className="flex w-full flex-col gap-[54px] rounded-[54px] bg-surface p-[72px] text-ink">
        <div className="flex flex-col gap-[24px]">
          <h2 className="font-display text-[72px] leading-none font-semibold tracking-[-0.02em]">
            {strings["cancel.title"]}
          </h2>
          <p className="text-[30px] leading-[1.45] text-muted">
            {units === 1 ? strings["cancel.bodyOne"] : format(strings["cancel.body"], { n: units })}
          </p>
        </div>
        <div className="flex flex-col gap-[21px]">
          <button
            onClick={onKeep}
            className="h-[150px] rounded-full bg-ink text-[33px] font-bold text-on-accent"
          >
            {strings["cancel.keep"]}
          </button>
          <button
            onClick={onConfirm}
            className="h-[150px] rounded-full bg-ground text-[33px] font-bold text-danger"
          >
            {strings["cancel.confirm"]}
          </button>
        </div>
      </div>
    </div>
  );
}
