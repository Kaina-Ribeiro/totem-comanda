// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Menu, OrderType } from "@/lib/kiosk/menu-view";

import { CrossSellSheet } from "./cross-sell-sheet";
import { menu, strings } from "./test-journey";

function renderSheet({
  theMenu = menu,
  groupId = "xs-cafes",
  orderType = "TAKE_OUT",
}: { theMenu?: Menu; groupId?: string; orderType?: OrderType } = {}) {
  const on = { onAccept: vi.fn(), onDismiss: vi.fn() };
  const utils = render(
    <CrossSellSheet
      menu={theMenu}
      groupId={groupId}
      orderType={orderType}
      strings={strings}
      {...on}
    />,
  );
  return { ...utils, on };
}

const pressed = (name: string | RegExp) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed") === "true";

describe("CrossSellSheet", () => {
  it("suggests the group's items with their price for this order", () => {
    renderSheet();

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Que tal um café?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Cappuccino/ }).textContent).toMatch(
      /R\$\s*13,90/,
    );
    expect(screen.getByRole("button", { name: /^Café com leite/ }).textContent).toMatch(
      /R\$\s*12,90/,
    );
  });

  it("keeps the add button disabled until an item is picked", async () => {
    const { on } = renderSheet();
    const add = () => screen.getByRole<HTMLButtonElement>("button", { name: /Escolha pelo menos um/ });

    expect(add().disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^Cappuccino/ }));
    expect(pressed(/^Cappuccino/)).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Adicionar ao pedido" }).disabled)
      .toBe(false);
    expect(on.onAccept).not.toHaveBeenCalled();
  });

  it("adds the picked items with their default choices, as ids only", async () => {
    const { on } = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: /^Cappuccino/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Café com leite/ }));
    await userEvent.click(screen.getByRole("button", { name: "Adicionar ao pedido" }));

    expect(on.onAccept).toHaveBeenCalledWith([
      {
        guid: expect.any(String),
        itemId: "itm-cappuccino",
        quantity: 1,
        options: [{ optionId: "opt-leite-integral", quantity: 1 }],
      },
      {
        guid: expect.any(String),
        itemId: "itm-latte",
        quantity: 1,
        options: [{ optionId: "opt-leite-integral-latte", quantity: 1 }],
      },
    ]);
  });

  it("dismisses the suggestion with No, thanks", async () => {
    const { on } = renderSheet();

    await userEvent.click(screen.getByRole("button", { name: "Não, obrigado" }));
    expect(on.onDismiss).toHaveBeenCalledOnce();
    expect(on.onAccept).not.toHaveBeenCalled();
  });

  it("hides suggestions the order type does not serve", () => {
    const withDrink = {
      ...menu,
      crossSellGroups: [
        { id: "xs-beber", name: "Algo para beber?", crossSells: ["itm-refrigerante", "itm-agua"] },
      ],
    };

    const { unmount } = renderSheet({ theMenu: withDrink, groupId: "xs-beber", orderType: "TAKE_OUT" });
    expect(screen.queryByRole("button", { name: /^Refrigerante de garrafa/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Água sem gás/ })).toBeTruthy();
    unmount();

    renderSheet({ theMenu: withDrink, groupId: "xs-beber", orderType: "DINEIN" });
    expect(screen.getByRole("button", { name: /^Refrigerante de garrafa/ })).toBeTruthy();
  });

  it("renders nothing when the group is unknown", () => {
    const { container } = renderSheet({ groupId: "xs-inexistente" });
    expect(container.innerHTML).toBe("");
  });
});
