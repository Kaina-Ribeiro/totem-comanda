import Image from "next/image";
import { useState } from "react";

import { formatBRL } from "@/lib/format/money";
import {
  canAdd,
  type Choice,
  draftToLine,
  groupCount,
  initialDraft,
  isBlocked,
  isInvisible,
  isSingleChoice,
  type ItemDraft,
  lineToDraft,
  quantityOf,
  setOptionQuantity,
  setQuantity,
  setToggle,
  toggleOption,
} from "@/lib/kiosk/item-draft";
import {
  badgesFor,
  type BasketLine,
  itemPrice,
  type Menu,
  type MenuEntity,
  type OptionGroup,
  optionPrice,
  type OrderType,
  unitPrice,
} from "@/lib/kiosk/menu-view";
import { format, type Strings } from "@/lib/kiosk/strings";

import { Check, ChevronLeft, Minus, Plus } from "../icons";

/**
 * Prototype 04-Item at 1080x1920: required choices as chips, extras as a
 * checklist up to the group's maximum, ingredients to take out, quantity, and
 * the add button with the live display total. The total the guest pays comes
 * from the Core API's quote in the basket.
 */
export function ItemScreen({
  menu,
  item,
  editing,
  orderType,
  strings,
  backLabel,
  onBack,
  onSave,
}: {
  menu: Menu;
  item: MenuEntity;
  editing: BasketLine | null;
  orderType: OrderType;
  strings: Strings;
  backLabel: string;
  onBack: () => void;
  onSave: (line: BasketLine) => void;
}) {
  const [draft, setDraft] = useState<ItemDraft>(() =>
    editing ? lineToDraft(item, editing) : initialDraft(item),
  );
  const line = draftToLine(item, draft, editing?.guid ?? "");
  const total = unitPrice(item, line.options, orderType) * draft.quantity;
  const ready = canAdd(item, draft);
  const badges = badgesFor(menu, { id: item.id }, "ITEM_PAGE");
  const groups = (item.optionGroups ?? []).filter(
    (g) => g.role !== "COMBO_MAIN" && !isInvisible(g),
  );

  return (
    <div className="flex h-full flex-col bg-surface text-ink">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative h-[570px] bg-wheat">
          {item.image && (
            <Image src={item.image} alt="" fill sizes="1080px" priority className="object-cover" />
          )}
          <button
            onClick={onBack}
            className="absolute top-[42px] left-12 flex h-[84px] items-center gap-3 rounded-full bg-surface pr-[33px] pl-[21px] text-[28.5px] font-bold"
          >
            <ChevronLeft size={36} />
            {backLabel}
          </button>
          {badges.length > 0 && (
            <div className="absolute bottom-9 left-[66px] flex gap-3">
              {badges.map((badge) => (
                <span
                  key={badge.id}
                  className="rounded-[18px] px-[21px] py-[10px] text-[24px] font-bold"
                  style={{ color: badge.textColour, backgroundColor: badge.backgroundColour }}
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-[54px] px-[66px] pt-[54px] pb-12">
          <div className="flex flex-col gap-6">
            <div className="flex items-baseline justify-between gap-8">
              <h1 className="font-display text-[72px] leading-[1.05] font-semibold tracking-[-0.02em]">
                {item.name}
              </h1>
              <span className="shrink-0 text-[39px] font-bold text-price">
                {formatBRL(itemPrice(item, orderType))}
              </span>
            </div>
            {item.description && (
              <p className="text-[30px] leading-[1.45] text-muted">{item.description}</p>
            )}
          </div>

          {groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              draft={draft}
              orderType={orderType}
              strings={strings}
              onChange={setDraft}
            />
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
          <span className="w-[72px] text-center font-display text-[54px] font-semibold">
            {draft.quantity}
          </span>
          <StepButton
            label={strings["item.more"]}
            onPress={() => setDraft(setQuantity(draft, draft.quantity + 1))}
          >
            <Plus size={36} />
          </StepButton>
        </div>
        <button
          onClick={() => onSave(draftToLine(item, draft, editing?.guid ?? crypto.randomUUID()))}
          disabled={!ready}
          className="flex h-button flex-1 items-center justify-between rounded-full bg-accent px-[54px] text-on-accent transition-opacity disabled:opacity-50"
        >
          <span className="text-[36px] font-bold">
            {editing ? strings["item.update"] : strings["item.add"]}
          </span>
          <span className="font-display text-[51px] font-semibold tracking-[-0.02em]">
            {formatBRL(total)}
          </span>
        </button>
      </div>
    </div>
  );
}

function GroupSection({
  group,
  draft,
  orderType,
  strings,
  onChange,
}: {
  group: OptionGroup;
  draft: ItemDraft;
  orderType: OrderType;
  strings: Strings;
  onChange: (draft: ItemDraft) => void;
}) {
  const single = isSingleChoice(group) && group.minimum === 1;
  const hint =
    group.options.length === 0
      ? null
      : single
        ? strings["item.chooseOne"]
        : group.maximum > 1
          ? format(strings["item.count"], { count: groupCount(draft, group), max: group.maximum })
          : group.minimum > 0
            ? format(strings["item.chooseN"], { n: group.minimum })
            : strings["item.optional"];

  return (
    <section className="flex flex-col gap-[27px]">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[45px] font-semibold">{group.name}</h2>
        {hint && (
          <span className={`text-[24px] font-bold ${single ? "text-detail-text" : "text-muted"}`}>
            {hint}
          </span>
        )}
      </div>

      {single ? (
        <div className="grid grid-cols-3 gap-[18px]">
          {group.options.map((option) => {
            const on = quantityOf(draft, group, option) > 0;
            const price = optionPrice(option, orderType);
            return (
              <button
                key={option.id}
                onClick={() => onChange(toggleOption(draft, group, option))}
                aria-pressed={on}
                className={`flex min-h-[114px] flex-col items-center justify-center rounded-[24px] px-4 text-[27px] font-bold ${
                  on ? "bg-accent text-on-accent" : "bg-wheat text-ink"
                }`}
              >
                {option.name}
                {price > 0 && (
                  <span className="text-[22px] font-semibold opacity-80">+ {formatBRL(price)}</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <ul className="flex flex-col">
          {group.options.map((option) => (
            <OptionRow
              key={option.id}
              group={group}
              option={option}
              draft={draft}
              orderType={orderType}
              strings={strings}
              onChange={onChange}
            />
          ))}
        </ul>
      )}

      {group.compositeOptions.length > 0 && (
        <ul className="flex flex-col">
          {group.compositeOptions.map((composite) => {
            const choice: Choice =
              draft.toggles[composite.positiveOption.id] ?? composite.defaultChoice ?? "POSITIVE";
            const kept = choice === "POSITIVE";
            return (
              <li key={composite.positiveOption.id} className="border-b border-line last:border-0">
                <button
                  onClick={() =>
                    onChange(
                      setToggle(draft, composite.positiveOption.id, kept ? "NEGATIVE" : "POSITIVE"),
                    )
                  }
                  aria-pressed={kept}
                  className="flex h-[114px] w-full items-center gap-[27px] text-left text-[30px] font-semibold"
                >
                  <CheckBox on={kept} />
                  <span className={kept ? "" : "text-muted line-through"}>
                    {composite.positiveOption.name}
                  </span>
                  {!kept && (
                    <span className="ml-auto text-[24px] font-bold text-danger">
                      {composite.negativeOption.name}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Nested groups of picked options (BR-MENU-17), shown inline under their group. */}
      {group.options
        .filter((option) => quantityOf(draft, group, option) > 0 && option.optionGroups.length > 0)
        .flatMap((option) => option.optionGroups)
        .filter((nested) => !isInvisible(nested))
        .map((nested) => (
          <div key={nested.id} className="border-l-[6px] border-wheat pl-9">
            <GroupSection
              group={nested}
              draft={draft}
              orderType={orderType}
              strings={strings}
              onChange={onChange}
            />
          </div>
        ))}
    </section>
  );
}

function OptionRow({
  group,
  option,
  draft,
  orderType,
  strings,
  onChange,
}: {
  group: OptionGroup;
  option: OptionGroup["options"][number];
  draft: ItemDraft;
  orderType: OrderType;
  strings: Strings;
  onChange: (draft: ItemDraft) => void;
}) {
  const quantity = quantityOf(draft, group, option);
  const blocked = isBlocked(draft, group, option);
  const price = optionPrice(option, orderType);
  const priceLabel = price > 0 ? `+ ${formatBRL(price)}` : null;

  if (option.maximumQuantity > 1) {
    return (
      <li className="flex h-[114px] items-center justify-between gap-6 border-b border-line text-[30px] font-semibold last:border-0">
        <span>{option.name}</span>
        <span className="flex items-center gap-6">
          {priceLabel && <span className="text-[25.5px] text-muted">{priceLabel}</span>}
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
              disabled={blocked || quantity >= option.maximumQuantity}
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
        disabled={blocked}
        aria-pressed={quantity > 0}
        className="flex h-[114px] w-full items-center gap-[27px] text-left text-[30px] font-semibold disabled:opacity-40"
      >
        <CheckBox on={quantity > 0} />
        <span>{option.name}</span>
        {priceLabel && <span className="ml-auto text-[25.5px] text-muted">{priceLabel}</span>}
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

function StepButton({
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
  children: React.ReactNode;
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
