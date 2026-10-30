# Backlog pendente

Aplicar no Linear no fim do plano (regra em CLAUDE.md § Task tracking).

## COM-35

- **Tech Debt** · Combos (`COMBO_MAIN`) ainda não aparecem no construtor do item
  O construtor monta grupos, adicionais, ingredientes e grupos aninhados, mas esconde grupos
  `COMBO_MAIN` (F-MENU-09: trocar o principal na revisão). O cardápio do mock não tem combo. Fazer
  quando a padaria definir combos. Story: COM-35. Não corrigido.

## COM-39

- **Tech Debt** · Pedido abandonado fica AWAITING_PAYMENT quando o cliente muda o carrinho no pagamento
  O totem cria o pedido ao escolher a forma de pagar; se o cliente volta e muda o carrinho, cria outro
  pedido e o primeiro fica esperando pagamento para sempre. Precisa de expiração no Go ou de um
  `cancelOrder` no contrato. Story: COM-39. Não corrigido.
- **Spike** · Quem decide o resultado do pagamento simulado
  Com gateway `SIMULATED` nada resolve o pagamento sozinho; o BFF faz o papel da maquininha e chama
  `simulatePayment` depois de 3 s (aprova, recusa ou não responde, escolhido no `/dev/mock`;
  `SIMULATED_PAYMENT_OUTCOME` fora do dev). Confirmar com o parceiro que o Go não resolve sozinho.
  Story: COM-39. Não corrigido.
- **Story** · Pix com QR Code na tela (fase 4)
  `Payment.pix` (copia e cola) existe no contrato, mas o pagamento simulado não manda QR; a tela
  de maquininha serve para os três métodos. Desenhar e montar o QR quando o provedor de Pix for
  escolhido. Story: COM-39. Não corrigido.
