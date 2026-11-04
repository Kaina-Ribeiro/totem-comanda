# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

- **Tech Debt** · Deploy no Cubeship pela automação de release · COM-69 · não corrigido neste plano.
  Hoje o deploy em prod é manual: rodar `release.mjs check-deploy` e trocar o `ref` dos apps comanda no Cubeship. Um job no `release.yml` faria isso após o `final`, com aprovação.
- **Tech Debt** · Rulesets versionados ainda pedem 1 aprovação · COM-69 · corrigido neste plano (PR para `release/v0.2`).
  Kai decidiu em 04/11/2026: nenhuma aprovação obrigatória. Junto: tags passam a ser criadas com o `RELEASE_PR_TOKEN`, porque o GitHub não aceita o Actions como exceção no ruleset de tags em repo pessoal.
- **Story** · Ambiente de teste no Cubeship para tags rc · COM-69 · não corrigido neste plano.
  O flow prevê test stages que aceitam `vX.Y.Z-rc.N`; o Cubeship do comanda só tem `production`.
