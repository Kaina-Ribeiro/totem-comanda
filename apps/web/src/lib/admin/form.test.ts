import { describe, expect, it } from "vitest";

import { cents, optionalPrice, orderTypesError } from "./form";

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
    expect(optionalPrice(form("  "), "price.TAKE_OUT", "preço para viagem")).toBeNull();
  });

  it("reads a valid price", () => {
    expect(optionalPrice(form("9,90"), "price.TAKE_OUT", "preço para viagem")).toBe(990);
  });

  it("fails the save naming the field, never drops it", () => {
    expect(() => optionalPrice(form("9,9,9"), "price.TAKE_OUT", "preço para viagem")).toThrow(
      expect.objectContaining({ code: "VALIDATION_FAILED", detail: "preço para viagem" }),
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
