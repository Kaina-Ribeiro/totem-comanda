// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TaxIdRow, TaxIdSheet } from "./tax-id-sheet";
import { strings } from "./test-journey";

const VALID_CPF = "52998224725";
const VALID_CNPJ = "11222333000181";

function renderSheet(initial: string | null = null) {
  const on = { onSkip: vi.fn(), onConfirm: vi.fn() };
  render(<TaxIdSheet initial={initial} strings={strings} {...on} />);
  return on;
}

const key = (label: string) => screen.getByRole("button", { name: label });

async function type(digits: string) {
  for (const digit of digits) await userEvent.click(key(digit));
}

describe("TaxIdSheet", () => {
  it("shows the digits as the CPF mask while the guest types", async () => {
    renderSheet();
    expect(screen.getByText("000.000.000-00")).toBeTruthy();

    await type(VALID_CPF.slice(0, 4));
    expect(screen.getByText("529.9")).toBeTruthy();
  });

  it("confirms a valid CPF with its digits only", async () => {
    const on = renderSheet();
    await type(VALID_CPF);
    expect(screen.getByText("529.982.247-25")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: strings["taxId.confirm"] }));
    expect(on.onConfirm).toHaveBeenCalledWith(VALID_CPF);
  });

  it("confirms a valid CNPJ typed on the same keypad", async () => {
    const on = renderSheet();
    await type(VALID_CNPJ);

    await userEvent.click(screen.getByRole("button", { name: strings["taxId.confirm"] }));
    expect(on.onConfirm).toHaveBeenCalledWith(VALID_CNPJ);
  });

  it("rejects a number with a wrong check digit and clears the error on the next key", async () => {
    const on = renderSheet();
    await type("52998224726"); // last digit wrong

    await userEvent.click(screen.getByRole("button", { name: strings["taxId.confirm"] }));
    expect(screen.getByText(strings["taxId.invalid"])).toBeTruthy();
    expect(on.onConfirm).not.toHaveBeenCalled();

    await userEvent.click(key("0"));
    expect(screen.queryByText(strings["taxId.invalid"])).toBeNull();
  });

  it("confirms an empty field as null, which clears a stored document", async () => {
    const on = renderSheet(VALID_CPF);
    expect(screen.getByText("529.982.247-25")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: strings["taxId.clear"] }));
    await userEvent.click(screen.getByRole("button", { name: strings["taxId.confirm"] }));
    expect(on.onConfirm).toHaveBeenCalledWith(null);
  });

  it("erases the last digit and stops at 14 digits", async () => {
    renderSheet();
    await type("1234567890123456"); // 16 presses, only 14 kept
    expect(screen.getByText("12.345.678/9012-34")).toBeTruthy();

    await userEvent.click(key(strings["taxId.erase"]));
    expect(screen.getByText("12.345.678/9012-3")).toBeTruthy();
  });

  it("skips without saving", async () => {
    const on = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: strings["taxId.skip"] }));
    expect(on.onSkip).toHaveBeenCalledOnce();
    expect(on.onConfirm).not.toHaveBeenCalled();
  });
});

describe("TaxIdRow", () => {
  it("offers to add a document, and shows the masked one with CPF or CNPJ once set", async () => {
    const onOpen = vi.fn();
    const { rerender } = render(
      <TaxIdRow digits={null} strings={strings} onOpen={onOpen} />,
    );
    expect(screen.getByText(strings["taxId.row"])).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Adicionar/ }));
    expect(onOpen).toHaveBeenCalledOnce();

    rerender(<TaxIdRow digits={VALID_CPF} strings={strings} onOpen={onOpen} />);
    expect(screen.getByText("CPF")).toBeTruthy();
    expect(screen.getByText("529.982.247-25")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Alterar/ })).toBeTruthy();
  });
});
