# Pilot v2 — Phase 4: kitchen, store, devices, orders, report on v2 (COM-148)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a paid order from the v2 kiosk reaches the kitchen in ≤ 2 s and goes through every status; the
back office store, devices, owner cancel, daily report and the home KPIs read and write Core `/v2`.

**Architecture:** the kitchen's order type becomes the contract's `SubmitOrderResponse` (key `number`,
short number `customerCheckNumber`, lines `orderItems` = `CheckItem` with nested `modifiers`). One
pure module (`lib/kitchen/order.ts`) turns those lines into what the screens show, so the board,
production totals, "Acabou" and "Retirados" keep their logic and only change field names. Every
Core call of these areas goes through `coreApiV2()`; the device and owner sessions stay as they are
(Core and the mock accept the same tokens on `/v1` and `/v2`; phase 5 moves sign-in).

**Tech Stack:** Next.js 16, React 19, TypeScript strict, openapi-fetch, Vitest, stateful mock + Prism.

**Spec:** [`docs/pilot-v2/SPEC.md`](../pilot-v2/SPEC.md) §6 and §4.6 (owner cancel); master plan
[`pilot-v2.md`](pilot-v2.md) Phase 4 (Tasks 4.1–4.2).

## Global Constraints

- Contract `contract/openapi.v2.yaml` is frozen: a gap is reported, never patched.
- Money is decimal BRL; display with `formatMoney()` (`src/lib/format/money.ts`); never add prices
  in the front end (the report and the home only show Go's numbers).
- Dine-in only: no "Comer aqui / Para viagem" chip or report split.
- Availability is on/off until changed ("Acabou" → `available: false`, undo → `true`); no "today only".
- Owner cancel: refund in the Mercado Pago panel, outside Comanda (copy says so).
- Back office loading keeps `<Streamed fallback={<…Skeleton />}>` (COM-140/141).
- Do not touch phase 3 areas: menus, schedules, sections, items, groups, coupons, availability page,
  the home's "Esgotados hoje" tile, `lib/admin/media.ts`.

## Review Focus

1. **The same SSE event twice or late** (stream + polling cross) → the card never moves back. Pinned
   by the existing `accept`/`mergeSnapshot` tests, re-keyed on `number` (Task 1).
2. **One product line per unit** (the kiosk sends `quantity: 1` per unit) → the kitchen reads "2×
   Cappuccino · Grande", not two loose lines. `kitchenLines` groups identical lines (Task 1).
3. **Options nested under options** (combo main with its own choices, sauce under a modifier) → every
   level shows and every option can be marked "Acabou". `kitchenLines` flattens depth-first (Task 1).
4. **Business day after midnight** (cutoff 04:00) → at 01:30 the report and the home ask for
   yesterday's date. `businessDate()` test (Task 4).
5. **Owner types a wrong password in the kitchen's cancel dialog** → "E-mail ou senha errados", the
   order stays. Existing `cancelAsOwner` mapping kept on `/v2/admin/auth/login` (Task 2).

---

### Task 1: Kitchen order model on v2

**Files:**
- Create: `apps/web/src/lib/kitchen/order.ts`, `apps/web/src/lib/kitchen/order.test.ts`
- Modify: `src/lib/kitchen/{board,detail,production,collected,pace}.ts` + their tests,
  `src/components/kitchen/sold-out.tsx` + `sold-out.test.ts`

**Interfaces — Produces:**
- `type KitchenOrder = components["schemas"]["SubmitOrderResponse"]` (from `@/lib/core-api-v2`)
- `type KitchenLine = { key: string; id: string; name: string; quantity: number; options: string[]; choices: { id: string; name: string }[]; note: string | null }`
- `kitchenLines(order: KitchenOrder): KitchenLine[]` — product lines in order, identical ones
  (same id, same modifier tree, same note) merged with summed quantity; `options` = modifier names
  depth-first, `"2× Queijo"` when a modifier's quantity > 1; `choices` = unique modifier ids, all depths.
- `updatedAt(order): string` = last history entry's `at` (or `placedAt`); `readyAt(order): string | null`.
- `SoldOutTarget = { id: string; name: string; whole: boolean }`; `lineTargets(line: KitchenLine)`.

- [x] Write `order.test.ts`: two `quantity: 1` lines of `2001` with modifier `2001-L` → one line
      `quantity: 2`, `options: ["Grande"]`; a line with a note stays apart; nested `S-BBQ` under
      `X-SAUCE` appears after it in `options` and in `choices`; `updatedAt` / `readyAt` from history.
- [x] Run `npx vitest run src/lib/kitchen/order.test.ts` → FAIL (module missing). Implement. → PASS.
- [x] Re-key `board`, `detail`, `production`, `collected`, `pace` on v2 (`number`,
      `customerCheckNumber`, `kitchenLines`, `updatedAt`); production groups by line id + choice ids.
      Update their tests' fixtures to `SubmitOrderResponse`. Run `npx vitest run src/lib/kitchen src/components/kitchen` → PASS.

### Task 2: Kitchen BFF and screens on v2

**Files:** `src/lib/kitchen/core.ts`, `src/app/kitchen/{actions.ts,page.tsx}`,
`src/app/api/kitchen/{orders,stream}/route.ts`, `src/components/kitchen/*.tsx`

**Interfaces — Consumes:** Task 1. **Produces:** `listKitchenOrders(status)`, `kitchenStreamUrl()` →
`${CORE_STREAM_URL ?? CORE_API_V2_URL}/v2/kitchen/stream`, `moveOrder(number, status, expectedVersion?)`,
`setAvailable(id: string, available: boolean): Promise<Result<LightMenuResponse>>`,
`cancelOrder(number, email, password, reason)`, `setKitchenPace`, `closeKitchenDay`, `readKitchenPace`,
all through `coreApiV2()` with the v2 `Result`/`failure` of `lib/kiosk/core-v2.ts`.

- [x] Port the calls; cancel signs in on `/v2/admin/auth/login` and posts `/v2/admin/orders/{number}/cancel`.
- [x] Screens: drop the order-type chip; show `note` ("Obs.: …") under a line; "Acabou" copy
      "Sai do totem até alguém liberar" and chip "Indisponível"; cancel dialog says the refund is
      done in the Mercado Pago panel. `kitchen-board.test.tsx` passes on v2 fixtures.
- [x] `npx tsc --noEmit` passes for the kitchen files.

### Task 3: `npm run mock:orders` places v2 orders

**Files:** `apps/web/mock/seed-orders.ts`

- [x] Same flags; flow `POST /v2/devices/auth` → `GET /v2/menus/active` (first available `ITEM`
      with no group links) → `POST /v2/totals` → `POST /v2/payments` (PIX) → control
      `POST /__mock/payments/{id}` APPROVED → `POST /v2/orders`. Prints `#<customerCheckNumber>`.
- [x] With the mock running: `npm run mock:orders -- 2` prints two numbers and they appear in
      `GET /v2/kitchen/orders`.

### Task 4: Store, layout and store status on v2

**Files:** `src/app/admin/(panel)/loja/page.tsx`, `layout.tsx`, `src/lib/admin/store-status.ts`,
`src/lib/admin/home.ts` (+ test)

**Produces:** `businessDate(now: Date, timeZone: string, cutoff: string): string` (YYYY-MM-DD of
`now − cutoff` in `timeZone`); `loadStoreStatus(now, { store?, devices? })` with `timeZone` from the v2 store.

- [x] Test: `businessDate(2026-11-10T04:30Z /* 01:30 BRT */, "America/Sao_Paulo", "04:00")` → `"2026-11-09"`;
      at 07:30Z → `"2026-11-10"`. FAIL → implement → PASS.
- [x] Store form on `GET/PUT /v2/admin/store`: name, logo, languages, default language, timezone,
      business-day cutoff (`HH:mm`), closed message PT/EN, invoice notice PT/EN. Removed (no v2
      field): dine-in/take-out toggles, CNPJ, order-number digits, receipt footer. Wait minutes on
      `PUT /v2/admin/pace/wait-minutes`, read from `GET /v2/admin/pace`.
- [x] Layout's store name = `locationName`; store status reads store + pace on v2 (menus stay v1: phase 3).

### Task 5: Devices, report and home on v2

**Files:** `src/app/admin/(panel)/{aparelhos,relatorio}/page.tsx`, `src/app/admin/(panel)/page.tsx`

- [x] Devices on `/v2/admin/devices…`; kiosk cards and the create form get "Maquininha (Point)"
      → `paymentTerminalId` (empty = null); the card shows the terminal id.
- [x] Report on `GET /v2/admin/reports/daily` for `businessDate(...)`: Pedidos, Faturamento, Ticket
      médio, Descontos, Cancelados, Não retirados; best sellers keyed by `id`; `formatMoney`.
- [x] Home: store, devices, pace and both reports on v2, KPIs with `formatMoney`; the sold-out
      tile stays as it is (phase 3).

### Task 6: Verify and hand over

- [x] `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run mock:smoke:v2` pass.
- [x] Mock + dev server: pay on the v2 kiosk (Totem on `/`), the order shows on `/kitchen` ≤ 2 s,
      Começar → Pronto → Retirado → Voltar para Prontos; Acabou + undo; close the day; owner cancel.
- [x] Screenshots: kitchen 1920×1080 (board, drawer, Retirados); store, devices, report, home at
      375/768/1024/1440.
- [x] `docs/plans/pilot-v2.md` Tasks 4.1–4.2 status; `CLAUDE.md` (mock:orders is v2; kitchen on v2).
