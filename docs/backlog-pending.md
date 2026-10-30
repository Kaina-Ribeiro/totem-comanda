# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

## COM-33

- **Bug** · Heartbeat e status do totem davam 400 no mock atrás do Prism
  Rotas do BFF (Route Handlers) mandam o POST em chunked; o Prism repassa com `Content-Length` e
  `Transfer-Encoding` juntos e o parser do Node recusa (o Go aceita). Corrigido no mock
  (`insecureHTTPParser`). Story: COM-9. **Corrigido neste plano.**
- **Spike** · Contrato: onde ficam as imagens (`/media/...`)
  `MediaAsset.url` e `image` são caminhos `/media/x.jpg` na Core API, mas o contrato não define a rota.
  O BFF busca em `CORE_MEDIA_URL` (no mock, a porta 4020, porque o Prism recusa caminhos fora do
  contrato). Decidir com o parceiro e documentar no contrato. Story: COM-33. Não corrigido.
- **Spike** · Contrato: cotação e validação de cupom não dizem o cardápio nem o idioma da jornada
  `QuoteRequest` e `DiscountValidationRequest` não levam `orderNonce`, `menuId` nem `language`. Na troca de
  cardápio (10:59 → 11:00) a Core API não sabe por qual cardápio cotar, e o título do desconto volta no
  idioma padrão. O mock usa o último cardápio carregado pelo aparelho. Propor ao parceiro. Story: COM-36.
  Não corrigido.
