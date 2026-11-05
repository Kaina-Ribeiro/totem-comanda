// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { FormState } from "@/lib/admin/form";

import { ActionForm, SubmitButton } from "./form";

function renderForm(action: (state: FormState, form: FormData) => Promise<FormState>) {
  render(
    <ActionForm action={action}>
      <input aria-label="Preço para viagem" name="price" defaultValue="5,00" />
      <SubmitButton name="intent" value="save" pendingLabel="Salvando…">
        Salvar
      </SubmitButton>
    </ActionForm>,
  );
  return screen.getByLabelText<HTMLInputElement>("Preço para viagem");
}

async function typeAndSave(field: HTMLInputElement, value: string) {
  const user = userEvent.setup();
  await user.clear(field);
  await user.type(field, value);
  await user.click(screen.getByRole("button"));
}

describe("ActionForm (COM-138)", () => {
  it("keeps what the owner typed when the save fails", async () => {
    const field = renderForm(async () => ({
      error: "Algum campo está inválido.",
    }));
    await typeAndSave(field, "1e3");

    await screen.findByRole("alert");
    expect(field.value).toBe("1e3");
  });

  it("goes back to the saved values after a successful save", async () => {
    const field = renderForm(async () => ({ saved: "Salvo." }));
    await typeAndSave(field, "6,00");

    await screen.findByRole("status");
    expect(field.value).toBe("5,00");
  });

  it("sends the fields and the button that saved", async () => {
    const action = vi.fn<(state: FormState, form: FormData) => Promise<FormState>>(async () => ({
      saved: "Salvo.",
    }));
    const field = renderForm(action);
    await typeAndSave(field, "6,00");

    await screen.findByRole("status");
    const form = action.mock.calls[0][1];
    expect(form.get("price")).toBe("6,00");
    expect(form.get("intent")).toBe("save");
  });

  it("shows the button as busy while saving", async () => {
    let finish!: (state: FormState) => void;
    const field = renderForm(() => new Promise<FormState>((resolve) => (finish = resolve)));
    await typeAndSave(field, "6,00");

    expect(screen.getByRole<HTMLButtonElement>("button").textContent).toBe("Salvando…");
    expect(screen.getByRole<HTMLButtonElement>("button").disabled).toBe(true);
    finish({ saved: "Salvo." });
    await screen.findByRole("status");
    expect(screen.getByRole("button").textContent).toBe("Salvar");
  });
});
