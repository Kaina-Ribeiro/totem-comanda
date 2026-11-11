import { describe, expect, it } from "vitest";

import { formatMoney } from "./money";

// Intl puts a no-break space after "R$".
const brl = (text: string) => text.replace(" ", "\u00a0");

describe("formatMoney (decimal BRL, pilot Review Focus 5)", () => {
  it("formats reais with two decimals", () => {
    expect(formatMoney(9.5)).toBe(brl("R$ 9,50"));
    expect(formatMoney(0)).toBe(brl("R$ 0,00"));
    expect(formatMoney(1234.5)).toBe(brl("R$ 1.234,50"));
  });

  it("never shows float noise", () => {
    expect(formatMoney(0.1 + 0.2)).toBe(brl("R$ 0,30"));
    expect(formatMoney(14.7 - 0.95)).toBe(brl("R$ 13,75"));
  });
});
