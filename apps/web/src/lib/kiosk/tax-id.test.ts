import { describe, expect, it } from "vitest";

import { isValidCnpj, isValidCpf, isValidTaxId, maskTaxId, onlyDigits } from "./tax-id";

describe("tax id", () => {
  it("masks progressively, CPF then CNPJ", () => {
    expect(maskTaxId("1234567890")).toBe("123.456.789-0");
    expect(maskTaxId("52998224725")).toBe("529.982.247-25");
    expect(maskTaxId("123456780001")).toBe("12.345.678/0001");
    expect(maskTaxId("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("keeps digits only, at most 14", () => {
    expect(onlyDigits("529.982.247-25x99999")).toBe("52998224725999");
  });

  it("checks CPF and CNPJ check digits", () => {
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("11222333000182")).toBe(false);
    expect(isValidTaxId("1234")).toBe(false);
  });
});
