// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdleGuard } from "./idle-guard";
import { strings } from "./test-journey";

const TIMEOUT_MS = 30_000;

function renderGuard(overrides: { active?: boolean; timeoutMs?: number } = {}) {
  const on = { onTimeout: vi.fn(), onCancel: vi.fn() };
  render(
    <IdleGuard
      active={overrides.active ?? true}
      timeoutMs={overrides.timeoutMs ?? TIMEOUT_MS}
      strings={strings}
      {...on}
    />,
  );
  return on;
}

/** Moves the fake clock forward, letting the component's timers run. */
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

const warning = () => screen.queryByRole("alertdialog");

describe("IdleGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  it("stays quiet before the timeout", async () => {
    renderGuard();
    await advance(TIMEOUT_MS - 1_000);
    expect(warning()).toBeNull();
  });

  it("asks whether the guest is still there, with a countdown of the same length", async () => {
    renderGuard();
    await advance(TIMEOUT_MS);

    const dialog = screen.getByRole("alertdialog", { name: strings["idle.title"] });
    expect(dialog).toBeTruthy();
    expect(screen.getByText(strings["idle.body"])).toBeTruthy();
    expect(screen.getByText(String(TIMEOUT_MS / 1000))).toBeTruthy();
  });

  it("closes on continue and restarts the idle clock", async () => {
    renderGuard();
    await advance(TIMEOUT_MS);

    await user().click(screen.getByRole("button", { name: strings["idle.continue"] }));
    expect(warning()).toBeNull();

    await advance(TIMEOUT_MS - 1_000);
    expect(warning()).toBeNull();
    await advance(2_000);
    expect(warning()).toBeTruthy();
  });

  it("a touch or key press before the timeout postpones the warning", async () => {
    renderGuard();
    await advance(20_000);
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
    });

    await advance(20_000); // 40 s since start, but only 20 s since the touch
    expect(warning()).toBeNull();
    await advance(10_000);
    expect(warning()).toBeTruthy();
  });

  it("calls onTimeout when the countdown runs out, and nothing else", async () => {
    const on = renderGuard();
    await advance(TIMEOUT_MS);
    await advance(TIMEOUT_MS);

    expect(on.onTimeout).toHaveBeenCalledOnce();
    expect(on.onCancel).not.toHaveBeenCalled();
    expect(warning()).toBeNull();
  });

  it("cancels the order when the guest chooses to cancel", async () => {
    const on = renderGuard();
    await advance(TIMEOUT_MS);

    await user().click(screen.getByRole("button", { name: strings["idle.cancel"] }));
    expect(on.onCancel).toHaveBeenCalledOnce();
    expect(on.onTimeout).not.toHaveBeenCalled();
    expect(warning()).toBeNull();
  });

  it("does not check for idleness while inactive (attract, payment, success)", async () => {
    const on = renderGuard({ active: false });
    await advance(TIMEOUT_MS * 2);

    expect(warning()).toBeNull();
    expect(on.onTimeout).not.toHaveBeenCalled();
  });

  it("never warns when the timeout is 0 (idle checking off)", async () => {
    renderGuard({ timeoutMs: 0 });
    await advance(TIMEOUT_MS * 2);
    expect(warning()).toBeNull();
  });
});
