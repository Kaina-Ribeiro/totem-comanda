// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PlacedOrder } from "@/app/kiosk/actions";

import { SuccessScreen } from "./success-screen";
import { strings } from "./test-journey";

const placed = (overrides: Partial<PlacedOrder> = {}): PlacedOrder => ({
  orderId: "ord-1",
  posCheckNumber: "42",
  waitTime: 8,
  status: "PREPARING",
  ...overrides,
});

function renderSuccess(placedOrder: PlacedOrder, displayLength = 3) {
  const onDone = vi.fn();
  render(
    <SuccessScreen
      placed={placedOrder}
      displayLength={displayLength}
      strings={strings}
      onDone={onDone}
    />,
  );
  return { onDone };
}

/** Moves the fake clock forward, letting the countdown run. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe("SuccessScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the Core API's order number, big, after the payment tag", () => {
    renderSuccess(placed({ posCheckNumber: "42" }));

    expect(screen.getByText(strings["success.tag"])).toBeTruthy();
    expect(screen.getByText(strings["success.lead"])).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("shows only the last digits of a long number, as the guest sees it (BR-POST-01)", () => {
    renderSuccess(placed({ posCheckNumber: "1042" }), 3);
    expect(screen.getByText("042")).toBeTruthy();
    expect(screen.queryByText("1042")).toBeNull();
  });

  it("says how long the wait is when the Core API gives it", () => {
    renderSuccess(placed({ waitTime: 8 }));
    expect(screen.getByText("Fica pronto em cerca de 8 min.")).toBeTruthy();
  });

  it("leaves out the wait line when there is no wait time", () => {
    renderSuccess(placed({ waitTime: null }));
    expect(screen.queryByText(/Fica pronto/)).toBeNull();
  });

  it("counts down to the start and returns there by itself after 15 s", async () => {
    const { onDone } = renderSuccess(placed());
    expect(screen.getByRole("button", { name: /Volta ao início em 15 s/ })).toBeTruthy();

    await advance(14_000);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Volta ao início em 1 s/ })).toBeTruthy();

    await advance(1_000);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("goes back to the start when the guest taps Concluir", async () => {
    const { onDone } = renderSuccess(placed());
    await userEvent
      .setup({ advanceTimers: vi.advanceTimersByTime })
      .click(screen.getByRole("button", { name: /Concluir/ }));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
