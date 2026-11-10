# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

## COM-145 (contrato v2, fase 1 do piloto)

- **Tech Debt** · Cubeship itodev: expor a porta 4011 do mock e passar `CORE_API_V2_URL` ao web. O Dockerfile já expõe 4011; falta a mudança de ambiente no Cubeship (precisa do sim do Kai). Story: COM-145. Não feito neste plano.
- **Tech Debt** · Mock: parar o mock à força (kill sem SIGTERM) deixa os processos do Prism órfãos na porta (4010/4011). Matar o grupo de processos ou fechar os filhos no `exit`. Story: COM-145. Não feito.
- **Tech Debt** · Mock v2: a retomada automática do ritmo (fim da pausa) só avisa o stream da cozinha v1; o stream v2 só ouve mudanças feitas pelas rotas v2. Some na fase 5 quando o v1 sair. Story: COM-148. Não feito.
- **Story** · Seed do mock v2 com o cardápio da padaria (hoje é o exemplo 5.20 do MODELS traduzido, hambúrgueres). Útil para as telas da fase 2. Story: COM-146. Não feito.
