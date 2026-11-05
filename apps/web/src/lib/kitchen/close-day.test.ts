import { describe, expect, it } from "vitest";

import { closeDayError, closeDayQuestion, closedDayLabel } from "./close-day";

describe("closeDayQuestion", () => {
  it("counts the open orders that become não retirado, singular and plural", () => {
    expect(closeDayQuestion(1)).toBe("1 pedido aberto vai ficar como não retirado.");
    expect(closeDayQuestion(6)).toBe("6 pedidos abertos vão ficar como não retirados.");
  });

  it("never says the orders were collected", () => {
    for (const n of [1, 2, 40]) expect(closeDayQuestion(n)).not.toMatch(/retirados? hoje|Retirado\b/);
  });
});

describe("closedDayLabel", () => {
  it("uses Go's count, not the board's", () => {
    expect(closedDayLabel(1)).toBe("Dia encerrado: 1 pedido não retirado");
    expect(closedDayLabel(3)).toBe("Dia encerrado: 3 pedidos não retirados");
  });

  it("says so when nothing was open any more", () => {
    expect(closedDayLabel(0)).toBe("Dia encerrado. Nenhum pedido estava aberto.");
  });
});

describe("closeDayError", () => {
  it("asks the kitchen to check the connection and try again", () => {
    expect(closeDayError).toBe(
      "Não deu para encerrar o dia. Verifique a conexão e tente de novo.",
    );
  });
});
