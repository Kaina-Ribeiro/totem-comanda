/**
 * The kiosk's bundled UI strings, pt-BR first. The owner's overrides from the
 * language pack (OP-START-02) are merged over these; any failure to load them
 * falls back to the bundle.
 */
const ptBR = {
  "attract.brandTagline": "Pães, doces e café",
  "attract.title": "Fornada fresca,\nsem fila.",
  "attract.body": "Escolha seus pães, doces e café aqui e retire no balcão.",
  "attract.cta": "Toque para começar",
  "language.button": "English",
  "language.title": "Escolha o idioma",
  "language.close": "Fechar",
  "starting": "Preparando o cardápio…",
  "startFailed.title": "Não deu para abrir o cardápio",
  "startFailed.body": "Tente de novo em instantes ou faça seu pedido no balcão.",
  "startOver": "Começar de novo",
  "nav.home": "Início",
  "nav.menu": "Cardápio",
  "orderType.title": "Onde você vai comer?",
  "orderType.DINEIN": "Comer aqui",
  "orderType.DINEIN.body": "Fique no salão e retire no balcão",
  "orderType.TAKE_OUT": "Para viagem",
  "orderType.TAKE_OUT.body": "Embalamos tudo para você levar",
  "menu.change": "Trocar",
  "menu.options": "{n} opções",
  "menu.option": "1 opção",
  "menu.add": "Adicionar {name}",
  "menu.cancel": "Cancelar pedido",
  "menu.empty": "Nada nesta categoria agora.",
  "basketBar.items": "{n} itens",
  "basketBar.item": "1 item",
  "basketBar.cta": "Ver meu pedido",
  "basketBar.empty": "Seu pedido está vazio",
  "item.chooseOne": "Escolha um",
  "item.chooseN": "Escolha {n}",
  "item.count": "{count} de {max}",
  "item.optional": "Opcional",
  "item.add": "Adicionar",
  "item.update": "Atualizar",
  "item.less": "Menos",
  "item.more": "Mais",
  "item.remove": "Tirar",
} as const;

export type StringKey = keyof typeof ptBR;
export type Strings = Record<StringKey, string>;

const en: Strings = {
  "attract.brandTagline": "Bread, pastries and coffee",
  "attract.title": "Fresh from the oven,\nno queue.",
  "attract.body": "Pick your bread, pastries and coffee here and collect at the counter.",
  "attract.cta": "Tap to start",
  "language.button": "Português",
  "language.title": "Choose your language",
  "language.close": "Close",
  "starting": "Getting the menu ready…",
  "startFailed.title": "We couldn't open the menu",
  "startFailed.body": "Try again in a moment or order at the counter.",
  "startOver": "Start over",
  "nav.home": "Start",
  "nav.menu": "Menu",
  "orderType.title": "Where will you eat?",
  "orderType.DINEIN": "Eat here",
  "orderType.DINEIN.body": "Stay in and collect at the counter",
  "orderType.TAKE_OUT": "Take away",
  "orderType.TAKE_OUT.body": "We'll pack it all for you",
  "menu.change": "Change",
  "menu.options": "{n} items",
  "menu.option": "1 item",
  "menu.add": "Add {name}",
  "menu.cancel": "Cancel order",
  "menu.empty": "Nothing in this category right now.",
  "basketBar.items": "{n} items",
  "basketBar.item": "1 item",
  "basketBar.cta": "View my order",
  "basketBar.empty": "Your order is empty",
  "item.chooseOne": "Choose one",
  "item.chooseN": "Choose {n}",
  "item.count": "{count} of {max}",
  "item.optional": "Optional",
  "item.add": "Add",
  "item.update": "Update",
  "item.less": "Less",
  "item.more": "More",
  "item.remove": "Remove",
};

export type Language = "pt-BR" | "en";

export const BUNDLED: Record<Language, Strings> = { "pt-BR": ptBR, en };

/** The bundle with the owner's overrides on top; unknown keys are ignored. */
export function mergeStrings(language: Language, overrides: Record<string, string> | undefined): Strings {
  const merged: Strings = { ...BUNDLED[language] };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (key in merged && typeof value === "string" && value !== "") merged[key as StringKey] = value;
  }
  return merged;
}

/** Fills `{name}` placeholders. */
export function format(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
