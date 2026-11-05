/**
 * "Encerrar o dia" (plan G-K9, KDS FEAT-033): the open orders leave the board
 * as "não retirado". Never "Retirado": nobody handed them over (BR-022).
 */

const pedidos = (n: number) => (n === 1 ? "1 pedido" : `${n} pedidos`);

/** The confirmation's main line, with the board's count of open orders. */
export function closeDayQuestion(count: number): string {
  return count === 1
    ? "1 pedido aberto vai ficar como não retirado."
    : `${pedidos(count)} abertos vão ficar como não retirados.`;
}

/** The toast after Go closed the day, with Go's count (it may differ from the board's). */
export function closedDayLabel(count: number): string {
  if (count === 0) return "Dia encerrado. Nenhum pedido estava aberto.";
  return `Dia encerrado: ${pedidos(count)} ${count === 1 ? "não retirado" : "não retirados"}`;
}

/** What the dialog shows when the call fails; the board reloads and keeps what Go still has open. */
export const closeDayError =
  "Não deu para encerrar o dia. Verifique a conexão e tente de novo.";
