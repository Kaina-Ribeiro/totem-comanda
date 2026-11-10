# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

- **Tech Debt** · Início do back office ainda lê v1 (esgotados de hoje, link para Esgotados) — a home (`/admin`) conta itens esgotados com `soldOutDate` do v1; com o v2 o certo é contar `available: false`. O link antigo já redireciona para Disponibilidade. Story: COM-148 (fase 4) ou COM-149. Não corrigido neste plano.
- **Story** · Remover foto enviada e foto de grupo no editor v2 — o editor escolhe/troca a foto de categoria e item, mas não lista nem apaga fotos órfãs (`/v2/admin/images` não tem DELETE no contrato) e grupos não têm campo de foto. Pedir ao parceiro um `deleteImage` se o dono precisar. Story: COM-147. Não corrigido.
- **Tech Debt** · Editor v2 mostra os horários da categoria mesmo com “Só em certos horários” desligado — sem JS no form, os 7 dias ficam visíveis; é só ruído visual. Story: COM-147. Não corrigido.
