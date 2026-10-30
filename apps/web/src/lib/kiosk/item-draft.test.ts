import { describe, expect, it } from "vitest";

import { seedCatalogue } from "../../../mock/catalogue";
import { resolveMenu } from "../../../mock/kiosk-menu";
import {
  canAdd,
  draftToLine,
  initialDraft,
  isBlocked,
  lineToDraft,
  setOptionQuantity,
  setQuantity,
  setToggle,
  toggleOption,
} from "./item-draft";
import { findItem, type OptionGroup, unitPrice } from "./menu-view";

const menu = resolveMenu(
  { id: "mnu-manha", name: { "pt-BR": "Manhã" }, showCategoriesPrice: false },
  seedCatalogue(),
  "pt-BR",
  "2026-10-30",
);
const croque = findItem(menu, "itm-croque-monsieur")!;
const group = (id: string) => croque.optionGroups!.find((g) => g.id === id)!;
const option = (g: OptionGroup, id: string) => g.options.find((o) => o.id === id)!;
const bread = group("grp-pao");
const extras = group("grp-adicionais");

describe("item draft", () => {
  it("starts with the defaults and is ready to add", () => {
    const draft = initialDraft(croque);
    expect(draft.picks["grp-pao"]).toEqual({ "opt-pao-brioche": 1 });
    expect(canAdd(croque, draft)).toBe(true);
    expect(draftToLine(croque, draft, "g").options).toEqual([{ optionId: "opt-pao-brioche", quantity: 1 }]);
  });

  it("builds the prototype's croque at R$ 40,90", () => {
    const draft = toggleOption(initialDraft(croque), extras, option(extras, "opt-ovo-poche"));
    const line = draftToLine(croque, draft, "g");
    expect(line.options).toEqual([
      { optionId: "opt-pao-brioche", quantity: 1 },
      { optionId: "opt-ovo-poche", quantity: 1 },
    ]);
    expect(unitPrice(croque, line.options, "TAKE_OUT")).toBe(4090);
  });

  it("replaces a single choice and keeps a required one chosen", () => {
    let draft = toggleOption(initialDraft(croque), bread, option(bread, "opt-pao-ciabatta"));
    expect(draft.picks["grp-pao"]).toEqual({ "opt-pao-ciabatta": 1 });
    draft = toggleOption(draft, bread, option(bread, "opt-pao-ciabatta"));
    expect(draft.picks["grp-pao"]).toEqual({ "opt-pao-ciabatta": 1 });
  });

  it("blocks extras past the group maximum", () => {
    let draft = initialDraft(croque);
    for (const id of ["opt-ovo-poche", "opt-presunto-parma", "opt-gruyere-extra"]) {
      draft = toggleOption(draft, extras, option(extras, id));
    }
    const dijon = option(extras, "opt-mostarda-dijon");
    expect(isBlocked(draft, extras, dijon)).toBe(true);
    expect(toggleOption(draft, extras, dijon)).toBe(draft);
  });

  it("sends a removed ingredient only when it differs from the default", () => {
    const draft = setToggle(initialDraft(croque), "opt-com-bechamel", "NEGATIVE");
    expect(draftToLine(croque, draft, "g").options).toContainEqual({ optionId: "opt-sem-bechamel", quantity: 1 });
  });

  it("caps option steppers and the item quantity", () => {
    const cheese = findItem(menu, "itm-pao-de-queijo")!;
    const side = cheese.optionGroups![0];
    const draft = setOptionQuantity(initialDraft(cheese), side, side.options[0], 5);
    expect(draft.picks[side.id]).toEqual({ "opt-requeijao": 2 });
    expect(setQuantity(draft, 0).quantity).toBe(1);
  });

  it("round-trips a basket line for editing", () => {
    let draft = toggleOption(initialDraft(croque), extras, option(extras, "opt-ovo-poche"));
    draft = setToggle(setQuantity(draft, 2), "opt-com-presunto", "NEGATIVE");
    const line = draftToLine(croque, draft, "g");
    expect(draftToLine(croque, lineToDraft(croque, line), "g")).toEqual(line);
  });
});
