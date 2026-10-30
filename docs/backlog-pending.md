# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

## COM-25

- **Tech Debt** · Upload de imagem passa por fora do Prism
  O proxy do Prism recodifica o corpo binário do multipart como UTF-8 e corrompe a imagem. O BFF manda
  `uploadMedia` para `CORE_MEDIA_URL` (no dev, o mock direto), então o upload não é validado contra o
  contrato. Em produção cai em `CORE_API_URL`. Story: COM-25. Não corrigido.

## COM-28

- **Spike** · Contrato: ler os itens de uma categoria
  O contrato grava os itens de uma categoria (`PUT /v1/admin/categories/{id}/items`) mas não tem leitura.
  O back office precisa mostrar quais itens estão em cada categoria e o preço deles naquele cardápio.
  O mock manda um campo extra `items` em `AdminCategory`, lido só em `categoryLinks()`. Propor ao
  parceiro: `items: CategoryItemLink[]` em `AdminCategory` ou `GET /v1/admin/categories/{id}/items`.
  Story: COM-28. Não corrigido.
