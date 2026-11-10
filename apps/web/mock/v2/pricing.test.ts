import { beforeEach, describe, expect, it } from "vitest";

import { applyScenario } from "../state";
import { key, type S } from "./http";
import { applyDiscount, createTotals } from "./orders";
import { allocate, priceBasket } from "./pricing";
import { v2 } from "./state";

const DEVICE = "KIOSK-TBT-001";
const totalsOf = (items: S["OrderItem"][]) => {
  const priced = priceBasket({ orderType: "DINEIN", items }, "pt-BR", null, "B-test");
  if ("error" in priced) throw new Error(JSON.stringify(priced.error.body));
  return priced.totals;
};
const errorOf = (items: S["OrderItem"][]) => {
  const priced = priceBasket({ orderType: "DINEIN", items }, "pt-BR", null, "B-test");
  return "error" in priced ? (priced.error.body as S["Problem"]) : null;
};

const burgerWithExtras: S["OrderItem"] = {
  id: "1001",
  quantity: 1,
  uniqueId: 1,
  modifiers: [
    { id: "X-CHEESE", quantity: 2, uniqueId: 2, parentId: 1, position: 1 },
    { id: "X-SAUCE", quantity: 1, uniqueId: 3, parentId: 1, position: 3 },
    { id: "S-BBQ", quantity: 1, uniqueId: 4, parentId: 3, position: 1 },
  ],
};
const largeCola: S["OrderItem"] = {
  id: "2001",
  quantity: 1,
  uniqueId: 5,
  modifiers: [{ id: "2001-L", quantity: 1, uniqueId: 6, parentId: 5, position: 2, modifierType: "SIZE" }],
};
const mealWithSalad: S["OrderItem"] = {
  id: "3001",
  quantity: 1,
  uniqueId: 7,
  modifiers: [
    { id: "C-1001", quantity: 1, uniqueId: 8, parentId: 7, position: 1 },
    { id: "C-SALAD", quantity: 1, uniqueId: 9, parentId: 7, position: 2 },
    { id: "C-COLA", quantity: 1, uniqueId: 10, parentId: 7, position: 1 },
  ],
};

describe("priceBasket", () => {
  beforeEach(() => applyScenario("afternoon"));

  it("totals price the 5.20 menu", () => {
    const totals = totalsOf([burgerWithExtras, largeCola, mealWithSalad]);
    expect(totals).toMatchObject({ subTotal: 28.15, discount: 0, tax: 0, total: 28.15, taxes: [] });
    expect(totals.orderItems!.map((l) => l.total)).toEqual([11.5, 3.2, 13.45]);
    expect(totals.orderItems![0].modifiers![1].modifiers![0]).toMatchObject({ id: "S-BBQ", name: "Molho barbecue" });
  });

  it("an unavailable option is ITEM_UNAVAILABLE", () => {
    const bacon = { ...burgerWithExtras, modifiers: [{ id: "X-BACON", quantity: 1, uniqueId: 2, parentId: 1 }] };
    expect(errorOf([bacon])).toMatchObject({ code: "ITEM_UNAVAILABLE", detail: "X-BACON" });
  });

  it("a sized item without a size, or a required group left empty, is VALIDATION_FAILED", () => {
    expect(errorOf([{ id: "2001", quantity: 1, uniqueId: 1 }])?.code).toBe("VALIDATION_FAILED");
    expect(errorOf([{ id: "3001", quantity: 1, uniqueId: 1 }])?.code).toBe("VALIDATION_FAILED");
  });

  it("only dine-in", () => {
    const priced = priceBasket({ orderType: "TAKE_OUT", items: [largeCola] }, "pt-BR", null, "B");
    expect("error" in priced && (priced.error.body as S["Problem"]).code).toBe("ORDER_TYPE_UNAVAILABLE");
  });

  it("no float noise", () => {
    (v2().entities.get(key("ITEM", "2010")) as S["PosEntityItem"]).price = 0.1;
    const lager = (uniqueId: number): S["OrderItem"] => ({ id: "2010", quantity: 1, uniqueId });
    expect(totalsOf([lager(1), lager(2), lager(3)]).subTotal).toBe(0.3);
  });
});

describe("coupons", () => {
  beforeEach(() => applyScenario("afternoon"));

  it("a percent coupon rounds per line half up", () => {
    const burger: S["OrderItem"] = { id: "1001", quantity: 1, uniqueId: 1 };
    const created = createTotals({ orderType: "DINEIN", items: [burger, largeCola] }, DEVICE, "pt-BR");
    const { basketId } = created.body as S["TotalsResponse"];
    const reply = applyDiscount(
      { basketId, orderType: "DINEIN", items: [burger, largeCola], awards: [{ id: "bemvindo10", type: "CODE" }] },
      DEVICE,
      "pt-BR",
    );
    expect(reply.body).toMatchObject({ awards: [{ id: "BEMVINDO10", discountAmount: 1.27 }] });
    expect(v2().baskets.get(basketId)!.totals).toMatchObject({ subTotal: 12.7, discount: 1.27, total: 11.43 });
  });

  it("a coupon below its minimum order is DISCOUNT_INVALID; a used-up one is DISCOUNT_LIMIT_REACHED", () => {
    const items: S["OrderItem"][] = [{ id: "1001", quantity: 1, uniqueId: 1 }];
    const { basketId } = createTotals({ orderType: "DINEIN", items }, DEVICE, "pt-BR").body as S["TotalsResponse"];
    const apply = (code: string) =>
      applyDiscount({ basketId, orderType: "DINEIN", items, awards: [{ id: code, type: "CODE" }] }, DEVICE, "pt-BR");
    expect(apply("CAFE5").body).toMatchObject({ code: "DISCOUNT_INVALID", detail: "Pedido mínimo de R$ 20,00" });
    expect(apply("LIMITADO").body).toMatchObject({ code: "DISCOUNT_LIMIT_REACHED" });
  });

  it("allocate splits by largest remainder", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(500, [950, 320])).toEqual([374, 126]);
  });
});
