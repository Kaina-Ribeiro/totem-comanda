import type { Strings } from "@/lib/kiosk/strings";

import type { Journey } from "./journey-state";

/** Placeholder until COM-34: proves the menu loaded once, in the journey's language. */
export function MenuScreen({
  brand,
  journey,
  strings,
  canChangeOrderType,
  onChangeOrderType,
  onCancel,
}: {
  brand: string;
  journey: Journey;
  strings: Strings;
  canChangeOrderType: boolean;
  onChangeOrderType: () => void;
  onCancel: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col gap-12 bg-ground p-[84px] text-ink">
      <div className="font-display text-[51px] italic">{brand}</div>
      <div className="flex items-center gap-6 text-[30px] font-bold">
        {journey.orderType && strings[`orderType.${journey.orderType}`]}
        {canChangeOrderType && (
          <button onClick={onChangeOrderType} className="text-detail-text">
            {strings["menu.change"]}
          </button>
        )}
      </div>
      <h1 className="font-display text-[75px] font-semibold">{journey.menu?.name}</h1>
      <ul className="flex flex-col gap-4 text-[36px]">
        {journey.menu?.entities.map((category) => <li key={category.id}>{category.name}</li>)}
      </ul>
      <button onClick={onCancel} className="self-start text-[30px] font-bold text-danger">
        {strings["menu.cancel"]}
      </button>
    </main>
  );
}
