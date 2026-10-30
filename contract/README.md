# Comanda contract

`openapi.yaml` is the contract between the **Comanda BFF** (Next.js server routes, Kai) and the
**Comanda Core API** (Go, partner). It is the source of truth: the TypeScript types and the Go server
interface are both generated from it, so neither side can drift without the build noticing.

Version `0.1.0` · 66 operations · OpenAPI 3.0.3

## The rules in one screen

| Rule | Detail |
|:--|:--|
| Money | Integer cents in BRL. `2800` = R$ 28,00. Never floats. |
| Names | camelCase, matching the functional specs where they define a field (`orderNonce`, `posCheckNumber`). |
| Time | Timestamps in UTC ISO 8601. Business dates `YYYY-MM-DD` and opening hours `HH:MM` in the restaurant's timezone. |
| IDs | Opaque strings. Never parse them. |
| Errors | `application/problem+json` with a stable `code` (see `ProblemCode`). Clients switch on `code`, never on `title`. |
| Retries | `POST /v1/orders`, `/payments` and `/place` require `Idempotency-Key` (UUID). Same key + same body returns the first result; same key + different body is `409 IDEMPOTENCY_KEY_REUSED`. |
| Caching | `GET /v1/devices/me/config` and `GET /v1/menus/active` return an `ETag`; `If-None-Match` gets `304`. |
| Language | Guest endpoints return text resolved to `language`. Back office uses `LocalizedText` (`pt-BR` required, `en` optional). |
| Prices | The Go API prices everything. The kiosk sends item and option ids, never prices. |
| Phases | `x-phase` on each operation says which MVP phase needs it. |

## Endpoints by phase

| Phase | Operations | What |
|:--|:--|:--|
| 0 | 4 | Device auth, config, heartbeat, status |
| 1 | 45 | Back office: restaurant, devices, media, menus and schedules, categories, items, sold out, option groups, tags, cross-sells, discounts |
| 2 | 13 | Kiosk: active menu, language pack, journeys, quotes, discount check, orders, simulated payments, place |
| 3 | 4 | Kitchen list, stream (SSE) and status; daily report |
| 4 | not yet | Real payment provider, provider webhooks, NFC-e. Added in a later version. |

## Front end (Kai)

```bash
# Mock server from the examples in the contract
npx @stoplight/prism-cli mock contract/openapi.yaml -p 4010
# point the BFF at it
CORE_API_URL=http://localhost:4010

# Types
npx openapi-typescript contract/openapi.yaml -o apps/web/src/lib/core-api.d.ts
```

```ts
import createClient from "openapi-fetch";
import type { paths } from "./core-api";

// Server-only module: Route Handlers, Server Actions, Server Components.
// The device and owner tokens never reach the browser.
export const core = createClient<paths>({ baseUrl: process.env.CORE_API_URL });
```

To see an error screen against the mock, send `Prefer: code=422` (or `409`, `404`) and Prism answers
with that response's example.

## Back end (partner)

```bash
go get -tool github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
```

The generator itself needs Go 1.25+ to build; the generated `net/http` server needs Go 1.24+.

```yaml
# api/internal/api/cfg.yaml
package: api
output: api.gen.go
generate:
  models: true
  std-http-server: true
  strict-server: true
```

```go
//go:generate go tool oapi-codegen -config cfg.yaml ../../../contract/openapi.yaml
```

Implement `StrictServerInterface` (one method per operation, typed request and response objects),
then mount it:

```go
mux := http.NewServeMux()
handler := api.HandlerFromMux(api.NewStrictHandler(impl, nil), mux)
```

Things the contract expects from the implementation:

- **Repricing**: `POST /v1/orders` recomputes every line from the menu. Quote totals are display only.
- **Order number**: `posCheckNumber` is a sequence per restaurant per business day, assigned in `place`.
- **Idempotency**: store key, hash of the body and the response for at least 24 h.
- **Menu by schedule**: evaluate `menu_schedule` in the restaurant's timezone. `timeStart` later than
  `timeEnd` runs past midnight. A forced menu wins until `forcedUntil`.
- **ETag**: change it whenever the menu, its items, sold-out flags or the language change.
- **Simulated payments**: until phase 4 the gateway is `SIMULATED`; `/payments/{id}/simulate` sets the
  outcome and must answer `404 SIMULATION_DISABLED` once a real gateway is configured.
- **Kitchen stream**: Server-Sent Events with `order.paid` and `order.status_changed`, a ping every 15 s.

## Checking the Go API against the contract

```bash
# Go API on :8080; Prism validates every request and response that passes through
npx @stoplight/prism-cli proxy contract/openapi.yaml http://localhost:8080 -p 4011 --errors
CORE_API_URL=http://localhost:4011
```

Any field the Go API returns that the contract does not describe (or the other way round) comes back
as an error, so drift shows up during development, not on the kiosk.

## Changing the contract

1. Edit `openapi.yaml` in a pull request. Both partners approve.
2. Bump `info.version`: patch for docs and examples, minor for additions, major for anything that
   breaks a client (rename, removal, new required field). Breaking changes are agreed first.
3. Run `npx @redocly/cli lint contract/openapi.yaml`.
4. Regenerate both sides in the same pull request. Never edit generated files by hand.

## Open questions that will change the contract

From the plan's open questions; each one is marked in the operation it affects.

- Price changed during a journey: keep the quoted price or reject and re-quote (`POST /v1/orders`).
- How `waitTime` is computed (`PlacedOrder`).
- Order number reset and `posCheckNumberDisplayLength`.
- Offline behaviour of the kiosk.
- Fiscal fields per item (`FiscalFields`, phase 4).
- Device pairing and where the device secret lives.

## Verified on 30 Oct 2026

- `@redocly/cli lint`: valid (3 warnings: no license URL, localhost servers on purpose).
- `oapi-codegen` v2.8.1: generated server compiles.
- `openapi-typescript` 7.13 + `openapi-fetch`: generated types type-check in strict mode.
- `@stoplight/prism-cli` 5.14.2: mock serves the bakery examples (menu, R$ 82,80 basket, order 42).
