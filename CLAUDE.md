# CLAUDE.md — Comanda

Comanda is a self-service ordering kiosk ("totem") for a single bakery, the first real test.
Guests order on a vertical touch screen, pay, and pick up at the counter. There is also a
kitchen screen and a back office for the owner.

**The pilot** (`docs/pilot-v2/SPEC.md`, decided by Kai and the partner 5–6 Nov 2026) is a basic
dine-in kiosk on the v2 data models of `docs/v2-research/MODELS.md`: see the menu, choose, pay with
Pix or card (Mercado Pago Pix + Point, called only by the Core API), and the order reaches the kitchen after
payment. Every order is `DINEIN`. No NFC-e: the success screen shows the invoice notice ("Se quiser
nota fiscal, dirija-se ao caixa."). No tax. Availability is plain on/off. The waiter app, tables,
open checks and the table QR menu come **after the pilot**.

Two people build it:
- **Kai** (you work with him): the Next.js app — kiosk, kitchen and back-office screens, and the BFF.
- **Bruno** (the partner): the Core API, in **Java**, and the PostgreSQL database. Do not write
  back-end code unless Kai asks.

The Core API was planned in Go and Bruno moved it to Java (Kai, 11 Nov 2026), before any of it was
written. `contract/openapi.yaml`, older docs and code comments still say "Go" for the Core API: read
it as "the Core API". The contract itself does not depend on the language.

**Where it stands (11 Nov 2026, `v0.4.9` in prod, `release/v0.5` open):** the kiosk, the kitchen screen, the back office and the
BFF are built and run end to end against the stateful mock, on contract `2.0.0` (64 operations, all
answered by the mock through Prism). The Core API is not started. Next: Bruno implements the
contract, then `CORE_API_URL` points at it instead of the mock (`contract/README.md`, "Back end").

Talk to Kai in Brazilian Portuguese, casual and direct. Code, comments, commits and docs in English.

## Read first, in this order

1. `docs/pilot-v2/SPEC.md` — the pilot: scope, decisions, what changed from the original plan.
   `docs/plan.md` — original MVP scope, architecture, phases, decisions, risks (the SPEC wins).
2. `contract/openapi.yaml` and `contract/README.md` — the API contract with the Core API.
3. `docs/data-model-and-api.md` — entities, business rules, open questions.
4. `docs/prototype/README.md` and `docs/prototype/screens/*.png` — the approved visual design.
5. `docs/specs/` — functional specs of the reference kiosk: how each screen behaves.
   IDs: `F-` features, `FR-` requirements, `BR-` business rules, `SCR-` screens,
   `ENT-` entities, `OP-` backend operations.

When sources disagree: **contract > pilot SPEC > plan > prototype > specs.** The specs describe a Windows +
Electron kiosk with a local service; the plan replaces that with a thin client (below) and cuts
scope. Use the specs for screen behaviour, rules and field names, not for architecture.

## Architecture

```
Kiosk (Orange Pi, Debian, Chromium --kiosk, 1080x1920 portrait)
   │ HTTPS
   ▼
Next.js app (server)  ── BFF: Route Handlers, Server Actions, Server Components
   │ REST/JSON /v2, generated client from contract/openapi.yaml
   ▼
Core API (Java, Bruno) ── PostgreSQL       all in Docker on one server
```

- Nothing is installed on the kiosk except Chromium. No Electron, no local service.
- One Next.js app serves three areas behind three logins: `/kiosk` (device), `/kitchen` (device),
  `/admin` (owner).
- The BFF formats and combines. **Prices, discounts, menu availability and order numbers are
  decided only by the Core API.** Never compute them in the front end beyond display.
- Device and owner tokens stay on the server (HttpOnly cookies). The browser never sees them.

## Stack

- Next.js 16 (App Router), React 19, TypeScript `strict`.
- Tailwind CSS v4. Fonts with `next/font`: **Fraunces** (display) and **Manrope** (text).
- `openapi-typescript` + `openapi-fetch` for the Core API client, in server-only modules.
- Serwist for the service worker (app shell and image cache). The MVP offline behaviour is a
  "temporarily offline" screen, not an offline order queue.
- React Compiler on. No animation library, no CSS-in-JS runtime.
- Ask Kai before adding any other production dependency.

## Repository layout

```
CLAUDE.md
AGENTS.md                 points other coding agents (Codex …) here; keep every rule in CLAUDE.md
README.md                 how to run the project locally, from zero
RELEASING.md              the release flow in full
contract/openapi.yaml     source of truth for the API; change only by PR, both partners approve
contract/README.md        how both sides use the contract; what the Core API must do
docs/                     plan, data model, specs, prototype (read-only reference)
apps/web/                 the Next.js app: kiosk, kitchen, back office and the BFF
  src/lib/core-api.d.ts   generated, never edit by hand
  mock/                   the stateful mock Core API (routes in mock/v2)
deploy/cubeship/          Dockerfiles of the `web` and `mock` apps
infra/kiosk/              kiosk board setup kit (phase 4)
```

The Core API's code is not in this repository yet; where it will live is Bruno's call.

## Phases

| Phase | Goal | Done when |
|:--|:--|:--|
| 0 | Foundation: Next.js app, BFF, device auth, config, heartbeat, PWA shell, HTTPS deploy | The kiosk, in a regular browser over the server's HTTPS address, reaches the Core API |
| 1 | Back office and menus: catalogue, schedules, sold out, discounts | The menu switches by itself |
| 2 | Kiosk ordering: full flow, PT/EN, coupons, simulated payment, number on screen | A real order on the unit |
| 3 | Kitchen screen (SSE) and daily report | Order in the kitchen in 2 s |
| 4 | Kiosk board (Orange Pi, Chromium kiosk, measurements), payment terminal, receipt and kitchen printers, NFC-e | Real sale, valid NFC-e, on a locked kiosk |
| 5 | Pilot at the bakery | Owner keeps it running |

Everything that is hardware is phase 4, last: the kiosk board itself, the payment terminal and the
printers (Kai, 30 Oct 2026; this overrides `docs/plan.md`, which had the board in phase 0). Until
then the kiosk is developed and tested in a regular desktop browser at 1080x1920; the board setup
kit waits in `infra/kiosk/`.
Payment in the pilot is Mercado Pago Pix + Point through the Core API (`POST /v2/payments`); the mock
simulates Mercado Pago (`POST /v2/payments/{id}/simulate` and `/__mock/payments/{id}`).

The `x-phase` field on each contract operation is **not** a phase of this table: it is the phase of
the pilot plan (`docs/plans/pilot-v2.md`) that moved the app onto that operation (2 kiosk, 3 menu
editor, 4 kitchen, store, devices, orders, report). The Core API needs all 64.

## Contract rules (short version; full list in `contract/README.md`)

- One contract, `contract/openapi.yaml` (v2 models); every path is under `/v2`. There is no v1.
- Money is a JSON number in decimal BRL (`9.50` = R$ 9,50), never cents. Display it with
  `formatMoney()` (`src/lib/format/money.ts`); the Core API computes every amount.
- The kiosk sends entity ids, never prices; the Core API prices the basket (`POST /v2/totals`).
- Errors are `application/problem+json`; switch on `code`, never on `title`.
- `POST /v2/payments` and `POST /v2/orders` need an `Idempotency-Key` (UUID per attempt).
- Dine-in only: `orderType` is always `DINEIN`; no take-out screen or report split.
- Config and menu return an `ETag`; send `If-None-Match`.
- Guest endpoints take `language` (`pt-BR` or `en`) and return resolved text.

## Kiosk performance rules (the ARM board is the weakest part)

- Load the menu once at journey start and keep it in memory (spec OP-START-04). Menu, item and
  cart are one client-side flow; the only server call is the Core API pricing the basket (`POST /v2/totals`,
  debounced 400 ms after a change), which never blocks a tap.
- The attract, closed and unavailable screens are Server Components. Client code only for the
  journey (menu, item builder, basket, checkout and the success screen with its countdown), the
  paused screen and the idle timer.
- Menu photos (COM-173) go through `<Photo>` (`components/kiosk/journey/photo.tsx`), in two variants
  only (`PHOTO_PROPS`, `src/lib/kiosk/photos.ts`): `thumb` (one fixed 384 px width, used by the grid,
  the basket and the swap and cross-sell sheets) and `hero` (the item screen, over the thumbnail).
  Never give the thumbnail `fill sizes`: Chromium then draws the 1080 px variant it already holds
  and decodes it for every cell. Right after the menu loads, the journey preloads every photo in
  the background (`photo-preload.ts`), so a category or an item opens with no image request.
- The service worker keeps photos for 30 days (`photos` cache in `src/app/sw.ts`, up to 600) and
  the optimizer for a day (`images.minimumCacheTTL`; not longer while COM-45 is open). On the first
  kiosk render after a start, then every 10 minutes, the server resizes the active menu's photos
  in the background (`warmMenuPhotos`, production only), in the widths of `KIOSK_PHOTO_WIDTHS`.
- CSS transitions only. No blur or heavy shadows in animation.
- Keep the bundle in check with `npm run analyze` (baseline: ~181 KB gzip of JS on `/kiosk`); the
  real board is tested in phase 4, so do not let client code grow without a reason.

## Design

The prototype (12 screens) is the visual reference: `docs/prototype/README.md` has the colour
tokens, type scale and per-screen notes. It is drawn at 720x1280; the real screen is 1080x1920,
so multiply prototype sizes by 1.5. Kiosk UI copy is pt-BR first, with English as the second
language.

Every other screen (new kiosk states, kitchen, back office on desktop and phone, and the waiter and
table QR code apps) is in one canvas, sources in `docs/prototype/full/project/`; the README's "Full
canvas" section lists them. Only the 12 kiosk screens are approved: the rest is a proposal, and
the waiter and QR apps come after the pilot. A desktop screen and its phone version share the number
(`A2-Pedidos` ↔ `M2-Pedidos`).

## Commands

Running the project from zero (Node version, `.env.local`, the two terminals, test logins) is in
`README.md`; keep it current when a command or an environment variable changes.

```bash
# Stateful mock Core API (apps/web/mock) behind Prism, which validates every call against the
# contract. Front end and BFF are built against it until the Core API exists. In apps/web:
npm run mock        # one Prism on :4010 (contract/openapi.yaml): CORE_API_URL=http://localhost:4010,
                    # MOCK_CONTROL_URL=http://localhost:4020/__mock; routes live in mock/v2
npm run mock:orders -- 3                # with the mock running: 3 paid kiosk orders now (kitchen, report)
npm run mock:orders -- 3 --days-ago 7   # ...on the same weekday last week (Início, Relatório)
# A browser is one device and opens only its area (a kiosk browser sent to /kitchen lands on
# /kiosk). In dev with the mock, "Totem" and "Cozinha" on / pair this browser as the mock's
# device of that kind first.
# Extend apps/web/mock with the operations each story needs; Prism flags any drift from the contract.
# The mock's menu is Abigail Coffee's (mock/v2/seed-abigail.ts, photos in mock/media/abigail, invented
# prices) in front of the MODELS 5.20 reference menu; MOCK_MENU=reference keeps only the reference menu,
# which is how vitest runs (vitest.config.mts), so tests assert on MODELS 5.20 alone.
# Mercado Pago is simulated: MOCK_PAYMENT_OUTCOME=APPROVED|DECLINED|EXPIRED|NONE (default APPROVED)
# after MOCK_PAYMENT_DELAY_MS (3000); POST /__mock/payments/{id} {"outcome": …} decides one session.
# To see a Pix or card outcome, run the mock with MOCK_PAYMENT_OUTCOME=NONE and decide the waiting
# session from /dev/mock (or POST /__mock/payments/{id}).
npm run mock:smoke                      # with the mock running: every operation through Prism
# The kitchen reads order lines through src/lib/kitchen/order.ts (one line per unit merged). The
# kiosk never adds prices: the Core API prices the basket (POST /v2/totals) after every change.
# An ingredient taken out is not on the order: the kiosk tells the kitchen in specialNotes
# ("sem Tomate", always pt-BR, built in toOrderItems), so every call that sends the basket carries it.
# Ports taken by another worktree? MOCK_PORT and PRISM_PORT move the mock (then set CORE_API_URL
# and MOCK_CONTROL_URL to match).

# The service worker's caches and the photo warm-up run only in a production build. To see them
# locally, with the mock running (`web-prod` in .claude/launch.json):
npm run build && npm run start

# Regenerate API types after any contract change (in apps/web)
npm run gen:api        # contract/openapi.yaml → src/lib/core-api.d.ts

# Lint the contract
npx @redocly/cli lint contract/openapi.yaml

# Checks, in apps/web. CI (`pr-checks / checks`) runs only lint and typecheck, so run the tests yourself.
npm run typecheck && npm run lint && npm test
```

## Working agreements

- Do not change `contract/openapi.yaml` silently. Propose the change to Kai first; it needs the
  partner's approval.
- Never edit generated files.
- Back office forms (`apps/web/src/lib/admin/form.ts`): read prices with `readPrice()` / `priceField()`
  (decimal BRL), which refuse what is not a price and never guess. A form saved through
  two Core calls uses `saveBoth()`: the part that can be read back and undone goes first, and it is
  put back if the second call fails. The contract has no atomic save.
- Back office menu editor (COM-147): every form is read by a pure reader in
  `src/lib/admin/catalogue-form.ts` (FormData + current entity → v2 body; fields the form does not
  show are kept), tested on its own and by `reference-menu.test.ts`, which builds the MODELS 5.20
  menu through those readers (`MOCK_API_URL=http://localhost:4010` runs it through Prism). Catalogue
  saves go through `attemptCatalogue()` (`src/lib/admin/catalogue.ts`), which lists each
  `MENU_INVALID` rule by entity name.
- Back office loading (COM-140, COM-141): a page part that loads data goes in
  `<Streamed fallback={<…Skeleton />}>` (`components/admin/skeleton.tsx`), never a bare
  `<Suspense>` (only the panel layout's shell and the login page keep one: nothing there has a
  skeleton). The skeleton has the page's shape with its fixed labels as real text; the
  content then fades in at the same spot, without sliding. `NavProgress` and the page entrance live in
  `app/admin/(panel)/admin.css` + `template.tsx`, admin only. With `cacheComponents`, visited
  pages stay in `<main>` hidden (`display: none`): never rely on `:nth-child` across pages or on
  the URL changing as "the new page is on screen".
- Open questions. Settled by the pilot SPEC (section 9) and the contract: order number reset (per
  business day), offline ("Temporariamente offline" screen), device pairing (id + secret at
  `/setup`), `waitTime` (the owner's minutes for the pace) and a price changed mid-order
  (`409 BASKET_CHANGED`, the guest confirms the new total). Still open: where menu pictures are
  served (the contract has no `GET /media/...`; the BFF reads `CORE_MEDIA_URL`, isolated in
  `src/app/media/[...path]/route.ts`), where the device secret lives on the Core side, and the
  fiscal fields (no NFC-e in the pilot). Do not guess an answer into the code; ask Kai, or isolate
  it behind one clearly named function.
- Out of scope for the pilot (SPEC D-7, D-10, D-13, D-14): take-out, NFC-e, tax, the waiter app,
  tables and the table QR menu (after the pilot), loyalty, Scan-and-Go and staff age approval,
  split bill, guest walks away, accessibility mode, tips, other payment methods, digital receipts,
  multi-brand.
- Keep changes small and phase by phase. After each step, say what changed and how to check it.

## Task tracking

**No tracker** (Kai, 13 Nov 2026): Linear is abandoned (the free plan ran out of issues) and is not
read or updated any more. Do not use the `linear-backlog` skill.

- Ticket ids keep the `COM-n` shape, because the release kit's `conventions` check needs one in
  the branch and the PR title. A new piece of work takes the next number after the highest `COM-n`
  in git: `git log --all --format=%s | grep -oE "COM-[0-9]+" | sort -t- -k2 -n | tail -1`, plus one
  (COM-175 was the first after Linear).
- Name branches and commits per the release flow below (`fix/COM-175-short-name`,
  `fix(COM-175): summary`). The PR description says what the work is; it is the only record.
- Bugs, tech debt and follow-ups found while working go in `docs/backlog-pending.md` (type, pt-BR
  title, 1–2 lines of context, related id, fixed or not). It is the backlog now: remove an entry
  when its fix merges.
- Issues numbered before COM-175 with Bruno's back-end work (e.g. COM-12) stay his: do not
  implement the Core API.

## Release flow — always follow this

Kai's standing rule (31 Oct 2026). You manage branches, PRs, tags and deploys for this repository.
Follow these rules exactly. If a request conflicts with them, stop and say which rule it breaks.

**How this repo applies it** (details and setup in `RELEASING.md`):
- The default/prod branch was renamed `main` → `master` on 31 Oct 2026 (Kai's decision).
- Automation comes from the release kit (`Kaina-Ribeiro/release-kit`, COM-70), the same in every
  repo: `.github/workflows/release.yml` and `.github/workflows/pr-checks.yml` are short callers of
  the kit's reusable workflows pinned at `@v1`, whose `release.mjs` holds the logic. No copy of it
  lives in this repo: to run it locally, fetch it into `.git/release.mjs` (command at the top of
  `RELEASING.md`). CI jobs `pr-checks / checks` and `pr-checks / conventions`, rulesets in
  `.github/rulesets/*.json`. Never edit these files here: change the kit (a fix under `@v1`
  arrives without a PR) and reinstall with its `install.sh` when the callers change. Rulesets and the
  `RELEASE_TOKEN` secret are applied only with Kai's yes.
- Applied rulesets differ from the kit's JSON on purpose (Kai, 4 Nov 2026): **no required
  approval** (Kai merges alone), and the `v*` tag ruleset lets only admins bypass, because GitHub
  refuses the Actions app as a bypass actor on a personal-account repo. So `RELEASE_TOKEN` must be
  an admin's token (Kai's; Pull requests + Contents read/write) or rc/final tags fail to push.
  The version-lines ruleset also has the admin role as bypass (`always`, 4 Nov 2026), so the
  workflow can delete a shipped `release/*` or `hotfix/*` branch. Never reapply `.github/rulesets/*.json` here as they are. Kai manages tokens himself: never ask
  for, read or handle a token value.
- GitHub auto-merge is allowed on the repo (Kai, 13 Nov 2026): a work PR into `release/*` or
  `hotfix/*` gets squash auto-merge when it opens, so it lands on green CI. Merged branches are not
  deleted by GitHub (`delete_branch_on_merge` is off): delete them after the merge.
- Deploy is Cubeship (`deploy/cubeship`), not Jenkins. The apps `comanda/production/web` and
  `comanda/production/mock` build from a tag (`ref: v0.1.0` since 31 Oct 2026), never a branch.
  On release day prod takes the open line's last rc, with Kai's confirmation: Actions → Release →
  `deploy`, stage `prod` (needs `DEPLOY_PROD_APPS="comanda/production/mock comanda/production/web"`,
  `CUBESHIP_URL` and the `CUBESHIP_TOKEN` secret); then the merge into master tags it final.
  Without those variables, deploy by hand after `node .git/release.mjs deploy-check <rc> --prod` passes.
- Test stage is the Cubeship environment `itodev` (5 Nov 2026, COM-70): apps `comanda/itodev/mock`
  and `comanda/itodev/web`, same Dockerfiles as prod, at https://comanda-itodev.13-140-33-41.sslip.io
  (prod: https://comanda.13-140-33-41.sslip.io; the instance moved from `5.189.167.204`, and the
  Cubeship app list is the source of truth for the address). `web` is limited to 1 CPU like prod and
  keeps the image optimizer's cache in a volume at `/repo/apps/web/.next/cache/images` (12 Nov 2026,
  COM-173), so resized photos survive a deploy; an app with a volume stops before the new container
  starts, so each deploy has a short gap. Prod's `web` has the same volume since 13 Nov 2026
  (COM-173), mounted from its next deploy (a `v0.6.x` tag; the `v0.5.2` image lacks the directory).
  Prod deploys are always done outside opening hours (Kai, 13 Nov 2026), so those few seconds
  without answers are accepted. The itodev volume is not needed and stays only until Kai removes
  it in the Cubeship panel (no tool removes a volume).
  `DEPLOY_TEST_APPS="comanda/itodev/mock comanda/itodev/web"`, so every new rc deploys there by
  itself (mock first). `web` reaches `http://cubeship-comanda-itodev-mock:4010`/`:4020`, has its own
  `DEVICE_COOKIE_SECRET`, and `mock` runs with `MOCK_AUTO_DEVICES=1`.
- `v0.1.0` is an annotated tag created by hand (Kai, 30 Oct 2026) on `b230cce`, before this flow;
  it has no rc, so the gate refuses it for prod.

### Model
- Version lines: `release/vX.Y` (next version) and `hotfix/vX.Y` (fix for what's in prod).
- `master` = what's in prod. Only `release/vX.Y` and `hotfix/vX.Y` merge into it.
- Tags follow SemVer: `vX.Y.Z-rc` = release candidate, `vX.Y.Z` = shipped. Every rc takes the
  next patch (`v0.2.0-rc`, `v0.2.1-rc`, …) and the final is the last rc without `-rc`.
  Tags, GitHub releases, new version-line branches and sync PRs are created by
  automation (`.github/workflows/release.yml` → the kit's `release.mjs`).
  **Never create, move or delete a tag by hand.**

### Naming
- Branch: `<type>/<TICKET>-short-name`. Types: feat, fix, chore, refactor, perf, docs, test, ci, build, revert.
- PR title / commit: Conventional Commits → `type(TICKET): summary`, imperative, lowercase.
  Here the ticket is a `COM-n` id (see Task tracking): `feat/COM-9-heartbeat`, `feat(COM-9): send device heartbeat`.

### Procedures
1. **Feature/fix:** find the open release it ships in (`release/vX.Y` not merged into master;
   ask if more than one fits). Branch from it, PR into it, **squash** merge.
   The merge auto-tags the next `vX.Y.Z-rc`.
2. **Remove a feature from a release:** revert PR in that release (GitHub "Revert");
   reapply in the next release by reverting the revert.
3. **New release:** run Actions → Release → `cut-release`. Never create `release/*` by hand.
   It branches from the newest open release (or master if none).
4. **Release day:** deploy the line's last rc to prod first (see Deploy), then PR
   `release/vX.Y → master`, **merge commit** (never squash/rebase). The merge auto-tags the last
   rc's version (`v0.2.1-rc` → `v0.2.1`) with release notes; it refuses while prod runs another tag.
5. **Hotfix:** Actions → Release → `cut-hotfix` (branches from the final tag in prod).
   Fix PRs into `hotfix/vX.Y` (squash) → test the rc → PR into master (merge commit).
6. **Sync PRs** (`chore(sync): merge A into B`, opened automatically): review, merge with
   **merge commit**. Resolve conflicts on a branch off the target, never on the source.

### Deploy (Cubeship here; the original flow named Jenkins `dev_tag` + `environment`)
Every stage runs a tag, never a branch name. `release.mjs deploy-check <tag> [--prod]` is the gate.
- Test stages: any `vX.Y.Z-rc` (or final tag), any time. On Cubeship: `itodev` (see above).
- `prod`, on release day: the open line's **last** rc, deployed before the release PR merges
  (Actions → Release → `deploy`, stage `prod`, run from the release branch); the merge then tags
  it final. An older rc is refused.
- `prod`, rollback: a final `vX.Y.Z` whose code equals its `-rc`.
- Never deploy a branch name, or an rc that is not the line's last, to prod.

### Before acting
- Run `git fetch --all --tags` first; reason from remote state, not local.
- Confirm with Kai before anything outward-facing: push, opening/merging PRs,
  running workflows, deploying, changing repo settings.
- Never push directly to master, release/* or hotfix/*. Never force-push them.
- If something looks off (a release branch not based on the previous open release,
  a final tag whose code differs from its last rc, a manual tag), report it before continuing.

### If this repo doesn't have the automation yet
Set it up, adapted to the repo (same behavior, no repo-specific values in the script):
- `.github/scripts/release.mjs` with commands `rc`, `final`, `sync`, `cut-release`,
  `cut-hotfix`, and `--dry-run`. Every rc takes the next patch (`vX.Y.0-rc`,
  `vX.Y.1-rc`, …); the final is the last rc without `-rc`.
- `.github/workflows/release.yml`: on push to `release/v*`/`hotfix/v*` → `rc` + `sync`;
  on PR merged into master from those branches → `final`; `workflow_dispatch` → cut.
- CI job `checks` (install, lint, type-check) and job `conventions` (branch name, PR title,
  only version lines into master) on every PR.
- Rulesets: master (PR, 1 approval, `checks` + `conventions`, merge commit only, no force
  push/delete); release/hotfix (same, squash + merge allowed); `v*` tags (only GitHub
  Actions, app id 15368, and admins can create/update/delete).
- Deploy gate: test stages take release tags only; prod takes only `vX.Y.Z` whose
  tree equals its `vX.Y.Z-rc`.
- A `RELEASING.md` with these rules. Test the script with `--dry-run` on real tags before
  opening the PR, and don't apply settings without Kai's approval.
