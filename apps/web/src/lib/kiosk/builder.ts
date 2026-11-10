import type { BasketLine, Pick } from "./basket-v2";
import type { MenuGroup, MenuOption, Product } from "./menu-graph";

// The item builder's state (SPEC 5.3) as pure functions over the v2 groups:
// sizes, modifier groups, combo main and sides, nested groups under a picked
// option. `min`/`max` count picks across a group (`max: 0` = no limit);
// `minChoices`/`maxChoices` limit one option. Unavailable options cannot be
// picked. The draft becomes a basket line of ids only; Core prices it.

export type Draft = {
  quantity: number;
  /** group key → option id → quantity. */
  picks: Record<string, Record<string, number>>;
};

export const isSingleChoice = (group: MenuGroup) => group.max === 1;

export function groupCount(draft: Draft, group: MenuGroup): number {
  return Object.values(draft.picks[group.key] ?? {}).reduce((n, q) => n + q, 0);
}

export const quantityOf = (draft: Draft, group: MenuGroup, option: MenuOption) =>
  draft.picks[group.key]?.[option.id] ?? 0;

/** Default picks (`defaultQuantity`, e.g. INGR ingredients) of `groups`, nested ones included. */
function withDefaults(groups: MenuGroup[], picks: Draft["picks"]): void {
  for (const group of groups) {
    const chosen: Record<string, number> = {};
    for (const option of group.options) {
      if (option.available && option.defaultQuantity > 0) {
        chosen[option.id] = Math.min(option.defaultQuantity, option.maxChoices || Infinity);
      }
    }
    picks[group.key] = chosen;
    for (const option of group.options) if (chosen[option.id]) withDefaults(option.groups, picks);
  }
}

/** Drops the picks of `groups` and everything nested under them. */
function dropNested(groups: MenuGroup[], picks: Draft["picks"]): void {
  for (const group of groups) {
    delete picks[group.key];
    for (const option of group.options) dropNested(option.groups, picks);
  }
}

export function initialDraft(product: Product): Draft {
  const draft: Draft = { quantity: 1, picks: {} };
  withDefaults(product.groups, draft.picks);
  return draft;
}

/** Whether tapping `option` would be refused (unavailable, or its group is full). */
export function isBlocked(draft: Draft, group: MenuGroup, option: MenuOption): boolean {
  if (!option.available) return true;
  if (quantityOf(draft, group, option) > 0 || isSingleChoice(group)) return false;
  return group.max > 0 && groupCount(draft, group) >= group.max;
}

function withGroup(draft: Draft, group: MenuGroup, chosen: Record<string, number>): Draft {
  const picks = { ...draft.picks, [group.key]: chosen };
  for (const option of group.options) {
    const before = draft.picks[group.key]?.[option.id] ?? 0;
    if (chosen[option.id] && !before) withDefaults(option.groups, picks);
    if (!chosen[option.id] && before) dropNested(option.groups, picks);
  }
  return { ...draft, picks };
}

/** A tap on an option: single choice replaces, multi choice toggles up to the group's max. */
export function toggleOption(draft: Draft, group: MenuGroup, option: MenuOption): Draft {
  const current = draft.picks[group.key] ?? {};
  if (current[option.id]) {
    // A required single choice stays chosen; anything else can be cleared.
    if (isSingleChoice(group) && group.min > 0) return draft;
    const next = { ...current };
    delete next[option.id];
    return withGroup(draft, group, next);
  }
  if (isBlocked(draft, group, option)) return draft;
  return withGroup(draft, group, isSingleChoice(group) ? { [option.id]: 1 } : { ...current, [option.id]: 1 });
}

/** Stepper on an option with `maxChoices > 1`, capped by the option and by the group. */
export function setOptionQuantity(draft: Draft, group: MenuGroup, option: MenuOption, quantity: number): Draft {
  if (!option.available) return draft;
  const current = draft.picks[group.key] ?? {};
  const others = groupCount(draft, group) - (current[option.id] ?? 0);
  const room = group.max > 0 ? group.max - others : Infinity;
  const capped = Math.max(0, Math.min(quantity, option.maxChoices, room));
  const next = { ...current };
  if (capped === 0) delete next[option.id];
  else next[option.id] = capped;
  return withGroup(draft, group, next);
}

export function setQuantity(draft: Draft, quantity: number): Draft {
  return { ...draft, quantity: Math.max(1, quantity) };
}

function satisfied(draft: Draft, groups: MenuGroup[]): boolean {
  return groups.every((group) => {
    const count = groupCount(draft, group);
    if (count < group.min || (group.max > 0 && count > group.max)) return false;
    return group.options.every((option) => {
      const quantity = quantityOf(draft, group, option);
      if (quantity < option.minChoices) return false;
      return quantity === 0 || satisfied(draft, option.groups);
    });
  });
}

/** The add button is enabled once every required choice is made. */
export const canAdd = (product: Product, draft: Draft) => satisfied(draft, product.groups);

/** Picks of `groups` in display order, nested picks right after their option. */
function picksOf(draft: Draft, groups: MenuGroup[]): Pick[] {
  return groups.flatMap((group) =>
    group.options.flatMap((option) => {
      const quantity = quantityOf(draft, group, option);
      if (!quantity) return [];
      return [{ groupKey: group.key, optionId: option.id, quantity }, ...picksOf(draft, option.groups)];
    }),
  );
}

/** The basket line for this draft: ids and quantities only. */
export function draftToLine(product: Product, draft: Draft, guid: string): BasketLine {
  return { guid, productId: product.id, quantity: draft.quantity, picks: picksOf(draft, product.groups) };
}

/** Rebuilds a draft from a basket line, to edit it. */
export function lineToDraft(product: Product, line: BasketLine): Draft {
  const picks: Draft["picks"] = {};
  const fill = (groups: MenuGroup[]) => {
    for (const group of groups) {
      picks[group.key] = {};
      for (const option of group.options) {
        const pick = line.picks.find((p) => p.groupKey === group.key && p.optionId === option.id);
        if (pick) {
          picks[group.key][option.id] = pick.quantity;
          fill(option.groups);
        }
      }
    }
  };
  fill(product.groups);
  return { quantity: line.quantity, picks };
}

/**
 * The line after the guest takes a swap-sell offer: the target product, with
 * the picks of the groups both products share (e.g. the extras), and whether it
 * can go in as it is or the builder must ask for a missing choice.
 */
export function swapTo(target: Product, line: BasketLine): { line: BasketLine; ready: boolean } {
  const from = `${line.productId}/`;
  const moved: BasketLine = {
    guid: line.guid,
    productId: target.id,
    quantity: line.quantity,
    picks: line.picks
      .filter((p) => p.groupKey.startsWith(from))
      .map((p) => ({ ...p, groupKey: `${target.id}/${p.groupKey.slice(from.length)}` })),
  };
  const draft = lineToDraft(target, moved);
  return { line: draftToLine(target, draft, line.guid), ready: canAdd(target, draft) };
}
