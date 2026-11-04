# Comanda: what is left after v0.2

Nov 4, 2026 · drafted from the three reference specs Kai added (KDS, kiosk BFF, admin dashboard)

Status: **proposal for Kai**. Nothing here is decided until Kai (and the partner, for anything that
touches `contract/openapi.yaml`) says yes. `docs/plan.md` still rules the MVP scope; every row
marked "new to the MVP" needs that explicit yes (plan.md, risk "scope creep").

Prototype of every screen below: see [Prototype](#prototype).

## Summary

- Phases 0 to 3 are built against the mock (release v0.2). What is missing is mostly **how the
  kitchen and the owner run a real day**: the kitchen screen has no sound, no detail, no undo and no
  way to say "we are full"; the back office has no orders screen, no holidays and no real home.
- The kiosk BFF spec describes a service installed on the kiosk. Comanda replaced it on purpose, so
  it adds **screen states and phase 4 rules**, not endpoints.
- The dashboard spec is an enterprise multi-store product (5.5 MB). About **80 % of it is out**
  (delivery, loyalty, POS sync, multi-store, taxes per service). The useful 20 % is listed below.
- 34 gaps, grouped in 4 waves plus phase 4. Wave 1 (kitchen) and wave 2 (owner's day) are the ones
  worth having before the pilot.
- 11 decisions are waiting for Kai, each with a recommendation. 9 contract changes need the partner.

## How the specs were read

| Spec | Size | How |
|:--|--:|:--|
| KDS (`kds-functional-specifications`) | 157 KB, 15 files | Read in full in this session |
| Kiosk BFF (`bff-functional-specifications`) | 380 KB, 23 files | 11 files read in full in this session; the other 12 (loyalty, gift card, face-ID, peripherals, menu resources, health, integrations, background, auth, transformations, data models) read in full by a reader agent |
| Dashboard (`dashboard-functional-specifications`) | 5.5 MB, 43 files | Split by domain across 7 reader agents; every domain file read to the end, cross-cutting files (features, journeys, rules, forms, data models, screens) read by ID |

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
| G-K1 | **New-order alert**: sound that repeats until someone touches the screen, new cards highlighted, "2 pedidos novos" bar, tab title flashes. "Ativar som" on start, because Chromium blocks audio until the first touch. Per-device choice of sound and repeat | KDS FEAT-016/017/018, SCR-013/014, BR-013, WF-6 | P1 | No | K1, K5 |
| G-K2 | **Order detail** drawer: lines with options, type, time placed and waiting, status history, actions | KDS FEAT-019/027, SCR-007 | P1 | Yes: status history on `KitchenOrder` | K2 |
| G-K3 | **Undo**: 5 s "Desfazer" after each move, and "Voltar uma etapa" in the detail. The KDS has no recall at all (its README gaps 4 and 6 show the cost); today one wrong tap on "Retirado" loses the order from the screen | KDS FEAT-022, BR-012 (our proposal) | P1 | Yes: allow READY→PREPARING and COLLECTED→READY the same day | K1, K2 |
| G-K4 | **"Acabou" from the order**: marks the item (or one option) sold out for today without leaving the kitchen | KDS FEAT-028, BR-027, JRN-015 | P1 | Yes: kitchen-device sold-out call, item and option ids on order lines | K2 |
| G-K5 | **Kitchen pace**: Normal / Movimentado / Pausado. Movimentado raises the wait shown on the kiosk success screen; Pausado puts the kiosk on the at-capacity screen, with auto-resume after 15 or 30 min. One store-level state, also on the back office home (G-A1) | KDS FEAT-040, BR-028, WF-10; dashboard FEAT-017 and store mode CFG-059; BFF BR-SES-03 | P1 | Yes: store pace + wait minutes per level (closes the `waitTime` open question) | K4, A1, T3 |
| G-K6 | **Produção**: totals to make across open orders, by item and options ("4× Pão na chapa: 2 manteiga, 2 requeijão") | KDS FEAT-039, WF-12 | P2 | No | K3 |
| G-K7 | **Retirados hoje**: today's collected orders, search by number, move one back to Prontos | KDS FEAT-042, FEAT-013 | P2 | Yes: list collected orders | K1 (tab) |
| G-K8 | **Waiting colours in 3 steps**: on time, attention (5 min), late (10 min) | KDS FEAT-010 ageing | P2 | No | K1 |
| G-K9 | **Encerrar o dia**: move every Pronto to Retirado at closing | KDS FEAT-033, BR-022, JRN-017 | P2 | No (loop) or yes (batch) | — |
| G-K10 | Kitchen printer: print each paid order once per device, reprint from the detail | KDS FEAT-034/035/037, BR-024/025/026 | Phase 4 | Yes | — |
| G-K11 | Cancel an order at the counter with the owner's PIN | KDS FEAT-023, BR-006 | Later | Yes | — |

### Back office (epics E1 and E3)

| ID | Gap | Spec refs | Prio | Contract | Artboard |
|:--|:--|:--|:--|:--|:--|
| G-A1 | **Real Início**: today's revenue, orders and average ticket; kiosk and kitchen online; menu live now and next switch; kitchen pace with Pausar; sold out today; catalogue problems. Also fixes COM-67 (fixed "Bom dia!") | Dashboard FEAT-012, ACT-032; BFF health "minutes since last order" | P1 | No (existing endpoints) | A1, A11 |
| G-A2 | **Pedidos**: orders of a day, filter by status, search by number, detail with lines, coupon, total, payment and timeline | Dashboard FEAT-074, SCR-153/154, BR-049 | P1 | Yes: `GET /v1/admin/orders`, `GET /v1/admin/orders/{id}` | A2 |
| G-A3 | Refund dialog: full or partial, amount ≤ paid − refunded, reason (item esgotado, cancelamento, reclamação), irreversible confirmation | Dashboard FEAT-074 DLG-009 FORM-085 BR-047; KDS FEAT-025 BR-009/010/011 | Phase 4 | Yes | A3 |
| G-A4 | **Sold out with a duration, and hidden ≠ sold out**: "só hoje", "até eu liberar", "até uma data"; separate "Mostrar no totem" switch (sold out shows greyed, hidden disappears); options can be sold out too | Dashboard DLG-005, CFG-181/182/183/188, BR-241/242, FEAT-034 | P1 | Yes: `unavailableUntil`, `visible`, option availability | A4 |
| G-A5 | **Special dates**: closed day or special hours, one day or a range, message to the guest in PT and EN, list with Agendada / Hoje / Encerrada | Dashboard FEAT-030, FORM-024, JOURNEY-006, BR-017/018/019 | P1 | Yes: special dates CRUD; Go applies them to `isOpen`, `nextOpeningAt`, `closedMessage` | A5, T4 |
| G-A6 | **Change password**. Forgot password stays a manual reset for the pilot (no email sender yet) | Dashboard FEAT-010 FORM-005, FEAT-001 DLG-001 | P1 | Yes | — (simple form) |
| G-A7 | **Allergens on the item**: "não informado" / "sem alergênicos" / list; "pode conter" (traces); vegetariano, vegano; calories optional | Dashboard FEAT-033 CFG-191/213, FEAT-037, DEP-F32 | P2 (recommended before the pilot) | Yes: item fields | A6, T2 |
| G-A8 | **Option rules**: exclusive "Nenhum" option, default quantity, blank maximum = no limit, checks for min > max and for a required group that cannot be satisfied | Dashboard FEAT-034, DLG-006, BR-020…026, BR-224/229/243 | P2 | Yes: `supersedes`, `defaultQuantity` | A6, T2 |
| G-A9 | **"Pronto para vender?"**: about 15 catalogue checks with severity (no price, no photo, empty category, impossible option group, no menu live now…), each linking to the fix, never blocking a save | Dashboard FEAT-038, JOURNEY-020, DLG-015, BR-200…257 (subset) | P2 | No (BFF computes) | A1 |
| G-A10 | **Attract screen images**: ordered list, seconds per image (default 15), on/off per image, 9:16 guidance, falls back to today's photo | Dashboard FEAT-064, CFG-539…563, DLG-012, BR-042 | P2 | Yes: media list | A7 |
| G-A11 | **Kiosk messages**: owner edits the closed, paused and unavailable texts in PT and EN, with preview and "restore default" | Dashboard FEAT-082, CFG-713…716 | P2 | Yes: per-state messages (today only `closedMessage`) | A7 |
| G-A12 | **Coupon rules**: minimum order, maximum discount, total uses cap with counter, clear the amount when switching % / R$. Category or item target later | Dashboard FEAT-045, CFG-352…375, BR-037/038/060 | P2 | Yes: discount fields, redemption count | A8 |
| G-A13 | **Report by period + CSV**: Hoje, Ontem, 7 dias, 30 dias, Este mês, Mês passado, custom; revenue by day, best sellers, coupon use, cancellations. Also fixes COM-68 | Dashboard FEAT-077, ACT-531/532/537 | P2 | Yes: report with `from`/`to` | A9 |
| G-A14 | Store details for the receipt: address, CEP, phone | Dashboard FEAT-015, FEAT-051 | Phase 4 | Yes | — |
| G-A15 | "Balcão" login that only sees Esgotados and today's orders | Dashboard FEAT-013, PERM-024 | Later | Yes (Go must enforce) | — |
| G-A16 | Suggestion rules: how many to show, order, trigger by basket value or category | Dashboard FEAT-055 | Later | Yes | — |
| G-A17 | "Totem já pegou o cardápio novo" on Aparelhos | Dashboard FEAT-039 (awaiting kiosk confirmation) | Later | Yes: menu ETag in heartbeat | — |

### Kiosk (epic E2)

| ID | Gap | Spec refs | Prio | Contract | Artboard |
|:--|:--|:--|:--|:--|:--|
| G-T1 | Sold-out item shown greyed with "Esgotado" (not tappable); hidden item absent | BFF DT-MNU (available vs display), dashboard BR-241 | P1 (with G-A4) | With G-A4 | T1 |
| G-T2 | Allergens on the item screen and a small mark on the card; exclusive "Nenhum" option; sold-out option greyed | Dashboard FEAT-033/037/034 | P2 (with G-A7/A8) | With G-A7/A8 | T2 |
| G-T3 | Paused screen with the owner's message and "volta em ~15 min" | BFF BR-SES-03, DM-OPS-02; dashboard FEAT-082 | P1 (with G-K5) | With G-K5 | T3 |
| G-T4 | Closed screen for a special date ("Fechado hoje: Natal. Voltamos sábado às 06:00") | Dashboard FEAT-030 | P1 (with G-A5) | With G-A5 | T4 |
| G-T5 | Attract screen rotates the owner's images | Dashboard FEAT-064 | P2 (with G-A10) | With G-A10 | — |
| G-T6 | Payment errors by cause: refused, card not read, insufficient funds, connection, timeout (reference codes PE01/02/03/07/08/09); "paid but not sent to the kitchen" screen with the number for the counter (PAID_POS_ERROR, CANCEL_OR_REFUND_ERROR); printer out of paper keeps the number on screen | BFF payments, DM-PAY-04, DM-RCP-02 | Phase 4 | Yes | — |

### Rules found in the specs (no new screen)

- Swap the menu and config only when a new journey starts, never mid-order (BFF BG-BKG-01, INT-05). Comanda already loads the menu once per journey; keep it that way when ETags change.
- After a timeout on order placement, wait about 15 s (3 × 5 s) before telling the guest it failed, and retry with the same `Idempotency-Key` (BFF INT-13/14).
- "Authorised" is not "paid": in phase 4 the success screen follows the Go order status (BFF DM-PAY-04).
- Do not copy the reference's unauthenticated local API, its generic `/proxy/**` route or its unguarded static route (BFF EP-OPS-08, EP-MNU-07).
- Kitchen delivery must never decide whether an order succeeded; the kitchen catches up on reconnect (BFF INT-16). Comanda already does both.

## Cut on purpose (out of the MVP)

Loyalty and stamp cards, gift cards, room charge, face-ID, crypto, cash machines, food stamps, staff
PIN and age approval, delivery and marketplaces, POS sync, menu import and push, multi-store groups,
templates and publish targets, tax groups per service (NFC-e API in phase 4 instead), customer
accounts and guest conversion, legal documents and consent flows, email and SMS receipts, SaaS
billing, demo mode, keyboard-wedge scanner search, locker and event pickup.

## Decisions for Kai

| # | Question | Recommendation |
|--:|:--|:--|
| 1 | Which gaps enter the MVP scope? | Waves 1 and 2 (all P1). P2 by wave, after the pilot starts if time is short |
| 2 | Can the kitchen move an order back? | Yes: READY→PREPARING and COLLECTED→READY, same business day only, with a 5 s undo after each move |
| 3 | Where does "pause" live? | One store-level pace (Normal / Movimentado / Pausado) set from the kitchen or Início, auto-resume after 15 or 30 min. Per-device at capacity in Aparelhos stays for maintenance |
| 4 | What is `waitTime`? (open question in data-model-and-api.md) | Minutes per pace level, set by the owner (e.g. Normal 8, Movimentado 15). Computing it from the queue comes later |
| 5 | Hidden vs sold out | Two flags. Sold out shows greyed "Esgotado"; hidden disappears. Sold out has a duration: today, until released, until a date |
| 6 | Special dates vs menu windows | A closed special date closes every menu; special hours replace the windows for that date; the owner's "force menu" still wins |
| 7 | Allergens | Fixed list following the ANVISA RDC 26/2015 groups (glúten: trigo, centeio, cevada, aveia; leite; ovos; soja; amendoim; castanhas e nozes; peixes; crustáceos; látex natural) plus "pode conter", with an explicit "não informado" state so an empty list never reads as "safe". The owner is responsible for the data; the screen says so |
| 8 | Refunds and cancellations | None in the MVP while payment is simulated. With phase 4: refund from the order detail through the payment provider, owner only |
| 9 | Coupon limits | A total uses cap counted by Go (guests are anonymous, so no per-customer limit). Minimum order and maximum discount in cents |
| 10 | Report day | Business day in America/Sao_Paulo with a cut-off hour (proposal 04:00). Cancelled and refunded orders shown on their own line, not silently subtracted |
| 11 | A second login ("Balcão") | Not now. Revisit after a week of pilot |

## Contract changes to propose (partner approval)

1. Kitchen: status history on `KitchenOrder`; item and option ids on lines; backward transitions; list collected orders; kitchen-device sold-out.
2. Store pace: `pace` (NORMAL, BUSY, PAUSED), `pausedUntil`, wait minutes per level; Go sets `atCapacityMode` and `waitTime` from it.
3. Availability: `unavailableUntil` and `visible` on items; availability on options.
4. Special dates: CRUD, applied by Go to `isOpen`, `nextOpeningAt` and `closedMessage`.
5. Orders for the owner: list by day with status and number filters, detail with timeline.
6. Item fields: allergens, traces, vegetarian, vegan, calories; option `supersedes` and `defaultQuantity`.
7. Kiosk content: attract media list and seconds per image; per-state guest messages.
8. Coupons: `minimumSubtotalCents`, `maxDiscountCents`, `maxRedemptions`, `redemptionCount`.
9. Owner account: change password. Report with `from`/`to`.

Coupon errors: the reference defines no error codes (BFF EP-LOY-01 returns a free-text message),
so the `code` list for coupons is ours to write in the contract.

## Suggested order

| Wave | Release line | Gaps | Web points (rough) |
|:--|:--|:--|--:|
| 1 · Kitchen runs a rush | v0.3 | G-K1, K2, K3, K4, K5 + T3 | 21 |
| 2 · The owner's day | v0.3 or v0.4 | G-A1, A2, A4 + T1, A5 + T4, A6 | 28 |
| 3 · Richer catalogue | v0.4 | G-A7, A8 + T2, A9, A12, K6, K7, K8, K9 | 34 |
| 4 · Kiosk showcase and numbers | v0.5 | G-A10 + T5, A11, A13 | 19 |
| Phase 4 | with hardware | G-K10, A3, A14, T6 | in E4 |

Points are for the Next.js side only; the Go side is the partner's estimate. Each wave becomes
stories in Linear (`linear-backlog` skill) only after Kai approves this plan.

## Prototype

Design canvas "Comanda · o que falta": https://claude.ai/artifact/NARUZVhf5tz1Xe4vexq344 (private
until Kai shares it). Kitchen (landscape tablet, 1280 × 800), back office (page, 1440 wide plus one
phone frame) and kiosk deltas (same 720 × 1280 canvas as the approved prototype, × 1.5 for the real
1080 × 1920 screen). Same tokens, fonts, photos and prices as the approved prototype. Sources in
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
