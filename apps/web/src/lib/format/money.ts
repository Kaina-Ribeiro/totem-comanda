const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Integer cents in BRL as "R$ 28,00" (contract: money is always integer
 * cents). Intl's no-break space after "R$" stays, so a price never wraps.
 */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

/**
 * Decimal BRL as "R$ 9,50" (contract v2: money is a number in reais with at
 * most 2 decimals, SPEC D-3). Intl rounds to the cent, so float noise such as
 * 0.30000000000000004 never reaches the screen.
 */
export function formatMoney(brl: number): string {
  return BRL.format(brl);
}
