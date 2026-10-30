// The bakery's catalogue as the back office stores it (Admin* shapes), seeded
// with the prototype's menu. The kiosk's resolved Menu is built from it in
// kiosk-menu.ts, the way the Go API will build it from its tables.

import type { Schemas } from "./http.ts";

export type MockItem = Schemas["AdminItem"];
export type MockCategory = Schemas["AdminCategory"] & { items: Schemas["CategoryItemLink"][] };
export type MockOptionGroup = Schemas["AdminOptionGroup"];
export type MockTag = Schemas["AdminTag"];
export type MockCrossSell = Schemas["AdminCrossSellGroup"];
export type MockDiscount = Schemas["AdminDiscount"];

type L = Schemas["LocalizedText"];
const l = (pt: string, en?: string): L => (en ? { "pt-BR": pt, en } : { "pt-BR": pt });

const BOTH = { DINEIN: true, TAKE_OUT: true };

function item(id: string, name: L, price: number, extra: Partial<MockItem> = {}): MockItem {
  return {
    id,
    plu: null,
    name,
    image: null,
    price,
    servicePriceOverride: {},
    serviceAvailability: BOTH,
    calories: null,
    itemLabels: [],
    defaultEntity: null,
    crossSellGroupId: null,
    fiscal: null,
    soldOutDate: null,
    ...extra,
  };
}

function option(
  id: string,
  name: L,
  price: number,
  displayOrder: number,
  extra: Partial<Schemas["AdminOption"]> = {},
): Schemas["AdminOption"] {
  return {
    id,
    plu: null,
    name,
    price,
    servicePriceOverride: {},
    maximumQuantity: 1,
    defaultQuantity: 0,
    supersede: false,
    displayOrder,
    ...extra,
  };
}

const milk = (itemId: string, suffix: string): MockOptionGroup => ({
  id: `grp-leite-${suffix}`,
  itemId,
  parentOptionId: null,
  name: l("Leite", "Milk"),
  role: "REQUIRED-MODIFIER",
  minimum: 1,
  maximum: 1,
  defaultOption: `opt-leite-integral${suffix === "cappuccino" ? "" : `-${suffix}`}`,
  displayOrder: 1,
  compositeOptions: [],
  options: [
    option(
      `opt-leite-integral${suffix === "cappuccino" ? "" : `-${suffix}`}`,
      l("Leite integral", "Whole milk"),
      0,
      1,
      { defaultQuantity: 1 },
    ),
    option(`opt-leite-desnatado-${suffix}`, l("Leite desnatado", "Skimmed milk"), 0, 2),
    option(`opt-leite-aveia-${suffix}`, l("Bebida de aveia", "Oat drink"), 300, 3),
  ],
});

export function seedCatalogue() {
  const items: MockItem[] = [
    // Pães
    item("itm-fermentacao-natural", l("Fermentação natural", "Sourdough"), 2800, {
      plu: "1001",
      shortName: l("Fermentação", "Sourdough"),
      description: l(
        "Pão de fermentação natural, casca crocante.",
        "Naturally leavened bread with a crunchy crust.",
      ),
      image: "/media/fermentacao-natural.jpg",
    }),
    item("itm-baguete", l("Baguete tradicional", "Classic baguette"), 1200, {
      plu: "1002",
      shortName: l("Baguete", "Baguette"),
      image: "/media/baguete.jpg",
    }),
    item("itm-brioche", l("Brioche", "Brioche"), 2200, {
      plu: "1003",
      description: l("Massa amanteigada, levemente doce.", "Buttery, lightly sweet loaf."),
      image: "/media/brioche.jpg",
    }),
    item("itm-centeio", l("Centeio com sementes", "Seeded rye"), 2600, {
      plu: "1004",
      image: "/media/centeio.jpg",
    }),
    item("itm-pao-de-forma", l("Pão de forma da casa", "House sandwich loaf"), 1800, {
      plu: "1005",
      image: "/media/pao-de-forma.jpg",
    }),
    item("itm-croissant", l("Croissant", "Croissant"), 1400, {
      plu: "1006",
      description: l("Folhado na manteiga.", "All-butter, flaky."),
      image: "/media/croissant.jpg",
      crossSellGroupId: "xs-cafes",
    }),
    // Doces
    item("itm-pain-au-chocolat", l("Pain au chocolat", "Pain au chocolat"), 1500, {
      plu: "2001",
      image: "/media/pain-au-chocolat.jpg",
      crossSellGroupId: "xs-cafes",
    }),
    item("itm-cookie", l("Cookie de chocolate", "Chocolate cookie"), 900, {
      plu: "2002",
      image: "/media/cookie.jpg",
    }),
    item("itm-cupcake", l("Cupcake de baunilha", "Vanilla cupcake"), 1100, {
      plu: "2003",
      image: "/media/cupcake.jpg",
    }),
    item("itm-donut", l("Donut com cobertura", "Glazed donut"), 1000, {
      plu: "2004",
      image: "/media/donut.jpg",
    }),
    // Salgados
    item("itm-pao-de-queijo", l("Pão de queijo", "Cheese bread"), 700, {
      plu: "2501",
      description: l("Porção com 4 unidades.", "Four pieces."),
    }),
    item("itm-coxinha", l("Coxinha de frango", "Chicken coxinha"), 900, { plu: "2502" }),
    item("itm-empada", l("Empada de palmito", "Heart of palm pie"), 1000, { plu: "2503" }),
    // Sanduíches
    item("itm-croque-monsieur", l("Croque monsieur", "Croque monsieur"), 3490, {
      plu: "3001",
      shortName: l("Croque", "Croque"),
      description: l(
        "Pão tostado, presunto, gruyère e molho bechamel gratinado.",
        "Toasted bread, ham, gruyère and gratinated béchamel.",
      ),
      image: "/media/croque-monsieur.jpg",
      crossSellGroupId: "xs-cafes",
    }),
    item("itm-misto-quente", l("Misto quente", "Ham and cheese toastie"), 1800, {
      plu: "3002",
      image: "/media/misto-quente.jpg",
      crossSellGroupId: "xs-cafes",
    }),
    // Cafés
    item("itm-cappuccino", l("Cappuccino", "Cappuccino"), 1390, {
      plu: "4001",
      image: "/media/cappuccino.jpg",
    }),
    item("itm-latte", l("Café com leite", "Caffè latte"), 1290, {
      plu: "4002",
      image: "/media/latte.jpg",
    }),
    item("itm-espresso", l("Espresso", "Espresso"), 700, { plu: "4003" }),
    // Bebidas
    item("itm-suco-laranja", l("Suco de laranja", "Orange juice"), 1000, { plu: "5001" }),
    item("itm-agua", l("Água sem gás", "Still water"), 500, { plu: "5002" }),
    // Dine-in only: served in a glass bottle that stays in the shop.
    item("itm-refrigerante", l("Refrigerante de garrafa", "Bottled soda"), 700, {
      plu: "5003",
      serviceAvailability: { DINEIN: true, TAKE_OUT: false },
    }),
  ];

  const optionGroups: MockOptionGroup[] = [
    {
      id: "grp-corte",
      itemId: "itm-fermentacao-natural",
      parentOptionId: null,
      name: l("Como você quer?", "How would you like it?"),
      role: "REQUIRED-MODIFIER",
      minimum: 1,
      maximum: 1,
      defaultOption: "opt-inteiro-fatiado",
      displayOrder: 1,
      compositeOptions: [],
      options: [
        option("opt-inteiro-fatiado", l("Inteiro, fatiado", "Whole, sliced"), 0, 1, {
          plu: "9001",
          defaultQuantity: 1,
        }),
        option("opt-inteiro", l("Inteiro", "Whole"), 0, 2, { plu: "9002" }),
        option("opt-meio", l("Meio pão", "Half loaf"), 0, 3, { plu: "9003" }),
      ],
    },
    {
      id: "grp-pao",
      itemId: "itm-croque-monsieur",
      parentOptionId: null,
      name: l("Pão", "Bread"),
      role: "REQUIRED-MODIFIER",
      minimum: 1,
      maximum: 1,
      defaultOption: "opt-pao-brioche",
      displayOrder: 1,
      compositeOptions: [],
      options: [
        option("opt-pao-brioche", l("Brioche"), 0, 1, { plu: "9101", defaultQuantity: 1 }),
        option("opt-pao-fermentacao", l("Fermentação", "Sourdough"), 0, 2, { plu: "9102" }),
        option("opt-pao-ciabatta", l("Ciabatta"), 0, 3, { plu: "9103" }),
      ],
    },
    {
      id: "grp-adicionais",
      itemId: "itm-croque-monsieur",
      parentOptionId: null,
      name: l("Adicionais", "Extras"),
      role: "MODIFIERS",
      minimum: 0,
      maximum: 3,
      defaultOption: null,
      displayOrder: 2,
      compositeOptions: [],
      options: [
        option("opt-ovo-poche", l("Ovo pochê", "Poached egg"), 600, 1, { plu: "9201" }),
        option("opt-presunto-parma", l("Presunto de parma", "Parma ham"), 900, 2, { plu: "9202" }),
        option("opt-gruyere-extra", l("Gruyère extra", "Extra gruyère"), 700, 3, { plu: "9203" }),
        option("opt-mostarda-dijon", l("Mostarda dijon", "Dijon mustard"), 200, 4, { plu: "9204" }),
      ],
    },
    {
      id: "grp-ingredientes-croque",
      itemId: "itm-croque-monsieur",
      parentOptionId: null,
      name: l("Ingredientes", "Ingredients"),
      role: "INGREDIENTS",
      minimum: 0,
      maximum: 0,
      defaultOption: null,
      displayOrder: 3,
      options: [],
      compositeOptions: [
        {
          positiveOption: option("opt-com-bechamel", l("Bechamel", "Béchamel"), 0, 1),
          negativeOption: option("opt-sem-bechamel", l("Sem bechamel", "No béchamel"), 0, 1),
          defaultChoice: "POSITIVE",
        },
        {
          positiveOption: option("opt-com-presunto", l("Presunto", "Ham"), 0, 2),
          negativeOption: option("opt-sem-presunto", l("Sem presunto", "No ham"), 0, 2),
          defaultChoice: "POSITIVE",
        },
      ],
    },
    {
      id: "grp-pao-misto",
      itemId: "itm-misto-quente",
      parentOptionId: null,
      name: l("Pão", "Bread"),
      role: "REQUIRED-MODIFIER",
      minimum: 1,
      maximum: 1,
      defaultOption: "opt-misto-forma",
      displayOrder: 1,
      compositeOptions: [],
      options: [
        option("opt-misto-forma", l("Pão de forma", "Sandwich loaf"), 0, 1, { defaultQuantity: 1 }),
        option("opt-misto-frances", l("Pão francês", "French roll"), 0, 2),
      ],
    },
    {
      id: "grp-pao-de-queijo",
      itemId: "itm-pao-de-queijo",
      parentOptionId: null,
      name: l("Acompanhamento", "On the side"),
      role: "MODIFIERS",
      minimum: 0,
      maximum: 0,
      defaultOption: null,
      displayOrder: 1,
      compositeOptions: [],
      options: [
        option(
          "opt-requeijao",
          l("Requeijão para acompanhar", "Cream cheese on the side"),
          300,
          1,
          {
            maximumQuantity: 2,
          },
        ),
      ],
    },
    milk("itm-cappuccino", "cappuccino"),
    milk("itm-latte", "latte"),
    {
      id: "grp-acucar-espresso",
      itemId: "itm-espresso",
      parentOptionId: null,
      name: l("Dose", "Shot"),
      role: "UPSELLS",
      minimum: 0,
      maximum: 1,
      defaultOption: null,
      displayOrder: 1,
      compositeOptions: [],
      options: [option("opt-dose-dupla", l("Dose dupla", "Double shot"), 400, 1)],
    },
  ];

  const link = (itemId: string, displayOrder: number, priceOverride: number | null = null) => ({
    itemId,
    displayOrder,
    priceOverride,
  });
  const category = (
    id: string,
    menuId: string,
    name: L,
    displayOrder: number,
    links: Schemas["CategoryItemLink"][],
  ): MockCategory => ({
    id,
    menuId,
    parentId: null,
    name,
    image: null,
    displayOrder,
    items: links,
  });

  const morning = "mnu-manha";
  const afternoon = "mnu-tarde";
  const coffees = (prices: [number | null, number | null, number | null]) => [
    link("itm-cappuccino", 1, prices[0]),
    link("itm-latte", 2, prices[1]),
    link("itm-espresso", 3, prices[2]),
  ];
  const drinks = [link("itm-suco-laranja", 1), link("itm-agua", 2), link("itm-refrigerante", 3)];
  const sweets = [
    link("itm-pain-au-chocolat", 1),
    link("itm-cookie", 2),
    link("itm-cupcake", 3),
    link("itm-donut", 4),
  ];
  const savoury = [link("itm-pao-de-queijo", 1), link("itm-coxinha", 2), link("itm-empada", 3)];
  const sandwiches = [link("itm-croque-monsieur", 1), link("itm-misto-quente", 2)];

  const categories: MockCategory[] = [
    category("cat-paes", morning, l("Pães", "Breads"), 1, [
      link("itm-fermentacao-natural", 1),
      link("itm-baguete", 2),
      link("itm-brioche", 3),
      link("itm-centeio", 4),
      link("itm-pao-de-forma", 5),
      link("itm-croissant", 6),
    ]),
    category("cat-doces", morning, l("Doces", "Sweets"), 2, sweets),
    category("cat-salgados", morning, l("Salgados", "Savoury"), 3, savoury),
    category("cat-sanduiches", morning, l("Sanduíches", "Sandwiches"), 4, sandwiches),
    category("cat-cafes", morning, l("Cafés", "Coffee"), 5, coffees([null, null, null])),
    category("cat-bebidas", morning, l("Bebidas", "Drinks"), 6, drinks),
    // Afternoon: savoury first; coffee costs a little more (price per menu).
    category("cat-t-salgados", afternoon, l("Salgados", "Savoury"), 1, savoury),
    category("cat-t-sanduiches", afternoon, l("Sanduíches", "Sandwiches"), 2, sandwiches),
    category("cat-t-doces", afternoon, l("Doces", "Sweets"), 3, sweets),
    category("cat-t-cafes", afternoon, l("Cafés", "Coffee"), 4, coffees([1490, 1390, null])),
    category("cat-t-bebidas", afternoon, l("Bebidas", "Drinks"), 5, drinks),
  ];

  const tags: MockTag[] = [
    {
      id: "tag-mais-pedido",
      badgeName: l("Mais pedido", "Most ordered"),
      textColour: "#2B211C",
      backgroundColour: "#FFFFFF",
      tagsPages: ["ITEM_MENU", "ITEM_PAGE"],
      scheduleEnabled: false,
      startDate: null,
      endDate: null,
      links: [
        { menuItemId: "itm-fermentacao-natural", categoryId: null, enabled: true },
        { menuItemId: "itm-croque-monsieur", categoryId: null, enabled: true },
      ],
    },
    {
      id: "tag-novo",
      badgeName: l("Novo", "New"),
      textColour: "#FAF6F0",
      backgroundColour: "#B07A3A",
      tagsPages: ["ITEM_MENU", "ITEM_PAGE", "BASKET"],
      scheduleEnabled: false,
      startDate: null,
      endDate: null,
      links: [{ menuItemId: "itm-centeio", categoryId: null, enabled: true }],
    },
  ];

  const crossSellGroups: MockCrossSell[] = [
    {
      id: "xs-cafes",
      name: l("Que tal um café?", "How about a coffee?"),
      crossSells: ["itm-cappuccino", "itm-latte"],
    },
  ];

  const discounts: MockDiscount[] = [
    {
      id: "dsc-bemvindo10",
      type: "COMANDA_COUPON",
      code: "BEMVINDO10",
      title: l("10% na primeira compra", "10% off your first order"),
      kind: "PERCENT",
      value: 10,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      id: "dsc-cafe5",
      type: "RESTAURANT_DISCOUNT",
      code: "CAFE5",
      title: l("R$ 5 de desconto", "R$ 5 off"),
      description: l("Promoção da casa.", "House promotion."),
      kind: "FIXED",
      value: 500,
      validFrom: null,
      validTo: null,
      active: true,
    },
    {
      id: "dsc-natal",
      type: "RESTAURANT_DISCOUNT",
      code: "NATAL2025",
      title: l("Natal 2025", "Christmas 2025"),
      kind: "PERCENT",
      value: 15,
      validFrom: "2025-12-01T03:00:00Z",
      validTo: "2025-12-26T03:00:00Z",
      active: true,
    },
  ];

  return { items, optionGroups, categories, tags, crossSellGroups, discounts };
}

/**
 * Media files the mock serves under /media, mapped to the prototype's photos
 * (docs/prototype/assets). The Go API will serve uploads the same way.
 */
export const SEED_MEDIA: Record<string, string> = {
  "fermentacao-natural.jpg": "sourdough.jpg",
  "baguete.jpg": "baguette.jpg",
  "brioche.jpg": "brioche.jpg",
  "centeio.jpg": "rye.jpg",
  "pao-de-forma.jpg": "forma.jpg",
  "croissant.jpg": "croissant.jpg",
  "pain-au-chocolat.jpg": "choco.jpg",
  "cookie.jpg": "cookie.jpg",
  "cupcake.jpg": "cupcake.jpg",
  "donut.jpg": "donut.jpg",
  "croque-monsieur.jpg": "sandwich.jpg",
  "misto-quente.jpg": "bread.jpg",
  "cappuccino.jpg": "cappuccino.jpg",
  "latte.jpg": "latte.jpg",
};
