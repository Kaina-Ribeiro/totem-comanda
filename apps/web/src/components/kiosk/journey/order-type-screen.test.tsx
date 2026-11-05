// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OrderTypeScreen } from "./order-type-screen";
import { strings } from "./test-journey";

function renderOrderType(orderTypes: ("DINEIN" | "TAKE_OUT")[] = ["DINEIN", "TAKE_OUT"]) {
  const on = { onBack: vi.fn(), onChoose: vi.fn() };
  render(
    <OrderTypeScreen
      strings={strings}
      orderTypes={orderTypes}
      languageButton={<button type="button">English</button>}
      {...on}
    />,
  );
  return on;
}

describe("OrderTypeScreen", () => {
  it("asks where the guest will eat, with a card for each order type", () => {
    renderOrderType();

    expect(screen.getByRole("heading", { level: 1, name: strings["orderType.title"] })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Comer aqui/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Para viagem/ })).toBeTruthy();
    expect(screen.getByText(strings["orderType.TAKE_OUT.body"])).toBeTruthy();
  });

  it("calls back with DINEIN when the guest eats in", async () => {
    const on = renderOrderType();

    await userEvent.click(screen.getByRole("button", { name: /Comer aqui/ }));
    expect(on.onChoose).toHaveBeenCalledWith("DINEIN");
  });

  it("calls back with TAKE_OUT when the guest takes away", async () => {
    const on = renderOrderType();

    await userEvent.click(screen.getByRole("button", { name: /Para viagem/ }));
    expect(on.onChoose).toHaveBeenCalledWith("TAKE_OUT");
  });

  it("offers only the order types the restaurant serves", () => {
    renderOrderType(["TAKE_OUT"]);

    expect(screen.queryByRole("button", { name: /Comer aqui/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Para viagem/ })).toBeTruthy();
  });

  it("goes back to the start and keeps the language switch", async () => {
    const on = renderOrderType();

    expect(screen.getByRole("button", { name: "English" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: strings["nav.home"] }));
    expect(on.onBack).toHaveBeenCalledOnce();
  });
});
