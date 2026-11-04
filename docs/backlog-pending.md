# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

- **Tech Debt** — Falha injetada com 401 no mock vira 500 no Prism
  `/__mock/fault` responde `{type, title, status}` sem `code`; o Prism não aceita esse corpo como
  `Problem` e devolve 500. Por isso um 401 (ou outro 4xx do contrato) injetado não chega ao BFF
  atrás do Prism; só testando direto na porta 4020. Corrigir: a falha injetada manda um `code`
  válido (ex. `UNAUTHORIZED` no 401). Story: COM-99. Não corrigido neste plano.
