// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type Journey } from "./journey-state";
import { MenuScreen } from "./menu-screen";
import { journeyAt, line, strings } from "./test-journey";

function renderMenu(journey: Journey, { canChangeOrderType = true } = {}) {
  const on = {
    onChangeOrderType: vi.fn(),
    onPickCategory: vi.fn(),
    onPickItem: vi.fn(),
    onOpenBasket: vi.fn(),
    onCancel: vi.fn(),
  };
  const utils = render(
    <MenuScreen
      brand="Padaria Teste"
      journey={journey}
      strings={strings}
      canChangeOrderType={canChangeOrderType}
      {...on}
    />,
  );
  return { ...utils, on };
}

const categoryNav = () => screen.getByRole("navigation", { name: "Categorias" });
const basketBar = () => screen.getByRole<HTMLButtonElement>("button", { name: /Ver meu pedido/ });

describe("MenuScreen", () => {
  it("opens the first category by default and lists its items", () => {
    renderMenu(journeyAt());

    expect(screen.getByRole("heading", { level: 1, name: "Pães" })).toBeTruthy();
    expect(within(categoryNav()).getAllByRole("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Adicionar Baguete tradicional" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar Croissant" })).toBeTruthy();
  });

  it("calls back with the category id when the guest picks another category", async () => {
    const { on } = renderMenu(journeyAt());

    await userEvent.click(within(categoryNav()).getByRole("button", { name: "Doces" }));
    expect(on.onPickCategory).toHaveBeenCalledWith("cat-doces");
  });

  it("shows the category open in the journey, marked as pressed", () => {
    renderMenu(journeyAt({ type: "pickCategory", categoryId: "cat-bebidas" }));

    expect(screen.getByRole("heading", { level: 1, name: "Bebidas" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar Suco de laranja" })).toBeTruthy();
    const drinks = within(categoryNav()).getByRole("button", { name: "Bebidas" });
    expect(drinks.getAttribute("aria-pressed")).toBe("true");
  });

  it("hides items not served for the order type", () => {
    const drinks = journeyAt({ type: "pickCategory", categoryId: "cat-bebidas" });

    const takeOut = renderMenu(drinks);
    expect(screen.queryByRole("button", { name: "Adicionar Refrigerante de garrafa" })).toBeNull();
    takeOut.unmount();

    renderMenu({ ...drinks, orderType: "DINEIN" });
    expect(screen.getByRole("button", { name: "Adicionar Refrigerante de garrafa" })).toBeTruthy();
  });

  it("calls back with the item when its Adicionar button is pressed", async () => {
    const { on } = renderMenu(journeyAt());

    await userEvent.click(screen.getByRole("button", { name: "Adicionar Croissant" }));
    expect(on.onPickItem).toHaveBeenCalledWith(
      expect.objectContaining({ id: "itm-croissant", name: "Croissant" }),
    );
  });

  it("disables the basket bar while empty", () => {
    renderMenu(journeyAt());
    expect(basketBar().disabled).toBe(true);
    expect(screen.getByText(strings["basketBar.empty"])).toBeTruthy();
  });

  it("shows the units and the display total, and opens the basket", async () => {
    const { on } = renderMenu(journeyAt({ type: "addLine", line: line("itm-croissant", 2) }));

    expect(basketBar().textContent).toContain("2 itens");
    expect(basketBar().textContent).toMatch(/R\$\s*28,00/); // 2 × 14,00, display only
    await userEvent.click(basketBar());
    expect(on.onOpenBasket).toHaveBeenCalledOnce();
  });

  it("offers the order type change and the cancel button", async () => {
    const { on } = renderMenu(journeyAt());

    await userEvent.click(screen.getByRole("button", { name: /Para viagem/ }));
    expect(on.onChangeOrderType).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar pedido" }));
    expect(on.onCancel).toHaveBeenCalledOnce();
  });

  it("disables the order type button when the restaurant offers only one", () => {
    renderMenu(journeyAt(), { canChangeOrderType: false });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: /Para viagem/ }).disabled).toBe(
      true,
    );
  });
});
