// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SuccessScreen } from "./success-screen";
import { placed, strings } from "./test-journey";

const NOTICE = "Se quiser nota fiscal, dirija-se ao caixa.";

describe("SuccessScreen", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows Go's customerCheckNumber, the wait and the invoice notice", () => {
    render(<SuccessScreen placed={placed} waitMinutes={8} invoiceNotice={NOTICE} strings={strings} onDone={vi.fn()} />);
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Fica pronto em cerca de 8 min.")).toBeTruthy();
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it("leaves the wait out when the store has none for its pace", () => {
    render(<SuccessScreen placed={placed} waitMinutes={null} invoiceNotice={NOTICE} strings={strings} onDone={vi.fn()} />);
    expect(screen.queryByText(/Fica pronto/)).toBeNull();
  });

  it("goes back to the start after 15 s", () => {
    const onDone = vi.fn();
    render(<SuccessScreen placed={placed} waitMinutes={8} invoiceNotice={NOTICE} strings={strings} onDone={onDone} />);
    act(() => vi.advanceTimersByTime(15_000));
    expect(onDone).toHaveBeenCalled();
  });
});
