// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BasketScreen } from "./basket-screen";
import { type Journey, journeyReducer, totalsKey } from "./journey-state";
import { journeyAt, line, pricedAt, strings } from "./test-journey";

function renderBasket(journey: Journey) {
  const on = {
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onEdit: vi.fn(),
    onQuantity: vi.fn(),
    onRemove: vi.fn(),
    onRetryTotals: vi.fn(),
    onPay: vi.fn(),
  };
  render(<BasketScreen journey={journey} strings={strings} {...on} />);
  return on;
}

const burger = {
  ...line("1001", 2),
  picks: [{ groupKey: "1001/M-EXTRAS", optionId: "X-CHEESE", quantity: 2 }],
};
const unit = (id: string, total: number) => ({ id, quantity: 1, total });

describe("BasketScreen (v2)", () => {
  it("shows Go's unit price per line, its total and the discount", () => {
    const journey = journeyAt({ type: "addLine", line: burger }, { type: "swapDone" }, { type: "crossSellDismissed" }, { type: "openBasket" });
    renderBasket(
      journeyReducer(
        journey,
        pricedAt(journey, 20.7, {
          subTotal: 23,
          discount: 2.3,
          orderItems: [unit("1001", 11.5), unit("1001", 11.5)],
          discounts: [{ id: "BEMVINDO10", name: "10% de boas-vindas", value: 2.3 }],
        }),
      ),
    );
    expect(screen.getByText(/^2 × R\$\s11,50$/)).toBeTruthy();
    expect(screen.getByText(/2× Queijo extra/)).toBeTruthy();
    expect(screen.getByText(/^R\$\s20,70$/)).toBeTruthy();
    expect(screen.getByText("10% de boas-vindas")).toBeTruthy();
  });

  it("keeps the other lines' last prices while a removal is re-priced", () => {
    const journey = journeyAt(
      { type: "addLine", line: burger },
      { type: "swapDone" },
      { type: "crossSellDismissed" },
      { type: "addLine", line: line("2010") },
      { type: "openBasket" },
    );
    const priced = journeyReducer(
      journey,
      pricedAt(journey, 31, { orderItems: [unit("1001", 11.5), unit("1001", 11.5), unit("2010", 8)] }),
    );
    renderBasket(journeyReducer(priced, { type: "removeLine", guid: burger.guid }));
    const price = screen.getByText(/^R\$\s8,00$/);
    expect(price.className).not.toContain("opacity-0");
    expect(screen.getByText(strings["basket.updating"])).toBeTruthy();
    expect(screen.queryByText(/11,50/)).toBeNull();
  });

  it("pays only once Go priced this basket", () => {
    const journey = journeyAt({ type: "addLine", line: line("2010") }, { type: "crossSellDismissed" }, { type: "openBasket" });
    renderBasket(journey);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: strings["basket.pay"] }).disabled).toBe(true);
    expect(screen.getByText(strings["basket.updating"])).toBeTruthy();
  });

  it("names the item Go says is unavailable", () => {
    const journey = journeyAt({ type: "addLine", line: line("2010") }, { type: "crossSellDismissed" }, { type: "openBasket" });
    renderBasket(
      journeyReducer(journey, {
        type: "priced",
        key: totalsKey(journey),
        result: { ok: false, code: "ITEM_UNAVAILABLE", detail: "2010" },
      }),
    );
    expect(screen.getByText("Chope (pint) acabou de esgotar. Remova para continuar.")).toBeTruthy();
  });
});
