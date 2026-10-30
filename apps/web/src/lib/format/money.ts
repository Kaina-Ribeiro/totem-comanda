const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Integer cents in BRL as "R$ 28,00" (contract: money is always integer cents). */
export function formatBRL(cents: number): string {
  // Intl puts a no-break space after "R$"; a plain space keeps tests and copy simple.
  return BRL.format(cents / 100).replace(/ /g, " ");
}
