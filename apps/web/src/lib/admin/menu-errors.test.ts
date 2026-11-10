import { describe, expect, it } from "vitest";

import { describeMenuErrors, type MenuProblem } from "./menu-errors";

const NAMES: Record<string, string> = {
  "MODIFIERS:M-SAUCE": "Escolha o molho",
  "MODIFIERS:M-EXTRAS": "Adicionais",
  "SWAP_SELL:SS-1": "Turbine seu hambúrguer",
  "COMBO_MEAL:3001": "Combo hambúrguer",
  "CATEGORY:100": "Hambúrgueres",
  "ITEM:1001": "Hambúrguer clássico",
};
const nameOf = (type: string, id: string) => NAMES[`${type}:${id}`];

const problem = (rule: MenuProblem["rule"], type: string, id: string, field = "links", message = "x"): MenuProblem => ({
  field,
  message,
  rule,
  entity: { type: type as MenuProblem["entity"]["type"], id },
});

describe("describeMenuErrors (MENU_INVALID, Review Focus 3)", () => {
  it("says which group has no option, by name", () => {
    expect(describeMenuErrors([problem("EMPTY_GROUP", "MODIFIERS", "M-SAUCE")], nameOf)).toEqual([
      "Grupo “Escolha o molho”: precisa de pelo menos uma opção.",
    ]);
  });

  it("names the missing target of a broken link from the message", () => {
    expect(
      describeMenuErrors(
        [problem("MISSING_LINK", "MODIFIERS", "M-EXTRAS", "links[3]", "ITEM X-NOPE does not exist")],
        nameOf,
      ),
    ).toEqual(["Grupo “Adicionais”: liga a algo que não existe mais (ITEM X-NOPE does not exist)."]);
  });

  it("explains every rule", () => {
    const lines = describeMenuErrors(
      [
        problem("EMPTY_SWAP_SELL", "SWAP_SELL", "SS-1"),
        problem("LOOP", "CATEGORY", "100"),
        problem("COMBO_INCOMPLETE", "COMBO_MEAL", "3001"),
        problem("INVALID_ID", "ITEM", "a::b", "id"),
        problem("LINK_NOT_ALLOWED", "ITEM", "1001"),
        problem("DUPLICATE_PRODUCT_ID", "ITEM", "1001", "id"),
        problem("ID_MISMATCH", "ITEM", "1001", "id"),
      ],
      nameOf,
    );
    expect(lines).toEqual([
      "Oferta de troca “Turbine seu hambúrguer”: precisa de pelo menos um produto.",
      "Categoria “Hambúrgueres”: volta para ela mesma (um dentro do outro em círculo).",
      "Combo “Combo hambúrguer”: precisa de um prato principal e pelo menos um acompanhamento.",
      "Item “a::b”: código inválido (não pode ter “:”).",
      "Item “Hambúrguer clássico”: essa ligação não é permitida.",
      "Item “Hambúrguer clássico”: outro produto já usa esse código.",
      "Item “Hambúrguer clássico”: o código não confere. Recarregue a página.",
    ]);
  });

  it("falls back to the id when the entity has no known name", () => {
    expect(describeMenuErrors([problem("EMPTY_GROUP", "COMBO_SIDE", "S-9")], nameOf)).toEqual([
      "Grupo “S-9”: precisa de pelo menos uma opção.",
    ]);
  });

  it("keeps an entry without a rule readable", () => {
    expect(describeMenuErrors([{ field: "root[0]", message: "bad root" } as MenuProblem], nameOf)).toEqual([
      "root[0]: bad root",
    ]);
  });
});
