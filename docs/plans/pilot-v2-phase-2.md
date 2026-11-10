# Pilot v2 · Phase 2 — Kiosk on v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the kiosk journey (attract → language → menu → builder → basket → coupon → Pix or card →
number + invoice notice) runs on the Core `/v2` contract, story COM-146.

**Architecture:** the kiosk keeps its shape (one client-side journey reducer, Server Actions as the
only way to Core), but every call goes through `coreApiV2()` and every type comes from
`core-api-v2.d.ts`. A pure graph reader turns `MenuResponse` (flat entities + links) into a tree the
screens walk; a pure builder turns the guest's picks into v2 `OrderItem`s (one product line per
unit, options flat in `modifiers` with `uniqueId`/`parentId`/`position`). Back office and kitchen stay
on `/v1`; shared device plumbing (token, heartbeat, status routes) stays as it is.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind v4, openapi-fetch, Vitest +
Testing Library, the v2 mock (`apps/web/mock/v2`) behind Prism on 4011.

**Spec:** [`docs/pilot-v2/SPEC.md`](../pilot-v2/SPEC.md) section 5; master plan
[`docs/plans/pilot-v2.md`](pilot-v2.md) Phase 2 (Tasks 2.1–2.4); contract `contract/openapi.v2.yaml`
(frozen: a gap means stop and report).

## Global Constraints

- Money is decimal BRL from Core (`9.5` = R$ 9,50). The front end **never adds, subtracts or
  multiplies prices** (SPEC 4.2): every total and line total shown comes from `POST /v2/totals`;
  a product's own price is `dineInPriceOverride ?? price`, "a partir de" is `displayPrice`.
  Display with `formatMoney()` (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
- Every order is `orderType: "DINEIN"`; no order-type screen, no CPF step.
- Call Core v2 only through `coreApiV2()` (`src/lib/core/client-v2.ts`); no other client.
- `Idempotency-Key` (UUID) on `POST /v2/payments` (one per attempt) and `POST /v2/orders` (one per
  basket, reused on every retry). `submitOrder` is retried for 15 s on an unknown answer.
- Poll `GET /v2/payments/{id}` at most once per second. Pix expires at `expiresAt` (5 min).
- Copy, exact: unavailable "Indisponível" / "Unavailable"; invoice notice from
  `store.invoiceNotice[language]` (default "Se quiser nota fiscal, dirija-se ao caixa." /
  "If you need an invoice, please go to the counter.").
- Idle reset from `idleTimerIntervalMilliseconds` (45 s); gate precedence Offline > Maintenance >
  Closed > Paused > Live, unchanged.
- No new dependency. No contract change. Never edit `core-api-v2.d.ts`.
- UI matches the approved prototype at 1080×1920 (prototype × 1.5); new screens (Pix, card wait,
  price changed, swap sell) in the approved kiosk style.

## Decisions taken here (Kai can overturn)

1. **No front-end totals.** The v1 kiosk summed display prices (basket bar, add button, line
   prices). On v2 the basket is priced by `POST /v2/totals` after every basket change, on the menu
   too (debounced 400 ms), and the basket bar shows that total (greyed while updating). The item
   builder's add button shows no total (option prices stay as "+ R$ 1,00"). A basket line of
   quantity > 1 shows "2 × R$ 9,50" from the unit line Core priced. Visible change vs. prototype
   04-Item: the button reads "Adicionar ao pedido" with no amount.
2. **Device token, heartbeat and status routes stay shared** (`src/lib/device/*`,
   `/api/device/*`, on `/v1`): the kitchen uses them and phase 4 owns it. The kiosk reads its config
   from `GET /v2/devices/me/config` with the same token (Core and the mock share device tokens).
   Moving the shared plumbing is logged for phase 4/5.
3. **No item note.** SPEC 5.3 says "item note (today's rule)", but today's kiosk has none and a
   free-text keyboard is not drawn. Logged as a question for Kai.
4. **Payment outcome in dev** comes from the mock (`MOCK_PAYMENT_OUTCOME`, `POST /__mock/payments/{id}`).
   The BFF never simulates on v2 (SPEC: simulation lives only in the mock).
5. Card is offered only when `DeviceConfig.paymentTerminalId` is set; otherwise its row is grey
   ("Indisponível neste totem").

## Review Focus

1. **Paid, then the connection drops** → `submitOrder` retried with the same key; an unknown answer
   shows "Verificando seu pedido" and keeps asking every 5 s; a definite failure shows "Pagamento
   aprovado — procure o caixa" with the Mercado Pago reference. Pinned in Task 2.3 (actions test +
   checkout test).
2. **Price or availability changed between totals and payment** (`BASKET_CHANGED`) → the kiosk
   re-prices and shows "O valor mudou" with the new total; paying needs a second tap; never the old
   amount. `ITEM_UNAVAILABLE` → back to the basket with the item named. Pinned in Task 2.3.
3. **Broken menu graph** (missing link, empty group, swap sell with no products, loop) → skipped,
   never a crash or a hang. Pinned in Task 2.1.
4. **Pix late / twice** → "Gerar novo" stops polling the old session and starts a new one (Go
   cancels the old); `BASKET_ALREADY_PAID` on a new session goes straight to `submitOrder`; an
   EXPIRED session shows the expiry screen, never success. Pinned in Task 2.3.
5. **Decimal money on screen** → `formatMoney(0.1 + 0.2)` is "R$ 0,30", `formatMoney(9.5)` is
   "R$ 9,50"; no float noise anywhere. Pinned in Task 2.2.

---

### Task 2.1: Menu graph reader

**Files:**
- Create: `apps/web/src/lib/kiosk/menu-graph.ts`, `apps/web/src/lib/kiosk/menu-graph.test.ts`

**Interfaces:**
- Consumes: `components["schemas"]["MenuResponse"]` from `@/lib/core-api-v2`.
- Produces:
  ```ts
  type ProductType = "ITEM" | "SIZED_ITEM" | "COMBO_MEAL";
  type Picture = { url: string; alt: string | null };
  type MenuOption = { id: string; type: "ITEM" | "SIZED_ITEM"; name: string; price: number;
    available: boolean; defaultQuantity: number; minChoices: number; maxChoices: number;
    groups: MenuGroup[] };
  type MenuGroup = { key: string; id: string; kind: "MODIFIERS" | "COMBO_MAIN" | "COMBO_SIDE" | "SIZE";
    name: string; modifierType: ModifierType | null; min: number; max: number; options: MenuOption[] };
  type Product = { id: string; type: ProductType; name: string; description: string | null;
    price: number; displayPrice: number | null; available: boolean; picture: Picture | null;
    allergens: Allergen[]; allergenTraces: Allergen[]; allergensDeclared: boolean;
    calories: string | null; badges: Badge[]; crossSellIds: string[];
    swapSell: { name: string; productIds: string[] } | null; groups: MenuGroup[] };
  type Section = { id: string; name: string; description: string | null; picture: Picture | null;
    products: Product[]; sections: Section[] };
  type KioskMenu = { menuId: string; validUntil: string | null; sections: Section[];
    products: Record<string, Product> };
  function readMenu(menu: MenuResponse): KioskMenu;
  function findProduct(menu: KioskMenu, id: string): Product | undefined;
  ```
  Group `key` is the path inside its product (`"1001/M-EXTRAS/X-SAUCE/M-SAUCE"`), unique per
  product even when a group is linked twice. A `SIZED_ITEM`'s sizes become a first group
  `{ kind: "SIZE", id: "<product>-SIZE", modifierType: "SIZE", min: 1, max: 1 }`; groups whose
  `modifierType` is `SIZE` sort first, the rest keep link order. `price` = `dineInPriceOverride ?? price`.
  Sections with `available: false` are left out; a section with no product and no sub-section is
  left out; unavailable products and options stay (shown grey).

- [ ] **Step 1: Write the failing tests** (fixture: `applyScenario("afternoon")` +
  `guestMenu(now(), "pt-BR")` from the v2 mock)
  - `reads sections from root in order, sub-sections nested` → `["100","200","300"]`, 100 has
    product `1001` and sub-section `110` with `1002`.
  - `a sized item gets its size group first` → `2001.groups[0]` is `{ kind: "SIZE", min: 1, max: 1 }`
    with options `2001-S`, `2001-L` priced 2.5 and 3.2.
  - `nested groups hang under their option` → `X-SAUCE.groups[0].id === "M-SAUCE"`.
  - `combos list main then sides` → `3001.groups.map(g => g.kind)` = `["COMBO_MAIN","COMBO_SIDE","COMBO_SIDE"]`.
  - `INGR options keep defaultQuantity 1`, `unavailable option stays with available false` (`X-BACON`).
  - `swap sell and cross-sell read from links and crossSellIds` → `1001.swapSell.productIds = ["1003"]`, `crossSellIds = ["2001"]`.
  - Review Focus 3: `a missing link is skipped`, `an empty group is dropped`,
    `a swap sell with no products is null`, `a loop ends without hanging` (option linking back to
    its own group) — each on a hand-made `MenuResponse`.
- [ ] **Step 2:** `npx vitest run src/lib/kiosk/menu-graph.test.ts` → FAIL (module missing).
- [ ] **Step 3:** implement `readMenu` with an index `type:id → entity` and a `visiting` set per walk.
- [ ] **Step 4:** tests pass.
- [ ] **Step 5:** commit `feat(COM-146): read the v2 menu graph for the kiosk`.

### Task 2.2: Builder, basket lines and money on v2

**Files:**
- Create: `apps/web/src/lib/kiosk/builder.ts` (+ test), `apps/web/src/lib/kiosk/basket-v2.ts` (+ test)
- Modify: `apps/web/src/lib/format/money.ts` (add `formatMoney`), add `money.test.ts`
- Modify: `components/kiosk/journey/{journey-state,menu-screen,item-screen,basket-screen,cross-sell-sheet,kiosk-journey}.tsx`; create `swap-sell-sheet.tsx`
- Delete (kiosk-only, replaced): `lib/kiosk/{menu-view,item-draft,tax-id,check-number,payment-recovery}.ts` + tests, `journey/{order-type-screen,tax-id-sheet}.tsx` + tests

**Interfaces:**
- Produces:
  ```ts
  // money.ts
  function formatMoney(brl: number): string; // "R$ 9,50"
  // builder.ts
  type Draft = { quantity: number; picks: Record<string /*group key*/, Record<string /*option id*/, number>> };
  function initialDraft(product: Product): Draft;          // defaultQuantity of available options
  function toggleOption(draft: Draft, group: MenuGroup, option: MenuOption): Draft;
  function setOptionQuantity(draft: Draft, group: MenuGroup, option: MenuOption, n: number): Draft;
  function canAdd(product: Product, draft: Draft): boolean; // min/max per group, minChoices per option, nested
  function isSingleChoice(group: MenuGroup): boolean;      // max === 1
  function groupCount(draft: Draft, group: MenuGroup): number;
  function draftToLine(product: Product, draft: Draft, guid: string): BasketLine;
  function lineToDraft(product: Product, line: BasketLine): Draft;
  // basket-v2.ts
  type Pick = { groupKey: string; optionId: string; quantity: number };
  type BasketLine = { guid: string; productId: string; quantity: number; picks: Pick[] };
  function toOrderItems(menu: KioskMenu, lines: BasketLine[]): OrderItem[];
  function lineUnits(lines: BasketLine[], totals: TotalsResponse): { guid: string; unit: CheckItem | null }[];
  function pickNames(product: Product, line: BasketLine): string[];
  const basketUnits: (lines: BasketLine[]) => number;
  ```
  `toOrderItems`: one product line per unit (`quantity: 1`), `uniqueId` counting from 1 across the
  basket; each pick is one modifier line (`quantity` = picks, `parentId` = the product's or the
  parent option's `uniqueId`, `position` = 1-based index of the option in its group,
  `modifierType` = the group's, `"SIZE"` for sizes), all flat in the product line's `modifiers`.
  `max: 0` means no limit. Unavailable options cannot be picked.

- [ ] **Step 1: failing tests**
  - money: `formatMoney(9.5) === "R$ 9,50"`, `formatMoney(0.1 + 0.2) === "R$ 0,30"`, `formatMoney(0) === "R$ 0,00"` (Intl's no-break space kept).
  - builder: `INGR ingredients start picked and can be removed`; `single choice replaces`;
    `a full group blocks another pick`; `maxChoices caps the stepper`; `an unavailable option cannot be picked`;
    `size is required before adding a sized item`; `a combo needs its main and every side`;
    `removing an option drops its nested picks`; `lineToDraft(draftToLine(x))` round-trips.
  - basket: `toOrderItems` for 2 × 1001 with 2 × X-CHEESE and X-SAUCE→S-BBQ equals the contract's
    `createTotals` example tree (ids, `uniqueId` 1…, `parentId`, `position`, `modifierType`) twice;
    a sized cola sends `{ id: "2001-L", modifierType: "SIZE", position: 2 }`; `lineUnits` maps
    response lines back by order.
- [ ] **Step 2:** run, FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** screens on the new types: menu (rail = top sections, grid = products then each
  sub-section's heading and products; price `displayPrice` with "A partir de" when set, else `price`;
  grey "Indisponível" card that cannot be tapped), builder (groups as today; sizes and combos are
  single-choice chips; options with `maxChoices > 1` get a stepper; INGR shown as "remove"
  checkboxes; no total on the button), basket (lines from `lineUnits`, totals from Core, no CPF row,
  no order-type label), swap sell sheet after adding a product that has one (accept = replace with
  the target, keeping picks of shared groups; opens the builder if the target still needs a
  choice), then cross-sell (products with no required choice toggle; others open the builder).
  Journey: totals after every basket change on menu and basket (debounced), `basketId` kept.
- [ ] **Step 6:** update the journey/screen component tests to the v2 fixtures; `npm test` PASS.
- [ ] **Step 7:** commit `feat(COM-146): build v2 basket lines in the kiosk`.

### Task 2.3: Totals, coupon, payment and order on v2

**Files:**
- Create: `apps/web/src/lib/kiosk/core-v2.ts` (Result helpers, device calls, menu/language/config loaders on v2)
- Modify: `apps/web/src/app/kiosk/actions.ts` (+ test), `components/kiosk/journey/{checkout-flow,coupon-sheet,kiosk-journey}.tsx` (+ tests), `lib/kiosk/strings.ts`

**Interfaces:**
- Produces (Server Actions, all KIOSK-only, all `Promise<Result<…>>`):
  ```ts
  beginJourney(language): JourneyStart { orderNonce; journeyStartedTimestamp; menu: MenuResponse; strings }
  switchLanguage(language): { menu: MenuResponse; strings }
  priceBasket({ basketId: string | null; items: OrderItem[]; language }): TotalsResponse
  applyCoupon({ basketId; items; code; language }): DiscountResponse
  removeCoupon({ basketId; items; code }): null
  recordJourneyEvent(orderNonce, type, orderTotal: number | null): void
  startPayment({ basketId; method: "PIX" | "CARD"; amount: number }, idempotencyKey): PaymentSession
  pollPayment(paymentId): PaymentSession
  cancelPayment(paymentId): PaymentSession
  submitOrder({ basketId; items; payment: PaymentSession | null }, idempotencyKey): SubmitOrderResponse
  ```
  `submitOrder` copies `tenderId`, `tenderRef`, `amount`, `cardScheme`, `cardLast4Digits`,
  `authCode` into `payments[0]` and wraps the call in `retryUnknown` (15 s).

- [ ] **Step 1: failing tests**
  - actions: every action refuses a non-kiosk device before calling Core; `submitOrder` retries an
    unknown answer with the same `Idempotency-Key` (Review Focus 1); `submitOrder` sends
    `orderType: "DINEIN"` and the session's tender fields.
  - checkout: `Pix shows the QR, the copy-paste code and a countdown`; `approved Pix submits the
    order and shows success`; `declined card offers retry and another method`; `expired Pix offers
    Gerar novo` and `Gerar novo starts a new session and stops polling the old one`;
    `BASKET_ALREADY_PAID submits the order` (Review Focus 4); `BASKET_CHANGED re-prices and asks to
    confirm the new total` (Review Focus 2); `submit unknown → verifying, then success`;
    `submit refused after approval → "procure o caixa" with the payment reference` (Review Focus 1);
    `card is grey without a terminal`.
  - coupon: applying sends one `CODE` award; `DISCOUNT_INVALID` shows `detail`;
    `DISCOUNT_LIMIT_REACHED` and `COUPON_ALREADY_APPLIED` have their own copy.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** commit `feat(COM-146): pay with pix or card and place the order on v2`.

### Task 2.4: Gate on v2, success with invoice notice, screenshots

**Files:**
- Create: `components/kiosk/kiosk-device-gate.tsx` (v2 twin of `DeviceGate` for `/kiosk`)
- Modify: `app/kiosk/page.tsx`, `components/kiosk/kiosk-gate.tsx`, `journey/success-screen.tsx` (+ test)

- [ ] **Step 1: failing tests:** success shows `customerCheckNumber`, the wait from
  `store.waitMinutes[pace]` when pace is NORMAL or BUSY, and `invoiceNotice` in the guest's language;
  gate maps v2 config to the same screens (maintenance, closed with `closedMessage`, paused, open).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `npm test`, `npx tsc --noEmit` (via `npm run typecheck`), `npm run lint` all pass.
- [ ] **Step 6:** with `npm run mock` (+ `MOCK_PAYMENT_OUTCOME=NONE` and `/__mock/payments/{id}`
  for each outcome) and `npm run dev`, screenshot at 1080×1920: attract, menu, menu with
  unavailable item, builder (size, combo, nested + INGR), swap sell, cross-sell, basket with coupon,
  method, Pix, card wait, declined, Pix expired, price changed, verifying, success with notice;
  compare with `docs/prototype/screens/*.png`; fix differences.
- [ ] **Step 7:** `npm run analyze` on `/kiosk` vs ~181 KB gzip; note any growth in the PR.
- [ ] **Step 8:** commit `feat(COM-146): run the kiosk gate and success on v2`; update status lines
  in `docs/plans/pilot-v2.md`; backlog to Linear; PR into `release/v0.4`.
