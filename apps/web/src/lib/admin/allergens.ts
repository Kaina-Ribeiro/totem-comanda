import type { components } from "@/lib/core-api";

export type Allergen = components["schemas"]["Allergen"];

/**
 * The ANVISA allergen groups (RDC 26/2015 and 727/2022) in the v2 values they
 * map to (SPEC 6). Shown first, in the order the label law lists them.
 */
export const ANVISA_ALLERGENS: Array<[Allergen, string]> = [
  ["GLUTEN", "Glúten"],
  ["WHEAT", "Trigo"],
  ["RYE", "Centeio"],
  ["BARLEY", "Cevada"],
  ["OATS", "Aveia"],
  ["CRUSTACEANS", "Crustáceos"],
  ["EGGS", "Ovos"],
  ["FISH", "Peixes"],
  ["PEANUTS", "Amendoim"],
  ["SOYA", "Soja"],
  ["MILK", "Leite"],
  ["ALMONDS", "Amêndoa"],
  ["HAZELNUTS", "Avelã"],
  ["CASHEW", "Castanha-de-caju"],
  ["BRAZIL_NUT", "Castanha-do-pará"],
  ["MACADAMIA", "Macadâmia"],
  ["WALNUTS", "Nozes"],
  ["PECAN", "Pecã"],
  ["PISTACHIOS", "Pistache"],
  ["NUTS", "Outras castanhas (pinoli, etc.)"],
  ["NATURAL_LATEX", "Látex natural"],
];

/** Every other v2 value (more allergens, diets, spice, drink tags), in pt-BR. */
export const OTHER_ALLERGENS: Array<[Allergen, string]> = [
  ["SESAME", "Gergelim"],
  ["MOLLUSCS", "Moluscos"],
  ["SHELLFISH", "Frutos do mar"],
  ["CELERY", "Aipo"],
  ["MUSTARD", "Mostarda"],
  ["LUPIN", "Tremoço"],
  ["SULPHITES", "Sulfitos"],
  ["SULPHUR", "Dióxido de enxofre"],
  ["GRAINS_GLUTEN", "Cereais com glúten"],
  ["CEREALS", "Cereais"],
  ["DAIRY", "Laticínios"],
  ["KAMUT", "Kamut"],
  ["SPELT", "Espelta"],
  ["PORK", "Carne de porco"],
  ["VEGETARIAN", "Vegetariano"],
  ["VEGAN", "Vegano"],
  ["PLANT_BASED", "À base de plantas"],
  ["GLUTEN_FREE", "Sem glúten"],
  ["DAIRY_FREE", "Sem laticínios"],
  ["LACTOSE_FREE", "Sem lactose"],
  ["SUGAR_FREE", "Sem açúcar"],
  ["ORGANIC", "Orgânico"],
  ["NATURAL", "Natural"],
  ["HALAL", "Halal"],
  ["KOSHER", "Kosher"],
  ["KETO", "Keto"],
  ["PALEO", "Paleo"],
  ["MILD", "Pouco picante"],
  ["MEDIUM", "Picante médio"],
  ["HOT", "Picante"],
  ["VERY_HOT", "Muito picante"],
  ["SOFT", "Refrigerante"],
  ["SUGARED", "Com açúcar"],
  ["NGCI", "NGCI"],
];

export const ALL_ALLERGENS: Allergen[] = [...ANVISA_ALLERGENS, ...OTHER_ALLERGENS].map(([value]) => value);

const LABEL = new Map([...ANVISA_ALLERGENS, ...OTHER_ALLERGENS]);

export const allergenLabel = (value: Allergen) => LABEL.get(value) ?? value;
