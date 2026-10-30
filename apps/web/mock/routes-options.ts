// Back-office option groups: an item's choices, extras and removable
// ingredients (composite options). Nested groups hang off an option.

import { randomBytes } from "node:crypto";

import { notFound, ok, problem, type Route, type Schemas } from "./http.ts";
import { owner } from "./routes-admin.ts";
import { state } from "./state.ts";

const ROLES = new Set([
  "MODIFIERS",
  "REQUIRED-MODIFIER",
  "UPSELLS",
  "INGREDIENTS",
  "INGREDIENT_MODIFIERS",
  "SURCHARGE",
  "COMBO_MAIN",
]);

const optionId = () => `opt-${randomBytes(3).toString("hex")}`;
const invalid = (field: string) => problem(422, "VALIDATION_FAILED", "Validation failed", field);

function optionProblem(option: Partial<Schemas["AdminOption"]>, where: string): string | null {
  if (!option.name?.["pt-BR"]?.trim()) return `${where}.name`;
  if (!Number.isInteger(option.price) || option.price! < 0) return `${where}.price`;
  if (!Number.isInteger(option.maximumQuantity) || option.maximumQuantity! < 1) {
    return `${where}.maximumQuantity`;
  }
  if (!Number.isInteger(option.defaultQuantity) || option.defaultQuantity! < 0) {
    return `${where}.defaultQuantity`;
  }
  return null;
}

function groupProblem(input: Partial<Schemas["OptionGroupInput"]> | null): string | null {
  if (!input) return "body";
  const items = state.catalogue.items;
  const groups = state.catalogue.optionGroups;
  if (!input.itemId === !input.parentOptionId) return "itemId or parentOptionId";
  if (input.itemId && !items.some((i) => i.id === input.itemId)) return "itemId";
  if (
    input.parentOptionId &&
    !groups.some((g) => g.options.some((o) => o.id === input.parentOptionId))
  ) {
    return "parentOptionId";
  }
  if (!input.name?.["pt-BR"]?.trim()) return "name";
  if (!input.role || !ROLES.has(input.role)) return "role";
  const { minimum = -1, maximum = -1 } = input;
  if (!Number.isInteger(minimum) || minimum < 0) return "minimum";
  if (!Number.isInteger(maximum) || maximum < 0 || (maximum > 0 && maximum < minimum))
    return "maximum";
  if (!Array.isArray(input.options)) return "options";
  for (const [i, option] of input.options.entries()) {
    const bad = optionProblem(option, `options[${i}]`);
    if (bad) return bad;
  }
  for (const [i, composite] of (input.compositeOptions ?? []).entries()) {
    const bad =
      optionProblem(composite.positiveOption, `compositeOptions[${i}].positiveOption`) ??
      optionProblem(composite.negativeOption, `compositeOptions[${i}].negativeOption`);
    if (bad) return bad;
  }
  if (input.defaultOption && !input.options.some((o) => o.id === input.defaultOption)) {
    return "defaultOption";
  }
  return null;
}

/** Options get an id on create; existing ids are kept so order history stays linked. */
function withIds(input: Schemas["OptionGroupInput"], id: string): Schemas["AdminOptionGroup"] {
  const keep = (option: Schemas["AdminOption"]) => ({ ...option, id: option.id || optionId() });
  return {
    id,
    itemId: input.itemId ?? null,
    parentOptionId: input.parentOptionId ?? null,
    name: input.name,
    role: input.role,
    minimum: input.minimum,
    maximum: input.maximum,
    defaultOption: input.defaultOption ?? null,
    displayOrder: input.displayOrder,
    options: input.options.map(keep),
    compositeOptions: (input.compositeOptions ?? []).map((c) => ({
      positiveOption: keep(c.positiveOption),
      negativeOption: keep(c.negativeOption),
      defaultChoice: c.defaultChoice ?? null,
    })),
  };
}

export const optionRoutes: Route[] = [
  [
    "GET",
    /^\/v1\/admin\/option-groups$/,
    owner((req) => {
      const itemId = req.query.get("itemId");
      return ok(
        state.catalogue.optionGroups
          .filter((g) => !itemId || g.itemId === itemId)
          .sort((a, b) => a.displayOrder - b.displayOrder),
      );
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/option-groups$/,
    owner((req) => {
      const input = req.body as Schemas["OptionGroupInput"];
      const bad = groupProblem(input);
      if (bad) return invalid(bad);
      const group = withIds(input, `grp-${randomBytes(3).toString("hex")}`);
      state.catalogue.optionGroups.push(group);
      return ok(group, 201);
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/option-groups\/([^/]+)$/,
    owner((req, [groupId]) => {
      const index = state.catalogue.optionGroups.findIndex((g) => g.id === groupId);
      if (index === -1) return notFound();
      const input = req.body as Schemas["OptionGroupInput"];
      const bad = groupProblem(input);
      if (bad) return invalid(bad);
      const group = withIds(input, groupId);
      state.catalogue.optionGroups[index] = group;
      return ok(group);
    }),
  ],
  [
    "DELETE",
    /^\/v1\/admin\/option-groups\/([^/]+)$/,
    owner((_req, [groupId]) => {
      const group = state.catalogue.optionGroups.find((g) => g.id === groupId);
      if (!group) return notFound();
      const optionIds = new Set(group.options.map((o) => o.id));
      // Nested groups go with their parent option.
      state.catalogue.optionGroups = state.catalogue.optionGroups.filter(
        (g) => g.id !== groupId && !(g.parentOptionId && optionIds.has(g.parentOptionId)),
      );
      return { status: 204 };
    }),
  ],
];
