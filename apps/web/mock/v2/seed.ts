// The v2 mock's starting data: the complete menu of MODELS.md 5.20 without tax,
// named in pt-BR with the original English in `translations.en`, two scheduled
// menus over that catalogue (06:00–11:00 and 11:00–20:00), store settings, a
// badge and three coupons. Abigail Coffee's menu (seed-abigail.ts, with photos)
// comes first in both menus so the kiosk demo shows real food; MOCK_MENU=reference
// leaves it out.

import type { Entity, S } from "./http.ts";
import { ABIGAIL_CATEGORY_IDS, abigailEntities } from "./seed-abigail.ts";

type Hours = S["PosEntitySectionHours"];
type Day = Hours["dayOfWeek"];

const DAYS: Day[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
export const daily = (open: string, close: string): Hours[] =>
  DAYS.map((dayOfWeek) => ({ dayOfWeek, open, close }));

const link = (type: S["PosEntityType"], id: string): S["Link"] => ({ type, id });
const en = (name: string, description?: string): S["Translations"] => ({
  en: description ? { name, description } : { name },
});

function item(
  id: string,
  name: string,
  english: string,
  price: number,
  extra: Partial<S["PosEntityItem"]> = {},
): S["PosEntityItem"] {
  return { id, name, type: "ITEM", price, available: true, plu: id, links: [], translations: en(english), ...extra };
}

function group(
  id: string,
  type: S["PosEntityModifier"]["type"],
  name: string,
  english: string,
  min: number,
  max: number,
  options: string[],
  extra: Partial<S["PosEntityModifier"]> = {},
): S["PosEntityModifier"] {
  return {
    id,
    name,
    type,
    min,
    max,
    modifierType: "MODI",
    links: options.map((o) => link("ITEM", o)),
    translations: en(english),
    ...extra,
  };
}

function image(id: string, name: string, file: string, altText?: string): S["PosEntityImage"] {
  return { id, name, type: "IMAGE", url: `/media/${file}`, altText: altText ?? null, links: [] };
}

export function seedEntities(): Entity[] {
  return [
    {
      id: "100",
      name: "Hambúrgueres",
      type: "CATEGORY",
      description: "Hambúrgueres na brasa no pão brioche",
      available: true,
      availableHours: [
        ...DAYS.slice(0, 4).map((dayOfWeek) => ({ dayOfWeek, open: "11:00:00", close: "22:00:00" })),
        { dayOfWeek: "FRIDAY", open: "11:00:00", close: "23:00:00" },
        { dayOfWeek: "SATURDAY", open: "12:00:00", close: "23:00:00" },
        { dayOfWeek: "SUNDAY", open: "12:00:00", close: "21:00:00" },
      ],
      links: [link("IMAGE", "100"), link("CATEGORY", "110"), link("ITEM", "1001")],
      translations: en("Burgers", "Flame-grilled burgers served in a brioche bun"),
    },
    {
      id: "110",
      name: "Vegetarianos",
      type: "CATEGORY",
      available: true,
      links: [link("ITEM", "1002")],
      translations: en("Veggie"),
    },
    {
      id: "200",
      name: "Bebidas",
      type: "CATEGORY",
      available: true,
      links: [link("SIZED_ITEM", "2001"), link("ITEM", "2010")],
      translations: en("Drinks"),
    },
    {
      id: "300",
      name: "Combos",
      type: "CATEGORY",
      available: true,
      links: [link("COMBO_MEAL", "3001")],
      translations: en("Meal deals"),
    },
    item("1001", "Hambúrguer clássico", "Classic Burger", 9.5, {
      deliveryPriceOverride: 10.5,
      description: "Carne bovina, alface, tomate e molho da casa",
      internalName: "CLASSICO",
      calories: "650",
      allergens: ["GLUTEN", "MILK", "SESAME"],
      allergensDeclared: true,
      badgeIds: ["NOVO"],
      crossSellIds: ["2001"],
      links: [
        link("MODIFIERS", "M-ING-1001"),
        link("MODIFIERS", "M-EXTRAS"),
        link("IMAGE", "1001"),
        link("SWAP_SELL", "SS-1001"),
      ],
      translations: en("Classic Burger", "Beef patty, lettuce, tomato and house sauce"),
    }),
    item("1002", "Hambúrguer vegetariano", "Veggie Burger", 8.95, {
      description: "Hambúrguer de plantas com abacate",
      calories: "520",
      allergens: ["GLUTEN", "SOYA", "VEGAN"],
      allergensDeclared: true,
      links: [link("MODIFIERS", "M-EXTRAS")],
      translations: en("Veggie Burger", "Plant-based patty with avocado"),
    }),
    item("1003", "Hambúrguer duplo", "Double Burger", 11.5, {
      description: "Duas carnes, queijo em dobro",
      calories: "980",
      allergens: ["GLUTEN", "MILK", "SESAME"],
      allergensDeclared: true,
      links: [link("MODIFIERS", "M-EXTRAS")],
      translations: en("Double Burger", "Two beef patties, double cheese"),
    }),
    {
      ...item("2001", "Refrigerante de cola", "Cola", 0, {
        description: "Cola bem gelada",
        allergens: ["SOFT", "SUGARED"],
        allergensDeclared: true,
        links: [link("ITEM", "2001-S"), link("ITEM", "2001-L"), link("IMAGE", "2001")],
        translations: en("Cola", "Ice-cold cola"),
      }),
      type: "SIZED_ITEM",
    },
    item("2001-S", "Pequeno", "Small", 2.5),
    item("2001-L", "Grande", "Large", 3.2),
    item("2010", "Chope (pint)", "Lager (pint)", 5.2, {
      alcoholic: true,
      ageRestriction: 18,
      allergens: ["BARLEY"],
      allergensDeclared: true,
    }),
    {
      ...item("3001", "Combo hambúrguer", "Burger Meal", 12.95, {
        description: "Qualquer hambúrguer com acompanhamento e bebida",
        links: [
          link("COMBO_MAIN", "3001-MAIN"),
          link("COMBO_SIDE", "3001-SIDE-1"),
          link("COMBO_SIDE", "3001-SIDE-2"),
          link("IMAGE", "3001"),
        ],
        translations: en("Burger Meal", "Any burger with a side and a drink"),
      }),
      type: "COMBO_MEAL",
      comboMealId: 7,
    },
    group("M-ING-1001", "MODIFIERS", "Ingredientes", "Ingredients", 0, 2, ["I-LETTUCE", "I-TOMATO"], {
      modifierType: "INGR",
    }),
    group("M-EXTRAS", "MODIFIERS", "Adicionais", "Add extras", 0, 3, ["X-CHEESE", "X-BACON", "X-SAUCE"], {
      included: 1,
    }),
    group("M-SAUCE", "MODIFIERS", "Escolha o molho", "Choose a sauce", 1, 1, ["S-BBQ", "S-MAYO"]),
    group("3001-MAIN", "COMBO_MAIN", "Escolha o hambúrguer", "Choose your burger", 1, 1, ["C-1001", "C-1002"]),
    group("3001-SIDE-1", "COMBO_SIDE", "Escolha o acompanhamento", "Choose your side", 1, 1, ["C-FRIES", "C-SALAD"]),
    group("3001-SIDE-2", "COMBO_SIDE", "Escolha a bebida", "Choose your drink", 1, 1, ["C-COLA", "C-WATER"]),
    item("I-LETTUCE", "Alface", "Lettuce", 0, { defaultQuantity: 1, minChoices: 0, maxChoices: 1 }),
    item("I-TOMATO", "Tomate", "Tomato", 0, { defaultQuantity: 1, minChoices: 0, maxChoices: 1 }),
    item("X-CHEESE", "Queijo extra", "Extra cheese", 1, { allergens: ["MILK"], minChoices: 0, maxChoices: 2 }),
    item("X-BACON", "Bacon", "Bacon", 1.5, { available: false, allergens: ["PORK"], maxChoices: 1 }),
    item("X-SAUCE", "Adicionar molho", "Add a sauce", 0, { links: [link("MODIFIERS", "M-SAUCE")] }),
    item("S-BBQ", "Molho barbecue", "BBQ sauce", 0),
    item("S-MAYO", "Maionese", "Mayonnaise", 0, { allergens: ["EGGS"] }),
    item("C-1001", "Hambúrguer clássico", "Classic Burger", 0),
    item("C-1002", "Hambúrguer vegetariano", "Veggie Burger", 0),
    item("C-FRIES", "Batata frita", "Fries", 0),
    item("C-SALAD", "Salada", "Side salad", 0.5),
    item("C-COLA", "Cola (normal)", "Cola (regular)", 0),
    item("C-WATER", "Água sem gás", "Still water", 0),
    {
      id: "SS-1001",
      name: "Turbine seu hambúrguer",
      type: "SWAP_SELL",
      links: [link("ITEM", "1003")],
      translations: en("Upgrade your burger"),
    },
    image("100", "Hambúrgueres", "croque-monsieur.jpg", "Uma seleção de hambúrgueres"),
    image("1001", "Hambúrguer clássico", "croque-monsieur.jpg"),
    image("2001", "Refrigerante de cola", "cookie.jpg"),
    image("3001", "Combo hambúrguer", "misto-quente.jpg"),
    ...(demoMenu() ? abigailEntities() : []),
  ];
}

export type MockMenuV2 = Omit<S["AdminMenu"], "isActive"> & { schedules: Hours[] };

/**
 * Abigail Coffee's menu goes in front unless MOCK_MENU=reference, which keeps
 * only the MODELS 5.20 menu (the tests run that way: vitest.config.mts).
 */
export const demoMenu = () => process.env.MOCK_MENU !== "reference";
const abigail = () => (demoMenu() ? ABIGAIL_CATEGORY_IDS.map((id) => link("CATEGORY", id)) : []);

export const seedMenus = (): MockMenuV2[] => [
  {
    id: "mnu-manha",
    name: "Manhã",
    translations: en("Morning"),
    root: [...abigail(), link("CATEGORY", "200"), link("CATEGORY", "100")],
    forcedUntil: null,
    schedules: daily("06:00:00", "11:00:00"),
  },
  {
    id: "mnu-tarde",
    name: "Tarde",
    translations: en("Afternoon"),
    root: [...abigail(), link("CATEGORY", "100"), link("CATEGORY", "200"), link("CATEGORY", "300")],
    forcedUntil: null,
    schedules: daily("11:00:00", "20:00:00"),
  },
];

export const seedStore = (): S["StoreConfigurationResponse"] => ({
  locationName: "Padaria do Pai do Brunera",
  liveFlag: 1,
  logo: null,
  languages: ["pt-BR", "en"],
  defaultLanguage: "pt-BR",
  closedMessage: {
    title: { "pt-BR": "Fechado agora", en: "Closed now" },
    description: { "pt-BR": "Volte no nosso horário.", en: "Come back during our hours." },
  },
  invoiceNotice: {
    "pt-BR": "Se quiser nota fiscal, dirija-se ao caixa.",
    en: "If you need an invoice, please go to the counter.",
  },
  timezone: "America/Sao_Paulo",
  businessDayCutoff: "04:00",
});

export const seedBadges = (): S["Badge"][] => [
  { id: "NOVO", name: "Novidade", textColour: "#FAF6F0", backgroundColour: "#4E3426", translations: en("New") },
];

export const seedDiscountRules = (): S["DiscountRule"][] => [
  { id: "dr-bemvindo10", code: "BEMVINDO10", name: "10% de boas-vindas", translations: en("10% welcome"), type: "PERCENT", value: 10, usesCount: 0, active: true },
  { id: "dr-cafe5", code: "CAFE5", name: "R$ 5 em pedidos a partir de R$ 20", type: "FIXED", value: 5, minOrderTotal: 20, usesCount: 0, active: true },
  { id: "dr-limitado", code: "LIMITADO", name: "20% (uso único)", type: "PERCENT", value: 20, maxUses: 1, usesCount: 1, active: true },
];
