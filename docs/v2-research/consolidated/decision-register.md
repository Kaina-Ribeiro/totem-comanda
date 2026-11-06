# Registro de decisões

👉 **Responda as 21 críticas abertas (C1 a C23, menos C19 e C21, que a resposta 1 do parceiro já resolveu).** Depois aceite o bloco padrão (D1 a D56) de uma vez, com as exceções que quiser.

⚠️ Mudei o ⭐ em 4 críticas em relação ao que os leitores marcaram: C8 (gorjeta), C9 (limite de pedidos), C13 (mesa no totem) e C18 (equipe no totem). Cada uma explica o motivo.

**Termos (uma vez):** **conta da mesa** = o consumo aberto de uma mesa (no código, `check`). **Forma de pagamento** = `tender`. **Core** = a API em Go do parceiro. **Contrato** = o acordo de API com o parceiro. **BFF** = a parte do site que roda no servidor.

**Fontes:** "kiosk.md Q4" = pergunta 4 do arquivo `kiosk.md`, na pasta `consolidated`. "P41" = linha da tabela do `platform.md` com verdict "?".

## Resumo

| Contagem | Número |
|:--|--:|
| Perguntas originais (112 numeradas + 23 linhas "?" do platform.md) | 135 |
| Novas do menu (suplementos 4 e 5, Q27 a Q35; nenhuma repetida) | 9 |
| Menu Q26 (vários cardápios), resolvida | 1 |
| Depois de juntar as repetidas | 87 |
| **Críticas** (você decide) | **21** (C19 e C21 resolvidas depois pela resposta 1 do parceiro; números mantidos) |
| **Padrão** (aceitar em bloco) | **56** |
| **Já resolvidas** (decisões do brief, plano, contrato e parceiro) | **10** (em 9 linhas) |

Check: 21 + 56 + 10 = 87 (77 + 9 novas + 1 resolvida).

## Críticas

### Pedido, dinheiro e regras de venda

### C1. Quando o pedido chega à cozinha?
Contexto: Pedido do totem é pago antes. Pedido de mesa sai com o cliente sentado, e a cozinha não pode esperar a conta fechar.
A) Totem: só depois de pagar. Mesa: ao enviar a rodada, sem aceite e sem pagar antes. ⭐ (a cozinha começa na hora; o garçom já é o aceite)
B) Tudo só depois de pagar (mesa: depois da conta paga). (a mesa espera o fim da refeição)
C) Tudo passa por aceite antes (status PENDENTE). (uma etapa a mais em todo pedido)
Fontes: kitchen.md Q1; waiter-table-qr.md OQ-23

### C2. Taxa de serviço (10%): em quais pedidos e sobre qual valor?
Contexto: A taxa é um percentual da loja, calculado pelo Core. Falta dizer em quais pedidos ela entra e sobre o quê. Os leitores divergem: uns pedem só consumo no local, outros o pedido todo.
A) Só consumo no local (mesa e totem "comer aqui"). Base: itens antes de descontos. Sem imposto próprio; descontos não se aplicam. ⭐ (uso comum no Brasil; o contador confirma)
B) Como A, mais botão "sem taxa" no garçom por conta (padrão: ligado). Base: depois dos descontos. (mais tela e mais regra)
C) Todos os pedidos, sobre o subtotal antes de descontos. (cliente de viagem também paga)
Fontes: platform.md Q2; kiosk.md Q4; backoffice-menu.md Q7 (pede o pedido todo); waiter-table-qr.md OQ-16, OQ-17, OQ-18, OQ-19

### C3. Imposto e arredondamento: como entram no preço?
Contexto: A suposição é que o preço da loja já inclui imposto. Isso ainda não foi confirmado com o dono. Arredondar cada linha pode dar R$ 0,01 de diferença no total.
A) Preço com imposto incluído; arredonda cada linha em centavos (meio para cima) e soma. ⭐ (padrão de cupom; o dono e o contador confirmam antes de programar)
B) Preço com imposto incluído; arredonda só o total. (linhas podem somar R$ 0,01 a mais ou a menos)
C) Preço sem imposto; imposto somado por cima. (o cliente vê um preço e paga outro)
Fontes: platform.md Q1, Q3, P67; backoffice-menu.md Q6

### C4. Pagamento antes da maquininha (fase 4): o que o sistema registra?
Contexto: Dinheiro volta como forma de pagamento (decisão 8). Maquininha integrada só na fase 4. O totem não recebe dinheiro na mão. Quem fecha a conta da mesa é o garçom.
A) Totem: pagamento simulado até a fase 4, como hoje. Garçom: registra à mão a forma usada (dinheiro com valor recebido e troco, cartão numa maquininha avulsa, Pix), marcada como manual. ⭐
B) Como A, mas Pix já no MVP por um provedor, no totem e no garçom. (mais uma integração antes da fase 4)
C) Garçom só registra dinheiro; cartão e Pix esperam a fase 4. (a mesa que paga com cartão não fecha no sistema)
Revisado pelo coordenador: a versão anterior registrava dinheiro no totem, que não tem como receber.
Fontes: kiosk.md Q11; waiter-table-qr.md OQ-12, OQ-13; platform.md Q6, Q7

### C5. Cancelar pedido pago ou já retirado
Contexto: O Comanda não faz estorno hoje. Falta dizer se o dono cancela pedido pago e quem devolve o dinheiro.
A) Dono cancela pago no backoffice; estorno feito fora do Comanda (maquininha ou banco). Depois de retirado, não cancela. ⭐ (o dinheiro volta sem registro no sistema)
B) Dono cancela e o Comanda registra o estorno (fase 4). (mais regra de dinheiro)
C) Sem cancelamento depois de pagar. (erro de pedido vira problema de balcão)
Fontes: platform.md Q12, P31; kitchen.md Q6

### C6. Regras de promoção no MVP
Contexto: Cupons e promoções estão no escopo. As regras (pedido mínimo, datas, teto, usos) mudam quanto o cliente paga.
A) Completo: pedido mínimo, datas, teto de valor, limite total de usos, forma de pagamento aceita. Sem limite por cliente (o cliente é anônimo). ⭐
B) Só pedido mínimo, datas e limite total de usos. (sem regra de forma de pagamento)
C) Só código de valor fixo, sem regras. (promoção por produto e por horário fica fora)
Fontes: platform.md Q14; backoffice-menu.md Q8

### C7. NFC-e (nota fiscal eletrônica do consumidor): quem emite? (fase 4)
Contexto: NFC-e é a nota fiscal digital da venda ao consumidor, exigida em muitos estados. Pode ser emitida por um provedor ou pelo próprio Comanda.
A) Um provedor de NFC-e emite; o Core guarda a chave e o QR. ⭐ (menos risco fiscal; tem custo mensal)
B) O Comanda monta o documento fiscal. (esforço e responsabilidade altos)
C) Vender sem NFC-e até o contador confirmar. (venda sem nota no piloto)
Fontes: platform.md Q13, P38

### C8. Gorjeta e doação no totem
Contexto: Gorjeta e doação voltam ao escopo (decisão 8), mas não há tela nem valores. Os leitores pediram três coisas diferentes. Escolhi C porque é a opção com menos tela e menos risco de valor errado no piloto.
A) Totem oferece gorjeta (5, 10, 15 %) e doação (R$ 2, 5, 10), em config. (tela nova e valores para aprovar)
B) Totem só com valor livre, sem valores prontos. (cliente digita o valor)
C) Sem gorjeta e doação no totem no piloto; a equipe lança no fechamento. ⭐ (quem quer doar pelo totem não consegue)
Fontes: kiosk.md Q8; backoffice-store-ops.md Q8; platform.md Q15

### C9. Limite de pedidos: a cozinha pode travar a venda?
Contexto: A cozinha tem ritmo (Normal, Movimentado, Pausado). Falta dizer se o totem também bloqueia quando a cozinha lota. Os leitores divergem: a cozinha pede só ritmo; a loja pede bloqueio. Escolhi A porque o plano troca capacidade por ritmo.
A) Não bloqueia; só o ritmo da cozinha. ⭐ (a cozinha pode lotar sem bloqueio)
B) Bloqueia novos pedidos do totem naquele serviço e intervalo, com mensagem. (precisa de regra de intervalo)
C) Só avisa e aceita. (sem limite real)
Fontes: kitchen.md Q8; backoffice-store-ops.md Q5; waiter-table-qr.md OQ-24

### Mesa e garçom

### C10. Chamar garçom e pedir conta
Contexto: O cliente de mesa pede ajuda ou a conta. Isso cria um registro novo ligado à conta e um aviso para o garçom.
A) O cliente pede ao garçom de viva voz; o garçom marca "conta pedida" no app dele (estado da conta, C11). Sem botão para o cliente. ⭐ (nenhuma entidade nova; o QR continua só cardápio)
B) Botões "chamar garçom" e "pedir conta" no cardápio QR, que viram alerta no app do garçom. (abre exceção na decisão "QR só mostra o menu"; uma entidade nova para o parceiro)
C) Nada no MVP. (sem registro de quem pediu a conta)
Revisado pelo coordenador: a versão anterior punha os botões no totem, que fica no balcão, e na mesa, onde só existe o QR (só cardápio).
Fontes: platform.md Q8, P56; waiter-table-qr.md OQ-25

### C11. Estados da conta da mesa e segunda rodada
Contexto: A conta precisa de estados claros para saber quando a mesa fica livre. Falta dizer como a segunda rodada entra.
A) ABERTA (OPEN) → PEDIDO DE CONTA (BILL_REQUESTED) → PAGA (PAID). Mesa livre só quando paga. Cada rodada é um pedido novo na mesma conta. ⭐
B) Só ABERTA e PAGA. O pedido de conta vem do chamado (C10). Rodadas iguais a A. (sem estado próprio de pedido de conta)
C) Sem campo de estado: derivado de pagamentos e chamados; uma conta nova por rodada. (sem conta única para a mesa)
Fontes: waiter-table-qr.md OQ-10, OQ-11

### C12. Mesa é cadastro ou só um número?
Contexto: Hoje a mesa é um número digitado. Lista de mesas, QR e status por mesa exigem cadastro.
A) Cadastro de MESA: número, ativa ou não, identificador do QR. Zona opcional em texto. Um lugar por mesa. ⭐
B) Só o número da mesa no pedido: sem lista, sem QR, sem status. (sem mesas reais para o QR e o garçom)
C) MESA mais grupos de local com nome (ex.: salão, varanda). (mais do que a padaria precisa)
Fontes: waiter-table-qr.md OQ-6, OQ-7, OQ-8

### C13. Pedido de totem para comer aqui: como identificar a mesa?
Contexto: Sem a mesa, a cozinha e o garçom não sabem onde entregar. Os leitores divergem: a tela do totem pede só o buzzer; o garçom pede o número da mesa. Escolhi A porque a cozinha precisa da mesa.
A) Como hoje: o totem mostra o número do pedido e o cliente retira no balcão; o totem não pergunta a mesa. ⭐ (o fluxo do totem não muda)
B) O cliente digita o número da mesa, validado na lista de mesas (C12), e a equipe leva o pedido até ele. (uma tela nova no totem; a padaria precisa entregar na mesa)
C) B, mas opcional: o cliente escolhe "retirar no balcão" ou "levar na mesa". (as duas operações convivem)
Revisado pelo coordenador: o fluxo do totem foi mantido sem mudança; o Comanda não tem buzzer nem cartão-tenda.
Fontes: kiosk.md Q3; waiter-table-qr.md OQ-33

### C14. Login e permissões do garçom
Contexto: O garçom usa um celular ou tablet compartilhado. Hoje não há conta de garçom. Falta dizer como entra, quem cadastra e o que pode fazer.
A) Nome e PIN de 4 dígitos (trava após 5 erros). O dono cadastra em "Equipe". Papel fixo "garçom": abre conta, envia rodadas, pede conta, fecha e recebe. Sem desconto nem estorno. ⭐ (sem trilha de quem fez o quê, por login próprio)
B) Login por e-mail e senha, por garçom, como o backoffice. (lento num aparelho compartilhado; exige e-mail de cada pessoa)
C) Papel configurável por conta, como no modelo de referência. (mais flexível; sem padrão seguro; o garçom pode receber estorno se o dono configurar)
Fontes: waiter-table-qr.md OQ-2, OQ-3, OQ-4; platform.md Q9, P112; backoffice-store-ops.md Q1

### C15. Pareamento do aparelho (garçom e totem)
Contexto: Como um aparelho novo ganha permissão para operar. Token é a chave de acesso guardada no aparelho. O documento de dados diz que isso não está decidido, então o código não deve inventar a regra.
A) Código de uso único criado no backoffice e digitado no aparelho. Depois o aparelho fica logado com token. ⭐ (alguém digita o código uma vez)
B) Segredo mostrado uma vez no backoffice e digitado no aparelho. (se perder, gera outro)
C) Segredo gravado na imagem do aparelho; nada é digitado. (se a imagem vazar, vaza o acesso; difícil trocar)
Fontes: platform.md Q10; waiter-table-qr.md OQ-5; backoffice-store-ops.md Q12

### C16. Preço de um item em pedido de mesa
Contexto: O preço no salão pode ser diferente do balcão. Isso muda o total pago.
A) Campo novo ITEM.seatPriceOverride, usado em pedido de mesa quando preenchido. ⭐ (mais um campo de preço para cadastrar)
B) Sempre o preço base do item. (sem preço de salão)
C) Campo dineInPriceOverride (preço de consumo no local). (o totem para comer aqui também usaria esse preço)
Fontes: waiter-table-qr.md OQ-22

### Cardápio, totem e back office

### C17. Traduções do cardápio (PT-BR e EN)
Contexto: O cardápio tem duas línguas. Essa escolha muda o formato de todo nome e descrição de item.
A) Campos PT e EN em cada nome e descrição. ⭐ (sem serviço extra; a loja escreve os dois)
B) Registros de tradução guardados no Core (campo `gfcId`); o parceiro constrói. (mais trabalho para o Go)
C) Só PT-BR no MVP. (cardápio em inglês fica de fora)
Fontes: backoffice-menu.md Q12

### C18. Equipe no totem: quem reinicia ou reimprime?
Contexto: Se o totem travar, alguém precisa reiniciar. As leituras marcaram "sem tela de equipe", mas sem ela não há como recuperar o totem na loja. Por isso marquei B.
A) Sem tela de equipe no totem; reiniciar só pelo backoffice ou pelo garçom. (se o totem travar, depende do celular do dono ou do garçom)
B) PIN de 4 dígitos no totem para ações de caixa: reiniciar e reimprimir o último recibo. ⭐ (uma tela de PIN a mais)
C) Só reimprimir o último recibo, com PIN. (não reinicia o totem)
Fontes: waiter-table-qr.md OQ-34

### C19. Datas especiais — ✅ RESOLVIDA (não precisa responder)
Resolvida pela resposta 1 do parceiro (6 nov): "datas especiais" estava na lista de capacidades mantidas como campos no v2. Regra: a do `docs/plan-next.md`, decisão 6 — uma data especial fechada fecha todos os cardápios; um horário especial substitui as janelas daquela data; o "forçar cardápio" do dono continua vencendo. Equivale à opção C.
Fontes: kiosk.md Q6; menu-supplement-1.md Q21; backoffice-store-ops.md Q3, Q11

### Cardápio: venda cruzada, esgotado e descontos

### C20. Venda cruzada: só lista simples, ou também regras com condições?
Contexto: A sugestão aparece depois que o cliente adiciona um item. Regras com condições (se o pedido tem X, sugerir Y) não têm forma no modelo v2 e pedem mais construção e teste. A opção A segue o desenho do D46 (regra por item, com datas e exclusões).
A) Só lista simples: depois do item, mostra a lista escolhida (quantidade, ordem, datas, cardápio), sem condições. ⭐ (usa o desenho do D46; sem forma nova para condições)
B) Manter as regras com condições (todas ou qualquer uma, valor de comparação, itens e tags). (pede forma nova no contrato e mais construção)
C) Cortar a venda cruzada do MVP. (o totem não sugere nada)
Fontes: menu-supplement-4.md S4-Q2 (= menu Q28); backoffice-menu.md Q11, C57

### C21. Item esgotado com data de volta — ✅ RESOLVIDA (não precisa responder)
Resolvida pela resposta 1 do parceiro (6 nov): "esgotado até uma data" e "oculto vs esgotado" estavam na lista de capacidades mantidas como campos no v2. Regra: a do `docs/plan-next.md`, decisão 5 — esgotado tem duração (hoje, até liberar, até uma data) e é diferente de oculto. O parceiro já aprovou a mudança no contrato.
Fontes: menu-supplement-5.md S5-Q1 (= menu Q30); S5-C1, S5-N1; backoffice-menu.md I8

### C22. Kiosk sem conexão com o Core: tela offline ou último cardápio?
Contexto: Se o Core não responde quando o cliente começa a compra, o totem pode mostrar a tela "temporariamente offline" ou usar o último cardápio guardado. O último cardápio pode deixar vender item que já esgotou, e o pedido não sai da cozinha.
A) Tela offline; sem cardápio antigo. ⭐ (não vende item esgotado; a venda para até o Core voltar)
B) Usar o último cardápio guardado no totem. (a loja segue vendendo, mas pode vender item esgotado)
Fontes: menu-supplement-5.md S5-Q2 (= menu Q31); S5-C3, S5-C4

### C23. Descontos por pedido: um cupom só, ou um limite maior?
Contexto: Hoje um pedido aceita um cupom (regra P9). Um limite maior muda quanto o cliente paga e exige um campo novo na loja.
A) Um cupom por pedido. ⭐ (já é a regra do fluxo atual; sem campo novo)
B) Limite de N descontos por pedido, em campo novo da loja (`maxDiscountsPerOrder`). (mais um campo, e o preço pode cair várias vezes)
C) Sem limite. (cupons podem se somar sem teto)
Fontes: menu-supplement-5.md S5-Q5 (= menu Q34); backoffice-menu.md P9

## Padrão (aceitar em bloco)

Cada linha já traz a escolha na coluna "⭐ Escolha". Se aceitar tudo, esse é o registro. Para mudar uma, responda o número.

| # | Pergunta | ⭐ Escolha | Fontes |
|:--|:--|:--|:--|
| D1 | Tempo sem uso no totem antes de zerar | 45 s | kiosk.md Q1 |
| D2 | Recibo digital (e-mail, SMS) no piloto | Fora: recibo impresso ou número na tela | kiosk.md Q2; platform.md P40, P41 |
| D3 | Vídeo no atrativo do totem | Só imagens | kiosk.md Q5; backoffice-store-ops.md Q11 |
| D4 | Código promocional: quem valida | Cliente digita e aplica; sem passo do garçom | kiosk.md Q7; menu-supplement-1.md Q19; menu-supplement-2.md Q20 |
| D5 | Número do pedido | Zera todo dia de negócio (não à meia-noite) | kiosk.md Q9; platform.md Q4 |
| D6 | Item esgotado no totem e no QR | Cinza com "Esgotado" | kiosk.md Q10; backoffice-menu.md Q1 |
| D7 | Desconto sênior | Fora do piloto | kiosk.md Q12; backoffice-menu.md Q9; platform.md P128 |
| D8 | Assentos por mesa | Um número por mesa | waiter-table-qr.md OQ-8 |
| D9 | Número de mesa válido | Existe na lista e está ativa | waiter-table-qr.md OQ-9 |
| D10 | Pessoas na mesa | Obrigatório ao abrir, de 1 a 12; editável até pagar | waiter-table-qr.md OQ-14 |
| D11 | Ações na mesa além de pedir | Só transferir a mesa; sem cancelar item, cortesia ou juntar mesas | waiter-table-qr.md OQ-15 |
| D12 | CPF do cliente | Entra no fechamento da conta | waiter-table-qr.md OQ-20 |
| D13 | Pedido "para quem" por item | Não; a rodada tem uma contagem só | waiter-table-qr.md OQ-21 |
| D14 | Status "servido" | Cozinha marca pronto; garçom marca servido (⚠️ novo status: avisar o parceiro) | waiter-table-qr.md OQ-27 |
| D15 | Cartão da cozinha | Mesa e número da rodada | waiter-table-qr.md OQ-28; kitchen.md Q3 |
| D16 | Segunda rodada na cozinha | Novo cartão, marcado como acréscimo | kitchen.md Q4 |
| D17 | QR da mesa | Token assinado; o número não aparece na URL | waiter-table-qr.md OQ-30 |
| D18 | Campos extras na conta da mesa | Removidos; só CPF | waiter-table-qr.md OQ-32; backoffice-store-ops.md Q4; platform.md P156 |
| D19 | Relatórios com contas | Só o relatório de conta de mesa | waiter-table-qr.md OQ-37 |
| D20 | Cadastro de cliente | Sem tela própria; dados só no pagamento e na nota | waiter-table-qr.md OQ-36 |
| D21 | Aviso ao garçom | Dentro do app, ao vivo | waiter-table-qr.md OQ-26 |
| D22 | Quadro da cozinha | Um quadro só; sem estações, armários ou impressora por setor | kitchen.md Q2 |
| D23 | Busca de pedido no quadro | Sem busca no quadro; a lista de retirados tem busca | kitchen.md Q7 |
| D24 | Pedido não retirado no fechamento | Um resultado só: "não retirado" | kitchen.md Q5 |
| D25 | Mensagens da cozinha ao cliente | Nenhuma | kitchen.md Q9; platform.md P136 |
| D26 | Sistemas e e-mails externos (StaffFeed, e-mails automáticos, feed de atividade, mensagens a outros apps) | Fora do MVP | kitchen.md Q10; backoffice-store-ops.md Q7; platform.md P133, P134, P135 |
| D27 | Tempo de preparo | Em minutos | backoffice-store-ops.md Q6 |
| D28 | Horário de salão e de viagem | Campos novos `Hours.dineIn` e `Hours.takeOut` | backoffice-store-ops.md Q2 |
| D29 | Tema e logo da loja | Só o protótipo aprovado; sem editor de loja | backoffice-store-ops.md Q9 |
| D30 | Cliente que volta | Reconhecido pelo telefone | backoffice-store-ops.md Q10 |
| D31 | Horário no sistema | UTC no Core; converter na borda | platform.md Q5 |
| D32 | Tentativas de conexão | Carregar config a cada 5 s; tela offline a cada 10 s | platform.md Q11 |
| D33 | Métricas e rastreio de erro (GA4, Sentry) | Sem serviço de terceiros no piloto | platform.md P108, P159, P160 |
| D34 | "Manter conectado" no backoffice | Opcional, renova a cada 3 h, como na referência | platform.md P114 |
| D35 | Login social, login único (SSO) e convite por link | Fora do MVP | platform.md P116, P139 |
| D36 | Usuários do backoffice | Um login de dono no piloto | platform.md P115 |
| D37 | Formulário de feedback de produto | Fora | platform.md P130 |
| D38 | Publicar cardápio | Vale ao salvar; sem rascunho e sem tela de progresso | backoffice-menu.md Q14; platform.md P144 |
| D39 | Primeiro cardápio | Digitado no editor; sem importar CSV | backoffice-menu.md Q15; platform.md P145 |
| D40 | Cardápio por tipo de pedido | Um cardápio só; os canais controlam o que aparece | menu-supplement-3.md Q19 |
| D41 | Flag de mesa nos itens | `seatFlag` cobre pedido de mesa e pagar na mesa | backoffice-menu.md Q16 |
| D42 | Validação ao salvar | Bloqueia só os erros das regras V1 | backoffice-menu.md Q17 |
| D43 | Selos (badges) | Lista da loja; itens referenciam o selo | backoffice-menu.md Q3 |
| D44 | Ações de tag (mensagem na cesta) | Cortadas (conflito: a lista de tags precisa de decisão própria) | backoffice-menu.md Q4; menu-supplement-2.md Q4 |
| D45 | Modificador sem limite máximo | `max` 0 = sem limite, no contrato (avisar o parceiro) | backoffice-menu.md Q5 |
| D46 | Sugestão de item (cross-sell) | Regra por item, com datas e exclusões | backoffice-menu.md Q11; platform.md P146 |
| D47 | Editor de ofertas | Só o atual (FEAT-045) | backoffice-menu.md Q10 |
| D48 | Fotos dos itens | Upload no próprio servidor (BFF); devolve URL https | backoffice-menu.md Q13 |
| D49 | Preço "a partir de" e opções | Core calcula `displayPrice`; opção só com valor positivo | backoffice-menu.md Q2 |
| D50 | Aviso de alergênicos | Texto do dono e link opcional; sem consentimento e sem texto jurídico | menu-supplement-2.md Q19 |
| D51 | Cupom com código de ID | Cortado | menu-supplement-3.md Q20 |
| D52 | Botão "Para viagem" do totem: qual tipo de pedido ele envia | TAKE_OUT (PICKUP fica só no modelo) | menu-supplement-4.md S4-Q1 (= menu Q27) |
| D53 | Horário de seção que passa da meia-noite (ex.: 22:00 às 02:00) | Sim: horário cujo fim é antes do início vale depois da meia-noite | menu-supplement-4.md S4-Q3 (= menu Q29); backoffice-menu.md S6, V9 |
| D54 | Lista de itens esgotados para o dono: onde fica | Filtro na lista de itens; sem aba nova | menu-supplement-5.md S5-Q3 (= menu Q32) |
| D55 | Subseções e itens na mesma seção: qual ordem | Uma lista só, na ordem que o dono define | menu-supplement-5.md S5-Q4 (= menu Q33) |
| D56 | Minuto exato do fechamento: a seção está aberta? | Não: fecha no próprio minuto (fim exclusivo) | menu-supplement-5.md S5-Q6 (= menu Q35) |

## Já resolvidas pelas decisões

### Resolvidas (8 perguntas)

| Pergunta | Decisão que resolve | Fontes |
|:--|:--|:--|
| Garçom e QR entram no MVP | Decisão 4 (canais) e 12. ⚠️ CLAUDE.md e o README do canvas dizem "fora do MVP": atualizar | waiter-table-qr.md OQ-1 |
| QR mostra só o cardápio: sem pedido, pagamento ou conta | Decisão 4 ("só visualiza o cardápio"). Conta no QR seria mudança da decisão 4 | waiter-table-qr.md OQ-29, OQ-31 |
| Pedido assistido por sessão externa | Decisão 4: o garçom faz os pedidos de mesa; sessão externa fica fora | waiter-table-qr.md OQ-35 |
| Taxa de serviço é percentual em config | Decisão 6 | menu-supplement-1.md Q22 |
| Zonas de entrega e mapa | Decisão 7: entrega só no modelo | menu-supplement-1.md Q20 |
| Limite diário por item | Decisão 3 (`ITEM.dailyLimit`) | backoffice-menu.md Q18 |
| Vários cardápios no estabelecimento (Q26) | Plano e contrato, não uma decisão do brief: o plano prevê cardápio da manhã e da tarde, ou um só para o dia todo, trocando pelo horário (`docs/plan.md`); o contrato tem `listMenus`, `createMenu` e `replaceMenuSchedules`. ⚠️ MODELS 5.1 (uma raiz só) está desatualizado; o contrato vale | backoffice-menu.md Q26; menu-supplement-5.md S5-C10 |

### Só uma opção cortada (a pergunta segue aberta)

| Opção cortada | Decisão que corta | Fontes |
|:--|:--|:--|
| Sem dinheiro como forma de pagamento | Decisão 8 (dinheiro volta) | platform.md Q6 (opção C) |
| Taxa de serviço desligada no piloto | Decisão 8 (taxa de serviço está no escopo) | kiosk.md Q4 (opção C); platform.md Q2 (opção C) |
| Scanner de código de barras | Decisão 11 (hardware na fase 4) | kitchen.md Q7 (opção C) |
| Consentimento e marketing no cadastro de cliente | Decisão 8 (consentimento fica fora) | waiter-table-qr.md OQ-36 (opção C) |
| Tema livre e cores | Decisão 10 (um template) | backoffice-store-ops.md Q9 (opção C) |
| Pedido de POS (importar cardápio e garçons) | Decisão 2 (POS fica fora) | waiter-table-qr.md OQ-3 (opção C) |
| PIN de aprovação de idade | Decisão 10 (aprovação de idade cortada) | platform.md Q9 (nota) |

---

Por que importa: as 23 críticas mudam contrato com o parceiro, dinheiro ou telas inteiras. As 56 do padrão podem ser aceitas de uma vez.
Próximo passo: responda C1 a C23 (pode ser só o número e a letra, como "C1A, C2A, C3A").
