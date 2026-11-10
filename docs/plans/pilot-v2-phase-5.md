# Pilot v2 — Phase 5: one contract, one version (COM-149)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** no `/v1` left in the app, the mock or the contract; the docs describe the pilot.

**Architecture:** first every remaining v1 caller in the app moves to `coreApiV2()` while both
contracts still exist (tsc stays green between steps). Then `contract/openapi.v2.yaml` becomes
`contract/openapi.yaml`, its generated types become `src/lib/core-api.d.ts`, `client-v2.ts` becomes
`client.ts` (`coreApi()`, `coreMediaApi()`, `coreApiUrl()`, `Problem`, `ProblemCode`), and the mock
loses every v1 route and the second Prism. The `/v2` path prefix stays: it is the contract's URL.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, openapi-fetch, Vitest, stateful mock + Prism.

**Spec:** [`docs/pilot-v2/SPEC.md`](../pilot-v2/SPEC.md); master plan [`pilot-v2.md`](pilot-v2.md)
Phase 5 (Tasks 5.1–5.2).

## Global Constraints

- The v2 contract's content does not change; only its file name (`contract/openapi.yaml`). PR needs
  the partner's OK: push and open the PR into `release/v0.4`, never merge it here.
- One Prism on `PRISM_PORT` 4010 serves the contract, so `CORE_API_URL=http://localhost:4010` keeps
  working on itodev and prod with no Cubeship change. `CORE_API_V2_URL` is no longer read.
- Money is decimal BRL from Core; dine-in only; Mercado Pago Pix + Point; invoice notice, no NFC-e.
- Never edit generated files: regenerate with `npm run gen:api`.
- No Go, no Linear, no Cubeship, tags, master or repo settings.

## Review Focus

1. A browser paired before this change (cookie holds the device id and secret) still signs in: the
   v2 `POST /v2/devices/auth` takes the same body, so `/setup` is not needed again.
2. The admin home's off-items tile shows options and sizes too (they are `ITEM`s in v2) and "Ligar"
   turns one back on (`PUT /v2/admin/items/{id}/availability {available: true}`).
3. A menu window past midnight (`close` < `open`) still ends at the right time on the home band:
   the v2 → home window mapping keeps `open`/`close` as they are.
4. `npm run mock` with an old `.env.local` that still has `CORE_API_V2_URL=…4011`: nothing reads it,
   and nothing listens on 4011 any more.
5. The kitchen gate (`DeviceGate`) on v2 config: `pace` now lives at `config.store.pace`.

---

### Task 1: Move the remaining v1 callers in the app to v2

**Files:**
- Modify: `src/lib/device/{session,config,gate}.ts`, `src/app/setup/actions.ts`,
  `src/app/api/device/{heartbeat,status}/route.ts`, `src/components/device-gate.tsx`,
  `src/lib/admin/{session,media,form,store-status,home}.ts`, `src/app/admin/(panel)/page.tsx`,
  `src/app/api/dev/core/route.ts`, `src/app/dev/mock/page.tsx`, `src/lib/core/mock-scenarios.ts`,
  admin pages that call `uploadImageV2`.
- Delete: `src/lib/kiosk/core.ts` (no importers), `src/lib/kiosk/simulated-payment.ts` (v1 only).
- Test: `src/lib/device/session.test.ts`, `src/lib/admin/home.test.ts`, `src/lib/admin/store-status.test.ts` (new).

**Interfaces:**
- Produces: `fromSectionHours(w: PosEntitySectionHours): Schedule` in `lib/admin/home.ts`
  (`MONDAY`→`MON` …; `open`→`timeStart`, `close`→`timeEnd`); `Schedule`/`Weekday` become local types
  in `home.ts` (no contract import).
- Produces: `unavailable(items: AdminItem[]): AdminItem[]` in `lib/admin/home.ts` — items with
  `available === false`, sorted by name (pt-BR).
- `DeviceConfig` (lib/device/config.ts) becomes v2 `DeviceConfig`; `gateState` callers pass
  `{ ...config, pace: config.store.pace }`.
- `uploadImageV2` → `uploadImage` (returns the IMAGE entity id); the v1 `uploadImage` goes.

- [ ] Step 1: tests — `session.test.ts` expects `POST "/v2/devices/auth"`; `home.test.ts` adds
  `fromSectionHours({dayOfWeek:"SUNDAY",open:"22:00",close:"02:00"})` → `{weekday:"SUN",timeStart:"22:00",timeEnd:"02:00"}`
  and `unavailable()` keeps only `available:false`, sorted ("Café" before "Pão").
- [ ] Step 2: run `npx vitest run src/lib/device src/lib/admin/home.test.ts` → FAIL.
- [ ] Step 3: implement; home tile "Indisponíveis agora" lists `unavailable(items)`, row "Desligado
  até você ligar", button "Ligar"; header link `/admin/disponibilidade?filtro=indisponiveis`.
  `/dev/mock` payment buttons decide the newest open v2 Mercado Pago session
  (`POST /__mock/payments/{id}`) instead of the v1 cookie.
- [ ] Step 4: `npx vitest run` + `npx tsc --noEmit` → PASS; grep `@/lib/core/client"` / `@/lib/core-api"` in
  `src` finds only `client-v2.ts`'s shared helpers.
- [ ] Step 5: commit `refactor(COM-149): move device, owner sign-in, media and home to core v2`.

### Task 2: One contract, one client, one Prism

**Files:**
- Move: `contract/openapi.v2.yaml` → `contract/openapi.yaml` (v1 file deleted);
  `src/lib/core/client-v2.ts` → `client.ts` (old deleted, helpers `fetchWithTimeout`,
  `CALL_TIMEOUT_MS`, `MEDIA_TIMEOUT_MS`, `problemCode` move in); `client-v2.test.ts` → `client.test.ts`;
  `src/lib/kiosk/core-v2.ts` → `core.ts`; `src/lib/kiosk/basket-v2{,.test}.ts` → `basket{,.test}.ts`.
- Regenerate: `src/lib/core-api.d.ts` from the single contract; delete `core-api-v2.d.ts`.
- Modify: `package.json` scripts (`gen:api`, `lint:contract`, `mock:smoke`, `mock:raw`; drop the `:v2`
  ones), `.env.example` (no `CORE_API_V2_URL`), every importer (sed).
- Mock: `server.ts` starts one Prism (`openapi.yaml`, `PRISM_PORT`), drops v1 routes; `pace.ts`
  serves `/v2/kitchen/pace`, `/v2/admin/pace`, `/v2/admin/pace/wait-minutes` itself and broadcasts on
  the v2 stream; owner login and devices move from `routes-admin.ts` into `v2/routes-admin.ts`;
  `http.ts` types from the single `core-api.d.ts`; `state.ts` keeps devices, tokens, owner, clock,
  media, idempotency, language packs, status reports (no v1 menus, catalogue, orders, payments);
  `SEED_MEDIA` moves to `media.ts`. Delete `routes-{catalogue,kiosk,options,orders,kitchen}.ts`,
  v1 `routes-admin.ts`, `catalogue.ts`, `kiosk-menu.ts`, `stream.ts` and their tests
  (`kiosk-menu`, `kitchen`, `devices` if v1-only); `v2/smoke.ts` → `mock/smoke.ts`.
- Test: existing v2 mock tests, `pace.test.ts` moved to `/v2` paths.

**Interfaces:**
- Produces: `coreApi(): CoreApi`, `coreMediaApi(): CoreApi`, `coreApiUrl(env?): string` (reads
  `CORE_API_URL`), `type Problem`, `type ProblemCode`, `problemCode(error)` — all in `@/lib/core/client`.

- [ ] Step 1: move the contract, `npm run gen:api`, `npm run lint:contract` → valid.
- [ ] Step 2: rename client + symbols (`coreApiV2`→`coreApi`, `coreMediaApiV2`→`coreMediaApi`,
  `coreApiV2Url`→`coreApiUrl`, `ProblemV2`→`Problem`, `ProblemCodeV2`→`ProblemCode`,
  `CoreApiV2`→`CoreApi`); `client.test.ts` asserts `coreApiUrl({CORE_API_URL:"http://x"})` = `"http://x"`
  and throws without it.
- [ ] Step 3: mock cleanup as listed; `npx vitest run` → PASS.
- [ ] Step 4: `npx tsc --noEmit`, `npm run lint`, `npm run mock` + `npm run mock:smoke` → PASS;
  `grep -rn "/v1" src mock ../../contract` → nothing live.
- [ ] Step 5: commit `refactor(COM-149): make contract v2 the only contract, client and mock`.

### Task 3: Docs (Task 5.2)

**Files:** `CLAUDE.md`, `contract/README.md`, `docs/plan.md`, `docs/data-model-and-api.md`,
`docs/plans/pilot-v2.md` (status lines), `RELEASING.md`/`deploy/` only where they name v1 or 4011.

- [ ] Step 1: CLAUDE.md — decimal BRL, `/v2`-only contract rules, dine-in pilot scope, waiter/QR after
  the pilot, single-Prism mock commands, no "menu pages stay on /v1" note.
- [ ] Step 2: contract/README.md describes v2; plan.md and data-model-and-api.md get a pointer to
  `docs/pilot-v2/SPEC.md` where they disagree.
- [ ] Step 3: commit `docs(COM-149): describe the pilot's single v2 contract`.

### Task 4: End-to-end proof and PR

- [ ] `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx @redocly/cli lint contract/openapi.yaml`,
  `npm run mock:smoke` with the mock up.
- [ ] Browser (mock + `next dev`): kiosk Pix order → kitchen board → report; item turned off in
  Disponibilidade shows on the admin home. Screenshots.
- [ ] Rename branch `refactor/COM-149-remove-v1`, push, PR into `release/v0.4`; do not merge.

## Status

| Task | Status |
|:--|:--|
| 1 App callers on v2 | ⏳ |
| 2 One contract, client, Prism | ⏳ |
| 3 Docs | ⏳ |
| 4 Proof and PR | ⏳ |
