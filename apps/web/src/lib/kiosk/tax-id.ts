// CPF/CNPJ on the receipt (F-BASKET-10, BR-BASKET-18): digits only, CPF
// mask up to 11 digits and CNPJ mask beyond, check digits on confirm.

export const TAX_ID_MAX_DIGITS = 14;

export const onlyDigits = (value: string) => value.replace(/\D/g, "").slice(0, TAX_ID_MAX_DIGITS);

/** Progressive mask: `000.000.000-00` up to 11 digits, `00.000.000/0000-00` beyond. */
export function maskTaxId(digits: string): string {
  const d = onlyDigits(digits);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

const allSame = (d: string) => /^(\d)\1+$/.test(d);

function checkDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, i) => total + Number(digits[i]) * weight, 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCpf(d: string): boolean {
  if (!/^\d{11}$/.test(d) || allSame(d)) return false;
  const first = checkDigit(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(d[9]) && second === Number(d[10]);
}

export function isValidCnpj(d: string): boolean {
  if (!/^\d{14}$/.test(d) || allSame(d)) return false;
  const first = checkDigit(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = checkDigit(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return first === Number(d[12]) && second === Number(d[13]);
}

/** A CPF (11) or CNPJ (14) with valid check digits. */
export const isValidTaxId = (digits: string) => isValidCpf(digits) || isValidCnpj(digits);
