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
| 0 | Foundation: Next.js app, BFF, device auth, config, heartbeat, PWA shell | A locked kiosk reaches the API |
| 1 | Back office and menus: catalogue, schedules, sold out, discounts | The menu switches by itself |
| 2 | Kiosk ordering: full flow, PT/EN, coupons, simulated payment, number on screen | A real order on the unit |
| 3 | Kitchen screen (SSE) and daily report | Order in the kitchen in 2 s |
| 4 | Payment terminal, receipt and kitchen printers, NFC-e | Real sale, valid NFC-e |
| 5 | Pilot at the bakery | Owner keeps it running |

Everything that is hardware beyond the screen (payment terminal, printers) is phase 4.
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
- Measure the bundle with the Next.js bundle analyzer and test on the real board in phase 0.

## Design

The prototype (12 screens) is the visual reference: `docs/prototype/README.md` has the colour
tokens, type scale and per-screen notes. It is drawn at 720x1280; the real screen is 1080x1920,
so multiply prototype sizes by 1.5. Kiosk UI copy is pt-BR first, with English as the second
language.

## Commands

```bash
# Mock Core API from the contract examples (front-end work before the Go API exists)
npx @stoplight/prism-cli mock contract/openapi.yaml -p 4010      # CORE_API_URL=http://localhost:4010

# Regenerate API types after any contract change
npx openapi-typescript contract/openapi.yaml -o apps/web/src/lib/core-api.d.ts

# Lint the contract
npx @redocly/cli lint contract/openapi.yaml
```

## Working agreements

- Do not change `contract/openapi.yaml` silently. Propose the change to Kai first; it needs the
  partner's approval.
- Never edit generated files.
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

Phase 0 stories are COM-5 to COM-13 (former GAB-n, same numbers). Start a branch from the issue's
suggested branch name, reference the issue id (e.g. `COM-9`) in commits, and move the issue as work
progresses. Issues with the `Core` label are the partner's Go work (e.g. COM-12): do not implement them.
