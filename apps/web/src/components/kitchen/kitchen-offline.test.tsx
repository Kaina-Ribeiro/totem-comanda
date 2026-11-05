// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { KitchenOffline, KITCHEN_RETRY_MS } = await import("./kitchen-offline");

describe("KitchenOffline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("says the kitchen has no connection", () => {
    render(<KitchenOffline />);
    expect(screen.getByText("Cozinha sem conexão")).toBeTruthy();
    expect(screen.getByText("Tentando de novo em instantes.")).toBeTruthy();
  });

  // COM-120: the screen promised a retry but never made one.
  it("tries the board again by itself, every few seconds", () => {
    render(<KitchenOffline />);
    expect(refresh).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(KITCHEN_RETRY_MS));
    expect(refresh).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(KITCHEN_RETRY_MS));
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});
