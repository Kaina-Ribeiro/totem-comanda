# Comanda pilot on the v2 models — SPEC

Status: **draft for Kai's review** · 6 Nov 2026 · decisions by Kai and the partner (5–6 Nov 2026)

One line: the pilot is a **basic dine-in kiosk** (see the menu, choose, pay with Pix or card,
the order reaches the kitchen after payment), **rebuilt on the v2 data models** of
[`MODELS.md`](../v2-research/MODELS.md), so the partner's Go server and the Next.js app speak one
standard format from day one.

Everything the full reference specs describe beyond this pilot was read line by line and is kept as
the post-pilot roadmap in [`docs/v2-research/`](../v2-research/) (809 features, 6 areas, a decision
register). This spec only covers the pilot.

---

## 1. Decisions (do not revisit)

| # | Decision | Who, when |
|:--|:--|:--|
| D-1 | All data models follow `MODELS.md` (the "v2" models of `lib-pos-integration`) to the letter, now, for the pilot. The Go server uses them; everything is standardised. | Kai 5 Nov · partner 6 Nov (1B) |
| D-2 | Capabilities Comanda needs that v2 lacks are **new fields inside the v2 models**, not a separate extension block. Each one is marked `x-comanda: true` in the contract. | Partner 6 Nov (answer 1) |
| D-3 | Money is a JSON number in BRL, main currency unit, 2 decimals (`9.50`), as in v2. Never cents. | Kai 5 Nov (1A) |
| D-4 | Ids are strings, as in v2. Never contain `::`. | Partner 6 Nov (7A) |
| D-5 | Comanda does **not** play the POS-integration role: no `/internal/v2/*`, no per-venue `config`, no init/destroy, pos-health, raw-menu, pos-data. | Kai 5 Nov |
| D-6 | Pilot flow: the guest sees the menu, chooses, pays; the order reaches the kitchen **after payment**. | Partner 6 Nov |
| D-7 | **Dine-in only.** Every order is `DINEIN`; no take-out, pickup or delivery screen. | Partner 6 Nov |
| D-8 | Payment in the pilot: **Pix and card terminal, Mercado Pago** (Pix + Point), called only by the Go server. | Partner 6 Nov (2) |
| D-9 | **No tax** in the pilot: no `TAX` entities, `tax` totals are `0`. | Partner 6 Nov |
| D-10 | **No NFC-e** in the pilot. The success screen says: "Se quiser nota fiscal, dirija-se ao caixa." | Partner 6 Nov (5B) |
| D-11 | Coupons stay. PT-BR and EN stay. | Partner 6 Nov (3A, 4A) |
| D-12 | Availability is a plain on/off (`available`), set in the back office and from the kitchen. No "unavailable until a date or time". | Partner 6 Nov |
| D-13 | Waiter app, tables, open checks and the QR menu are **after the pilot**. | Partner 6 Nov (6A) |
| D-14 | Still cut (original brief): multi-template, multi-store, loyalty, Scan-and-Go and staff age approval, split bill, guest walks away, accessibility mode. | Brief |
| D-15 | Pilot defaults accepted by Kai on 6 Nov: see section 9. | Kai 6 Nov |

---

## 2. Scope

### In the pilot

- **Kiosk**: attract → language → menu (v2 graph) → item builder → basket → coupon → payment
  method → Pix or card → order number + invoice notice → back to attract.
- **Kitchen**: today's board, reading v2 order lines.
- **Back office**: v2 menu editor, availability, coupons, menus and schedules, store, devices,
  orders (owner cancel), pace, daily report.
- **Contract v2**, a stateful **mock** behind Prism, and the front end + BFF built against them.

### Removed from what is built today (named before removal)

| Today | Pilot |
|:--|:--|
| "Comer aqui / Para viagem" screen on the kiosk | Removed. Every order is `DINEIN`. |
| CPF/CNPJ step on the kiosk | Removed (no NFC-e). Replaced by the invoice notice. |
| "Esgotado" for today only (`soldOutDate`) | Replaced by `available` on/off, kept until changed. |
| Simulated payment on the kiosk | Replaced by Pix / card screens. Simulation lives only in the mock. |
| Store toggles "dine-in / take-out available" | Removed (dine-in only). |

### Kept as they are (only re-shaped to v2)

Coupons, PT/EN, cross-sell, menus that switch by schedule (morning/afternoon) and the owner's
"force menu", item badges, allergens, item note, kitchen pace, kitchen undo, close the day, daily
report, devices, heartbeat, offline / closed / maintenance / paused screens.

### Not in the pilot (roadmap in `docs/v2-research/`)

Take-out, pickup, delivery, drive-thru, scheduled orders; tax groups; NFC-e; waiter app, tables,
open checks, call waiter, request bill, QR menu; tips, donations, service charge; cash; unavailable
until a date; hidden vs unavailable; special dates; promotion types beyond today's coupon rules;
vendor payment methods (gift card, room charge, food stamp, face-ID, crypto).

---

## 3. Architecture

Unchanged thin client:

```
Kiosk / Kitchen / Back office (Next.js pages)
   │ HTTPS
   ▼
Next.js server: BFF (Route Handlers, Server Actions)   ── device and owner tokens in HttpOnly cookies
   │ REST/JSON /v2, generated client from contract/openapi.yaml
   ▼
Go Core API (partner) ── PostgreSQL
   │
   └── Mercado Pago (Pix + Point): called only by Go; Go receives Mercado Pago webhooks
```

- The kiosk and the BFF never call Mercado Pago and never see its credentials.
- Prices, discounts, availability, order numbers and payment approval are decided only by Go.
  The front end formats and displays.

---

## 4. Contract v2

### 4.1 Shape

- New `contract/openapi.yaml`, version `2.0.0`, all paths under **`/v2`**. `/v1` is removed in the
  same release (production runs `v0.1.0` against the mock; no real client depends on `/v1`).
- Schema names and JSON fields are the `MODELS.md` names without the Java `I` prefix:
  `MenuResponse`, `Link`, `PosEntity`, `PosEntitySection`, `PosEntitySectionHours`, `PosEntityItem`,
  `PosEntityModifier`, `PosEntityComboMeal`, `PosEntityImage`, `PosEntitySwapSell`, `LightMenuResponse`,
  `OrderType`, `OrderItem`, `Tax`, `Discount`, `ServiceCharge`, `Customer`, `Payment`, `Award`,
  `TotalsRequest`, `TotalsResponse`, `SubmitOrderRequest`, `SubmitOrderResponse`, `CheckItem`,
  `DiscountRequest`, `DiscountResponse`, `StoreConfigurationResponse`, `Hours`.
- Every field Comanda adds sits inside those schemas with `x-comanda: true` and a one-line
  description (decision D-2).
- Kept rules: `application/problem+json` with a stable `code`; `Idempotency-Key` (UUID) on
  `POST /v2/payments` and `POST /v2/orders`; `ETag` / `If-None-Match` on config and active menu;
  `language` (`pt-BR` | `en`) on guest endpoints, which return text already resolved.
- `contract/README.md` is rewritten for v2 (money rule, ids, `x-comanda`, phases).

### 4.2 Money and rounding

- Decimal BRL with 2 places in every money field (`price`, `itemPrice`, `total`, `amount`, …).
- Go computes every amount. Discounts are rounded **per line, half up, to the cent**, then summed.
- `tax`, `taxTotal`, `itemTax`, `totalTax` are `0` in the pilot (D-9); `taxes` lists are empty.
- The front end never adds, subtracts or multiplies prices. "From R$ X" comes from `displayPrice`.

### 4.3 Operation map (v1 → v2)

| Area | v1 today | v2 | Notes |
|:--|:--|:--|:--|
| Device | `authenticateDevice`, `getDeviceConfig`, `sendHeartbeat`, `reportDeviceStatus` | same, under `/v2/devices/…` | Config embeds `StoreConfigurationResponse` + additions (4.5). Pairing stays: id + secret typed at `/setup`. |
| Guest menu | `getActiveMenu`, `getLanguagePack` | `GET /v2/menus/active` → `MenuResponse`; language pack kept | Text resolved to `language`. |
| Journey | `startJourney`, `recordJourneyEvent` | kept | |
| Pricing | `createQuote` | `POST /v2/totals` (`TotalsRequest` → `TotalsResponse`) | Go keeps the basket; returns `basketId`. |
| Coupon | `validateDiscount` | `POST /v2/discounts/apply` and `/v2/discounts/cancel` (`DiscountRequest` → `DiscountResponse`) | The code is an `Award` of type `CODE` on the basket. |
| Payment | `createOrder`, `startPayment`, `getPayment`, `cancelPayment`, `simulatePayment` | `POST /v2/payments`, `GET /v2/payments/{id}`, `POST /v2/payments/{id}/cancel`, `POST /v2/payments/{id}/simulate` (mock and dev only) | Payment is anchored on `basketId`, not on an order. |
| Order | `placeOrder`, `getOrder` | `POST /v2/orders` (`SubmitOrderRequest` → `SubmitOrderResponse`), `GET /v2/orders/{id}` | Placed only with an approved payment (4.6). |
| Kitchen | `listKitchenOrders`, `streamKitchenEvents`, `updateKitchenOrderStatus`, `setKitchenAvailability`, `closeKitchenDay`, `get/setKitchenPace` | same, under `/v2/kitchen/…` | Kitchen order = `SubmitOrderResponse` + status fields. Availability sets `available`. |
| Back office | restaurant, media, devices, menus, schedules, force, categories, items, sold-out, option groups, tags, cross-sells, discounts, owner cancel, pace, daily report | same areas under `/v2/admin/…`, re-shaped: categories → `CATEGORY` sections, items → `ITEM`/`SIZED_ITEM`/`COMBO_MEAL`, option groups → `MODIFIERS`/`COMBO_MAIN`/`COMBO_SIDE`, new swap sells, sold-out → `available` | Restaurant → store (`StoreConfigurationResponse` + additions). |

### 4.4 The menu (guest)

`GET /v2/menus/active?language=pt-BR` returns the active menu as one `MenuResponse`
(`root` + flat `entities` + `links`), following `MODELS.md` section 5 exactly:

- `CATEGORY` with nested sub-sections, `description`, `available`, `availableHours`
  (a window whose end is before its start runs past midnight; the closing minute is closed).
- `ITEM` (product, option or size), `SIZED_ITEM` (sizes are linked `ITEM`s; the sized item's own
  price is `0`), `COMBO_MEAL` + `COMBO_MAIN` + `COMBO_SIDE`, `MODIFIERS` with `modifierType`
  `MODI`, `SIZE`, `INGR`, `SURC`, `INGM`, nested groups, `min`/`max`/`included`, and per option
  `defaultQuantity`/`minChoices`/`maxChoices`.
- `IMAGE` (`url`, `altText`), `SWAP_SELL` (upgrade offer after adding a product).
- Not used in the pilot: `TAX`, `deliveryPriceOverride`, `takeOutPriceOverride`, the
  take-out/delivery/pickup/seat flags, `barcodes`, `factor`, `gfcId`, `posMetadata`. They stay in
  the schema, optional.
- `available: false` items and options are **sent** and shown grey with "Indisponível"
  (pt-BR) / "Unavailable" (en); they cannot be added.

### 4.5 Comanda additions (`x-comanda: true`)

| Schema.field | Type | Why |
|:--|:--|:--|
| `PosEntityItem.displayPrice` | number | "From R$ X" for items with sizes or required options; computed by Go. |
| `PosEntityItem.allergenTraces` | string[] | "Pode conter" (may contain), same value list as `allergens`. |
| `PosEntityItem.allergensDeclared` | boolean | `false` = "não informado"; an empty list never reads as safe. |
| allergen value `NATURAL_LATEX` | enum value | ANVISA group with no v2 value. |
| `PosEntityItem.badgeIds` | string[] | Item badges ("Selos"), store list. |
| `PosEntityItem.crossSellIds` | string[] | Cross-sell suggestions shown after adding (today's feature). |
| `PosEntity.translations` | object `{ en: { name, description } }` | Back office only. Guest endpoints resolve `name`/`description` to `language`. |
| `MenuResponse.menuId`, `MenuResponse.validUntil` | string, date-time | Which scheduled menu is active, and when the next switch happens. |
| `DiscountRule` (back office) | object | Coupon definition: `code`, `type` (fixed / percent), `value`, `minOrderTotal`, `maxDiscount`, `maxUses`, `usesCount`, `active`. Applied as an `Award` of type `CODE`. |
| `SubmitOrderResponse.status`, `.version`, `.placedAt`, `.history[]` | enum, int, date-time, list | Kitchen lifecycle (today's statuses and history). |
| `StoreConfigurationResponse.languages`, `.defaultLanguage`, `.closedMessage`, `.invoiceNotice`, `.pace`, `.waitMinutes`, `.timezone`, `.businessDayCutoff` | various | Store settings the kiosk and kitchen need today. |
| `DeviceConfig.paymentTerminalId` | string | Which Mercado Pago Point terminal sits next to this kiosk. |
| `PaymentSession` (new schema) | object | See 4.6. |

The final field list is fixed in phase 1 when the contract is written; anything not listed here
needs Kai's yes.

### 4.6 Payment and order placement

```
basket ──POST /v2/totals──▶ TotalsResponse (basketId, total)
       ──POST /v2/discounts/apply (optional)──▶ awards
       ──POST /v2/totals──▶ final total
guest picks Pix or card
       ──POST /v2/payments {basketId, method: PIX|CARD, amount}──▶ PaymentSession
            PIX:  qrCode (image data), copyPaste (text), expiresAt
            CARD: terminalId, "follow the terminal"
       ──GET /v2/payments/{id} (poll ≤ 1/s)──▶ PENDING → APPROVED | DECLINED | EXPIRED | CANCELLED
APPROVED
       ──POST /v2/orders SubmitOrderRequest{basketId, orderType: DINEIN, items, payments:[Payment]}──▶
            SubmitOrderResponse{number, customerCheckNumber, displayText, status: PAID}
```

- `Payment.tenderId` is `MP_PIX` or `MP_POINT`; `tenderRef` is the Mercado Pago payment id;
  `amount` is the approved amount; card fields (`cardScheme`, `cardLast4Digits`, `authCode`) when
  the terminal returns them.
- Go refuses an order whose payment is not approved or whose amount differs from the basket total
  (`PAYMENT_NOT_APPROVED`, `BASKET_CHANGED`).
- **A paid basket always becomes exactly one order.** `POST /v2/orders` is idempotent on
  `basketId` (and `Idempotency-Key`). If the kiosk never calls it (crash, network), Go places the
  order itself from the Mercado Pago webhook. This is a requirement for the partner.
- Pix expires after **5 minutes** (assumption; Mercado Pago setting). The kiosk shows the
  countdown and offers "Gerar novo" or "Trocar forma de pagamento".
- Card: Go sends the charge to the Point terminal in `paymentTerminalId`; the guest can cancel on
  the kiosk while it is `PENDING`.
- Failure, decline, expiry or cancel → back to "Como quer pagar?" with the basket kept.
- Owner cancel of a paid order (back office) sets `CANCELLED`; the refund is done in the Mercado
  Pago panel, outside Comanda.

### 4.7 Error codes (new or changed)

`ITEM_UNAVAILABLE`, `BASKET_CHANGED` (price or availability changed since totals),
`DISCOUNT_INVALID`, `DISCOUNT_LIMIT_REACHED`, `PAYMENT_DECLINED`, `PAYMENT_EXPIRED`,
`PAYMENT_NOT_APPROVED`, `PAYMENT_TERMINAL_UNAVAILABLE`, `MENU_INVALID` (back office save with
broken links, empty groups or loops), plus today's codes that still apply. Each has PT and EN copy
in the kiosk.

---

## 5. Kiosk

1. **Attract** (Server Component) → tap → **language** (PT/EN).
2. **Menu**: loaded once per journey and kept in memory (unchanged performance rule). Sections and
   sub-sections from `root`; items in link order; unavailable items grey.
3. **Item builder** (client): sizes first (`SIZE` / `SIZED_ITEM`), then groups in link order;
   nested groups open when their option is picked; `INGR` options start selected and can be
   removed; combos show the main choice and each side; quantity limits from `min`/`max` per group
   and `minChoices`/`maxChoices`/`defaultQuantity` per option; option prices shown only when > 0;
   item note (today's rule).
4. **After adding**: swap sell offer (if linked), then cross-sell (today's rule).
5. **Basket**: edit, remove, coupon (one per order); totals from `POST /v2/totals` only.
6. **"Como quer pagar?"**: Pix or Cartão.
7. **Pix screen**: QR + copy-paste + countdown; **card screen**: "Siga as instruções na
   maquininha" + cancel.
8. **Success** (Server Component): `customerCheckNumber`, wait time when Go sends it, and the
   invoice notice. Back to attract after the idle timer.
9. Idle reset at **45 s** (warning first, as today). Offline, closed, maintenance and paused
   screens as today (precedence: Offline > Maintenance > Closed > Paused > Live).

New screens (payment method, Pix, card wait, payment failed, invoice notice on success, size and
combo steps of the builder) follow the canvas proposals in `docs/prototype/full/` where they exist;
where they do not, they are drawn in the approved kiosk style and shown to Kai before phase 2 ends.

The BFF builds the v2 basket (`OrderItem` with `uniqueId`, `parentId`, `position`, one line per
unit) from the builder state, sends ids only, and keeps tokens server-side.

---

## 6. Back office and kitchen

- **Menu editor** on v2 entities: sections (nesting, hours, image), items, sized items, combos
  (main + sides), modifier groups (type, limits, nesting), swap sells, cross-sells, badges,
  allergens (ANVISA list mapped to v2 values + traces + declared), images, PT + EN.
  **Validation on save** blocks: links to missing entities, groups with no options, swap sells with
  no items, loops, duplicate `type`+`id`, `::` in ids (v2 drops these silently, so Comanda refuses
  them). Saving publishes (no draft).
- **Menus and schedules**: unchanged behaviour (several menus, weekly windows, owner force).
- **Availability** page (replaces "Esgotados"): on/off per item and per option, filter by
  unavailable. The kitchen keeps its "Acabou" button, which sets `available: false`.
- **Coupons**: today's rules (uses cap, minimum order, maximum discount), stored as `DiscountRule`.
- **Store**: name, logo, languages, closed message, invoice notice text, timezone, business-day
  cutoff. Dine-in/take-out toggles removed.
- **Devices**: unchanged, plus the Point terminal id per kiosk.
- **Orders**: owner cancel of a paid order (refund outside Comanda).
- **Kitchen**: today's board, statuses, undo, pace, close the day, SSE + polling; order lines read
  from `orderItems` (`CheckItem`) and nested `modifiers`. Report in decimal BRL.
- **Forms**: price inputs read decimal BRL; `cents()` / `optionalPrice()` in
  `apps/web/src/lib/admin/form.ts` are replaced by a decimal reader with the same "refuse, never
  guess" rule.

---

## 7. Mock, testing and quality

- **Mock** (`apps/web/mock`): rewritten for v2, still behind Prism (every call validated against
  the contract), stateful, with fault injection. Mercado Pago is simulated: Pix and card approve,
  decline or expire after a delay, chosen by env var or dev cookie (as the simulated payment today).
  `npm run mock:orders` keeps working.
- **Tests**: unit tests for the menu graph (build from `root`/`links`, resolve sizes/combos/nested
  groups, validator rules) and for the v2 basket builder (`uniqueId`/`parentId`); contract lint
  (`npx @redocly/cli lint`); Prism validation in the mock tests; `npm run typecheck`, lint, tests.
- **UI proof** (Kai's rules): every changed screen rendered and screenshot at the target sizes
  (kiosk 1080×1920; back office 375/768/1024/1440), compared with the prototype, overflow and
  states checked.
- **Bundle**: `npm run analyze` on `/kiosk` stays near the ~181 KB gzip baseline; any growth from
  the builder is justified in the PR.

---

## 8. Delivery

Five phases, one fresh session each. The plan with a status line per task goes to
`docs/plans/pilot-v2.md` (written next, from this spec).

| Phase | Goal | Done when |
|:--|:--|:--|
| 1 | Contract v2 + README + mock + generated types | `redocly lint` passes; the mock serves every v2 operation through Prism; types regenerate; **PR approved by the partner** (he can start Go here). |
| 2 | Kiosk on v2 | A full journey on the mock at 1080×1920: v2 menu with sizes, combos and nested groups, coupon, Pix approve/decline/expire, card approve/cancel, number + invoice notice; screenshots. |
| 3 | Back office menu, availability, coupons on v2 | The owner builds the reference example menu of MODELS §5.20 (minus tax) in the editor, the validator blocks the broken cases, the kiosk shows it. |
| 4 | Kitchen, report, store, devices, orders on v2 | A paid order appears in the kitchen in ≤ 2 s and moves through every status; report totals in decimal; owner cancel works. |
| 5 | Cleanup | `/v1` gone from code and mock; `CLAUDE.md`, `docs/plan.md`, `docs/data-model-and-api.md` and `contract/README.md` updated (decimal money, dine-in only, pilot scope, waiter/QR after pilot). |

Release: a new version line via Actions → Release → `cut-release` (after `release/v0.4` or
alongside it; decided in the plan), PRs squash-merged into it per `RELEASING.md`.

---

## 9. Pilot defaults (accepted by Kai, 6 Nov 2026)

| Topic | Rule |
|:--|:--|
| Unavailable item | Shown grey, "Indisponível", cannot be added |
| Coupon rules | Uses cap, minimum order, maximum discount; one coupon per order |
| Rounding | Discount per line, half up, to the cent |
| Cancel a paid order | Owner in the back office; refund in the Mercado Pago panel |
| Kiosk stuck | No staff screen; restart from the back office |
| Device pairing | As today: id + secret typed at `/setup` |
| Kiosk offline | "Temporariamente offline" screen; no selling from a cached menu |
| Kitchen full | Pace only (Normal / Movimentado / Pausado); never blocks the kiosk |
| PT/EN | Owner enters both; guest endpoints return resolved text |
| Idle reset | 45 s |
| Order number | Resets per business day (cutoff `businessDayCutoff`, proposal 04:00) |
| Publish | Saving publishes; no draft |
| Menu validation | Blocks broken links, empty groups, loops |
| "From" price | `displayPrice` from Go, never computed in the front end |

---

## 10. Open items (not blocking phase 1)

| Item | Owner | Assumption until answered |
|:--|:--|:--|
| Mercado Pago account, credentials, Point model | Kai / partner (setup) | Mercado Pago Point + Pix via the same account |
| Pix expiry minutes | Partner | 5 minutes |
| Business-day cutoff hour | Kai | 04:00 (from `docs/plan-next.md`) |
| Whether the bakery must issue NFC-e for every sale | Accountant | Not in the pilot (D-10) |

## 11. References

- `docs/v2-research/MODELS.md`: the v2 models (copy of the partner's file).
- `docs/v2-research/consolidated/*.md`: the 809 features by area, with sources; the post-pilot roadmap.
- `docs/v2-research/consolidated/decision-register.md`: every open question for after the pilot.
- `docs/v2-research/inventory/*.md`: line-by-line inventories of the reference specs.
- `docs/plan.md`, `docs/plan-next.md`: earlier plans; this spec overrides them where they disagree.
