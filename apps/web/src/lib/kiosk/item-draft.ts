import type { BasketLine, LineOptionInput, MenuEntity, Option, OptionGroup } from "./menu-view";

// The item builder's state (F-MENU-07 to 10) as pure functions: what the guest
// picked in each option group, the composite toggles and the quantity. It
// becomes a basket line of ids only; the Core API prices it.

export type Choice = "POSITIVE" | "NEGATIVE";

export type ItemDraft = {
  quantity: number;
  /** groupId → optionId → quantity. Group ids are unique across the menu. */
  picks: Record<string, Record<string, number>>;
  /** Composite toggles by their positive option id. */
  toggles: Record<string, Choice>;
};

/** Groups shown in the builder; COMBO_MAIN has its own flow and is out of the MVP. */
const isShown = (group: OptionGroup) => group.role !== "COMBO_MAIN";

/** BR-MENU-14: one required option and nothing nested is applied silently, never shown. */
export function isInvisible(group: OptionGroup): boolean {
  return (
    group.minimum === 1 &&
    group.options.length === 1 &&
    group.compositeOptions.length === 0 &&
    group.options[0].optionGroups.length === 0
  );
}

/** BR-MENU-15: single choice when the group takes exactly one. */
export const isSingleChoice = (group: OptionGroup) => group.maximum === 1;

export function groupCount(draft: ItemDraft, group: OptionGroup): number {
  return Object.values(draft.picks[group.id] ?? {}).reduce((n, q) => n + q, 0);
}

export const quantityOf = (draft: ItemDraft, group: OptionGroup, option: Option) =>
  draft.picks[group.id]?.[option.id] ?? 0;

const defaultChoice = (composite: OptionGroup["compositeOptions"][number]): Choice =>
  composite.defaultChoice ?? "POSITIVE";

function defaultPicks(groups: OptionGroup[], picks: ItemDraft["picks"], toggles: ItemDraft["toggles"]) {
  for (const group of groups.filter(isShown)) {
    const chosen: Record<string, number> = {};
    for (const option of group.options) {
      if (option.defaultQuantity > 0) chosen[option.id] = option.defaultQuantity;
    }
    const preset = group.options.find((o) => o.id === group.defaultOption);
    // A default with required nested choices waits for the guest's tap (F-MENU-04).
    if (preset && !chosen[preset.id] && !preset.optionGroups.some((g) => g.minimum > 0)) {
      if (isSingleChoice(group)) for (const id of Object.keys(chosen)) delete chosen[id];
      chosen[preset.id] = 1;
    }
    if (isInvisible(group)) chosen[group.options[0].id] = 1;
    picks[group.id] = chosen;
    for (const option of group.options) {
      if (chosen[option.id]) defaultPicks(option.optionGroups, picks, toggles);
    }
    for (const composite of group.compositeOptions) {
      toggles[composite.positiveOption.id] = defaultChoice(composite);
    }
  }
}

export function initialDraft(item: MenuEntity): ItemDraft {
  const draft: ItemDraft = { quantity: 1, picks: {}, toggles: {} };
  defaultPicks(item.optionGroups ?? [], draft.picks, draft.toggles);
  return draft;
}

/** Whether tapping `option` would be blocked (group full, or a supersede is on). */
export function isBlocked(draft: ItemDraft, group: OptionGroup, option: Option): boolean {
  if (quantityOf(draft, group, option) > 0 || isSingleChoice(group)) return false;
  const picked = draft.picks[group.id] ?? {};
  const supersedeOn = group.options.some((o) => o.supersede && (picked[o.id] ?? 0) > 0);
  if (supersedeOn && !option.supersede) return true;
  return group.maximum > 0 && groupCount(draft, group) >= group.maximum;
}

function withGroup(draft: ItemDraft, group: OptionGroup, chosen: Record<string, number>): ItemDraft {
  const picks = { ...draft.picks, [group.id]: chosen };
  // Options that left the group drop their nested picks; new ones get their defaults.
  const toggles = { ...draft.toggles };
  for (const option of group.options) {
    if (chosen[option.id]) {
      if (!(draft.picks[group.id]?.[option.id] ?? 0)) defaultPicks(option.optionGroups, picks, toggles);
    } else {
      for (const nested of option.optionGroups) delete picks[nested.id];
    }
  }
  return { ...draft, picks, toggles };
}

/** Tap on an option (BR-MENU-12, 16): single choice replaces, multi toggles up to the cap. */
export function toggleOption(draft: ItemDraft, group: OptionGroup, option: Option): ItemDraft {
  const current = draft.picks[group.id] ?? {};
  if (isSingleChoice(group)) {
    // A required single choice stays chosen; an optional one can be cleared.
    if (current[option.id]) return group.minimum > 0 ? draft : withGroup(draft, group, {});
    return withGroup(draft, group, { [option.id]: 1 });
  }
  if (current[option.id]) {
    const next = { ...current };
    delete next[option.id];
    return withGroup(draft, group, next);
  }
  if (isBlocked(draft, group, option)) return draft;
  const base = option.supersede ? {} : current;
  return withGroup(draft, group, { ...base, [option.id]: 1 });
}

/** Stepper on an option with maximumQuantity > 1, capped by the option and the group. */
export function setOptionQuantity(
  draft: ItemDraft,
  group: OptionGroup,
  option: Option,
  quantity: number,
): ItemDraft {
  const current = draft.picks[group.id] ?? {};
  const others = groupCount(draft, group) - (current[option.id] ?? 0);
  const groupRoom = group.maximum > 0 ? group.maximum - others : Infinity;
  const capped = Math.max(0, Math.min(quantity, option.maximumQuantity, groupRoom));
  const next = { ...current };
  if (capped === 0) delete next[option.id];
  else next[option.id] = capped;
  return withGroup(draft, group, next);
}

export function setToggle(draft: ItemDraft, positiveOptionId: string, choice: Choice): ItemDraft {
  return { ...draft, toggles: { ...draft.toggles, [positiveOptionId]: choice } };
}

export function setQuantity(draft: ItemDraft, quantity: number): ItemDraft {
  return { ...draft, quantity: Math.max(1, quantity) };
}

/** Every shown group in `groups` and the nested groups of picked options meets its minimum. */
function satisfied(draft: ItemDraft, groups: OptionGroup[]): boolean {
  return groups.filter(isShown).every((group) => {
    if (group.options.length > 0 && groupCount(draft, group) < group.minimum) return false;
    return group.options.every((o) => !quantityOf(draft, group, o) || satisfied(draft, o.optionGroups));
  });
}

/** BR-MENU-13: the add button is enabled once every required choice is made. */
export const canAdd = (item: MenuEntity, draft: ItemDraft) => satisfied(draft, item.optionGroups ?? []);

function lineOptions(draft: ItemDraft, groups: OptionGroup[]): LineOptionInput[] {
  return groups.filter(isShown).flatMap((group) => [
    ...group.options.flatMap((option) => {
      const quantity = quantityOf(draft, group, option);
      if (!quantity) return [];
      const nested = lineOptions(draft, option.optionGroups);
      return [{ optionId: option.id, quantity, ...(nested.length ? { options: nested } : {}) }];
    }),
    // A composite is sent only when the guest changed it from its default.
    ...group.compositeOptions.flatMap((composite) => {
      const choice = draft.toggles[composite.positiveOption.id] ?? defaultChoice(composite);
      if (choice === defaultChoice(composite)) return [];
      const option = choice === "POSITIVE" ? composite.positiveOption : composite.negativeOption;
      return [{ optionId: option.id, quantity: 1 }];
    }),
  ]);
}

/** The basket line for this draft: ids and quantities only. */
export function draftToLine(item: MenuEntity, draft: ItemDraft, guid: string): BasketLine {
  return { guid, itemId: item.id, quantity: draft.quantity, options: lineOptions(draft, item.optionGroups ?? []) };
}

/** Rebuilds a draft from a basket line, to edit it (F-BASKET-01). */
export function lineToDraft(item: MenuEntity, line: BasketLine): ItemDraft {
  const draft: ItemDraft = { quantity: line.quantity, picks: {}, toggles: {} };
  const fill = (groups: OptionGroup[], inputs: LineOptionInput[]) => {
    for (const group of groups.filter(isShown)) {
      draft.picks[group.id] = {};
      for (const option of group.options) {
        const input = inputs.find((i) => i.optionId === option.id);
        if (input) {
          draft.picks[group.id][option.id] = input.quantity;
          fill(option.optionGroups, input.options ?? []);
        }
      }
      for (const composite of group.compositeOptions) {
        const positive = inputs.some((i) => i.optionId === composite.positiveOption.id);
        const negative = inputs.some((i) => i.optionId === composite.negativeOption.id);
        draft.toggles[composite.positiveOption.id] = negative
          ? "NEGATIVE"
          : positive
            ? "POSITIVE"
            : defaultChoice(composite);
      }
    }
  };
  fill(item.optionGroups ?? [], line.options);
  return draft;
}
