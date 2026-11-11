// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { findProduct } from "@/lib/kiosk/menu-graph";

import { ItemScreen } from "./item-screen";
import { menu, strings } from "./test-journey";

function renderItem(productId: string) {
  const onSave = vi.fn();
  render(
    <ItemScreen
      product={findProduct(menu, productId)!}
      editing={null}
      strings={strings}
      backLabel="Cardápio"
      onBack={vi.fn()}
      onSave={onSave}
    />,
  );
  return onSave;
}

const add = () => screen.getByRole<HTMLButtonElement>("button", { name: strings["item.addToOrder"] });

describe("ItemScreen (v2 groups)", () => {
  it("asks for a size first and sends it as a pick; the button carries no total", async () => {
    const onSave = renderItem("2001");
    expect(add().disabled).toBe(true);
    expect(add().textContent).toBe(strings["item.addToOrder"]);
    await userEvent.setup().click(screen.getByRole("button", { name: /Grande/ }));
    expect(screen.getByRole("button", { name: /Grande/ }).textContent).toContain("R$ 3,20");
    await userEvent.setup().click(add());
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "2001", picks: [{ groupKey: "2001/2001-SIZE", optionId: "2001-L", quantity: 1 }] }),
    );
  });

  it("starts ingredients picked; taking one out says 'sem'", async () => {
    renderItem("1001");
    const lettuce = screen.getByRole("button", { name: /Alface/ });
    expect(lettuce.getAttribute("aria-pressed")).toBe("true");
    await userEvent.setup().click(lettuce);
    expect(within(lettuce).getByText("sem Alface")).toBeTruthy();
  });

  it("opens a nested group under the option that has one, and requires it", async () => {
    renderItem("1001");
    await userEvent.setup().click(screen.getByRole("button", { name: /Adicionar molho/ }));
    expect(screen.getByRole("heading", { name: "Escolha o molho" })).toBeTruthy();
    expect(add().disabled).toBe(true);
    await userEvent.setup().click(screen.getByRole("button", { name: /Maionese/ }));
    expect(add().disabled).toBe(false);
  });

  it("shows an unavailable option grey, and it cannot be picked", () => {
    renderItem("1001");
    const bacon = screen.getByRole<HTMLButtonElement>("button", { name: /Bacon/ });
    expect(bacon.disabled).toBe(true);
    expect(within(bacon).getByText(strings["item.unavailable"])).toBeTruthy();
  });

  it("needs the main choice and every side of a combo", async () => {
    renderItem("3001");
    const user = userEvent.setup();
    for (const name of [/Hambúrguer vegetariano/, /Batata frita/]) await user.click(screen.getByRole("button", { name }));
    expect(add().disabled).toBe(true);
    await user.click(screen.getByRole("button", { name: /Água sem gás/ }));
    expect(add().disabled).toBe(false);
  });
});
