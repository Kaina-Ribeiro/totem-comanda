import Image from "next/image";
import { useState } from "react";

import { formatBRL } from "@/lib/format/money";
import { draftToLine, initialDraft } from "@/lib/kiosk/item-draft";
import {
  type BasketLine,
  cellPrice,
  findItem,
  type Menu,
  type MenuEntity,
  type OrderType,
} from "@/lib/kiosk/menu-view";
import type { Strings } from "@/lib/kiosk/strings";

import { Check } from "../icons";

/**
 * "Que tal um café?" (F-MENU-11). Not drawn in the prototype: a sheet in the
 * 09-Cpf style with the group's items. Picked items go in with their default
 * choices; "No, thanks" stops suggestions for this journey.
 */
export function CrossSellSheet({
  menu,
  groupId,
  orderType,
  strings,
  onAccept,
  onDismiss,
}: {
  menu: Menu;
  groupId: string;
  orderType: OrderType;
  strings: Strings;
  onAccept: (lines: BasketLine[]) => void;
  onDismiss: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const group = menu.crossSellGroups.find((g) => g.id === groupId);
  const items = (group?.crossSells ?? [])
    .map((id) => findItem(menu, id))
    .filter(
      (item): item is MenuEntity => !!item && (item.serviceAvailability?.[orderType] ?? true),
    );
  if (!group || items.length === 0) return null;

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const accept = () =>
    onAccept(
      items
        .filter((item) => picked.includes(item.id))
        .map((item) => draftToLine(item, initialDraft(item), crypto.randomUUID())),
    );

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-[#2b211c]/75" role="dialog" aria-modal>
      <div className="flex w-full flex-col gap-[48px] rounded-t-[60px] bg-surface px-[66px] pt-[72px] pb-12 text-ink">
        <h2 className="font-display text-[72px] leading-none font-semibold tracking-[-0.02em]">
          {group.name}
        </h2>
        <div className="grid grid-cols-2 gap-[30px]">
          {items.map((item) => {
            const on = picked.includes(item.id);
            return (
              <button
                key={item.id}
                onClick={() => toggle(item.id)}
                aria-pressed={on}
                className={`flex flex-col gap-[18px] rounded-[36px] p-[18px] text-left ${
                  on ? "bg-wheat" : "bg-ground"
                }`}
              >
                <div className="relative h-[240px] overflow-hidden rounded-[27px] bg-oat">
                  {item.image && (
                    <Image src={item.image} alt="" fill sizes="440px" className="object-cover" />
                  )}
                  {on && (
                    <span className="absolute top-[18px] right-[18px] flex size-[60px] items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check size={33} strokeWidth={3} />
                    </span>
                  )}
                </div>
                <span className="px-[9px] text-[30px] font-bold">{item.name}</span>
                <span className="px-[9px] pb-[9px] text-[28.5px] font-semibold text-price">
                  + {formatBRL(cellPrice(item, orderType))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-[30px]">
          <button
            onClick={onDismiss}
            className="h-[138px] flex-1 rounded-full bg-ground text-[31.5px] font-bold"
          >
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
