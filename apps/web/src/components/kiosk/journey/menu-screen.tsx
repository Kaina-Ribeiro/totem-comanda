import Image from "next/image";

import { formatBRL } from "@/lib/format/money";
import {
  type Badge,
  badgesFor,
  basketDisplayTotal,
  basketUnits,
  cellPrice,
  filterMenu,
  type MenuEntity,
} from "@/lib/kiosk/menu-view";
import { format, type Strings } from "@/lib/kiosk/strings";

import { Close, Plus } from "../icons";
import type { Journey } from "./journey-state";

/** Pastel tints the prototype rotates through the categories (03-Menu). */
const TINTS = ["bg-butter", "bg-wheat", "bg-sage", "bg-oat"];

/**
 * Prototype 03-Menu at 1080x1920. Category rail, item grid and basket bar,
 * all over the menu loaded at journey start: changing category never calls
 * the server.
 */
export function MenuScreen({
  brand,
  journey,
  strings,
  canChangeOrderType,
  onChangeOrderType,
  onPickCategory,
  onPickItem,
  onOpenBasket,
  onCancel,
}: {
  brand: string;
  journey: Journey;
  strings: Strings;
  canChangeOrderType: boolean;
  onChangeOrderType: () => void;
  onPickCategory: (categoryId: string) => void;
  onPickItem: (item: MenuEntity) => void;
  onOpenBasket: () => void;
  onCancel: () => void;
}) {
  const orderType = journey.orderType ?? "DINEIN";
  const menu = filterMenu(journey.menu!, orderType);
  const categoryIndex = Math.max(
    0,
    menu.entities.findIndex((c) => c.id === journey.categoryId),
  );
  const category = menu.entities[categoryIndex];
  const tint = TINTS[categoryIndex % TINTS.length];
  const items = category?.childEntities ?? [];
  const units = basketUnits(journey.basket);

  return (
    <div className="flex h-dvh flex-col bg-ground text-ink">
      <header className="flex shrink-0 items-center justify-between px-12 pt-[42px] pb-[30px]">
        <div className="flex items-center gap-[30px]">
          <div className="font-display text-[39px] font-medium italic">{brand}</div>
          <button
            onClick={canChangeOrderType ? onChangeOrderType : undefined}
            disabled={!canChangeOrderType}
            className="flex h-[72px] items-center gap-[15px] rounded-full bg-surface px-[27px] text-[25.5px] font-bold"
          >
            <span>{strings[`orderType.${orderType}`]}</span>
            {canChangeOrderType && (
              <span className="text-detail-text">{strings["menu.change"]}</span>
            )}
          </button>
        </div>
        <button
          onClick={onCancel}
          aria-label={strings["menu.cancel"]}
          className="flex size-[84px] items-center justify-center rounded-full bg-surface"
        >
          <Close size={36} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Categorias"
          className="flex w-[312px] shrink-0 flex-col gap-[9px] pt-3 pr-[18px] pl-[30px]"
        >
          {menu.entities.map((c, index) => {
            const on = index === categoryIndex;
            const cTint = TINTS[index % TINTS.length];
            return (
              <button
                key={c.id}
                onClick={() => onPickCategory(c.id)}
                aria-pressed={on}
                className={`flex min-h-[108px] w-full items-center gap-[18px] rounded-[27px] px-[21px] text-left text-[27px] ${
                  on ? `${cTint} font-extrabold text-ink` : "font-semibold text-muted"
                }`}
              >
                <span
                  className={`size-[15px] shrink-0 rounded-full ${cTint} shadow-[inset_0_0_0_1.5px_rgba(43,33,28,0.15)]`}
                />
                <span>{c.name}</span>
              </button>
            );
          })}
        </nav>

        <main className="flex min-w-0 flex-1 flex-col gap-9 overflow-y-auto rounded-tl-[48px] bg-surface pt-12 pr-[42px] pb-12 pl-12">
          <div className="flex items-baseline justify-between">
            <h1 className="font-display text-[72px] font-semibold tracking-[-0.02em]">
              {category?.name}
            </h1>
            <div className="text-[25.5px] font-semibold text-muted">
              {items.length === 1
                ? strings["menu.option"]
                : format(strings["menu.options"], { n: items.length })}
            </div>
          </div>
          {items.length === 0 && <p className="text-[30px] text-muted">{strings["menu.empty"]}</p>}
          <div className="grid grid-cols-2 gap-x-[30px] gap-y-[42px]">
            {items.map((item, index) => (
              <ItemCell
                key={item.id}
                item={item}
                price={formatBRL(cellPrice(item, orderType))}
                badges={badgesFor(
                  journey.menu!,
                  { id: item.id, categoryId: category.id },
                  "ITEM_MENU",
                )}
                tint={tint}
                priority={index < 4}
                addLabel={format(strings["menu.add"], { name: item.name })}
                onPress={() => onPickItem(item)}
              />
            ))}
          </div>
        </main>
      </div>

      <div className="shrink-0 bg-surface px-12 pt-[30px] pb-12">
        <button
          onClick={onOpenBasket}
          disabled={units === 0}
          className="flex h-button w-full items-center justify-between rounded-full bg-accent px-[66px] text-on-accent transition-opacity disabled:opacity-60"
        >
          <span className="flex flex-col items-start gap-[3px]">
            <span className="text-[24px] font-semibold text-on-accent-muted">
              {units === 0
                ? strings["basketBar.empty"]
                : units === 1
                  ? strings["basketBar.item"]
                  : format(strings["basketBar.items"], { n: units })}
            </span>
            <span className="text-[39px] font-bold">{strings["basketBar.cta"]}</span>
          </span>
          <span className="font-display text-[54px] font-semibold tracking-[-0.02em]">
            {formatBRL(basketDisplayTotal(journey.menu!, journey.basket, orderType))}
          </span>
        </button>
      </div>
    </div>
  );
}

function ItemCell({
  item,
  price,
  badges,
  tint,
  priority,
  addLabel,
  onPress,
}: {
  item: MenuEntity;
  price: string;
  badges: Badge[];
  tint: string;
  priority: boolean;
  addLabel: string;
  onPress: () => void;
}) {
  return (
    <button onClick={onPress} aria-label={addLabel} className="flex flex-col gap-[18px] text-left">
      <div
        className={`relative flex h-[240px] items-center justify-center overflow-hidden rounded-[30px] ${tint}`}
      >
        {item.image ? (
          <Image
            src={item.image}
            alt=""
            fill
            sizes="324px"
            priority={priority}
            className="object-cover"
          />
        ) : (
          <span className="font-display text-[96px] font-semibold text-ink/25">
            {item.name.charAt(0)}
          </span>
        )}
        {badges.length > 0 && (
          <div className="absolute top-[18px] left-[18px] flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge.id}
                className="rounded-[18px] px-[18px] py-[9px] text-[21px] font-bold"
                style={{ color: badge.textColour, backgroundColor: badge.backgroundColour }}
              >
                {badge.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-start justify-between gap-[15px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[30px] leading-[1.2] font-bold">{item.name}</div>
          <div className="text-[28.5px] font-semibold text-price">{price}</div>
        </div>
        <span className="flex size-[66px] shrink-0 items-center justify-center rounded-full border-[3px] border-ink">
          <Plus size={30} strokeWidth={2.6} />
        </span>
      </div>
    </button>
  );
}
