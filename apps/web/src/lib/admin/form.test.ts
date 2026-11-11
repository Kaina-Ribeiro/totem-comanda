import { describe, expect, it, vi } from "vitest";

import { AdminApiError } from "./session";
import {
  attempt,
  errorMessage,
  orderTypesError,
  priceField,
  readPrice,
  saveBoth,
} from "./form";

describe("readPrice (Review Focus 5)", () => {
  it.each([
    ["9,50", 9.5],
    ["9.50", 9.5],
    ["9,5", 9.5],
    ["R$ 9,50", 9.5],
    ["R$9,50", 9.5],
    ["28", 28],
    ["1.234,50", 1234.5],
    [" 1.234 ", 1234],
    ["0,1", 0.1],
    ["0,30", 0.3],
    ["0,10", 0.1],
    ["13.9", 13.9],
  ])("reads %j as %d", (raw, expected) => {
    expect(readPrice(raw)).toBe(expected);
  });

  it.each(["9,505", "abc", "-1", "1e3", "", "1.23.4", "12,3,4", "1,234.50", "10,005"])(
    "refuses %j instead of guessing",
    (raw) => {
      expect(readPrice(raw)).toBeNull();
    },
  );

  it("never carries float noise", () => {
    expect(readPrice("0,30")).toBe(0.3);
    expect(String(readPrice("1.234,56"))).toBe("1234.56");
  });
});

describe("priceField", () => {
  const form = (value: string) => {
    const data = new FormData();
    data.set("price", value);
    return data;
  };

  it("reads a valid price", () => {
    expect(priceField(form("9,90"), "price", "preço")).toBe(9.9);
  });

  it("is null when an optional field is empty", () => {
    expect(priceField(form("  "), "price", "preço", { optional: true })).toBeNull();
  });

  it("fails the save naming the field when it is not a price, never drops it", () => {
    expect(() => priceField(form("9,9,9"), "price", "preço para comer aqui", { optional: true })).toThrow(
      expect.objectContaining({ code: "VALIDATION_FAILED", detail: "preço para comer aqui" }),
    );
  });

  it("fails the save when a required price is empty", () => {
    expect(() => priceField(form(""), "price", "preço")).toThrow(
      expect.objectContaining({ code: "VALIDATION_FAILED", detail: "preço" }),
    );
  });
});

describe("attempt with MENU_INVALID (Review Focus 3)", () => {
  it("returns the general message and one line per broken rule", async () => {
    const state = await attempt(async () => {
      throw new AdminApiError("MENU_INVALID", undefined, [
        {
          field: "links",
          message: "group has no option",
          rule: "EMPTY_GROUP",
          entity: { type: "MODIFIERS", id: "M-SAUCE" },
        },
      ]);
    });
    expect(state.error).toBe("O cardápio ficaria quebrado. Corrija e salve de novo.");
    expect(state.problems).toEqual(["Grupo “M-SAUCE”: precisa de pelo menos uma opção."]);
  });

  it("uses the names it is given", async () => {
    const names = (type: string, id: string) => (id === "M-SAUCE" ? "Escolha o molho" : undefined);
    const state = await attempt(async () => {
      throw new AdminApiError("MENU_INVALID", undefined, [
        { field: "links", message: "x", rule: "EMPTY_GROUP", entity: { type: "MODIFIERS", id: "M-SAUCE" } },
      ]);
    }, names);
    expect(state.problems).toEqual(["Grupo “Escolha o molho”: precisa de pelo menos uma opção."]);
  });
});

describe("orderTypesError", () => {
  it("refuses dine-in and take-out both off", () => {
    expect(orderTypesError(false, false)).toMatch(/pelo menos um/);
  });

  it("accepts either one on", () => {
    expect(orderTypesError(true, false)).toBeNull();
    expect(orderTypesError(false, true)).toBeNull();
    expect(orderTypesError(true, true)).toBeNull();
  });
});

describe("saveBoth (COM-129)", () => {
  const overlap = new AdminApiError("SCHEDULE_OVERLAP");
  const parts = () => ({
    first: {
      label: "o nome do cardápio",
      save: vi.fn(async () => {}),
      undo: vi.fn(async () => {}),
    },
    second: { label: "os horários", save: vi.fn(async () => {}) },
  });

  it("saves both parts in order", async () => {
    const { first, second } = parts();
    await saveBoth(first, second);
    expect(first.save).toHaveBeenCalledOnce();
    expect(second.save).toHaveBeenCalledOnce();
    expect(first.undo).not.toHaveBeenCalled();
  });

  it("puts the first part back when the second fails, so nothing is half saved", async () => {
    const { first, second } = parts();
    second.save.mockRejectedValueOnce(overlap);
    await expect(saveBoth(first, second)).rejects.toBe(overlap);
    expect(first.undo).toHaveBeenCalledOnce();
  });

  it("skips the first part when it did not change", async () => {
    const { second } = parts();
    second.save.mockRejectedValueOnce(overlap);
    await expect(saveBoth(null, second)).rejects.toBe(overlap);
    expect(second.save).toHaveBeenCalledOnce();
  });

  it("says what was saved when the first part cannot be put back", async () => {
    const { first, second } = parts();
    second.save.mockRejectedValueOnce(overlap);
    first.undo.mockRejectedValueOnce(new AdminApiError("CORE_UNAVAILABLE"));
    const error = await saveBoth(first, second).catch((e: unknown) => e);
    expect(errorMessage(error)).toBe(
      "Salvou o nome do cardápio, mas não os horários. Esse horário bate com o de outro cardápio. Só um cardápio pode estar ativo por vez.",
    );
  });

  it("does not touch the second part when the first fails", async () => {
    const { first, second } = parts();
    first.save.mockRejectedValueOnce(new AdminApiError("VALIDATION_FAILED"));
    await expect(saveBoth(first, second)).rejects.toBeInstanceOf(AdminApiError);
    expect(second.save).not.toHaveBeenCalled();
    expect(first.undo).not.toHaveBeenCalled();
  });
});
