// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { type BasketLine, findItem, type MenuEntity, type OrderType } from "@/lib/kiosk/menu-view";

import { ItemScreen } from "./item-screen";
import { line, menu, strings } from "./test-journey";

// Croque monsieur: a required bread (Brioche by default), up to 3 extras,
// and two composite ingredients (Bechamel and Presunto, both kept by default).
const croque = findItem(menu, "itm-croque-monsieur")!;

function renderItem({
  item = croque,
  editing = null,
  orderType = "TAKE_OUT",
}: { item?: MenuEntity; editing?: BasketLine | null; orderType?: OrderType } = {}) {
  const on = { onSave: vi.fn(), onBack: vi.fn() };
  render(
    <ItemScreen
      menu={menu}
      item={item}
      editing={editing}
      orderType={orderType}
      strings={strings}
      backLabel={strings["nav.menu"]}
      {...on}
    />,
  );
  return on;
}

const addButton = () => screen.getByRole<HTMLButtonElement>("button", { name: /^Adicionar/ });
const pressed = (name: string | RegExp) =>
  screen.getByRole("button", { name }).getAttribute("aria-pressed") === "true";

describe("ItemScreen", () => {
  it("shows the item, its price and the defaults, ready to add", async () => {
    const on = renderItem();

    expect(screen.getByRole("heading", { level: 1, name: "Croque monsieur" })).toBeTruthy();
    expect(pressed("Brioche")).toBe(true);
    expect(addButton().disabled).toBe(false);
    expect(addButton().textContent).toMatch(/R\$\s*34,90/);

    await userEvent.click(screen.getByRole("button", { name: strings["nav.menu"] }));
    expect(on.onBack).toHaveBeenCalledOnce();
  });

  it("moves the live total with the chosen extras", async () => {
    renderItem();

    await userEvent.click(screen.getByRole("button", { name: /^Ovo pochê/ }));
    expect(addButton().textContent).toMatch(/R\$\s*40,90/); // 34,90 + 6,00
    await userEvent.click(screen.getByRole("button", { name: /^Presunto de parma/ }));
    expect(addButton().textContent).toMatch(/R\$\s*49,90/); // + 9,00
    await userEvent.click(screen.getByRole("button", { name: /^Ovo pochê/ }));
    expect(addButton().textContent).toMatch(/R\$\s*43,90/); // egg removed again
  });

  it("multiplies the total by the quantity", async () => {
    renderItem();

    await userEvent.click(screen.getByRole("button", { name: "Mais" }));
    expect(addButton().textContent).toMatch(/R\$\s*69,80/); // 2 × 34,90
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Menos" }).disabled).toBe(false);
  });

  it("adds a line with ids and quantities only, never a price", async () => {
    const on = renderItem();

    await userEvent.click(screen.getByRole("button", { name: "Mais" }));
    await userEvent.click(screen.getByRole("button", { name: /^Ovo pochê/ }));
    await userEvent.click(addButton());

    expect(on.onSave).toHaveBeenCalledWith({
      guid: expect.any(String),
      itemId: "itm-croque-monsieur",
      quantity: 2,
      options: [
        { optionId: "opt-pao-brioche", quantity: 1 },
        { optionId: "opt-ovo-poche", quantity: 1 },
      ],
    });
  });

  it("blocks add until a required choice is made, then accepts a single choice", async () => {
    // Same item without a default bread, so the required group starts empty.
    const unpicked = structuredClone(croque);
    const bread = unpicked.optionGroups!.find((g) => g.id === "grp-pao")!;
    bread.defaultOption = null;
    bread.options[0].defaultQuantity = 0;
    const on = renderItem({ item: unpicked });

    expect(addButton().disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Fermentação" }));
    expect(pressed("Fermentação")).toBe(true);
    expect(addButton().disabled).toBe(false);

    await userEvent.click(addButton());
    expect(on.onSave.mock.calls[0][0].options).toEqual([
      { optionId: "opt-pao-fermentacao", quantity: 1 },
    ]);
  });

  it("stops at the group maximum of extras", async () => {
    renderItem();

    await userEvent.click(screen.getByRole("button", { name: /^Ovo pochê/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Presunto de parma/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Gruyère extra/ }));

    expect(screen.getByText("3 de 3")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: /^Mostarda dijon/ }).disabled).toBe(
      true,
    );
  });

  it("removes an ingredient and sends it only as a change from the default", async () => {
    const on = renderItem();

    // The ham toggle is named "Presunto", then "Presunto Sem presunto" once removed.
    const ham = /^Presunto( Sem presunto)?$/;
    await userEvent.click(screen.getByRole("button", { name: ham }));
    expect(pressed(/^Presunto Sem presunto$/)).toBe(false);
    expect(screen.getByText("Sem presunto")).toBeTruthy();

    await userEvent.click(addButton());
    expect(on.onSave.mock.calls[0][0].options).toEqual([
      { optionId: "opt-pao-brioche", quantity: 1 },
      { optionId: "opt-sem-presunto", quantity: 1 },
    ]);
  });

  it("edits an existing line: the button saves under the same guid", async () => {
    const existing = {
      ...line("itm-croque-monsieur", 2, "guid-42"),
      options: [{ optionId: "opt-pao-ciabatta", quantity: 1 }],
    };
    const on = renderItem({ editing: existing });

    expect(screen.queryByRole("button", { name: /^Adicionar/ })).toBeNull();
    expect(pressed("Ciabatta")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: /^Atualizar/ }));
    expect(on.onSave).toHaveBeenCalledWith({
      guid: "guid-42",
      itemId: "itm-croque-monsieur",
      quantity: 2,
      options: [{ optionId: "opt-pao-ciabatta", quantity: 1 }],
    });
  });
});
