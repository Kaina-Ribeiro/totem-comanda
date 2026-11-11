# Pilot v2 — Phase 3: back office menu, availability and coupons on v2 (COM-147)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the owner edits the v2 menu (sections, items, sized items, combos, modifier groups, swap
sells, badges, cross-sells, allergens, images, PT + EN), menus and schedules, availability and
coupons in the back office, all on `/v2/admin/…`.

**Architecture:** pages stay Server Components with Server Actions (`ActionForm`). Every form is
read by a **pure reader** in `src/lib/admin/catalogue-form.ts` (FormData + current entity → v2
body), so the same code is unit-tested, used by the pages and used by the reference-menu proof.
Core v2 is called only through `coreApiV2()` / `coreMediaApiV2()` inside `asOwner()`. A
`422 MENU_INVALID` answer becomes one pt-BR line per broken rule (`describeMenuErrors`), shown under
the form.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, openapi-fetch,
Vitest, the v2 mock behind Prism 4011.

**Spec:** [`docs/pilot-v2/SPEC.md`](../pilot-v2/SPEC.md) section 6; master plan
[`docs/plans/pilot-v2.md`](pilot-v2.md) Phase 3.

## Global Constraints

- Money is a decimal BRL number (`9.5`), never cents; display with `formatMoney` /
  `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- The back office never computes a price; `displayPrice` is Go's and is dropped on save.
- Ids match `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` (never `::`); the owner never types one: new
  entities get `newId(prefix)`.
- `contract/openapi.v2.yaml` is frozen. A gap → stop and report.
- Store, devices, orders, report and home pages are phase 4; the kiosk is phase 2. Do not touch.
- Shared files (`components/admin/nav.tsx`, `mock/v2/*`, `docs/plans/pilot-v2.md`) change only
  additively.
- Loading keeps `<Streamed fallback={<…Skeleton />}>`; two-call saves keep the `saveBoth()` rule.
- Copy for the unavailable state: "Indisponível".

## Review Focus

1. **Decimal money in forms** — "9,50", "9.50", "9,5", "R$ 9,50", "1.234,50" → 9.5 / 1234.5;
   "9,505", "abc", "-1", "1e3" → refused (`readPrice` tests, Task 1).
2. **Broken graph on save** (missing link, empty group, empty swap sell, loop, bad id) — the
   owner sees which entity and why, per field, and nothing is half saved (`describeMenuErrors`
   tests, Task 1; group save with new options undone on failure, Task 3).
3. **Editing an entity keeps fields the form does not show** (`deliveryPriceOverride`, `barcodes`,
   flags, `posMetadata`, `comboMealId`) — reader tests pass `current` and expect them kept (Task 2).
4. **An option is an `ITEM`** — turning an option off on "Disponibilidade" uses the same
   `setItemAvailability` path and the kiosk reads it grey (Task 5 + mock).
5. **Coupon limits** — percent over 100, value 0, a code not `^[A-Z0-9]{3,20}$`, `maxUses` 0 are
   refused before the call; `usesCount` is never sent as the owner's input (Task 5 reader tests).

---

## File structure

| File | Responsibility |
|:--|:--|
| `src/lib/admin/form.ts` | `readPrice`, `priceField`; `cents`/`optionalPrice` removed; `FormState.problems`; MENU_INVALID message |
| `src/lib/admin/session.ts` | `AdminApiError` gets `errors` (problem field errors) and v2 codes |
| `src/lib/admin/menu-errors.ts` | `describeMenuErrors(errors, nameOf)` → pt-BR lines |
| `src/lib/admin/catalogue-form.ts` | pure readers: texts, links, hours, section, item, group options, swap sell, badge, menu, discount rule; `newId` |
| `src/lib/admin/catalogue.ts` | server-only: `loadCatalogue()`, `put*`/`delete*` wrappers, `saveOptions` (undoable) |
| `src/lib/admin/media.ts` | + `uploadImageV2(form, field)` → IMAGE id |
| `src/components/admin/form.tsx` | `ActionForm` lists `state.problems` |
| `src/components/admin/catalogue-fields.tsx` | shared fields: `TextsFields`, `LinkRows`, `HoursFields`, `ImageField`, `AllergenFields` |
| `src/lib/admin/allergens.ts` | ANVISA groups → v2 `Allergen` values, pt-BR labels |
| pages `cardapios`, `categorias`, `itens` (+`[itemId]`, `novo`), `grupos` (+`[groupId]`, `novo`), `selos`, `cupons`, `disponibilidade`; `esgotados` → redirect | UI |
| `src/lib/admin/reference-menu.test.ts` | builds MODELS 5.20 through the readers into the mock and compares the active menu |

## Task 1: Decimal price reader and MENU_INVALID messages

**Files:** Modify `src/lib/admin/form.ts`, `src/lib/admin/form.test.ts`, `src/lib/admin/session.ts`,
`src/components/admin/form.tsx`; Create `src/lib/admin/menu-errors.ts` + test.

**Produces:**
- `readPrice(raw: string): number | null` — trims; optional `R$`; thousands `.` only in groups of
  3; up to 2 decimals after `,` or `.`; returns `Math.round(x*100)/100`; `null` otherwise.
- `priceField(form: FormData, name: string, label: string, opts?: { optional?: boolean }): number | null`
  — empty + optional → `null`; empty + required or invalid → `throw new AdminApiError("VALIDATION_FAILED", label)`.
- `AdminApiError(code, detail?, errors?: ProblemError[])`; `asOwner` copies `error.errors`.
- `FormState.problems?: string[]`; `attempt()` maps `MENU_INVALID` to
  `{ error: "O cardápio ficaria quebrado. Corrija e salve de novo.", problems }`.
- `describeMenuErrors(errors: ProblemError[], nameOf: (type, id) => string | undefined): string[]`.

- [ ] Tests (`form.test.ts`): `readPrice` table — "9,50"→9.5, "9.50"→9.5, "9,5"→9.5,
  "R$ 9,50"→9.5, "28"→28, "1.234,50"→1234.5, "0,1"→0.1, "0,30"→0.3 (never 0.30000000000000004);
  "9,505", "abc", "-1", "1e3", "", "1.23.4" → null. `priceField` throws with the label.
- [ ] Tests (`menu-errors.test.ts`): one line per rule with the entity's name, e.g.
  `EMPTY_GROUP` on `MODIFIERS M-SAUCE` named "Escolha o molho" →
  `"Grupo “Escolha o molho”: precisa de pelo menos uma opção."`; `MISSING_LINK` →
  `"… liga a algo que não existe mais (ITEM X-NOPE)."`; `LOOP`, `EMPTY_SWAP_SELL`,
  `COMBO_INCOMPLETE`, `INVALID_ID`, `LINK_NOT_ALLOWED`, `DUPLICATE_PRODUCT_ID`, `ID_MISMATCH`;
  unknown name falls back to the id.
- [ ] Implement; `ActionForm` renders `problems` as a `<ul>` under the error.
- [ ] `npx vitest run src/lib/admin` passes. Commit `feat(COM-147): read decimal prices and explain menu errors`.

## Task 2: Catalogue readers and loader

**Files:** Create `src/lib/admin/catalogue-form.ts` + test, `src/lib/admin/allergens.ts`,
`src/lib/admin/catalogue.ts`; Modify `src/lib/admin/media.ts`.

**Produces (pure, FormData field names fixed here):**
- `newId(prefix: string): string` — `${prefix}-${6 hex}`.
- `readTexts(form)` → `{ name, description, translations }` from `name.pt`, `name.en`,
  `description.pt`, `description.en` (empty `en` → no `translations.en` key for it).
- `readLinks(form, prefix)` → `Link[]`: rows `${prefix}.N.type`, `.id`, `.order`, `.remove`, plus
  `${prefix}.add` (`TYPE:id`); sorted by `order` (stable), removed dropped.
- `readHours(form)` → `PosEntitySectionHours[]` from `MONDAY.open` (checkbox), `MONDAY.start`,
  `MONDAY.end` (`HH:mm` → `HH:mm:00`).
- `readSection(form, current | null): PosEntitySection` — texts, `available`, hours (when
  `hours.on`), links = image link (`image`) first + `links` rows.
- `readItem(form, current | null): AdminItem` — keeps every field of `current` the form does not
  show; type from `type` (`ITEM` | `SIZED_ITEM` | `COMBO_MEAL`); `price` via `priceField` (forced
  `0` for `SIZED_ITEM`); `dineInPriceOverride` optional; `available`, `alcoholic`,
  `ageRestriction`, `plu`, `internalName`, `calories`, `allergens[]`, `allergenTraces[]`,
  `allergensDeclared`, `badgeIds[]`, `crossSellIds[]`, option fields `defaultQuantity`,
  `minChoices`, `maxChoices`; `comboMealId` kept or `nextComboId`; links = image + `links` rows;
  `displayPrice` dropped.
- `readGroup(form, current | null): { group: PosEntityModifier; options: PosEntityItem[] }` —
  group type, `modifierType`, `min`, `max` (min ≤ max else VALIDATION_FAILED "mínimo e máximo");
  option rows `opt.N.*` (`id`, `name.pt`, `name.en`, `price`, `defaultQuantity`, `minChoices`,
  `maxChoices`, `available`, `nested` = MODIFIERS id, `order`, `remove`) + one blank new row;
  existing option ids kept, new ones `newId("op")`; options keep fields of their current entity.
- `readSwapSell`, `readBadge`, `readMenu(form, current)` (`root` from `root` rows),
  `readDiscountRule(form, current)` (code upper-cased, `^[A-Z0-9]{3,20}$`, PERCENT 1–100,
  FIXED via `priceField`, optional `minOrderTotal`/`maxDiscount`/`maxUses ≥ 1`, `usesCount`
  copied from current, `active`).
- `catalogue.ts` (server-only): `loadCatalogue(): Promise<Catalogue>` (sections, items, groups,
  swapSells, images, badges in parallel) + `nameOf(catalogue)`; `saveOptions(options, current)`
  returns a `saveBoth` first part (save = PUT each changed/new option; undo = PUT previous / DELETE new).
- `uploadImageV2(form, field): Promise<string | null>` — v2 `uploadMedia`, returns the IMAGE id.

- [ ] Tests: each reader with a filled FormData; `readItem` with a `current` that has
  `deliveryPriceOverride`, `barcodes`, `posMetadata`, `comboMealId` keeps them (Review Focus 3);
  `readLinks` order/remove/add; `readGroup` min > max refused, new option gets an `op-` id;
  `readDiscountRule` refusals (Review Focus 5).
- [ ] Implement; tests pass; commit `feat(COM-147): read v2 catalogue forms`.

## Task 3: Editor pages — sections, items, groups, swap sells, badges, menus

**Files:** Create `src/components/admin/catalogue-fields.tsx`, `grupos/page.tsx`,
`grupos/[groupId]/page.tsx`, `grupos/novo/page.tsx`, `grupos/group-form.tsx`; Rewrite
`categorias/page.tsx`, `itens/page.tsx`, `itens/item-form.tsx`, `itens/[itemId]/page.tsx`,
`itens/novo/page.tsx`, `selos/page.tsx`, `cardapios/page.tsx`; Delete `itens/[itemId]/option-groups.tsx`;
Modify `components/admin/nav.tsx` (add "Grupos de opções").

- Sections: list as a tree from the menus' roots (orphans last), each in `<details>` with its form;
  "Nova categoria".
- Items: list "Produtos" (linked from a section or none) and "Opções e tamanhos" (linked from a
  group or a `SIZED_ITEM`); editor by type: `SIZED_ITEM` edits sizes inline (same
  `saveOptions` + `saveBoth`), `COMBO_MEAL` picks one `COMBO_MAIN` + `COMBO_SIDE`s, `ITEM` picks
  `MODIFIERS` groups and one swap sell; allergens (contains / may contain / declared), badges,
  cross-sells, image (upload or existing), option fields.
- Groups: type, modifier type, min/max, options inline with nested group; save = `saveBoth`
  (options first, undoable; then the group).
- Selos: badges and swap sells. Menus: name PT/EN, root sections (rows), weekly windows, force.
- Every save `revalidatePath` of its page; delete buttons per entity (MENU_INVALID shown if linked).

- [ ] typecheck + lint pass; commit `feat(COM-147): edit the v2 menu in the back office`.

## Task 4: Reference menu proof (MODELS 5.20 minus tax)

**Files:** Create `src/lib/admin/reference-menu.test.ts`.

- Builds every 5.20 entity as the forms post them (FormData → readers → bodies), sends them to the
  mock's `adminRoutesV2` in process (same handlers Prism proxies to), creates menu "Referência",
  forces it, then compares `guestMenu()` with the seed's 5.20 menu as a **canonical tree** (ids
  replaced by names, fields the editor does not show dropped).
- With `MOCK_V2_URL=http://localhost:4011` set, the same build runs through Prism and compares
  `GET /v2/menus/active`.

- [ ] In-process run passes; live run through Prism 4011 passes; commit
  `test(COM-147): build the MODELS 5.20 menu through the editor readers`.

## Task 5: Availability and coupons

**Files:** Create `disponibilidade/page.tsx`; Replace `esgotados/page.tsx` with a redirect;
Rewrite `cupons/page.tsx`; Modify `nav.tsx` ("Esgotados" → "Disponibilidade"), `skeleton.tsx`
(rename only if needed).

- Disponibilidade: products, then options and sizes grouped by their group; on/off button per row
  via `PUT /v2/admin/items/{id}/availability`; filter `?filtro=indisponiveis`.
- Cupons: list with uses `usesCount / maxUses`, edit + create + delete via `DiscountRule`; `409
  DISCOUNT_CODE_TAKEN` message kept.

- [ ] typecheck + lint + tests pass; commit `feat(COM-147): availability and coupons on v2`.

## Task 6: Verify and ship

- [ ] `npm run test`, `npm run typecheck`, `npm run lint` in `apps/web`.
- [ ] Mock running; build part of 5.20 in the browser; screenshots 375/768/1024/1440 of every
  changed page; overflow and states checked.
- [ ] Status lines in `docs/plans/pilot-v2.md`; `docs/backlog-pending.md` → Linear (Haiku).
- [ ] Rebase on `origin/release/v0.4`, push `feat/COM-147-back-office-v2`, PR into `release/v0.4`,
  squash on green CI.
