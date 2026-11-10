import type { components } from "@/lib/core-api";

/** One entry of a `422 MENU_INVALID` problem (contract: MenuInvalid). */
export type MenuProblem = NonNullable<components["schemas"]["Problem"]["errors"]>[number];
type EntityType = components["schemas"]["PosEntityType"];

/** Looks up an entity's pt-BR name; undefined when unknown (the id is shown instead). */
export type NameOf = (type: string, id: string) => string | undefined;

const KIND: Partial<Record<EntityType, string>> = {
  CATEGORY: "Categoria",
  ITEM: "Item",
  SIZED_ITEM: "Item com tamanhos",
  COMBO_MEAL: "Combo",
  MODIFIERS: "Grupo",
  COMBO_MAIN: "Grupo",
  COMBO_SIDE: "Grupo",
  SWAP_SELL: "Oferta de troca",
  IMAGE: "Foto",
};

/**
 * "liga a “Adicionais”, que não existe mais." when the message starts with the
 * missing target (`MODIFIERS M-EXTRAS does not exist`, as the contract example
 * does) and its name is known; otherwise the message as Go sent it.
 */
function missing(problem: MenuProblem, nameOf: NameOf): string {
  const target = /^([A-Z_]+) (\S+)/.exec(problem.message);
  const name = target && nameOf(target[1], target[2]);
  return name ? `liga a “${name}”, que não existe mais.` : `liga a algo que não existe mais (${problem.message}).`;
}

const WHY: Record<NonNullable<MenuProblem["rule"]>, (problem: MenuProblem, nameOf: NameOf) => string> = {
  MISSING_LINK: missing,
  EMPTY_GROUP: () => "precisa de pelo menos uma opção.",
  EMPTY_SWAP_SELL: () => "precisa de pelo menos um produto.",
  LOOP: () => "volta para ela mesma (um dentro do outro em círculo).",
  INVALID_ID: () => "código inválido (não pode ter “:”).",
  DUPLICATE_PRODUCT_ID: () => "outro produto já usa esse código.",
  COMBO_INCOMPLETE: () => "precisa de um prato principal e pelo menos um acompanhamento.",
  LINK_NOT_ALLOWED: () => "essa ligação não é permitida.",
  ID_MISMATCH: () => "o código não confere. Recarregue a página.",
};

/**
 * The owner-facing lines for a MENU_INVALID answer: which entity, by name,
 * and what to fix (Review Focus 3). `LOOP` reads in the feminine for a
 * section; other kinds reuse the same short sentences.
 */
export function describeMenuErrors(errors: MenuProblem[], nameOf: NameOf): string[] {
  return errors.map((problem) => {
    if (!problem.rule || !problem.entity) return `${problem.field}: ${problem.message}`;
    const { type, id } = problem.entity;
    const kind = KIND[type] ?? type;
    const name = (problem.rule === "INVALID_ID" ? undefined : nameOf(type, id)) ?? id;
    return `${kind} “${name}”: ${WHY[problem.rule](problem, nameOf)}`;
  });
}
