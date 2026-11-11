// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CrossSellSheet } from "./cross-sell-sheet";
import { line, menu, strings } from "./test-journey";

describe("CrossSellSheet (crossSellIds)", () => {
  it("opens the builder for a suggestion that needs a choice (a size)", async () => {
    const on = { onAccept: vi.fn(), onChoose: vi.fn(), onDismiss: vi.fn() };
    render(<CrossSellSheet menu={menu} productId="1001" basket={[line("1001")]} strings={strings} {...on} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Refrigerante de cola/ }));
    expect(on.onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: "2001" }));
  });

  it("shows nothing when every suggestion is already in the basket", () => {
    const { container } = render(
      <CrossSellSheet
        menu={menu}
        productId="1001"
        basket={[line("1001"), line("2001")]}
        strings={strings}
        onAccept={vi.fn()}
        onChoose={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });
});
