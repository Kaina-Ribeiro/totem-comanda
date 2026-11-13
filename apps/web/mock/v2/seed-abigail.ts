// Abigail Coffee's menu (categories, items and photos, from its public menu on
// leadsfood.app, 13 Nov 2026) so the kiosk demo shows real food. Prices are invented:
// the source shows none. Photos live in mock/media/abigail (800x800 WebP).

import type { Entity, S } from "./http.ts";

const link = (type: S["PosEntityType"], id: string): S["Link"] => ({ type, id });

type Row = [slug: string, name: string, english: string, price: number, description?: string, english_description?: string];
type Category = { id: string; name: string; english: string; image: string; alcoholic?: boolean; items: Row[] };

const CATEGORIES: Category[] = [
  {
    id: "AB-comidinhas",
    name: "Comidinhas",
    english: "Snacks",
    image: "categoria-comidinhas.webp",
    items: [
      ["toast-serrano-com-uva-fermentada", "Toast Serrano com Uva Fermentada", "Serrano Toast with Fermented Grapes", 42, "Fatia de pão italiano de fermentação natural, queijo cremoso da Serra da Canastra, com crocante e fatias de presunto serrano, finalizado com uvas roxas fermentadas, gel de tomate, manjericão roxo e azeite.", "Slice of sourdough Italian bread, Serra da Canastra cream cheese, crispy elements and slices of Serrano ham, finished with fermented purple grapes, tomato gel, purple basil, and olive oil."],
      ["toast-avocado", "Toast Avocado", "Toast Avocado", 34, "Fatia de pão italiano de fermentação natural com pasta de avocado, temperadinha, leve e refrescante.", "Slice of naturally fermented Italian bread with avocado spread, lightly seasoned, light and refreshing."],
      ["toast-hommus", "Toast Hommus", "Toast Hommus", 32, "Fatia de pão italiano de fermentação natural, hommus (pasta de grão-de-bico), picles de beterraba e azeite de oliva. Um toast vegano leve e muito saboroso. Vegano e Sem Lactose", "Slice of naturally fermented Italian bread, hummus (chickpea paste), pickled beetroot, and olive oil. A light and very tasty vegan toast. Vegan and lactose-free."],
      ["tostada-de-queijo", "Tostada de Queijo", "Cheese Toast", 29, "Fatia de pão italiano de fermentação natural, com casquinha de queijo da Serra da Canastra tostado na chapa.", "Slice of natural fermentation Italian bread, with Serra da Canastra cheese cone toasted on the plate."],
      ["pao-de-queijo-da-dona-nadir", "Pão de Queijo da Dona Nadir", "Dona Nadir's Pão de Queijo", 12, "Mineiríssimo, com a receita secreta da mestra cuca lá da Fazenda Daterra!\nCom queijo da Serra da Canastra e vários segredinhos! 😉 [SG]", "Mineiríssimo, with the secret recipe of the master cuca there from Fazenda Daterra!\n\nWith cheese from Serra da Canastra and several little secrets! 😉 [SG]"],
      ["waffle-de-pao-de-queijo", "Waffle de Pão de Queijo", "Pão de Queijo Waffle", 26, "Waffle tostadinho e crocante, produzido com a receita da dona Nadir. [SG]", "Toasted and crispy waffle, produced with Dona Nadir’s recipe. [SG]"],
      ["pao-italiano-de-fermentacao-natural", "Pão Italiano de Fermentação Natural", "Italian Sourdough Bread", 28, "Escolha acompanhamento: manteiga artesanal tradicional;\nOU manteiga aromatizada com flores;\nOU com azeite (no italiano: opção [V][SL]).", "Choose an accompaniment: traditional artisanal butter;\nOR floral-infused butter;\nOR olive oil (Italian style: [V][SL] option).\nOR butter flavoured with flowers;\n\nOR with olive oil (in Italian: option [V][SL])."],
      ["pao-brioche-artesanal", "Pão Brioche Artesanal", "Artisan Brioche Bread", 24, "Escolha acompanhamento: manteiga artesanal tradicional;\nOU manteiga aromatizada com flores;\nOU com azeite (no italiano: opção [V][SL]).", "Choose an accompaniment: traditional artisanal butter;\nOR floral-infused butter;\nOR olive oil (Italian style: [V][SL] option)."],
      ["bocadillo-catalan", "Bocadillo Catalán", "Bocadillo Catalan", 39, "Inspirado nos deliciosos bocadillos (sanduíches) espanhóis. Baguete de fermentação natural, queijo da Serra da Canastra, tomate esmagado e azeite, com fatias de charcutaria - escolha: “Bocadillo Bologna”, com fatias de mortadela artesanal Bologna, OU “Bocadillo Catalán” com fatias de presunto serrano (presunto cru espanhol, curado).", "Inspired by delicious Spanish *bocadillos* (sandwiches). Sourdough baguette, Serra da Canastra cheese, crushed tomato, and olive oil, with sliced ​​cured meats—choose between the “Bocadillo Bologna,” with slices of artisanal Bologna mortadella, OR the “Bocadillo Catalán,” with slices of Serrano ham (Spanish dry-cured ham)."],
      ["toast-de-cogumelos", "Toast de Cogumelos", "Mushroom Toast", 36, "Fatia de pão italiano de fermentação natural, refogadinho de cogumelo shitake e cogumelo paris, amêndoa com páprica defumada e tomatinhos fermentados. [V][SL]", "Slice of sourdough Italian bread, sautéed shiitake and cremini mushrooms, smoked paprika almonds, and fermented cherry tomatoes. [V][LF]"],
      ["tostex-de-queijos", "Tostex de Queijos", "Cheese Toasted Sandwich", 31, "Sanduíche no pão brioche artesanal da Abigail, tostado com manteiga e recheado com fatias de queijo laranja artesanal com urucum e queijo da Serra da Canastra.", "Sandwich on Abigail’s artisanal brioche—buttered and toasted—filled with slices of artisanal orange cheese (colored with annatto) and Serra da Canastra cheese."],
      ["pao-com-ovo-e-bacon", "Pão com Ovo e Bacon", "Bread with Egg and Bacon", 33, "Ovos mexidos servidos sobre pão de brioche macio tostado na manteiga e finalizado com pedacinhos\nde bacon crocante. A pão-com-ovo que venceu na vida!", "Scrambled eggs served on soft, butter-toasted brioche bread and finished with crispy bacon bits. The ultimate glow-up for the humble egg sandwich!"],
      ["omelete-persa", "Omelete Persa", "Persian Omelet", 38, "Uma antiga receita persa de omelete: ovos mexidos com tomate, toque de alho, servido com gema\nmolinha e cremosa por cima. Servido com fatias de pão de fermentação natural.", "An ancient Persian omelet recipe: scrambled eggs with tomato and a touch of garlic, topped with a soft, creamy yolk. Served with slices of sourdough bread."],
      ["iogurte", "Iogurte", "Yogurt", 19, "Iogurte artesanal da Fazenda Atalaia com compota de frutas vermelhas e amêndoas torradas.", "Fazenda Atalaia artisanal yogurt with mixed berry compote and toasted almonds."],
    ],
  },
  {
    id: "AB-doces",
    name: "Doces e Sobremesas",
    english: "Desserts",
    image: "categoria-doces.webp",
    items: [
      ["brigadeiro-com-chocolate-de-origem", "Brigadeiro com Chocolate de Origem", "Brigadeiro with Special Chocolate", 8],
      ["cookie-de-framboesa", "Cookie de Framboesa", "Raspberry Cookie", 14, "Cookie amanteigado recheado com geleia de framboesa, chocolate branco e chocolate 50% de origem. Servido quente, surpreendente!", "Buttery cookie filled with raspberry jelly, white chocolate and chocolate 50% of origin. Served hot, amazing!"],
      ["bolo-banana-bread-fit", "Bolo Banana Bread Fit", "Banana Bread Fit", 16, "Produzido com frutas, cereais, castanhas e gotas de chocolate Zero açúcar, fino e de origem, tostado na chapa e finalizado com cacau em pó – sem açúcar adicionado. [SG][SL]", "Made with fruit, grains, nuts, and sugar-free chocolate chips; a premium, single-origin product, griddle-toasted and finished with cocoa powder—no added sugar. [GF][DF]"],
      ["bolo-amanteigado-duas-uvas", "Bolo Amanteigado Duas Uvas", "Two-Grapes Butter Cake", 18, "Bolo amanteigado com uvas verdes e roxas, limão\nsiciliano, farofinha crocante e finalizado com uma\ncalda azedinha de uvas e balsâmico.", "Buttery cake with green and red grapes, Sicilian lemon, and a crunchy streusel topping, finished with a tangy grape and balsamic glaze."],
      ["choux-cream-de-caju", "Choux Cream de Caju", "Caju Choux Cream", 21, "Um clássico francês com twist Abigail:\nMassinha leve e delicada, recheada com um creme de caju com natas frescas, castanhas de caju e coulis de caju. Equilibrada e muito saborosa.", "A French classic with Abigail twist:\n\nLight and delicate dough, stuffed with a cashew cream with fresh cream, cashew nuts and cashew coulis. Balanced and very tasty."],
      ["cheesecake-da-abigail", "Cheesecake da Abigail", "Abigail's Cheesecake", 24, "Cheesecake artesanal com cobertura de frutas\nvermelhas. O melhor cheesecake que você já comeu na vida – cremoso que chega a derreter na boca!", "Handmade cheesecake with a mixed berry topping. The best cheesecake you’ve ever had—so creamy it practically melts in your mouth!"],
      ["torta-de-chocolate-de-origem-e-caramelo-salgado", "Torta de Chocolate de Origem e Caramelo Salgado", "Chocolate Tart with Salted Caramel", 24, "Produzida com cacau fino e de origem. [SG]", "Made with fine, single-origin cocoa. Gluten Free"],
      ["bolo-de-maracuja-e-coco", "Bolo de Maracujá e Coco", "Passion Fruit and Coconut Cake", 18, "Massa de maracujá, recheio de ganache de chocolate de origem 50%, recheio de coco com chutney de manga e cobertura de buttercream de maracujá.", "Passion fruit dough, chocolate ganache filling of 50% origin, coconut filling with mango chutney and passion fruit buttercream topping."],
      ["mousse-de-chocolate", "Mousse de Chocolate", "Chocolate Mousse", 19, "Mousse de chocolate 50% fino e de origem, com\npraliné de castanha de caju, finalizado com azeite e flor de sal. Ah! E é vegano! [V][SL][SG]", "Fine, single-origin 50% chocolate mousse with cashew praline, finished with olive oil and fleur de sel. Oh, and it’s vegan! [V][SL][SG]"],
    ],
  },
  {
    id: "AB-cafes",
    name: "Cafés",
    english: "Coffee",
    image: "categoria-cafes.webp",
    items: [
      ["espresso", "Espresso", "Espresso", 8, "Produz uma xícara bem intensa, com acidez presente, muito encorpada e com sabor concentrado. Aqui a gente só faz espresso duplo para\nextração mais uniforme e usamos de 2 a 3 vezes mais grãos de café que o usual.\nConsulte as opções de cafés no quadro ao lado do balcão.", "It produces a very intense cup with noticeable acidity, a full body, and a concentrated flavor.\nWe only make double espressos here for a more uniform extraction, using two to three times the usual amount of coffee beans.\nCheck the coffee options on the board next to the counter."],
      ["coado", "Coado", "Filtered", 12, "Produz uma xícara leve e equilibrada, com acidez suave, corpo delicado e sabores mais limpos e definidos.\nNosso café coado é preparado para valorizar a doçura natural dos grãos e revelar toda a complexidade dos seus aromas e notas sensoriais, proporcionando uma bebida mais completa.\nConsulte as opções de cafés no quadro ao lado do balcão", "It produces a light, balanced cup with mild acidity, a delicate body, and cleaner, more defined flavors.\nOur pour-over coffee is prepared to highlight the beans' natural sweetness and reveal the full complexity of their aromas and sensory notes, resulting in a richer, more complete cup.\nPlease check the coffee options on the board next to the counter.Choose your brewing method.\nPlace your order at the counter.\nRemember: talk to the barista and ask for a recommendation.\nIt will be our pleasure."],
    ],
  },
  {
    id: "AB-cafes-com-leite",
    name: "Cafés com Leite",
    english: "Milk-based",
    image: "categoria-cafes-com-leite.webp",
    items: [
      ["dirty-coffee", "Dirty Coffee", "Dirty Coffee", 16, "Uma dose de espresso, servido com espuma de leite por cima", "A shot of espresso served with milk foam on top."],
      ["cappuccino", "Cappuccino", "Cappuccino", 14, "O verdadeiro cappuccino italiano: espresso e leite vaporizado bem cremoso.", "The true Italian cappuccino: espresso and perfectly creamy steamed milk."],
      ["macchiato", "Macchiato", "Macchiato", 10, "Uma dose de espresso servido com espuma de leite por cima.", "A single shot of espresso topped with milk foam."],
      ["flat-white", "Flat White", "Flat White", 15, "Pra quem gosta de mais café no leite: leite vaporizado com duas doses de expresso.", "For those who prefer more coffee with milk: steamed milk with two shots of espresso."],
    ],
  },
  {
    id: "AB-cafes-gelados",
    name: "Cafés Gelados",
    english: "Iced Coffees",
    image: "categoria-cafes-gelados.webp",
    items: [
      ["freddoccino-abigail", "Freddoccino Abigail", "Freddoccino Abigail", 19, "Dose de espresso e outra de leite, emulsionados com leite.", "A shot of espresso and another of milk, emulsified with milk."],
      ["iced-coffee", "Iced Coffee", "Iced Coffee", 14, "Café coado, refrescante, servido com bastante gelo.", "Filtered coffee, refreshing, served over plenty of ice."],
      ["cold-brew-classic", "Cold Brew Classic", "Cold Br", 17, "Café extraído a frio, com fatia de limão\nsiciliano.", "Cold-brewed coffee served with a slice of Sicilian lemon."],
      ["cold-brew-amarelo", "Cold Brew Amarelo", "Yellow Cold Brew", 17, "Café extraído a frio com nosso smoothie amarelo da Abiga.", "Cold brew coffee with our yellow Abiga smoothie."],
      ["cold-brew-vermelho", "Cold Brew Vermelho", "Red Cold brew", 17, "Café extraído a frio, com nosso smoothie vermelho da Abiga.", "Cold brew coffee, with our Abiga red smoothie."],
      ["espresso-tonica-ginger", "Espresso Tônica Ginger", "Tônica Espresso Ginger", 21, "Espresso com água tônica de gengibre, limão siciliano e gelo.", "Espresso with ginger tonic water, Sicilian lemon, and ice."],
      ["espresso-tonica-rose", "Espresso Tônica Rosé", "Espresso Tônica Rosé", 21, "Espresso com água tônica Rosè, limão siciliano e gelo.", "Espresso com água tônica Rosè, limão siciliano e gelo."],
    ],
  },
  {
    id: "AB-outras-bebidas",
    name: "Outras bebidas",
    english: "Other beverages",
    image: "categoria-outras-bebidas.webp",
    items: [
      ["cha-blend-de-flores-da-abigail", "Chá Blend de Flores da Abigail", "Abigail's Flower Blend Tea", 12, "Quente ou Gelado", "Hot or Cold"],
      ["chocolate-quente", "Chocolate Quente", "Hot Chocolate", 18, "Produzido com chocolate de Origem, deleite Naveia e raspas de laranja bahia. Com doçura equilibrada e um toque cítrico especial.\n[V][SL][SG]", "Made with single-origin chocolate, Naveia’s delicious plant-based blend, and Bahia orange zest. Features a balanced sweetness and a special citrus touch.\n[V][Dairy-Free][Gluten-Free]"],
      ["chocolate-gelado", "Chocolate Gelado", "Cold Chocolate", 19, "Produzido com chocolate de Origem, deleite Naveia e raspas de laranja bahia. Com doçura equilibrada e um toque cítrico especial.\n[V][SL][SG]", "Made with single-origin chocolate, Naveia’s delicious plant-based blend, and Bahia orange zest. Features a balanced sweetness and a special citrus touch.\n[V][Dairy-Free][Gluten-Free]"],
      ["agua-purificada", "Água purificada", "Water", 6, "Sem gás e gelada. Recipiente retornável, zero plástico, baixa emissão de carbono e triplamente filtragem por sistema de filtragem top de linha.", "Still and cold. Returnable container, zero plastic, low carbon emissions, and triple-filtered using a top-of-the-line filtration system."],
      ["pink-lemonade", "Pink Lemonade", "Pink Lemonade", 15, "Refresco levemente gaseificado de frutas vermelhas e limão siciliano.", "Lightly carbonated red berry and Sicilian lemon refresher."],
      ["ginger-ale-artesanal-da-abiga", "Ginger Ale artesanal da Abiga", "Ginger Ale", 14, "Refresco levemente gaseificado de gengibre e limão siciliano.", "Lightly carbonated ginger and Sicilian lemon refresher."],
      ["refresco", "Refresco", "Refresco", 12, "Refresco fermentado de Jabuticaba, produzido aqui na casa com fermentação espontânea, que o deixa naturalmente gaseificado. Frutado, brasileiríssimo e cheio de probióticos provenientes da fermentação.", "Fermented jabuticaba refreshment, crafted in-house using spontaneous fermentation, which renders it naturally carbonated.\nFruity, quintessentially Brazilian, and packed with probiotics derived from the fermentation process."],
      ["smoothie-vermelho-da-abiga", "Smoothie Vermelho da Abiga", "Abiga's Red Smoothie", 22, "100% fruta, sem adição de água ou açúcar. Maçã, morango, blueberry e amora.", "100% fruit, with no added water or sugar.\nApple, strawberry, blueberry, and blackberry."],
      ["smoothie-amarelo-da-abiga", "Smoothie Amarelo da Abiga", "Abiga's Yellow Smoothie", 22, "100% frutas, sem adição de água e açúcar. Maçã, abacaxi, manga, maracujá e banana.", "100% fruit, with no added water or sugar.\nApple, pineapple, mango, passion fruit, and banana."],
    ],
  },
  {
    id: "AB-drinks",
    name: "Drinks Alcóolicos com (ou sem) café",
    english: "Alcoholic drinks with (or without) coffee",
    image: "categoria-drinks.webp",
    alcoholic: true,
    items: [
      ["chopp-capim-cervejaria-tabuas-473ml", "Chopp Capim - Cervejaria Tábuas 473ml", "Chopp Capim - Tábuas Cervejaria 473ml", 26],
      ["espresso-gin-tonica-rose", "Espresso Gin Tônica Rosé", "Rosé Espresso Gin & Tonic", 34, "Gin, tônica rosè, espreso, com uma fatia de limão siciliano e mirtilo.", "Gin, rosé tonic, and espresso, with a slice of lemon and blueberries."],
      ["espresso-gin-tonica-ginger", "Espresso Gin Tônica Ginger", "Ginger Espresso Gin & Tonic", 34, "Gin. tônica de gengibre,  espresso, com fatia de limão siciliano e gengibre.", "Ginger gin and tonic, espresso, with a slice of Sicilian lemon and ginger."],
      ["coffee-negroni", "Coffee Negroni", "Coffee Negroni", 38, "A nossa releitura deste drink clássico. Gin, Campari, Vermute, Cold Brew (café extraído a frio) e laranja desidratada.", "Our twist on this classic cocktail. Gin, Campari, vermouth, cold brew coffee, and dehydrated orange."],
      ["cold-brewska-amarelo", "Cold Brewska Amarelo", "Yellow Cold Brewska", 34, "Vodka, smoothie amarelo, com café cold brew finalizado com abacaxi.", "Vodka, yellow smoothie, and cold brew coffee, finished with pineapple."],
      ["cold-brewska-vermelho", "Cold Brewska Vermelho", "Red Cold Brewska", 34, "Vodka, smoothie vermelho com café cold brew e finalizado com mirtilo.", "Vodka, red smoothie with cold brew coffee, finished with blueberries."],
      ["coffeerinha", "Coffeerinha", "Coffeerinha", 32, "A receita secreta de caipirinha de café, provada e aprovada por baristas campeões.", "The secret coffee caipirinha recipe, tried and approved by champion baristas."],
    ],
  },
];

/** Category ids in menu order, for the scheduled menus' roots. */
export const ABIGAIL_CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Media file name → file in mock/media/abigail. */
export const ABIGAIL_MEDIA: string[] = [
  ...CATEGORIES.map((c) => c.image),
  ...CATEGORIES.flatMap((c) => c.items.map(([slug]) => `${slug}.webp`)),
];

export function abigailEntities(): Entity[] {
  return CATEGORIES.flatMap((c): Entity[] => [
    {
      id: c.id,
      name: c.name,
      type: "CATEGORY",
      available: true,
      links: [link("IMAGE", c.id), ...c.items.map(([slug]) => link("ITEM", `AB-${slug}`))],
      translations: { en: { name: c.english } },
    },
    { id: c.id, name: c.name, type: "IMAGE", url: `/media/${c.image}`, altText: null, links: [] },
    ...c.items.flatMap(([slug, name, english, price, description, englishDescription]): Entity[] => [
      {
        id: `AB-${slug}`,
        name,
        type: "ITEM",
        price,
        available: true,
        plu: `AB-${slug}`,
        ...(description ? { description } : {}),
        ...(c.alcoholic ? { alcoholic: true, ageRestriction: 18 } : {}),
        links: [link("IMAGE", `AB-${slug}`)],
        translations: { en: englishDescription ? { name: english, description: englishDescription } : { name: english } },
      },
      { id: `AB-${slug}`, name, type: "IMAGE", url: `/media/${slug}.webp`, altText: name, links: [] },
    ]),
  ]);
}
