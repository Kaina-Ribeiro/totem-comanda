// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { journeyReducer } from "./journey-state";
import { MenuScreen } from "./menu-screen";
import { journeyAt, line, pricedAt, strings } from "./test-journey";

function renderMenu(journey = journeyAt()) {
  const on = { onOpenProduct: vi.fn(), onAddProduct: vi.fn() };
  render(
    <MenuScreen
      brand="Padaria Teste"
      journey={journey}
      strings={strings}
      onPickSection={vi.fn()}
      {...on}
      onOpenBasket={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return on;
}

describe("MenuScreen (v2)", () => {
  it("lists the top sections on the rail and a sub-section under its heading", () => {
    renderMenu();
    const rail = screen.getByRole("navigation", { name: "Categorias" });
    expect(within(rail).getAllByRole("button").map((b) => b.textContent)).toEqual(["Hambúrgueres", "Bebidas", "Combos"]);
    expect(screen.getByRole("heading", { name: "Vegetarianos" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar Hambúrguer vegetariano" })).toBeTruthy();
  });

  it("opens the product from its card and adds it only from the +", () => {
    const on = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Hambúrguer vegetariano" }));
    expect(on.onOpenProduct).toHaveBeenCalledTimes(1);
    expect(on.onAddProduct).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar Hambúrguer vegetariano" }));
    expect(on.onAddProduct).toHaveBeenCalledTimes(1);
    expect(on.onOpenProduct).toHaveBeenCalledTimes(1);
  });

  it("uses Go's displayPrice as 'A partir de'", () => {
    renderMenu(journeyAt({ type: "pickSection", sectionId: "200" }));
    expect(screen.getByText(/^A partir de R\$\s2,50$/)).toBeTruthy();
  });

  it("shows Go's total on the bar, greyed while the basket is re-priced", () => {
    const one = journeyAt({ type: "addLine", line: line("2010") }, { type: "crossSellDismissed" });
    const priced = journeyReducer(one, pricedAt(one, 5.2));
    const two = journeyReducer(priced, { type: "lineQuantity", guid: "line-2010", quantity: 2 });
    renderMenu(two);
    const total = screen.getByText(/^R\$\s5,20$/);
    expect(total.className).toContain("opacity-50");
    expect(screen.getByText("2 itens")).toBeTruthy();
  });
});
