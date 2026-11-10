# Pilot v2 · Phase 1 — Contract v2, mock, types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Executed natively in the phase 1 session (Kai's weekly usage is high: one session, no per-task
> subagents). Linear: COM-145. Branch: `feat/COM-145-contract-v2` from `origin/release/v0.4`.

**Goal:** a `/v2` contract built on the `MODELS.md` v2 models, served by the stateful mock behind a
second Prism next to `/v1`, with generated types, ready for the partner's approval.

**Architecture:** `contract/openapi.v2.yaml` (OpenAPI 3.0.3, `2.0.0`) sits next to the v1 file. The
mock process keeps one HTTP server on 4020 and starts two Prism proxies: 4010 for v1 (unchanged) and
4011 for v2. v2 routes and state live in `apps/web/mock/v2/`; devices, tokens, clock and the store
pace are shared with v1, everything else (catalogue, menus, baskets, payments, orders) is v2-only.

**Tech Stack:** OpenAPI 3.0.3, Redocly CLI, Prism 5 (proxy, `--errors`), openapi-typescript, Node 24
(type stripping), Vitest.

**Spec:** [`docs/pilot-v2/SPEC.md`](../pilot-v2/SPEC.md) · master plan
[`docs/plans/pilot-v2.md`](pilot-v2.md) Phase 1 · models
[`docs/v2-research/MODELS.md`](../v2-research/MODELS.md).

## Global Constraints

- Schema and field names = `MODELS.md` names without the Java `I` prefix, JSON types exact (D-1).
- Comanda additions inside v2 models carry `x-comanda: true` and a one-line description (D-2). A
  schema that is Comanda's own (not in MODELS) carries `x-comanda: true` at schema level.
- Money: JSON `number`, BRL, 2 decimals (`9.50`), never cents (D-3). No `multipleOf` (float noise
  breaks validators); the rule is in the `Money` description.
- Ids are strings, never contain `::` (D-4). Admin writes take the id in the path, pattern
  `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` (no `:` at all, no lookahead so Go's regexp can use it).
- No `/internal/v2`, no `config` envelope, no menu-state/raw-menu/pos-data/init/destroy (D-5).
- Every order `orderType: DINEIN` (D-7); other values answer `ORDER_TYPE_UNAVAILABLE`.
- Tenders `MP_PIX` and `MP_POINT`; Mercado Pago only from Go (D-8). No tax: tax amounts `0`,
  `taxes: []`; `TAX` entities stay in the schema, unused (D-9).
- Kept rules: `application/problem+json` with `code`; `Idempotency-Key` on `POST /v2/payments` and
  `POST /v2/orders`; `ETag`/`If-None-Match` on config and active menu; `language` on guest endpoints.
- `x-phase` on every operation = the pilot v2 phase that moves the app onto it (2 kiosk, 3 menu
  editor, 4 kitchen/store/devices/orders/report).
- Invoice notice default copy: pt-BR "Se quiser nota fiscal, dirija-se ao caixa." / en "If you need
  an invoice, please go to the counter.". Idle reset 45 s (`idleTimerIntervalMilliseconds: 45000`).
  Pix expiry 5 min. Business-day cutoff `04:00`.
- No production dependency added. Never edit `src/lib/core-api*.d.ts` by hand. No app screen changes.

## Decisions taken while writing the contract (for Kai's summary)

1. **Catalogue is shared, menus are roots.** Sections, items, modifier groups, swap sells and images
   are one catalogue; a menu is `name` + `root` (its top `CATEGORY` links) + schedules. The guest menu
   is the graph reachable from the active menu's `root`.
2. **Admin writes are `PUT …/{id}` upserts with ids the BFF chooses** (v2 ids are POS ids). No POST
   create, no server ids. Path id = body id.
3. **Product ids are unique across `ITEM`, `SIZED_ITEM`, `COMBO_MEAL`** in Comanda, so
   `crossSellIds` (string[], SPEC 4.5) and `/v2/admin/items/{itemId}` are unambiguous.
4. **Cross-sells are edited on the item** (`crossSellIds`); no cross-sell group endpoints.
5. **One availability shortcut** `PUT /v2/admin/items/{itemId}/availability` for products, options
   and sizes (all are `ITEM`s in v2), instead of separate item/option paths.
6. **Section hours are resolved by Go**: a section outside its `availableHours` at request time is
   sent with `available: false` (MODELS: false hides it); `availableHours` stays for display.
7. **`OrderItem.itemPrice` is optional on requests** (MODELS marks it required): the kiosk sends ids
   only and Go prices. Go ignores any price the client sends.
8. **`SubmitOrderResponse.number` is the order id** in `/v2/orders/{number}` and the kitchen paths.
9. **`included` on modifier groups is ignored by Go in the pilot** (MODELS: a venue feature, off).
10. **Additions beyond the SPEC 4.5 table** (need Kai's yes): `MenuResponse.badges` (the kiosk needs
    badge names and colours), `CheckItem.specialNotes` (the kitchen shows item notes),
    `StoreConfigurationResponse.logo`, `PosEntityImage.width`/`height`, code `BASKET_ALREADY_PAID`,
    `Problem.errors[].rule`/`.entity` (the `MENU_INVALID` list), `DiscountRule.name`/`validFrom`/
    `validTo` (today's coupon fields), `LightMenuResponse` used as the availability answer.

## Review Focus

1. **Kiosk loses the connection after approval** → `POST /v2/orders` is idempotent on `basketId`, and
   the mock places the order itself after `MOCK_WEBHOOK_PLACE_MS`. Pinned in Task 4
   (`orders.test.ts`: "kiosk and webhook race make one order").
2. **Price or availability changes between totals and payment** → `BASKET_CHANGED` on
   `POST /v2/payments` and `POST /v2/orders`. Pinned in Task 4 (`orders.test.ts`).
3. **Broken menu graph saved** (missing link, empty group, empty swap sell, loop, `::` id) → admin
   save answers `422 MENU_INVALID` with each error. Pinned in Task 3 (`menu.test.ts`).
4. **Pix approved after it expired, or paid twice** → late approval answers `PAYMENT_EXPIRED` and is
   listed under `GET /__mock` as refund needed; a second session on a paid basket is
   `409 BASKET_ALREADY_PAID`. Pinned in Task 4.
5. **Decimal money noise** → totals never show `0.30000000000000004`; the mock computes in integer
   cents and converts once. Pinned in Task 4 (`pricing.test.ts`: "no float noise").

---

## Task 1: Contract v2 (master Tasks 1.1–1.4)

**Status:** ✅ done

**Files:**
- Create: `contract/openapi.v2.yaml`
- Modify: `contract/README.md` (new "v2 (pilot)" section)

**Produces (names later tasks and the partner rely on):**
- Components: `Problem`, `ProblemCode` (v1 codes + `BASKET_CHANGED`, `DISCOUNT_INVALID`,
  `DISCOUNT_LIMIT_REACHED`, `PAYMENT_DECLINED`, `PAYMENT_EXPIRED`, `PAYMENT_NOT_APPROVED`,
  `PAYMENT_TERMINAL_UNAVAILABLE`, `MENU_INVALID`, `BASKET_ALREADY_PAID`), `Money`, parameters
  `IdempotencyKey`, `IfNoneMatch`, `Language`, header `ETag`, security `deviceAuth`, `ownerAuth`.
- Menu: `MenuResponse`, `Link`, `PosEntityType`, `PosEntity` (oneOf, discriminator `type`, each
  member pins its `type` values by enum), `PosEntityCommon`, `PosEntitySection`,
  `PosEntitySectionHours`, `PosEntityItem`, `PosEntityComboMeal`, `PosEntityModifier`,
  `PosEntityImage`, `PosEntitySwapSell`, `PosEntityTaxGroup`, `PosEntityTaxRate`, `ModifierType`,
  `Allergen`, `Translations`, `Badge`, `LightMenuResponse`.
- Store/devices: `StoreConfigurationResponse`, `Hours`, `DeviceConfig`, `LocalizedText`, pace schemas.
- Orders: `OrderType`, `OrderItem`, `Tax`, `Discount`, `ServiceCharge`, `Customer`, `Address`,
  `Payment`, `ExternalUserId`, `Award`, `TotalsRequest`, `TotalsResponse`, `CheckItem`,
  `ResponseDiscount`, `SubmitOrderRequest`, `SubmitOrderResponse`, `OrderStatus`,
  `OrderStatusChange`, `DiscountRequest`, `DiscountResponse`, `PaymentSession`.
- Admin: `AdminMenu`, `AdminItem` (oneOf item/combo), `DiscountRule`, `AdminDevice`, `MediaAsset`
  (= `PosEntityImage` + size), `DailyReport`.
- Operations (operationIds): device `authenticateDevice`, `getDeviceConfig`, `sendHeartbeat`,
  `reportDeviceStatus`; guest `getActiveMenu`, `getLanguagePack`, `startJourney`,
  `recordJourneyEvent`, `createTotals`, `applyDiscount`, `cancelDiscount`, `createPayment`,
  `getPayment`, `cancelPayment`, `simulatePayment`, `submitOrder`, `getOrder`; kitchen
  `listKitchenOrders`, `streamKitchenEvents`, `updateKitchenOrderStatus`, `setKitchenAvailability`,
  `closeKitchenDay`, `getKitchenPace`, `setKitchenPace`; admin `ownerLogin`, `getStore`,
  `replaceStore`, `uploadMedia`, `listDevices`, `createDevice`, `replaceDevice`,
  `rotateDeviceSecret`, `listMenus`, `putMenu`, `deleteMenu`, `listMenuSchedules`,
  `replaceMenuSchedules`, `forceMenu`, `clearForcedMenu`, `listSections`, `putSection`,
  `deleteSection`, `listItems`, `putItem`, `deleteItem`, `setItemAvailability`, `listModifierGroups`,
  `putModifierGroup`, `deleteModifierGroup`, `listSwapSells`, `putSwapSell`, `deleteSwapSell`,
  `listBadges`, `putBadge`, `deleteBadge`, `listDiscountRules`, `putDiscountRule`,
  `deleteDiscountRule`, `cancelOrder`, `getStorePace`, `setStorePace`, `setPaceWaitMinutes`,
  `getDailyReport`.

- [ ] **Step 1:** Write the skeleton, shared components, device and guest-menu part; the
      `getActiveMenu` example is MODELS 5.20 with the `TAX` entity and every `TAX` link removed.
- [ ] **Step 2:** Run `npx @redocly/cli lint contract/openapi.v2.yaml` → `Woohoo! Your API description is valid.` (warnings allowed only for `operation-4xx-response` style rules v1 also has).
- [ ] **Step 3:** Add totals, discount, payment, order and kitchen; SPEC 4.6 rules in the operation
      descriptions (approved-only placement, amount check, one order per paid basket, webhook
      placement is a Go requirement). Lint again → valid.
- [ ] **Step 4:** Add `/v2/admin/…`; every catalogue `PUT`/`DELETE` documents `422 MENU_INVALID`.
      Lint again → valid.
- [ ] **Step 5:** README v2 section: file, version, money rule, ids, `x-comanda`, `x-phase` meaning,
      the decisions list above, how to run the v2 mock and generate types.
- [ ] **Step 6:** Commit `feat(COM-145): add the v2 contract on the MODELS.md models`.

## Task 2: Generated types and scripts

**Status:** ✅ done

**Files:** Modify `apps/web/package.json`; generate `apps/web/src/lib/core-api-v2.d.ts`.

- [ ] **Step 1:** Scripts `gen:api:v2` (`openapi-typescript ../../contract/openapi.v2.yaml -o src/lib/core-api-v2.d.ts`),
      `lint:contract:v2` (`redocly lint ../../contract/openapi.v2.yaml`),
      `mock:smoke:v2` (`node mock/v2/smoke.ts`).
- [ ] **Step 2:** `npm run gen:api:v2` → file written; `npm run typecheck` → exit 0.
- [ ] **Step 3:** Commit `build(COM-145): generate the v2 api types`.

## Task 3: v2 catalogue, guest menu and validator in the mock

**Status:** ✅ done

**Files:**
- Create: `apps/web/mock/v2/http.ts`, `v2/seed.ts`, `v2/state.ts`, `v2/menu.ts`, `v2/menu.test.ts`

**Interfaces:**
- `v2/http.ts`: `type S = components["schemas"]` (from `core-api-v2.d.ts`);
  `problem(status, code: S["ProblemCode"], title, detail?, extra?): Reply`; reuses v1 `Reply`,
  `Request`, `Route`, `ok`, `authDevice`, `authOwner`, `idempotent`.
- `v2/state.ts`: `v2(): V2State` — reseeds whenever the v1 `state` object was replaced (a scenario
  switch), so both versions reset together. `V2State = { store, entities: Map<string, Entity>
  (key `${type}:${id}`), menus: MockMenuV2[], badges, discountRules, baskets, payments, orders,
  refunds, journeys }`.
- `v2/menu.ts`:
  - `guestMenu(at: Date, language: "pt-BR" | "en"): S["MenuResponse"] | null` — reachable graph from
    the active menu's root; `name`/`description` resolved (en from `translations.en`, falling back
    to pt-BR); `translations` removed; sections outside their hours `available: false`;
    `displayPrice` = lowest size price for `SIZED_ITEM`, else `price` + cheapest required option.
  - `validateCatalogue(entities, menus): MenuError[]` with `rule` in `MISSING_LINK`, `EMPTY_GROUP`,
    `EMPTY_SWAP_SELL`, `LOOP`, `INVALID_ID`, `DUPLICATE_PRODUCT_ID`, `COMBO_INCOMPLETE`,
    `LINK_NOT_ALLOWED`.

- [ ] **Step 1: tests** in `menu.test.ts`:
  - "the seed passes the validator": `validateCatalogue(seed)` → `[]`.
  - "a link to a missing entity is MISSING_LINK": add `{id:"NOPE",type:"ITEM"}` to `M-EXTRAS` →
    one error `{rule:"MISSING_LINK", entity:{type:"MODIFIERS",id:"M-EXTRAS"}}`.
  - "a group with no options is EMPTY_GROUP"; "a swap sell with no items is EMPTY_SWAP_SELL".
  - "an option linking back to its group is LOOP" (`S-BBQ` links `M-SAUCE`).
  - "an id with :: is INVALID_ID".
  - "guest menu resolves English and drops translations": `guestMenu(at,"en")` names from
    `translations.en`, no entity has `translations`.
  - "a sized item shows its cheapest size as displayPrice": Cola (`2001`) → `2.5`.
- [ ] **Step 2:** `npx vitest run mock/v2/menu.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `http.ts`, `seed.ts` (MODELS 5.20 minus tax, pt-BR names with the
      English as `translations.en`; menus `mnu-manha` 06:00–11:00 root `[200, 100]` and `mnu-tarde`
      11:00–20:00 root `[100, 200, 300]`; coupon `BEMVINDO10` 10 % and `CAFE5` R$ 5 with
      `minOrderTotal: 20`; one badge), `state.ts`, `menu.ts`.
- [ ] **Step 4:** Run the test → PASS.

## Task 4: Pricing, payments (simulated Mercado Pago) and orders in the mock

**Status:** ✅ done

**Files:**
- Create: `apps/web/mock/v2/pricing.ts`, `v2/payments.ts`, `v2/orders.ts`, `v2/pricing.test.ts`,
  `v2/orders.test.ts`

**Interfaces:**
- `pricing.ts`: `priceBasket(req: S["TotalsRequest"], language): { totals: S["TotalsResponse"] } |
  { error: Reply }` — integer cents inside; option extra × quantity; size price for sized items;
  unavailable/unknown id → `ITEM_UNAVAILABLE`; coupon per line, half up, to the cent (percent per
  line; fixed and capped amounts split over lines by largest remainder); `tax: 0`, `taxes: []`.
- `payments.ts`: `createSession(basketId, method, amount)`, `sweep(at = now())` (applies
  `MOCK_PAYMENT_OUTCOME` = `APPROVED` default | `DECLINED` | `EXPIRED` | `NONE` after
  `MOCK_PAYMENT_DELAY_MS` = 3000; expires PIX at `expiresAt` = +5 min; places the order from the
  "webhook" `MOCK_WEBHOOK_PLACE_MS` = 30000 after approval when the kiosk never submitted),
  `forceOutcome(id, outcome)` (mock control and `simulatePayment`; late approval of an EXPIRED
  session → `PAYMENT_EXPIRED` and a `refunds` entry).
- `orders.ts`: `submitOrder(basketId, payments, by: "KIOSK" | "SYSTEM")` idempotent on `basketId`;
  `customerCheckNumber` per business day (cutoff 04:00); `moveOrder`, `closeDay`, kitchen stream.

- [ ] **Step 1: tests** (`pricing.test.ts`, `orders.test.ts`):
  - "totals price the 5.20 menu": Classic Burger + 2× Extra cheese + Add a sauce → BBQ; Cola Large;
    Burger Meal with Side salad → `subTotal 11.5 + 3.2 + 13.45 = 28.15`, `tax 0`, `total 28.15`.
  - "an unavailable option is ITEM_UNAVAILABLE" (Bacon).
  - "a percent coupon rounds per line half up": `BEMVINDO10` on 9.50 + 3.20 → discount `0.95 + 0.32`
    = `1.27`, total `11.43`.
  - "no float noise": three lines of 0.10 → `subTotal` `0.3` exactly.
  - "an order needs an approved payment": submit with a PENDING session → `409 PAYMENT_NOT_APPROVED`.
  - "kiosk and webhook race make one order": approve, kiosk submits, `sweep` past
    `MOCK_WEBHOOK_PLACE_MS`, submit again → one order, same `number`.
  - "the webhook places the order when the kiosk never calls": approve, sweep → order with history
    `by: "SYSTEM"`.
  - "a price change after totals is BASKET_CHANGED": totals, change Classic Burger price, create
    payment with the old amount → `409 BASKET_CHANGED`.
  - "late approval after expiry is PAYMENT_EXPIRED and needs a refund".
  - "a second payment on a paid basket is BASKET_ALREADY_PAID".
- [ ] **Step 2:** Run → FAIL. **Step 3:** implement. **Step 4:** Run → PASS.

## Task 5: v2 routes, second Prism, smoke through Prism

**Status:** ✅ done

**Files:**
- Create: `apps/web/mock/v2/routes-guest.ts`, `v2/routes-kitchen.ts`, `v2/routes-admin.ts`,
  `v2/smoke.ts`
- Modify: `apps/web/mock/server.ts` (v2 routes, `POST /__mock/payments/{id}`, refunds in
  `GET /__mock`, v2 kitchen stream, second Prism on `PRISM_V2_PORT` = 4011, `sweep` every second),
  `deploy/cubeship/mock.Dockerfile` (`EXPOSE 4010 4011 4020`), `CLAUDE.md` (commands),
  `docs/backlog-pending.md`.

- [ ] **Step 1:** Implement routes for every v2 operation (admin catalogue `PUT` runs
      `validateCatalogue` on the would-be catalogue and answers `422 MENU_INVALID` with `errors`).
- [ ] **Step 2:** `smoke.ts` walks every operation through `http://localhost:4011` (owner login,
      device auth, config + 304, menu + 304, journey, totals, coupon apply/cancel, Pix and card
      payments, simulate, order + replay, kitchen list/status/availability/pace/close-day, every
      admin list/put/delete, a broken save → 422, report) and fails on any status it did not expect.
      Prism with `--errors` turns any contract violation into an error answer, so a clean run proves
      the responses match.
- [ ] **Step 3:** `npm run mock` in the background, then `npm run mock:smoke:v2` → `smoke: N calls, all valid`; v1 still answers (`curl :4010/v1/devices/auth` → 401 problem).
- [ ] **Step 4:** `npm run test`, `npm run typecheck`, `npm run lint`, both contract lints → pass.
- [ ] **Step 5:** Commit `feat(COM-145): serve the v2 contract from the mock behind prism`.
- [ ] **Step 6:** Status lines in `docs/plans/pilot-v2.md`; summary to Kai; push + PR into
      `release/v0.4` only after his yes; never merge (partner approves).
- [ ] Cubeship `itodev` (mock exposes 4011, `web` gets `CORE_API_V2_URL`): settings change, Kai's yes
      first — not done in this phase unless he says so.
