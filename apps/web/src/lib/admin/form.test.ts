import { describe, expect, it, vi } from "vitest";

import { AdminApiError } from "./session";
import {
  cents,
  errorMessage,
  optionalPrice,
  orderTypesError,
  saveBoth,
} from "./form";

describe("cents", () => {
  it("reads Brazilian and plain prices as integer cents", () => {
    expect(cents("28,00")).toBe(2800);
    expect(cents("R$ 1.234,50")).toBe(123450);
    expect(cents("13.9")).toBe(1390);
    expect(cents("7")).toBe(700);
    expect(cents("")).toBeNull();
    expect(cents("-3")).toBeNull();
  });

  it("rejects what is not a price instead of guessing (COM-128)", () => {
    expect(cents("1e3")).toBeNull(); // was R$ 13,00
    expect(cents("10,005")).toBeNull(); // was rounded to R$ 10,01
    expect(cents("12,3,4")).toBeNull();
    expect(cents("abc")).toBeNull();
    expect(cents("1,234.50")).toBeNull();
  });

  it("keeps the formats owners type", () => {
    expect(cents("28,5")).toBe(2850);
    expect(cents("R$28,00")).toBe(2800);
    expect(cents(" 1.234 ")).toBe(123400);
    expect(cents("0,10")).toBe(10);
  });
});

describe("optionalPrice (COM-128)", () => {
  const form = (value: string) => {
    const data = new FormData();
    data.set("price.TAKE_OUT", value);
    return data;
  };

  it("is null when the field is empty", () => {
    expect(
      optionalPrice(form("  "), "price.TAKE_OUT", "preço para viagem"),
    ).toBeNull();
  });

  it("reads a valid price", () => {
    expect(
      optionalPrice(form("9,90"), "price.TAKE_OUT", "preço para viagem"),
    ).toBe(990);
  });

  it("fails the save naming the field, never drops it", () => {
    expect(() =>
      optionalPrice(form("9,9,9"), "price.TAKE_OUT", "preço para viagem"),
    ).toThrow(
      expect.objectContaining({
        code: "VALIDATION_FAILED",
        detail: "preço para viagem",
      }),
    );
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
