# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

## COM-25

- **Tech Debt** · Upload de imagem passa por fora do Prism
  O proxy do Prism recodifica o corpo binário do multipart como UTF-8 e corrompe a imagem. O BFF manda
  `uploadMedia` para `CORE_MEDIA_URL` (no dev, o mock direto), então o upload não é validado contra o
  contrato. Em produção cai em `CORE_API_URL`. Story: COM-25. Não corrigido.
