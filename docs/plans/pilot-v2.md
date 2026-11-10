# Pilot on the v2 models — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **How this plan is used (Kai's rule for big plans):** this file is the master plan, one status line
> per task. Each phase runs in its **own fresh session**. That session first writes the step-level
> plan for its phase with superpowers:writing-plans into `docs/plans/pilot-v2-phase-<n>.md` (exact
> test code, signatures and commands, from the real contract as it exists then), executes it, then
> updates the status lines here. The coordinating session only reads this file and the phase notes.

**Goal:** ship the basic dine-in pilot (menu → choose → pay with Pix or card → kitchen after payment)
with every data model following `MODELS.md` v2.

**Architecture:** thin client unchanged (Next.js pages → BFF → Go Core → Postgres; Mercado Pago only
from Go). A new contract in `/v2` with the v2 schemas plus `x-comanda` fields; `/v1` and `/v2` live
side by side during the migration (phases 1–4) and `/v1` is removed in phase 5.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, openapi-typescript +
openapi-fetch, Vitest, stateful Node mock behind Prism, OpenAPI 3.0.3, Redocly lint.

**Spec:** [`docs/pilot-v2/SPEC.md`](../pilot-v2/SPEC.md) (approved by Kai, 6 Nov 2026). Research and
the post-pilot roadmap: [`docs/v2-research/`](../v2-research/).

## Global Constraints

- Every schema follows `docs/v2-research/MODELS.md` field names and JSON types exactly; Comanda
  additions sit inside those schemas with `x-comanda: true` (SPEC D-1, D-2, 4.5).
- Money: JSON number, BRL, 2 decimals, never cents (D-3). The front end never computes a price;
  it formats with `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- Ids are strings and never contain `::` (D-4).
- Every order is `orderType: "DINEIN"` (D-7). No tax: tax amounts `0`, `taxes: []` (D-9).
- Payment tenders: `MP_PIX`, `MP_POINT`; Mercado Pago is called only by Go (D-8).
- Success screen notice, exact copy: pt-BR "Se quiser nota fiscal, dirija-se ao caixa." (en: "If you
  need an invoice, please go to the counter.") — editable in the store as `invoiceNotice` (SPEC 4.5).
- Unavailable item copy: "Indisponível" / "Unavailable".
- Idle reset 45 s; Pix expiry 5 min (assumption, SPEC 10); business-day cutoff 04:00 (assumption).
- Kept rules: `application/problem+json` with stable `code`; `Idempotency-Key` on `POST /v2/payments`
  and `POST /v2/orders`; `ETag` on config and active menu; `language` on guest endpoints.
- No new production dependency without Kai's yes. No contract change without Kai's yes and the
  partner's approval (PR). Never edit generated files.
- UI: every changed screen rendered and screenshot (kiosk 1080×1920; back office 375/768/1024/1440)
  before it is reported done; `/kiosk` bundle stays near ~181 KB gzip.
- Branches, commits and PRs follow `RELEASING.md` (`feat/COM-<n>-…`, squash into the open release
  line). Linear stories per phase (Task 0).

## Review Focus

The five failure modes the spec implies but a happy-path test would not catch, and where each is
pinned:

1. **Kiosk loses the connection after the payment is approved** → the guest paid, the order must
   still exist exactly once. Pinned in Task 2.3 (BFF retries `POST /v2/orders` with the same key and
   shows "Pagamento aprovado — procure o caixa com o número X" if it still fails) and Task 1.4 (mock
   places the order from its simulated webhook when the kiosk never calls; idempotent on
   `basketId`).
2. **Price or availability changes between totals and payment** → Go answers `BASKET_CHANGED` /
   `ITEM_UNAVAILABLE`; the kiosk re-prices and asks the guest to confirm, never charges the old
   total. Pinned in Task 1.4 (mock fault) and Task 2.3 (kiosk test).
3. **A menu graph with a missing link, an empty group, a swap sell with no items or a loop** reaches
   the kiosk (e.g. edited directly in the database) → the kiosk skips the broken part and never
   crashes or hangs. Pinned in Task 2.1 (graph reader tests) and Task 3.1 (editor refuses to save
   them).
4. **Pix approved just after it expired, or the guest pays twice** (scans a second QR after "Gerar
   novo") → only one payment is attached to the order; the extra one is flagged for refund.
   Pinned in Task 1.4 (mock: late approval on an expired session returns `PAYMENT_EXPIRED` and the
   session is listed under `/__mock` as "refund needed") and Task 2.3.
5. **Decimal money in forms and display** → "9,50", "9.50", "9,5" and "R$ 9,50" read as 9.50;
   "9,505", "abc" and negative values are refused; display never shows float noise (0.30000000000000004).
   Pinned in Task 3.1 (`readPrice`) and Task 2.2 (formatting tests).

---

## Task 0: Linear and docs PR

**Status:** ✅ done — Linear epic `P-COM-18` "Piloto v2"; stories COM-145 (phase 1), COM-146 (phase 2), COM-147 (phase 3), COM-148 (phase 4), COM-149 (phase 5), Web; COM-150 Core v2 (partner).

- [x] Create, with the `linear-backlog` skill, a Linear project/epic "Piloto v2" and one Story per
      phase (1–5), Squad `Web`, plus one Story with label `Core` for the partner: "Implementar o
      Core v2 conforme contract/openapi.v2.yaml" (not ours to build).
- [x] Commit `docs/pilot-v2/SPEC.md`, `docs/plans/pilot-v2.md` and `docs/v2-research/` on
      `docs/COM-<phase-1-story>-pilot-v2-spec` from the open release line; PR into it; squash.
- **Done when:** the PR is merged and the six Linear issues exist with their ids written in the
  status lines below.

---

## Phase 1 — Contract v2, mock, types (COM-145)

Session brief: Goal: v2 contract + mock + types the partner can approve. Where: `contract/`,
`apps/web/mock`, `apps/web/package.json`. Done when: Tasks 1.1–1.5 done and the contract PR is
approved by the partner. Limits: no app screens change in this phase.

### Task 1.1: Contract v2 skeleton and shared parts

**Status:** ✅ done — `contract/openapi.v2.yaml` 2.0.0 + README v2 section (cb94097); step plan in `docs/plans/pilot-v2-phase-1.md`.

**Files:**
- Create: `contract/openapi.v2.yaml` (becomes `contract/openapi.yaml` in phase 5)
- Modify: `contract/README.md` (add a v2 section; full rewrite in phase 5)

**Produces:** `info.version: 2.0.0`; security schemes copied from v1 (device bearer, owner bearer);
components `Problem`, `ProblemCode` (v1 codes still valid + SPEC 4.7 codes), parameters
`IdempotencyKey`, `IfNoneMatch`, `Language`; headers `ETag`; every operation has `x-phase`.

- [ ] Write it; run `npx @redocly/cli lint contract/openapi.v2.yaml` → no errors.

### Task 1.2: v2 menu and store schemas, device and guest-menu operations

**Status:** ✅ done — menu, store, device and guest-menu operations; MODELS 5.20 minus tax is the `getActiveMenu` example.

**Files:** Modify `contract/openapi.v2.yaml`.

**Produces:** schemas `MenuResponse`, `Link`, `PosEntityType`, `PosEntity` (oneOf by `type`
discriminator), `PosEntitySection`, `PosEntitySectionHours`, `PosEntityItem`, `PosEntityModifier`
(also used for `COMBO_MAIN`/`COMBO_SIDE`), `PosEntityComboMeal`, `PosEntityImage`,
`PosEntitySwapSell`, `PosEntityTaxGroup`/`PosEntityTaxRate` (present, unused), `ModifierType`,
`Allergen` (MODELS 5.11 + `NATURAL_LATEX`), `LightMenuResponse`, `StoreConfigurationResponse`,
`Hours`, `DeviceConfig`; additions from SPEC 4.5 (`displayPrice`, `allergenTraces`,
`allergensDeclared`, `badgeIds`, `crossSellIds`, `translations`, `menuId`, `validUntil`, store
fields, `paymentTerminalId`). Operations under `/v2`: `authenticateDevice`, `getDeviceConfig`,
`sendHeartbeat`, `reportDeviceStatus`, `getActiveMenu`, `getLanguagePack`, `startJourney`,
`recordJourneyEvent`.

- [ ] Include the full MODELS 5.20 example (tax removed) as the `getActiveMenu` example.
- [ ] Lint passes.

### Task 1.3: v2 order, totals, discount, payment and kitchen

**Status:** ✅ done — totals, coupons, Mercado Pago sessions, `submitOrder` (idempotent on `basketId`, webhook placement documented), kitchen.

**Files:** Modify `contract/openapi.v2.yaml`.

**Produces:** schemas `OrderType`, `OrderItem`, `Tax`, `Discount`, `ServiceCharge`, `Customer`,
`Address`, `Payment`, `ExternalUserId`, `Award`, `TotalsRequest`, `TotalsResponse`, `CheckItem`,
`SubmitOrderRequest`, `SubmitOrderResponse` (+ `status`, `version`, `placedAt`, `history`),
`DiscountRequest`, `DiscountResponse`, `PaymentSession` (`id`, `basketId`, `method` PIX|CARD,
`amount`, `status` PENDING|APPROVED|DECLINED|EXPIRED|CANCELLED, `qrCode`, `copyPaste`, `expiresAt`,
`terminalId`, `tenderRef`). Operations: `createTotals` (POST `/v2/totals`), `applyDiscount`,
`cancelDiscount`, `createPayment`, `getPayment`, `cancelPayment`, `simulatePayment` (dev only),
`submitOrder` (POST `/v2/orders`, idempotent on `basketId`), `getOrder`, and the kitchen set
(`listKitchenOrders`, `streamKitchenEvents`, `updateKitchenOrderStatus`, `setKitchenAvailability`,
`closeKitchenDay`, `getKitchenPace`, `setKitchenPace`).

- [ ] Document SPEC 4.6 rules in the operation descriptions (approved-only placement, amount check,
      exactly one order per paid basket, webhook placement is a Go requirement).
- [ ] Lint passes.

### Task 1.4: v2 back office operations

**Status:** ✅ done in the contract (`/v2/admin/…`, `422 MENU_INVALID`). ⏳ PR waits for Kai's yes, then the partner's approval.

**Files:** Modify `contract/openapi.v2.yaml`.

**Produces:** `/v2/admin/…` for: owner login, store (get/replace), media upload, devices
(+ `paymentTerminalId`), menus + schedules + force, sections, items (ITEM/SIZED_ITEM/COMBO_MEAL),
modifier groups (MODIFIERS/COMBO_MAIN/COMBO_SIDE), swap sells, badges, cross-sells, discount rules
(`DiscountRule`), availability (`PUT …/items/{id}/availability`, `PUT …/options/{id}/availability`
with `{ available: boolean }`), owner cancel, pace, daily report. Admin entities carry `name`
(pt-BR) + `translations.en`; saving answers `422 MENU_INVALID` with the list of broken links,
empty groups and loops.

- [ ] Lint passes. Contract PR opened to the partner (Kai's yes first) once 1.1–1.4 are in.

### Task 1.5: Mock serves v2 next to v1, types generated

**Status:** ✅ done — mock serves `/v2` behind a second Prism on 4011 (`mock/v2/`), `gen:api:v2` → `core-api-v2.d.ts`, 32 v2 unit tests, `npm run mock:smoke:v2` = 107 calls valid through Prism; test 342/342, typecheck and lint pass. ⏳ Cubeship itodev env (4011, `CORE_API_V2_URL`) waits for Kai's yes.

**Files:**
- Modify: `apps/web/mock/server.ts` (spawn a second Prism on `PRISM_V2_PORT` = 4011 for
  `contract/openapi.v2.yaml`, proxying to the same mock on 4020)
- Create: `apps/web/mock/v2/*.ts` (v2 routes, state and the simulated Mercado Pago)
- Modify: `apps/web/package.json` (`gen:api:v2` → `src/lib/core-api-v2.d.ts`, `lint:contract:v2`)
- Create: `apps/web/mock/v2/*.test.ts`

**Produces:** `CORE_API_V2_URL=http://localhost:4011`; mock control: `POST /__mock/payments/{id}`
`{ "outcome": "APPROVED" | "DECLINED" | "EXPIRED" }`, auto-outcome by env `MOCK_PAYMENT_OUTCOME` and
delay `MOCK_PAYMENT_DELAY_MS` (default 3000); simulated webhook placement after
`MOCK_WEBHOOK_PLACE_MS` (default 30000) when the kiosk never submits; late approval after expiry →
`PAYMENT_EXPIRED` and listed as "refund needed" in `GET /__mock`.

- [ ] Tests: totals price the 5.20 menu; an order needs an approved payment; the same `basketId`
      never makes two orders (kiosk + webhook race); `BASKET_CHANGED` after a price change;
      every v2 response passes Prism (no validation errors in the Prism log).
- [ ] `npm run test`, `npm run typecheck`, `npm run lint` pass; `/v1` app unchanged and working.
- [ ] Cubeship `itodev`: the mock app exposes 4011 and `web` gets `CORE_API_V2_URL`
      (settings change: Kai's yes first).

---

## Phase 2 — Kiosk on v2 (COM-146)

Session brief: Goal: the kiosk journey on `/v2` per SPEC 5. Where: `apps/web/src/app/kiosk`,
`src/components/kiosk`, `src/lib/kiosk`. Done when: Tasks 2.1–2.4 done with screenshots at
1080×1920. Limits: back office and kitchen stay on `/v1`.

### Task 2.1: Menu graph reader

**Status:** ✅ done — `readMenu` + `findProduct`/`nameOf`, 12 tests incl. missing link, empty group, empty swap sell, loops; step plan in `docs/plans/pilot-v2-phase-2.md`.
**Files:** Create `apps/web/src/lib/kiosk/menu-graph.ts` + test.
**Produces:** `readMenu(menu: MenuResponse): KioskMenu` — sections tree from `root`, products per
section in link order, groups per product (sizes first), nested groups per option, combos, swap
sells; skips missing links, empty groups and loops (Review Focus 3).

### Task 2.2: Item builder and basket on v2

**Status:** ✅ done — `builder.ts`, `basket-v2.ts` (`toOrderItems` matches the contract example), `formatMoney`; swap-sell sheet, cross-sell from `crossSellIds`. No front-end totals: Go prices the basket after every change (menu bar included), the add button has no amount. ⚠️ Item note not built (no v1 rule, no drawing): question for Kai in `docs/backlog-pending.md`.
**Files:** Modify the builder and basket components; create `src/lib/kiosk/basket-v2.ts` + test.
**Produces:** builder rules (`min`/`max`, `minChoices`/`maxChoices`/`defaultQuantity`, `INGR`
removal, combo main + sides, swap sell offer, cross-sell); `toOrderItems(basket): OrderItem[]` with
`uniqueId`/`parentId`/`position`, one line per unit; item note → `OrderItem.specialNotes` (today's
limit); unavailable shown grey; money formatting tests (Review Focus 5).

### Task 2.3: Totals, coupon, payment and order on v2

**Status:** ✅ done — actions `priceBasket`, `applyCoupon`/`removeCoupon`, `startPayment`, `pollPayment`, `cancelPayment`, `submitOrder` (retry with the same key, 15 s); Pix, card, declined, expired, price changed, terminal off, verifying, "procure o caixa" screens; Review Focus 1, 2, 4 tested and run against the mock with fault injection.
**Files:** Modify `src/app/kiosk/actions.ts`, checkout components; create payment screens.
**Produces:** BFF actions `createTotals`, `applyCoupon`, `startPayment(method)`, `pollPayment`,
`cancelPayment`, `submitOrder` (same `Idempotency-Key` on retry, 15 s budget); screens "Como quer
pagar?", Pix (QR, copia-e-cola, 5-min countdown, "Gerar novo"), card wait (+ cancel), failure,
"approved but not confirmed" (Review Focus 1, 2, 4).

### Task 2.4: Remove order type and CPF; success with invoice notice

**Status:** ✅ done — `/kiosk` reads `GET /v2/devices/me/config` (`KioskDeviceGate`); menu, language pack, journeys and key-action reports on `/v2`; success shows `customerCheckNumber`, wait and `invoiceNotice`. ⚠️ Device token, heartbeat and status routes stay shared on `/v1` with the kitchen (phase 4/5).
**Produces:** no "comer aqui / para viagem" screen, no CPF step; success shows
`customerCheckNumber`, wait time and `invoiceNotice`; the kiosk's device auth, config, heartbeat,
language pack and journey calls on `/v2` (offline / closed / maintenance / paused screens keep their
precedence); screenshots of every kiosk state.

---

## Phase 3 — Back office menu, availability, coupons on v2 (COM-147)

Session brief: Goal: the owner edits the v2 menu per SPEC 6. Where: `src/app/admin/(panel)/…`,
`src/lib/admin`. Done when: the MODELS 5.20 example (minus tax) is built in the editor and shows on
the kiosk.

### Task 3.1: Decimal price reader and v2 editor forms

**Status:** ✅ done — `readPrice`/`priceField` replace `cents`/`optionalPrice`; pure readers in `lib/admin/catalogue-form.ts`; editors for menus, sections, items (sized, combo), groups with inline options, badges, swap sells, cross-sells, allergens; `MENU_INVALID` listed per entity; MODELS 5.20 built through the readers and checked through Prism 4011 (`reference-menu.test.ts`); step plan in `docs/plans/pilot-v2-phase-3.md`. ⏳ Kiosk check waits for phase 2 on the same mock.
**Produces:** `readPrice(raw: string): number | null` in `src/lib/admin/form.ts` replacing `cents()`
/ `optionalPrice()` (Review Focus 5); editors for sections (nesting, hours), items, sized items,
combos, modifier groups (type, limits, nesting), swap sells, cross-sells, badges, allergens (+ traces,
declared), images, PT + EN; menus, schedules and owner force re-shaped to v2 (same behaviour); save
shows `MENU_INVALID` details per field (Review Focus 3). Back office loading keeps the `<Streamed>` +
skeleton rule (COM-140/141).

### Task 3.2: Availability page and coupon rules

**Status:** ✅ done — `/admin/disponibilidade` (products, then options and sizes by group; filter by unavailable; `/admin/esgotados` redirects); coupons as `DiscountRule`.
**Produces:** "Disponibilidade" page (on/off per item and option, filter by unavailable) replacing
"Esgotados"; coupons as `DiscountRule` (uses cap, minimum order, maximum discount).

---

## Phase 4 — Kitchen, report, store, devices, orders on v2 (COM-148)

Session brief: Goal: the rest of the app on `/v2` per SPEC 6. Done when: a paid order appears in the
kitchen in ≤ 2 s and goes through every status; report in decimal; owner cancel works.

### Task 4.1: Kitchen board on v2 order lines

**Status:** ✅ done (COM-148, plan `pilot-v2-phase-4.md`) — board, Produção, Retirados, undo, "Acabou" (`available`), pace, close the day and owner cancel on `/v2`; a v2 kiosk order shows in < 0.1 s on the mock.
**Produces:** board reads `SubmitOrderResponse.orderItems` (`CheckItem` + nested `modifiers`);
statuses, undo, pace, close the day, "Acabou" → `available: false`; SSE + polling unchanged.

### Task 4.2: Store, devices, orders, report on v2

**Status:** ✅ done (COM-148) — Loja (cutoff, invoice notice; CNPJ, order-number digits and receipt footer removed: no v2 field), Aparelhos (+ Point), Relatório and Início KPIs in decimal BRL; `npm run mock:orders` places v2 orders. Owner cancel stays in the kitchen (the v2 contract has no admin order list).
**Produces:** store form (no dine-in/take-out toggles; `invoiceNotice`, `businessDayCutoff`);
devices with `paymentTerminalId`; owner cancel; daily report in decimal BRL.

---

## Phase 5 — Cleanup (COM-149)

Session brief: Goal: one contract, one version. Done when: no `/v1` left and docs match the pilot.

### Task 5.1: Remove v1

**Status:** ⏳ pending
**Produces:** `contract/openapi.v2.yaml` → `contract/openapi.yaml`; v1 routes, types, mock code and
the second Prism removed; `CORE_API_V2_URL` folded back into `CORE_API_URL`; `gen:api` points at the
single contract; Cubeship `itodev` and prod env updated (Kai's yes first).

### Task 5.2: Docs

**Status:** ⏳ pending
**Produces:** `CLAUDE.md` (money is decimal BRL; dine-in only; pilot scope; waiter/QR after the
pilot; mock commands), `contract/README.md` (v2), `docs/plan.md` and `docs/data-model-and-api.md`
point to the SPEC where they now disagree.
