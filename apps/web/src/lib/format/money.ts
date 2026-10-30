const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Integer cents in BRL as "R$ 28,00" (contract: money is always integer
 * cents). Intl's no-break space after "R$" stays, so a price never wraps.
 */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}
