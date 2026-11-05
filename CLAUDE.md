# CLAUDE.md — Comanda

Comanda is a self-service ordering kiosk ("totem") for a single bakery, the first real test.
Guests order on a vertical touch screen, pay, and pick up at the counter. There is also a
kitchen screen and a back office for the owner.

Two people build it:
- **Kai** (you work with him): the Next.js app — kiosk, kitchen and back-office screens, and the BFF.
- **Partner**: the Go Core API and the PostgreSQL database. Do not write Go unless Kai asks.

Talk to Kai in Brazilian Portuguese, casual and direct. Code, comments, commits and docs in English.

## Read first, in this order

1. `docs/plan.md` — MVP scope, architecture, phases, decisions, risks.
2. `contract/openapi.yaml` and `contract/README.md` — the API contract with the Go side.
3. `docs/data-model-and-api.md` — entities, business rules, open questions.
4. `docs/prototype/README.md` and `docs/prototype/screens/*.png` — the approved visual design.
5. `docs/specs/` — functional specs of the reference kiosk: how each screen behaves.
   IDs: `F-` features, `FR-` requirements, `BR-` business rules, `SCR-` screens,
   `ENT-` entities, `OP-` backend operations.

When sources disagree: **contract > plan > prototype > specs.** The specs describe a Windows +
Electron kiosk with a local service; the plan replaces that with a thin client (below) and cuts
scope. Use the specs for screen behaviour, rules and field names, not for architecture.

## Architecture

```
Kiosk (Orange Pi, Debian, Chromium --kiosk, 1080x1920 portrait)
   │ HTTPS
   ▼
Next.js app (server)  ── BFF: Route Handlers, Server Actions, Server Components
   │ REST/JSON /v1, generated client from contract/openapi.yaml
   ▼
Go Core API (partner) ── PostgreSQL        all in Docker on one server
```

- Nothing is installed on the kiosk except Chromium. No Electron, no local service.
- One Next.js app serves three areas behind three logins: `/kiosk` (device), `/kitchen` (device),
  `/admin` (owner).
- The BFF formats and combines. **Prices, discounts, menu availability and order numbers are
  decided only by the Go API.** Never compute them in the front end beyond display.
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
contract/openapi.yaml     source of truth for the API; change only by PR, both partners approve
contract/README.md        how both sides use the contract
docs/                     plan, data model, specs, prototype (read-only reference)
apps/web/                 the Next.js app (create it in phase 0)
  src/lib/core-api.d.ts   generated, never edit by hand
api/                      Go Core API (partner)
```

## Phases

| Phase | Goal | Done when |
|:--|:--|:--|
| 0 | Foundation: Next.js app, BFF, device auth, config, heartbeat, PWA shell, HTTPS deploy | The kiosk, in a regular browser over the server's HTTPS address, reaches the Go API |
| 1 | Back office and menus: catalogue, schedules, sold out, discounts | The menu switches by itself |
| 2 | Kiosk ordering: full flow, PT/EN, coupons, simulated payment, number on screen | A real order on the unit |
| 3 | Kitchen screen (SSE) and daily report | Order in the kitchen in 2 s |
| 4 | Kiosk board (Orange Pi, Chromium kiosk, measurements), payment terminal, receipt and kitchen printers, NFC-e | Real sale, valid NFC-e, on a locked kiosk |
| 5 | Pilot at the bakery | Owner keeps it running |

Everything that is hardware is phase 4, last: the kiosk board itself, the payment terminal and the
printers (Kai, 30 Oct 2026; this overrides `docs/plan.md`, which had the board in phase 0). Until
then the kiosk is developed and tested in a regular desktop browser at 1080x1920; the board setup
kit waits in `infra/kiosk/`.
Until then: simulated payment (`POST /v1/payments/{id}/simulate`) and the order number on screen only.

The `x-phase` field on each contract operation says which phase needs it.

## Contract rules (short version; full list in `contract/README.md`)

- Money is integer cents in BRL. Format for display with
  `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- The kiosk sends item and option ids, never prices.
- Errors are `application/problem+json`; switch on `code`, never on `title`.
- `POST /v1/orders`, `/payments` and `/place` need an `Idempotency-Key` (UUID per attempt).
- Config and menu return an `ETag`; send `If-None-Match`.
- Guest endpoints take `language` (`pt-BR` or `en`) and return resolved text.

## Kiosk performance rules (the ARM board is the weakest part)

- Load the menu once at journey start and keep it in memory (spec OP-START-04). Menu, item and
  cart are one client-side flow with no server round trip until the quote.
- Attract, closed and success screens are Server Components. Client code only for the basket,
  the item builder and the idle timer.
- Images through `next/image`, sized for 1080x1920; cached by the service worker.
- CSS transitions only. No blur or heavy shadows in animation.
- Keep the bundle in check with `npm run analyze` (baseline: ~181 KB gzip of JS on `/kiosk`); the
  real board is tested in phase 4, so do not let client code grow without a reason.

## Design

The prototype (12 screens) is the visual reference: `docs/prototype/README.md` has the colour
tokens, type scale and per-screen notes. It is drawn at 720x1280; the real screen is 1080x1920,
so multiply prototype sizes by 1.5. Kiosk UI copy is pt-BR first, with English as the second
language.

## Commands

```bash
# Stateful mock Core API (apps/web/mock) behind Prism, which validates every call against the
# contract. Front end and BFF are built against it until the Go API exists. In apps/web:
npm run mock        # CORE_API_URL=http://localhost:4010, MOCK_CONTROL_URL=http://localhost:4020/__mock
npm run mock:orders -- 3                # with the mock running: 3 paid kiosk orders now
npm run mock:orders -- 3 --days-ago 7   # ...on the same weekday last week (Início, Relatório)
# A browser is one device and opens only its area (a kiosk browser sent to /kitchen lands on
# /kiosk). In dev with the mock, "Totem" and "Cozinha" on / pair this browser as the mock's
# device of that kind first.
# Extend apps/web/mock with the operations each story needs; Prism flags any drift from the contract.

# Regenerate API types after any contract change
npx openapi-typescript contract/openapi.yaml -o apps/web/src/lib/core-api.d.ts

# Lint the contract
npx @redocly/cli lint contract/openapi.yaml
```

## Working agreements

- Do not change `contract/openapi.yaml` silently. Propose the change to Kai first; it needs the
  partner's approval.
- Never edit generated files.
- Back office forms (`apps/web/src/lib/admin/form.ts`): read prices with `cents()` / `optionalPrice()`,
  which refuse what is not a price and never guess. A form saved through two Core calls uses
  `saveBoth()`: the part that can be read back and undone goes first, and it is put back if the
  second call fails. The contract has no atomic save.
- Open questions in `docs/data-model-and-api.md` (price changed mid-order, `waitTime`, order
  number reset, offline, fiscal fields, device pairing and secret storage) are not decided.
  Do not guess an answer into the code; ask Kai, or isolate it behind one clearly named function.
- Out of scope for the MVP: loyalty, Scan-and-Go and staff age approval, split bill, guest walks
  away, accessibility mode, tips, other payment methods, digital receipts, multi-brand.
- Keep changes small and phase by phase. After each step, say what changed and how to check it.

## Task tracking

Work is tracked in Linear, Jira-style (Team → Squad → Epic → Story). Use the `linear-backlog`
skill (`.claude/skills/linear-backlog`) for any backlog change: types, squads, points, splitting.

| Item | Value |
|:--|:--|
| Team | Comanda (`COM`); the workspace also holds another product's team (`BOOK`) |
| Squads | Free plan, so labels in the `Squad` group: `Web` = `apps/web` (Kai), `Core` = `api/` (partner) |
| Epics | Linear projects `E0 · Fundação` … `E5 · Piloto`, one per phase; pass ids (`P-COM-12` = E0) |
| Types | `Type` group: `Story`, `Bug`, `Tech Debt`, `Spike`; Fibonacci points, split over 8 |
| Issue language | pt-BR |

Phase 0 stories are COM-5 to COM-13 (former GAB-n, same numbers). Name branches and commits per the
release flow below (`feat/COM-9-short-name`, `feat(COM-9): summary`), not Linear's suggested branch
name, and move the issue as work progresses. Issues with the `Core` label are the partner's Go work (e.g. COM-12): do not implement them.

Batch Linear updates to save tokens:
- At the start of a plan, move its story to In Progress (one call). Nothing else in Linear mid-work.
- While working, append each bug, tech debt or follow-up found to `docs/backlog-pending.md`: type,
  pt-BR title, 1–2 lines of context, related story id, and whether it was fixed in this plan.
- At the end of the plan, hand that file to one Haiku subagent (fresh, short brief, `effort: low`;
  Sonnet only if descriptions need real writing). It creates, closes and moves the issues per the
  `linear-backlog` skill and reports the ids in ≤5 lines. Check the result, then clear the file.

## Release flow — always follow this

Kai's standing rule (31 Oct 2026). You manage branches, PRs, tags and deploys for this repository.
Follow these rules exactly. If a request conflicts with them, stop and say which rule it breaks.

**How this repo applies it** (details and setup in `RELEASING.md`):
- The default/prod branch was renamed `main` → `master` on 31 Oct 2026 (Kai's decision).
- Automation comes from the release kit (`Kaina-Ribeiro/release-kit`, COM-70), the same in every
  repo: `.github/workflows/release.yml` + `.github/scripts/release.mjs`, CI jobs `checks` and
  `conventions` (`.github/workflows/pr-checks.yml`), rulesets in `.github/rulesets/*.json`. Never
  edit these files here: change the kit and reinstall with its `install.sh`. Rulesets and the
  `RELEASE_TOKEN` secret are applied only with Kai's yes.
- Applied rulesets differ from the kit's JSON on purpose (Kai, 4 Nov 2026): **no required
  approval** (Kai merges alone), and the `v*` tag ruleset lets only admins bypass, because GitHub
  refuses the Actions app as a bypass actor on a personal-account repo. So `RELEASE_TOKEN` must be
  an admin's token (Kai's; Pull requests + Contents read/write) or rc/final tags fail to push.
  The version-lines ruleset also has the admin role as bypass (`always`, 4 Nov 2026), so the
  workflow can delete a shipped `release/*` or `hotfix/*` branch. Never reapply `.github/rulesets/*.json` here as they are. Kai manages tokens himself: never ask
  for, read or handle a token value.
- Deploy is Cubeship (`deploy/cubeship`), not Jenkins. The apps `comanda/production/web` and
  `comanda/production/mock` build from a tag (`ref: v0.1.0` since 31 Oct 2026), never a branch.
  On release day prod takes the open line's last rc, with Kai's confirmation: Actions → Release →
  `deploy`, stage `prod` (needs `DEPLOY_PROD_APPS="comanda/production/mock comanda/production/web"`,
  `CUBESHIP_URL` and the `CUBESHIP_TOKEN` secret); then the merge into master tags it final.
  Without those variables, deploy by hand after `release.mjs deploy-check <rc> --prod` passes.
- Test stage is the Cubeship environment `itodev` (5 Nov 2026, COM-70): apps `comanda/itodev/mock`
  and `comanda/itodev/web`, same Dockerfiles as prod, at https://comanda-itodev.5-189-167-204.sslip.io.
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
  automation (`.github/workflows/release.yml` → `.github/scripts/release.mjs`).
  **Never create, move or delete a tag by hand.**

### Naming
- Branch: `<type>/<TICKET>-short-name`. Types: feat, fix, chore, refactor, perf, docs, test, ci, build, revert.
- PR title / commit: Conventional Commits → `type(TICKET): summary`, imperative, lowercase.
  Here the ticket is the Linear id: `feat/COM-9-heartbeat`, `feat(COM-9): send device heartbeat`.

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
