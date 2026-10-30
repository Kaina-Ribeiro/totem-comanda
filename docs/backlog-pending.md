# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

## COM-43

- **Tech Debt** · Stream da cozinha (SSE) passa por fora do Prism
  O proxy do Prism só repassa a resposta inteira, então o `text/event-stream` nunca chega por ele. O BFF
  abre o stream em `CORE_STREAM_URL` (no dev, o mock direto) e cai para polling de 2 s pelo Prism se o
  stream cair. O stream não é validado contra o contrato. Story: COM-43. Não corrigido.
