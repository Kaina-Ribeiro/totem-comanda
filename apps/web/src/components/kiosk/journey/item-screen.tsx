import { type ReactNode, useState } from "react";

import { formatMoney } from "@/lib/format/money";
import type { BasketLine } from "@/lib/kiosk/basket";
import {
  canAdd,
  type Draft,
  draftToLine,
  groupCount,
  initialDraft,
  isBlocked,
  isSingleChoice,
  lineToDraft,
  quantityOf,
  setOptionQuantity,
  setQuantity,
  toggleOption,
} from "@/lib/kiosk/builder";
import type { MenuGroup, MenuOption, Product } from "@/lib/kiosk/menu-graph";
import { format, type Strings } from "@/lib/kiosk/strings";

import { Check, ChevronLeft, Minus, Plus } from "../icons";
import { Badges, productPrice } from "./menu-screen";
import { Photo } from "./photo";

/**
 * Prototype 04-Item at 1080x1920 on the v2 groups (SPEC 5.3): sizes first,
 * then groups in link order; single choices (sizes, combo main and sides) as
 * chips, extras as a checklist up to the group's max, ingredients (INGR) to
 * take out, nested groups under the option that opens them, quantity. Option
 * prices show only when > 0. The add button carries no total: the kiosk never
 * adds prices (SPEC 4.2); Go prices the basket.
 */
export function ItemScreen({
  product,
  editing,
  strings,
  backLabel,
  onBack,
  onSave,
}: {
  product: Product;
  editing: BasketLine | null;
  strings: Strings;
  backLabel: string;
  onBack: () => void;
  onSave: (line: BasketLine) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => (editing ? lineToDraft(product, editing) : initialDraft(product)));
  const ready = canAdd(product, draft);

  return (
    <div className="flex h-full flex-col bg-surface text-ink">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative h-[570px] bg-wheat">
          {product.picture && (
            <>
              {/* The grid thumbnail, already in the browser, holds the place until the full photo fades in over it. */}
              <Photo picture={product.picture} variant="thumb" decorative />
              <Photo picture={product.picture} variant="hero" preload />
            </>
          )}
          <button
            onClick={onBack}
            className="absolute top-[42px] left-12 flex h-[84px] items-center gap-3 rounded-full bg-surface pr-[33px] pl-[21px] text-[28.5px] font-bold"
          >
            <ChevronLeft size={36} />
            {backLabel}
          </button>
          {product.badges.length > 0 && <Badges badges={product.badges} large />}
        </div>

        <div className="flex flex-col gap-[54px] px-[66px] pt-[54px] pb-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-8">
              <h1 className="font-display text-[72px] leading-[1.05] font-semibold tracking-[-0.02em]">{product.name}</h1>
              <span className="shrink-0 text-[39px] font-bold text-price">{productPrice(product, strings)}</span>
            </div>
            {product.description && <p className="text-[30px] leading-[1.45] text-muted">{product.description}</p>}
          </div>

          {product.groups.map((group) => (
            <GroupSection key={group.key} group={group} draft={draft} strings={strings} onChange={setDraft} />
          ))}
        </div>
      </div>

      <div className="flex shrink-0 gap-[30px] px-12 pt-6 pb-12">
        <div className="flex h-button items-center gap-3 rounded-full bg-ground px-3">
          <StepButton
            label={strings["item.less"]}
            disabled={draft.quantity <= 1}
            onPress={() => setDraft(setQuantity(draft, draft.quantity - 1))}
          >
            <Minus size={36} />
          </StepButton>
          <span className="w-[72px] text-center font-display text-[54px] font-semibold">{draft.quantity}</span>
          <StepButton label={strings["item.more"]} onPress={() => setDraft(setQuantity(draft, draft.quantity + 1))}>
            <Plus size={36} />
          </StepButton>
        </div>
        <button
          onClick={() => onSave(draftToLine(product, draft, editing?.guid ?? crypto.randomUUID()))}
          disabled={!ready}
          className="flex h-button flex-1 items-center justify-center rounded-full bg-accent px-[54px] text-[39px] font-bold text-on-accent transition-opacity disabled:opacity-50"
        >
          {editing ? strings["item.updateOrder"] : strings["item.addToOrder"]}
        </button>
      </div>
    </div>
  );
}

function groupHint(group: MenuGroup, draft: Draft, strings: Strings): { text: string; strong: boolean } {
  if (group.modifierType === "INGR") return { text: strings["item.ingredients"], strong: false };
  if (isSingleChoice(group) && group.min === 1) return { text: strings["item.chooseOne"], strong: true };
  if (group.max > 1) return { text: format(strings["item.count"], { count: groupCount(draft, group), max: group.max }), strong: false };
  if (group.min > 0) return { text: format(strings["item.chooseN"], { n: group.min }), strong: true };
  return { text: strings["item.optional"], strong: false };
}

/** "+ R$ 1,00" for an extra; a size shows its own price; free options show nothing. */
function optionPriceLabel(group: MenuGroup, option: MenuOption): string | null {
  if (option.price <= 0) return null;
  return group.kind === "SIZE" ? formatMoney(option.price) : `+ ${formatMoney(option.price)}`;
}

function GroupSection({
  group,
  draft,
  strings,
  onChange,
}: {
  group: MenuGroup;
  draft: Draft;
  strings: Strings;
  onChange: (draft: Draft) => void;
}) {
  const hint = groupHint(group, draft, strings);
  const chips = isSingleChoice(group) && group.modifierType !== "INGR";

  return (
    <section className="flex flex-col gap-[27px]">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="font-display text-[45px] font-semibold">
          {group.kind === "SIZE" ? strings["item.size"] : group.name}
        </h2>
        <span className={`shrink-0 text-[24px] font-bold ${hint.strong ? "text-detail-text" : "text-muted"}`}>{hint.text}</span>
      </div>

      {chips ? (
        <div className="grid grid-cols-3 gap-[18px]">
          {group.options.map((option) => {
            const on = quantityOf(draft, group, option) > 0;
            const price = optionPriceLabel(group, option);
            return (
              <button
                key={option.id}
                onClick={() => onChange(toggleOption(draft, group, option))}
                disabled={!option.available}
                aria-pressed={on}
                className={`flex min-h-[114px] flex-col items-center justify-center rounded-[24px] px-4 py-3 text-center text-[27px] font-bold ${
                  on ? "bg-accent text-on-accent" : option.available ? "bg-wheat text-ink" : "bg-ground text-muted opacity-75"
                }`}
              >
                {option.name}
                {!option.available ? (
                  <span className="text-[22px] font-semibold">{strings["item.unavailable"]}</span>
                ) : (
                  price && <span className="text-[22px] font-semibold opacity-80">{price}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col">
          {group.options.map((option) => (
            <OptionRow key={option.id} group={group} option={option} draft={draft} strings={strings} onChange={onChange} />
          ))}
        </ul>
      )}

      {/* Nested groups of picked options, inline under their group. */}
      {group.options
        .filter((option) => quantityOf(draft, group, option) > 0 && option.groups.length > 0)
        .flatMap((option) => option.groups)
        .map((nested) => (
          <div key={nested.key} className="border-l-[6px] border-wheat pl-9">
            <GroupSection group={nested} draft={draft} strings={strings} onChange={onChange} />
          </div>
        ))}
    </section>
  );
}

function OptionRow({
  group,
  option,
  draft,
  strings,
  onChange,
}: {
  group: MenuGroup;
  option: MenuOption;
  draft: Draft;
  strings: Strings;
  onChange: (draft: Draft) => void;
}) {
  const quantity = quantityOf(draft, group, option);
  const blocked = isBlocked(draft, group, option);
  const price = optionPriceLabel(group, option);
  const ingredient = group.modifierType === "INGR";
  const right: ReactNode = !option.available ? (
    <span className="ml-auto text-[24px] font-bold text-muted">{strings["item.unavailable"]}</span>
  ) : ingredient && quantity === 0 ? (
    <span className="ml-auto text-[24px] font-bold text-danger">{format(strings["item.without"], { name: option.name })}</span>
  ) : price ? (
    <span className="ml-auto text-[25.5px] text-muted">{price}</span>
  ) : null;

  if (option.maxChoices > 1 && option.available) {
    return (
      <li className="flex h-[114px] items-center justify-between gap-6 border-b border-line text-[30px] font-semibold last:border-0">
        <span>{option.name}</span>
        <span className="flex items-center gap-6">
          {price && <span className="text-[25.5px] text-muted">{price}</span>}
          <span className="flex items-center gap-3 rounded-full bg-ground p-2">
            <StepButton
              small
              label={strings["item.less"]}
              disabled={quantity === 0}
              onPress={() => onChange(setOptionQuantity(draft, group, option, quantity - 1))}
            >
              <Minus size={27} />
            </StepButton>
            <span className="w-12 text-center text-[30px] font-bold">{quantity}</span>
            <StepButton
              small
              label={strings["item.more"]}
              disabled={blocked || quantity >= option.maxChoices}
              onPress={() => onChange(setOptionQuantity(draft, group, option, quantity + 1))}
            >
              <Plus size={27} />
            </StepButton>
          </span>
        </span>
      </li>
    );
  }

  return (
    <li className="border-b border-line last:border-0">
      <button
        onClick={() => onChange(toggleOption(draft, group, option))}
        disabled={blocked && quantity === 0}
        aria-pressed={quantity > 0}
        className="flex h-[114px] w-full items-center gap-[27px] text-left text-[30px] font-semibold disabled:opacity-40"
      >
        <CheckBox on={quantity > 0} />
        <span className={ingredient && quantity === 0 ? "text-muted line-through" : ""}>{option.name}</span>
        {right}
      </button>
    </li>
  );
}

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className={`flex size-[54px] shrink-0 items-center justify-center rounded-[15px] ${
        on ? "bg-detail text-on-accent" : "border-[3px] border-[#c9c0b5] bg-surface"
      }`}
    >
      {on && <Check size={33} strokeWidth={3} />}
    </span>
  );
}

export function StepButton({
  label,
  disabled,
  small,
  onPress,
  children,
}: {
  label: string;
  disabled?: boolean;
  small?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={`flex items-center justify-center rounded-full bg-surface disabled:bg-transparent disabled:opacity-40 ${
        small ? "size-[66px]" : "size-[120px]"
      }`}
    >
      {children}
    </button>
  );
}
