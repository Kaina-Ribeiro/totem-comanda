# Comanda: what is left after v0.2

Nov 4, 2026 · drafted from the three reference specs Kai added (KDS, kiosk BFF, admin dashboard)

Status: **decisions 1 to 17 approved by Kai (4 Nov 2026)**. Contract changes still need the partner's yes before they go into
`contract/openapi.yaml`. `docs/plan.md` still rules the MVP scope.

Prototype of every screen below: see [Prototype](#prototype).

## Summary

- Phases 0 to 3 are built against the mock (release v0.2). What is missing is mostly **how the
  kitchen and the owner run a real day**: the kitchen screen has no sound, no detail, no undo and no
  way to say "we are full"; the back office has no orders screen, no holidays and no real home.
- The kiosk BFF spec describes a service installed on the kiosk. Comanda replaced it on purpose, so
  it adds **screen states and phase 4 rules**, not endpoints.
- The dashboard spec is an enterprise multi-store product (4.1 MB). About **80 % of it is out**
  (delivery, loyalty, POS sync, multi-store, taxes per service). The useful 20 % is listed below.
- 43 gaps, grouped in a fix wave, 4 waves and phase 4. Wave 1 (kitchen) and wave 2 (owner's day) are the ones
  worth having before the pilot.
- 17 decisions approved by Kai (6 of them from a second review pass). 10 contract changes need the
  partner.
- A second, independent review against all three specs (4 Nov) found 2 bugs in v0.2 and a set of
  rules the first pass missed; see [Second review pass](#second-review-pass-4-nov-2026).

## How the specs were read

| Spec | Size | How |
|:--|--:|:--|
| KDS (`kds-functional-specifications`) | 154 KB, 15 files | Read in full in this session; read in full again by a reviewer |
| Kiosk BFF (`bff-functional-specifications`) | 377 KB, 24 files | 11 files read in full in this session; 12 others (loyalty, gift card, face-ID, peripherals, menu resources, health, integrations, background, auth, transformations, data models) read in full by a reader agent; a reviewer read all 24 again, skipping only gift card, room charge and guest identity |
| Dashboard (`dashboard-functional-specifications`) | 4.1 MB, 43 files | Split by domain across 7 reader agents; every domain file read to the end, cross-cutting files (features, journeys, rules, forms, data models, screens) read by ID; a reviewer classified all 101 FEAT ids |

Honest caveat: in the dashboard files about 85 % of each field entry is generated boilerplate
("Empty/reset/persistence", "Acceptance"). Readers checked by script that those lines were identical
templates and read every line that was not. `functional-requirements.md` (1.1 MB) repeats the domain
field entries with the same boilerplate and was only grepped where an entry looked incomplete.

Working notes of each reader (not committed): the session scratchpad `dash/*.md`.

## What already exists (v0.2)

| Area | Built |
|:--|:--|
| Kiosk | Attract, PT/EN, eat here / take away, menu by category, item builder, basket, coupon, CPF/CNPJ, simulated payment, order number, idle reset, cross-sell, closed / maintenance / at capacity / offline screens, `waitTime` on the success screen when Go sends it |
| Kitchen | Three columns (Novos, Preparando, Prontos), one button per step, waiting minutes (red from 10 min), SSE with 2 s polling fallback |
| Back office | Início (placeholder), Esgotados (today only), Relatório (one day), Cardápios with windows and force, Categorias, Itens with option groups and combos, Selos e sugestões, Cupons, Aparelhos (per-device maintenance, at capacity, idle timer), Loja |

## What is missing

Priority: **P1** = before the pilot · **P2** = good for the pilot, can slip · **Later** = after the
pilot · **Phase 4** = with the payment terminal, printers and NFC-e.
"Contract" = needs a change in `contract/openapi.yaml` (partner approval).

### Kitchen screen (epic E3)

| ID | Gap | Spec refs | Prio | Contract | Artboard |
|:--|:--|:--|:--|:--|:--|
| G-K1 | **New-order alert**: sound that repeats until someone touches the screen, new cards highlighted, "2 pedidos novos" bar (replaces the spec's popup, so no "hide popup" setting), tab title flashes. "Ativar som" on start, because Chromium blocks audio until the first touch. Per-device choice of sound and repeat; "repeat until touched" is our default, the spec's default is "once" (kept as a setting) | KDS FEAT-016/017/018, SCR-013/014, CFG-012/013, WF-6 | P1 | No | K1, K5 |
| G-K2 | **Order detail** drawer: lines with options, type, time placed and waiting, status history, actions | KDS FEAT-019/027, SCR-007 | P1 | Yes: status history on `KitchenOrder` | K2 |
| G-K3 | **Undo**: 5 s "Desfazer" after each move, and "Voltar uma etapa" in the detail. Our proposal: the KDS has no recall (its scope boundary excludes it). Today one wrong tap on "Retirado" loses the order from the screen. Needs a stale-event guard, because a late event for the old status could put a card back | None (deviates from the KDS scope on purpose) | P1 | Yes: allow READY→PREPARING and COLLECTED→READY the same day; `updatedAt` or `version` on `KitchenOrder` | K1, K2 |
| G-K4 | **"Acabou" from the order**: marks the item (or one option) sold out for today without leaving the kitchen. The order already placed stays open (BR-027); if it cannot be made, G-K11 cancels it | KDS FEAT-028, BR-027, JRN-015 | P1 | Yes: kitchen-device sold-out call, item and option ids on order lines | K2 |
| G-K5 | **Kitchen pace**: Normal / Movimentado / Pausado. Movimentado raises the wait shown on the kiosk success screen; Pausado puts the kiosk on the at-capacity screen, with auto-resume after 15 or 30 min (clock in America/Sao_Paulo). One store-level state, also on the back office home (G-A1) | KDS FEAT-040, BR-028, CFG-041, WF-10; dashboard FEAT-017 (CFG-056..058 prep times); BFF BR-SES-03 as an analogy only (there AT_CAPACITY is automatic) | P1 | Yes: store pace + wait minutes per level (closes the `waitTime` open question) | K4, A1, T3 |
| G-K6 | **Produção**: totals to make across Novos + Preparando (not Prontos), by item and options ("4× Pão na chapa: 2 manteiga, 2 requeijão") | KDS FEAT-039, WF-12 | P2 | No | K3 |
| G-K7 | **Retirados hoje**: today's collected orders, search by number, move one back to Prontos | KDS FEAT-042, FEAT-013 | P2 | Yes: list collected orders | K1 (tab) |
| G-K8 | **Waiting colours in 3 steps**: on time, attention (5 min), late (10 min) | Our design (KDS FEAT-010 ageing is for banner rows, 30/60 s) | P2 | No | K1 |
| G-K9 | **Encerrar o dia**: at closing, confirm with the count of unpicked orders, then clear the board. Unpicked orders are not recorded as Retirado (that says they were handed over); they stay visible to the owner as "não retirado" | KDS FEAT-033, BR-022, SCR-012a, JRN-017 | P2 | Yes: a "não retirado" outcome or a batch call | — |
| G-K10 | Kitchen printer: print each paid order once per device, reprint from the detail; printer setup per device (model, address, line width); options printed in a fixed order. Do not port the reference's broken print-all modal | KDS FEAT-034/035/037, BR-024/025/026/031, SCR-017, CFG-006/020..022 | Phase 4 | Yes | — |
| G-K11 | **Cancel an order** that cannot be made (after "Acabou"), confirmed with the owner's login, not a PIN. While payment is simulated, cancel needs no refund; in phase 4 it opens the refund (G-A3) | KDS FEAT-023, BR-006 | **P1** (was Later) | Yes: `POST` order cancel | K2 |
| G-K12 | **Failed move is visible**: a status change that fails shows an error with "Tentar de novo" and the card stays where Go has it. Today `advance()` ignores a failed result, so a tap can do nothing silently | KDS BR-012, error-and-offline scenario 3 | **P1 (bug in v0.2)** | No | — |
| G-K13 | Refresh button on the board and a full refetch every 60 s while live, so a lost event never leaves the board wrong until a reload | KDS WF-11, SCR-001 | P2 | No | K1 |

### Back office (epics E1 and E3)

| ID | Gap | Spec refs | Prio | Contract | Artboard |
|:--|:--|:--|:--|:--|:--|
| G-A1 | **Real Início**: today's revenue, orders and average ticket; kiosk and kitchen online; menu live now and next switch; kitchen pace with Pausar; sold out today; catalogue problems. Also fixes COM-67 (fixed "Bom dia!") | Dashboard FEAT-012, ACT-032; BFF health "minutes since last order" | P1 | No (existing endpoints) | A1, A10 |
| G-A2 | **Pedidos**: orders of a day, filter by status, search by number, detail with lines, coupon, total, payment and timeline; cancelled and "não retirado" orders included | Dashboard FEAT-074, SCR-153/154, BR-049 | P1 | Yes: `GET /v1/admin/orders`, `GET /v1/admin/orders/{id}` | A2 |
| G-A3 | Refund dialog: full or partial, amount ≤ paid − refunded, reason (item esgotado, cancelamento, reclamação), irreversible confirmation | Dashboard FEAT-074 DLG-009 FORM-085 BR-047; KDS FEAT-025 BR-009/010/011 | Phase 4 | Yes | A3 |
| G-A4 | **Sold out with a duration, and hidden ≠ sold out**: "só hoje", "até eu liberar", "até uma data"; separate "Mostrar no totem" switch (sold out shows greyed, hidden disappears); options can be sold out too. The kitchen reads back what is sold out, so "Esgotado hoje" survives a reload (COM-100) | Dashboard DLG-005, CFG-181/182/183/188, BR-241/242, FEAT-034; KDS FEAT-045, SCR-021 | P1 | Yes: `unavailableUntil`, `visible`, option availability, `GET /v1/kitchen/availability` | A4 |
| G-A5 | **Special dates**: closed day or special hours, one day or a range, message to the guest in PT and EN, list with Agendada / Hoje / Encerrada | Dashboard FEAT-030, FORM-024, JOURNEY-006, BR-017/018/019 | P1 | Yes: special dates CRUD; Go applies them to `isOpen`, `nextOpeningAt`, `closedMessage` | A5, T4 |
| G-A6 | **Change password**. Forgot password stays a manual reset for the pilot (no email sender yet) | Dashboard FEAT-010 FORM-005, FEAT-001 DLG-001 | P1 | Yes | — (simple form) |
| G-A7 | **Allergens on the item**: "não informado" / "sem alergênicos" / list; "pode conter" (traces); vegetariano, vegano; calories optional. The spec uses free tags; the fixed ANVISA list is our decision 7 | Dashboard FEAT-033 CFG-191/213, FEAT-037, FEAT-070, BR-045, DEP-F32 | P2 (recommended before the pilot) | Yes: item fields | A6, T2 |
| G-A8 | **Option rules**: exclusive "Nenhum" option, default quantity, blank maximum = no limit, checks for min > max and for a required group that cannot be satisfied | Dashboard FEAT-034, DLG-006, BR-020…026, BR-224/229/243 | P2 | Yes: `supersedes`, `defaultQuantity` | A6, T2 |
| G-A9 | **"Pronto para vender?"**: about 15 catalogue checks with severity (no price, no photo, empty category, impossible option group, no menu live now…), each linking to the fix, never blocking a save | Dashboard FEAT-038, JOURNEY-020, DLG-015, BR-200…257 (subset) | P2 | No (BFF computes) | A1 |
| G-A10 | **Attract screen images**: ordered list, seconds per image (default 15), on/off per image, 9:16 guidance, falls back to today's photo | Dashboard FEAT-064, CFG-539…563, DLG-012, BR-042 | P2 | Yes: media list | A7 |
| G-A11 | **Kiosk messages**: owner edits the closed, paused and unavailable texts in PT and EN, with preview and "restore default" | Dashboard FEAT-082, CFG-713…716, CFG-539/546 (display priority) | P2 | Yes: per-state messages (today only `closedMessage`) | A7 |
| G-A12 | **Coupon rules**: minimum order, maximum discount, total uses cap with counter (a use counts only when the order is paid), one coupon per order, the total never below zero (a discount larger than the basket is refused with a problem code, never clamped silently), clear the amount when switching % / R$. Category or item target later | Dashboard FEAT-045, CFG-352…375, BR-037/038/060; BFF FR-ORD-008, BR-LOY-02, EP-LOY-03 | P2 (the "never below zero" check is P1) | Yes: discount fields, redemption count | A8 |
| G-A13 | **Report by period + CSV**: Hoje, Ontem, 7 dias, 30 dias, Este mês, Mês passado, custom; revenue by day, best days, best sellers, coupon use, cancellations. Also fixes COM-68 | Dashboard FEAT-077, ACT-531/532/537 | P2 | Yes: report with `from`/`to` | A9 |
| G-A14 | Fiscal data for NFC-e: seller name, IE, tax regime, address, CEP; per-item fiscal fields (NCM, unit, origin, CST/CSOSN); receipt QR and consult URL. Validate the list with the NFC-e provider | Dashboard FEAT-049/050/051/099 | Phase 4 | Yes | — |
| G-A15 | "Balcão" login that only sees Esgotados and today's orders | Dashboard FEAT-013, PERM-007, PERM-024 | Later | Yes (Go must enforce) | — |
| G-A16 | Suggestion rules: how many to show, order, trigger by basket value or category | Dashboard FEAT-055 | Later | Yes | — |
| G-A17 | "Totem já pegou o cardápio novo" on Aparelhos | Dashboard FEAT-039 (awaiting kiosk confirmation) | Later | Yes: menu ETag in heartbeat | — |
| G-A18 | **"Comer aqui" and "Para viagem" cannot both be off**: Loja saves both off today, leaving a kiosk with nothing to sell | Dashboard FEAT-063, BR-041 | **P1 (bug in v0.2)** | No (Go should refuse too) | — |
| G-A19 | **Privacy notice on the CPF step**: one short LGPD line on the kiosk where the guest types CPF/CNPJ, text editable in Loja. The consent workflow stays cut | Dashboard FEAT-066/067 | P1 (decision 13) | Yes: notice text in kiosk config | — |
| G-A20 | Store phone (and address) on Loja and on the closed and paused screens ("Ligue: …") | Dashboard FEAT-015 | P2 | Yes | T3, T4 |
| G-A21 | "Fechar a loja agora": closes the kiosk with a message until the next menu window. Today the owner has to edit windows or put each kiosk in maintenance | Dashboard FEAT-018 | P2 | Yes (store override) | A1 |
| G-A22 | Daily limit per item ("só 30 croissants hoje"): Go counts sold units and marks it sold out at the limit | Dashboard FEAT-033 (CFG-200) | P2 | Yes: `dailyLimit` | A4 |
| G-A23 | Owner alerts by e-mail (kiosk offline for 10 min, optionally each order). Needs an e-mail sender | Dashboard FEAT-085/086 | Later | Yes | — |

### Kiosk (epic E2)

| ID | Gap | Spec refs | Prio | Contract | Artboard |
|:--|:--|:--|:--|:--|:--|
| G-T1 | Sold-out item shown greyed with "Esgotado" (not tappable); hidden item absent. A category shows only with at least one available, visible item; no category left = the unavailable screen, never an empty grid | BFF DT-MNU, BR-MNU-02, BR-BKG-04; dashboard BR-241 | P1 (with G-A4) | With G-A4 | T1 |
| G-T2 | Allergens on the item screen and a small mark on the card; exclusive "Nenhum" option; sold-out option greyed | Dashboard FEAT-033/037/034 | P2 (with G-A7/A8) | With G-A7/A8 | T2 |
| G-T7 | Item note ("sem cebola"), up to 60 characters, shown on the kitchen card and detail | Dashboard FEAT-016 (CFG-203, CFG-048..050) | P2 (decision 15) | Yes: note on order line | — |
| G-T3 | Paused screen with the owner's message and "volta em ~15 min" | BFF BR-SES-03, DM-OPS-02; dashboard FEAT-082 | P1 (with G-K5) | With G-K5 | T3 |
| G-T4 | Closed screen for a special date ("Fechado hoje: Natal. Voltamos sábado às 06:00") | Dashboard FEAT-030 | P1 (with G-A5) | With G-A5 | T4 |
| G-T5 | Attract screen rotates the owner's images | Dashboard FEAT-064 | P2 (with G-A10) | With G-A10 | — |
| G-T6 | Payment errors by cause: refused, card not read, insufficient funds, connection, timeout, refund error, unknown status (reference codes PE01/02/03/04/06/07/08/09); an unknown status is never shown as refused or paid. "Paid but not sent to the kitchen" screen with the number for the counter (order statuses PAID_POS_ERROR, CANCEL_OR_REFUND_ERROR); printer out of paper keeps the number on screen; reprints marked as duplicates | BFF payments, DM-PAY-02/04, BR-ORD-03, DM-RCP-02, DT-RCP-01 | Phase 4 | Yes | — |

### Rules found in the specs (no new screen)

- Swap the menu and config only when a new journey starts, never mid-order (BFF BG-BKG-01, INT-05). Comanda already loads the menu once per journey; keep it that way when ETags change.
- **Timeouts on every Go call** (BFF BR-XC-04): today the server Core client has none. Budgets: reads 5 s; order placement 15 s in total, retries included; payment calls per provider in phase 4. **P1.**
- **Order placement never reports "failed" while the result is unknown**: retry the POST with the same `Idempotency-Key` inside the 15 s budget (Go returns the first result); if still unknown, show "verificando seu pedido" with the number lookup, never a new key. The reference polls 3 × 5 s and then reports failure even if the order exists (BFF INT-13/14, BR-ORD-04): do not copy that.
- **Screen precedence** when states overlap (BFF BR-SES-02/03/04; our proposal, decision 14): Offline > Maintenance > Closed (hours or special date) > Paused > Live. One test per overlapping pair.
- **Opening hours = the menu windows.** There is no separate weekly store schedule (dashboard FEAT-024/025); special dates (G-A5) and "fechar agora" (G-A21) override it.
- Menu windows are start-inclusive, end-exclusive (11:00 belongs to the afternoon menu); the reference counts the close minute as open (BFF BR-SES-04): do not copy. Server time in America/Sao_Paulo only; the kiosk never decides open, closed or menu from its own clock (BR-MNU-01).
- Fail closed: Go unreachable means the offline screen, never a live menu without quotes (BFF BG-BKG-07 is fail-open: do not copy). The offline screen retries every 10 s; one missed read does not flip a live kiosk offline (BG-BKG-08).
- Retries: GET reads up to 2 times with short backoff; POST order and payment only with `Idempotency-Key`; never retry a 4xx or a money call blindly (BFF BR-SVC-03).
- A missing English name falls back to Portuguese, never blank (BFF FR-MNU-003).
- Personal data: never log order or payment bodies, redact CPF/CNPJ, keep CPF only as long as the NFC-e needs it (LGPD). No literal credentials in code: `src/app/api/dev/core/route.ts` holds the mock's device secret and goes before the pilot.
- Validate every Server Action input before calling Go (ids, quantity bounds, string lengths, CPF checksum); the reference parses bad JSON into null silently (BFF DT-ORD-01). A validator library is a new dependency: ask Kai first.
- Phase 4 payments: authorise, place the order, then capture; void or refund on any failure (BFF FR-PAY-007); every payment step has a hard deadline that cancels the terminal read and returns to the basket, since the idle timer is off while paying (BR-SES-07); check terminal readiness before offering the method (BR-SES-02); Pix shows pending, expiry and cancel (EP-PAY-09..11); the BFF keeps no payment state in memory, and a payment that cannot be recorded in Go is shown to the owner, never dropped (BR-PAY-02, BG-BKG-11).
- "Authorised" is not "paid": in phase 4 the success screen follows the Go order status (BFF DM-PAY-04, FR-PAY-007; BR-PAY-03 contradicts them).
- Do not copy the reference's unauthenticated local API, its generic `/proxy/**` route or its unguarded static route (BFF EP-OPS-08, EP-MNU-07).
- Kitchen delivery must never decide whether an order succeeded; the kitchen catches up on reconnect (BFF INT-16). Comanda already does both.

## Cut on purpose (out of the MVP)

Loyalty and stamp cards ("Selos" in the back office are item badges, already built), gift cards,
room charge, face-ID, crypto, cash machines, food stamps, staff PIN and age approval, delivery and
marketplaces, POS sync, menu import and push, multi-store groups, templates and publish targets, tax
groups per service (NFC-e API in phase 4 instead), customer accounts and guest conversion, guest
name and contact, consent flows and legal document management (the privacy notice G-A19 stays in),
email and SMS receipts, customer "your order is ready" messages (the number on the kiosk is the
call), SaaS billing, demo mode, keyboard-wedge scanner search and order search on the open board,
locker and event pickup.

## Decisions for Kai

All 17 decisions were **approved by Kai on 4 Nov 2026** as recommended (12 to 17 came from the
second review pass).

| # | Question | Recommendation |
|--:|:--|:--|
| 1 | Which gaps enter the MVP scope? | Waves 1 and 2 (all P1). P2 by wave, after the pilot starts if time is short |
| 2 | Can the kitchen move an order back? | Yes: READY→PREPARING and COLLECTED→READY, same business day only, with a 5 s undo after each move |
| 3 | Where does "pause" live? | One store-level pace (Normal / Movimentado / Pausado) set from the kitchen or Início, auto-resume after 15 or 30 min. Per-device at capacity in Aparelhos stays for maintenance |
| 4 | What is `waitTime`? (open question in data-model-and-api.md) | Minutes per pace level, set by the owner (e.g. Normal 8, Movimentado 15). Computing it from the queue comes later |
| 5 | Hidden vs sold out | Two flags. Sold out shows greyed "Esgotado"; hidden disappears. Sold out has a duration: today, until released, until a date |
| 6 | Special dates vs menu windows | A closed special date closes every menu; special hours replace the windows for that date; the owner's "force menu" still wins. Our proposal: the spec leaves this precedence open (dashboard BR-019) |
| 7 | Allergens | Fixed list following the ANVISA RDC 26/2015 groups (glúten: trigo, centeio, cevada, aveia; leite; ovos; soja; amendoim; castanhas e nozes; peixes; crustáceos; látex natural) plus "pode conter", with an explicit "não informado" state so an empty list never reads as "safe". The owner is responsible for the data; the screen says so |
| 8 | Refunds and cancellations | None in the MVP while payment is simulated. With phase 4: refund from the order detail through the payment provider, owner only |
| 9 | Coupon limits | A total uses cap counted by Go (guests are anonymous, so no per-customer limit). Minimum order and maximum discount in cents |
| 10 | Report day | Business day in America/Sao_Paulo with a cut-off hour (proposal 04:00). Cancelled and refunded orders shown on their own line, not silently subtracted |
| 11 | A second login ("Balcão") | Not now. Revisit after a week of pilot |
| 12 | Cancel an order from the kitchen (G-K11) | Yes, P1 with "Acabou", confirmed with the owner's login (email + password), no PIN. Cancelled orders show in Pedidos and the report |
| 13 | Privacy notice on the CPF step (G-A19) | Yes, one short line with an editable text in Loja; a lawyer checks the wording before the pilot |
| 14 | Screen precedence on the kiosk | Offline > Maintenance > Closed > Paused > Live |
| 15 | Item note on the kiosk (G-T7) | Yes in wave 3, 60 characters, shown on the kitchen card |
| 16 | Fee on the order (packaging, service) | No for the pilot |
| 17 | Orders for another day or time (pre-order) | Not in the pilot |

Payment methods (dashboard FEAT-079) are already settled in `docs/plan.md`: no cash in Comanda;
card terminal or Pix on screen stays that plan's open question for phase 4.

## Contract changes to propose (partner approval)

1. Kitchen: status history and `updatedAt` (or `version`) on `KitchenOrder`; item and option ids on lines; backward transitions; list collected orders; kitchen-device sold-out; order cancel confirmed by the owner; a "não retirado" outcome for closing.
2. Store pace: `pace` (NORMAL, BUSY, PAUSED), `pausedUntil`, wait minutes per level; Go sets `atCapacityMode` and `waitTime` from it.
3. Availability: `unavailableUntil` and `visible` on items; availability on options.
   `GET /v1/kitchen/availability` for the kitchen device: the items and options unavailable
   right now, in the same shape the `PUT` returns, read when the board opens and on its 60 s
   reload (COM-100; modelled on the KDS "Unavailable items" list, FEAT-045). Ask the partner
   whether the kitchen stream also sends an `availability.changed` event.
4. Special dates: CRUD, applied by Go to `isOpen`, `nextOpeningAt` and `closedMessage`.
5. Orders for the owner: list by day with status and number filters, detail with timeline.
6. Item fields: allergens, traces, vegetarian, vegan, calories; option `supersedes` and `defaultQuantity`.
7. Kiosk content: attract media list and seconds per image; per-state guest messages.
8. Coupons: `minimumSubtotalCents`, `maxDiscountCents`, `maxRedemptions`, `redemptionCount` (counted on payment); a problem code when the discount exceeds the basket.
9. Owner account: change password. Report with `from`/`to`.
10. Store: phone and address; "close now" override; privacy notice text; `dailyLimit` on items. Go also refuses dine-in and take-out both off.

Coupon errors: the reference defines no error codes (BFF EP-LOY-01 returns a free-text message),
so the `code` list for coupons is ours to write in the contract.

## Suggested order

| Wave | Release line | Gaps | Web points (rough) |
|:--|:--|:--|--:|
| 0 · Fixes, no contract change | v0.3 | G-K12, G-A18, Go-call timeouts and the order-timeout rule, dev-route secret out | 5 |
| 1 · Kitchen runs a rush | v0.3 | G-K1, K2, K3, K4, K5, K11 + T3, screen precedence | 26 |
| 2 · The owner's day | v0.3 or v0.4 | G-A1, A2, A4 + T1, A5 + T4, A6, A19 | 30 |
| 3 · Richer catalogue | v0.4 | G-A7, A8 + T2, A9, A12, T7, K6, K7, K8, K9, K13 | 39 |
| 4 · Kiosk showcase and numbers | v0.5 | G-A10 + T5, A11, A13, A20, A21, A22 | 27 |
| Phase 4 | with hardware | G-K10, A3, A14, T6 | in E4 |

Points are for the Next.js side only; the Go side is the partner's estimate. Each wave becomes
stories in Linear (`linear-backlog` skill) when its work starts.

Can start before the partner approves the contract changes (no contract needed): wave 0, G-K1,
G-K6, G-K8, G-K13, the parts of G-A1 that use existing endpoints, and bringing the built back office
in line with the prototype's type (Manrope headings, icon sidebar).

## Second review pass (4 Nov 2026)

The three spec folders were checked again (same files as the first pass, unchanged since 04:25) by
three independent reviewers, one per spec, against this plan and the v0.2 code. What changed here:

- **2 bugs in v0.2**, confirmed in code: a failed kitchen move is silent (`kitchen-board.tsx`
  `advance()` ignores a failed result; G-K12) and Loja saves "Comer aqui" and "Para viagem" both off
  (G-A18). Also confirmed: the server Core client has no timeout (`src/lib/core/client.ts`), and the
  dev route holds the mock's device secret in code.
- New rows: G-K11 moved to P1, G-K12, G-K13, G-A18 to G-A23, G-T7. Rows corrected: G-K1, K3, K4, K5,
  K6, K8, K9, K10, A2, A7, A11, A12, A13, A14, A15, T1, T6 (wrong or missing spec refs, scope details).
- Rules added for timeouts, unknown order results, screen precedence, opening hours, window
  boundaries, fail-closed, retries, translation fallback, personal data, input validation and
  phase 4 payments. Decisions 12 to 17 added.
- Reviewer notes (not committed): session scratchpad `review-kds.md`, `review-bff.md`,
  `review-dashboard.md`.

## Prototype

Design canvas "Comanda · o que falta": https://claude.ai/artifact/NARUZVhf5tz1Xe4vexq344 (shared
by link). Kitchen (landscape tablet, 1280 × 800), back office (page, 1440 wide plus one
phone frame) and kiosk deltas (same 720 × 1280 canvas as the approved prototype, × 1.5 for the real
1080 × 1920 screen). Same colour tokens, photos and prices as the approved prototype; kitchen and
back office use Manrope for headings and numbers (see `prototype/README.md`). Sources in
`docs/prototype/ops/project/`. Most artboards are clickable (Play): pace, sound, filters, sold-out
duration, allergens, exclusive option, coupon type and report period change state.

| Artboard | Shows |
|:--|:--|
| K1 Pedidos | Board with new-order bar, 3-step waiting colours, undo toast, pace and sound in the header |
| K2 Detalhe | Order drawer: lines with "Acabou", history, back one step |
| K3 Produção | Totals to make across open orders |
| K4 Ritmo | Normal / Movimentado / Pausar with duration |
| K5 Ativar som | First-touch sound prompt and sound choice |
| A1 Início | Today, now, pace, sold out, "Pronto para vender?" |
| A2 Pedidos | Orders of the day with the detail panel |
| A3 Estorno | Refund dialog (phase 4) |
| A4 Esgotados | Duration sheet, hidden vs sold out, options |
| A5 Datas especiais | List and form with kiosk preview |
| A6 Item | Kiosk visibility, allergens, option rules |
| A7 Tela do totem | Attract images and guest messages |
| A8 Cupom | Minimum, maximum, uses cap, live summary |
| A9 Relatório | Period presets, daily revenue, best sellers, coupons, CSV |
| A10 Início no celular | Phone layout of the home |
| T1 Cardápio | Sold-out item greyed |
| T2 Item | Allergens, exclusive "Nenhum", sold-out option |
| T3 Pausado | At-capacity screen with the owner's message |
| T4 Fechado | Special-date closed screen |
