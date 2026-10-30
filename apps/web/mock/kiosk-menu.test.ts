import { describe, expect, it } from "vitest";

import { seedCatalogue } from "./catalogue.ts";
import { priceBasket, PricingError, resolveMenu } from "./kiosk-menu.ts";

const restaurant = { isDineInAvailable: true, isTakeOutAvailable: true };
const ctx = { today: "2026-10-30", at: new Date("2026-10-30T12:00:00Z"), language: "pt-BR" as const };
const morning = { id: "mnu-manha", name: { "pt-BR": "Manhã" }, showCategoriesPrice: false };

// The prototype's basket (docs/prototype/README.md).
const basket = [
  {
    guid: "3f0c9a52-6f0e-4d7b-9c61-0d1f4b7f2a10",
    itemId: "itm-croque-monsieur",
    quantity: 1,
    options: [
      { optionId: "opt-pao-brioche", quantity: 1 },
      { optionId: "opt-ovo-poche", quantity: 1 },
    ],
  },
  {
    guid: "8b2d1c47-2a6e-4f53-8d0b-5e9a7c3f1b22",
    itemId: "itm-cappuccino",
    quantity: 1,
    options: [{ optionId: "opt-leite-integral", quantity: 1 }],
  },
  {
    guid: "c51e7a90-4b3d-4c8e-a2f6-9d0b1e3c5f44",
    itemId: "itm-fermentacao-natural",
    quantity: 1,
    options: [{ optionId: "opt-inteiro-fatiado", quantity: 1 }],
  },
];

const price = (input: Partial<Parameters<typeof priceBasket>[0]>, catalogue = seedCatalogue()) =>
  priceBasket(
    { menuId: "mnu-manha", orderType: "TAKE_OUT", orderItems: basket, ...input },
    catalogue,
    restaurant,
    ctx,
  );

const codeOf = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof PricingError) return error.code;
    throw error;
  }
  return null;
};

describe("resolveMenu", () => {
  it("resolves the morning menu in the requested language", () => {
    const menu = resolveMenu(morning, seedCatalogue(), "en", ctx.today);
    expect(menu.entities.map((c) => c.name)).toEqual([
      "Breads",
      "Sweets",
      "Savoury",
      "Sandwiches",
      "Coffee",
      "Drinks",
    ]);
    expect(menu.entities[0].childEntities[0]).toMatchObject({ name: "Sourdough", price: 2800 });
  });

  it("leaves out items sold out today, and categories left empty", () => {
    const catalogue = seedCatalogue();
    for (const item of catalogue.items) {
      if (["itm-pao-de-queijo", "itm-coxinha", "itm-empada"].includes(item.id)) {
        item.soldOutDate = ctx.today;
      }
    }
    const menu = resolveMenu(morning, catalogue, "pt-BR", ctx.today);
    expect(menu.entities.map((c) => c.id)).not.toContain("cat-salgados");
  });
});

describe("priceBasket", () => {
  it("prices the prototype basket at R$ 82,80", () => {
    const { total, lines } = price({});
    expect(lines.map((l) => l.lineTotal)).toEqual([4090, 1390, 2800]);
    expect(total).toMatchObject({ subtotal: 8280, discountTotal: 0, total: 8280 });
  });

  it("applies BEMVINDO10 as 10%", () => {
    const { total } = price({ discountCode: "bemvindo10" });
    expect(total).toMatchObject({ discountTotal: 828, total: 7452 });
    expect(total.discount?.value).toBe("BEMVINDO10");
  });

  it("rejects expired coupons, missing required choices and items off the order type", () => {
    expect(codeOf(() => price({ discountCode: "NATAL2025" }))).toBe("INVALID_COUPON");
    expect(
      codeOf(() =>
        price({ orderItems: [{ ...basket[0], options: [{ optionId: "opt-ovo-poche", quantity: 1 }] }] }),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(
      codeOf(() =>
        price({ orderItems: [{ guid: "x", itemId: "itm-refrigerante", quantity: 1, options: [] }] }),
      ),
    ).toBe("ITEM_UNAVAILABLE");
  });

  it("uses the menu's price override", () => {
    const { lines } = price({
      menuId: "mnu-tarde",
      orderItems: [basket[1]],
    });
    expect(lines[0].unitPrice).toBe(1490);
  });
});
