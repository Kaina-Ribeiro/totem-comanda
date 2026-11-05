// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { BasketLine } from "@/lib/kiosk/menu-view";

import { BasketScreen } from "./basket-screen";
import { type Journey, journeyReducer, quoteKey } from "./journey-state";
import { journeyAt, line, quotedAt, strings } from "./test-journey";

function renderBasket(journey: Journey) {
  const on = {
    onBack: vi.fn(),
    onCancel: vi.fn(),
    onEdit: vi.fn(),
    onQuantity: vi.fn(),
    onRemove: vi.fn(),
    onRetryQuote: vi.fn(),
    onPay: vi.fn(),
  };
  render(<BasketScreen journey={journey} strings={strings} {...on} />);
  return on;
}

/** The basket screen with these lines, before any quote. */
const basketWith = (...lines: BasketLine[]) =>
  journeyAt(...lines.map((l) => ({ type: "addLine" as const, line: l })), { type: "openBasket" });

/** The same journey once the Core API quoted exactly this basket. */
const quoted = (journey: Journey, cents: number) =>
  journeyReducer(journey, quotedAt(journey, cents));

const pay = () => screen.getByRole<HTMLButtonElement>("button", { name: "Escolher como pagar" });

describe("BasketScreen", () => {
  it("lists each line with its display price and shows the Core API's total", () => {
    renderBasket(quoted(basketWith(line("itm-croissant", 2), line("itm-baguete")), 4000));

    expect(screen.getByText("Croissant")).toBeTruthy();
    expect(screen.getByText("Baguete tradicional")).toBeTruthy();
    expect(screen.getByText(/R\$\s*28,00/)).toBeTruthy(); // 2 × 14,00, from the menu
    expect(screen.getByText(/R\$\s*40,00/)).toBeTruthy(); // the quote's total
    expect(pay().disabled).toBe(false);
  });

  it("waits for the quote before paying", () => {
    renderBasket(basketWith(line("itm-croissant")));
    expect(pay().disabled).toBe(true);
  });

  it("pays once the quote is in", async () => {
    const on = renderBasket(quoted(basketWith(line("itm-croissant")), 1400));
    await userEvent.click(pay());
    expect(on.onPay).toHaveBeenCalledOnce();
  });

  it("changes quantity and removes a line", async () => {
    const journey = quoted(basketWith(line("itm-croissant", 2)), 2800);
    const on = renderBasket(journey);

    await userEvent.click(screen.getByRole("button", { name: "Mais" }));
    expect(on.onQuantity).toHaveBeenCalledWith(journey.basket[0], 3);
    await userEvent.click(screen.getByRole("button", { name: "Menos" }));
    expect(on.onQuantity).toHaveBeenCalledWith(journey.basket[0], 1);
    await userEvent.click(screen.getByRole("button", { name: "Remover" }));
    expect(on.onRemove).toHaveBeenCalledWith(journey.basket[0]);
  });

  it("does not go below one unit", () => {
    renderBasket(quoted(basketWith(line("itm-croissant")), 1400));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Menos" }).disabled).toBe(true);
  });

  // COM-112: a line whose item left the menu stays visible, so the guest can remove it.
  it("shows a line whose item left the menu, with Remove", async () => {
    const gone = line("itm-gone");
    const journey = basketWith(gone, line("itm-baguete"));
    const on = renderBasket({
      ...journey,
      quote: {
        key: quoteKey(journey),
        result: { ok: false, code: "ITEM_UNAVAILABLE", detail: "Croissant" },
      },
    });

    const row = screen.getByText("Item indisponível").closest("li")!;
    expect(within(row).getByText("Saiu do cardápio. Remova para continuar.")).toBeTruthy();
    expect(screen.getByText("Croissant acabou de esgotar. Remova para continuar.")).toBeTruthy();
    expect(pay().disabled).toBe(true);

    await userEvent.click(within(row).getByRole("button", { name: "Remover" }));
    expect(on.onRemove).toHaveBeenCalledWith(gone);
  });

  it("offers to try the quote again when it failed", async () => {
    const journey = basketWith(line("itm-croissant"));
    const on = renderBasket({
      ...journey,
      quote: { key: quoteKey(journey), result: { ok: false, code: "CORE_UNAVAILABLE" } },
    });
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(on.onRetryQuote).toHaveBeenCalledOnce();
  });

  it("hides an older basket's quote error (COM-63)", () => {
    const before = basketWith(line("itm-croissant"));
    const stale = { key: quoteKey(before), result: { ok: false as const, code: "CORE_UNAVAILABLE" as const } };
    const after = journeyReducer(before, { type: "lineQuantity", guid: before.basket[0].guid, quantity: 2 });
    renderBasket({ ...after, quote: stale });
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });

  it("shows the empty state without lines", () => {
    renderBasket(journeyAt({ type: "openBasket" }));
    expect(screen.getByText(strings["basket.empty"])).toBeTruthy();
    expect(pay().disabled).toBe(true);
  });
});
