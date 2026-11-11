# Comanda contract

`openapi.yaml` is the contract between the **Comanda BFF** (Next.js server routes, Kai) and the
**Comanda Core API** (Java, Bruno), for the dine-in pilot (`docs/pilot-v2/SPEC.md`). It is the
source of truth: the TypeScript types and the Java server interface are both generated from it, so
neither side can drift without the build noticing.

Version `2.0.0` · 64 operations · OpenAPI 3.0.3 · every path under `/v2`. Every data model follows
`docs/v2-research/MODELS.md` (the "v2" models of `lib-pos-integration`): same schema names without
the Java `I` prefix, same JSON field names and types.

There is one contract. The first contract (`/v1`, integer cents, Comanda's own shapes) was removed in
pilot phase 5 (COM-149); git history has it.

## The rules in one screen

| Rule | Detail |
|:--|:--|
| Money | JSON number in BRL, main currency unit, 2 decimals: `28.00` = R$ 28,00. Never cents. The Core API rounds discounts per line, half up, to the cent, then sums. No tax in the pilot (`tax: 0`, `taxes: []`). |
| Names | MODELS.md names and fields. `x-comanda: true` marks what Comanda adds (see "Reading the file"). |
| Time | Timestamps in UTC ISO 8601. Business dates `YYYY-MM-DD` and opening hours `HH:MM[:SS]` in the store's timezone. |
| IDs | Strings, never containing `::`. An entity is `type` + `id`. Back-office writes take the id in the path, pattern `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`. |
| Errors | `application/problem+json` with a stable `code` (see `ProblemCode`). Clients switch on `code`, never on `title`. |
| Retries | `POST /v2/payments` and `POST /v2/orders` require `Idempotency-Key` (UUID). Same key + same body returns the first result; same key + different body is `409 IDEMPOTENCY_KEY_REUSED`. |
| Caching | `GET /v2/devices/me/config` and `GET /v2/menus/active` return an `ETag`; `If-None-Match` gets `304`. |
| Language | Guest endpoints return text resolved to `language` (`pt-BR` or `en`). The back office edits `translations`; `LocalizedText` has `pt-BR` required, `en` optional. |
| Prices | The Core API prices everything (`POST /v2/totals`). The kiosk sends entity ids, never prices. |
| Order type | Dine-in only: every order is `DINEIN` (`ORDER_TYPE_UNAVAILABLE` otherwise). |
| Payment | Mercado Pago Pix and Point, called only by the Core API, anchored on `basketId`; the order is placed after approval. |
| Order id | `number` (the id) + `customerCheckNumber` (the short daily number on the success screen). |
| Availability | `available` on/off, kept until changed. No "sold out today". |
| Fiscal | No NFC-e and no CPF step in the pilot; the success screen shows the store's `invoiceNotice`. |
| Phases | `x-phase` on each operation = the pilot plan phase that moved the app onto it: 2 kiosk, 3 menu editor, 4 kitchen, store, devices, orders, report. |

## Endpoints by area

| Area | Operations | What |
|:--|:--|:--|
| Device | 4 | Auth, config (store, pace, terminal), heartbeat, status |
| Kiosk | 13 | Active menu, language pack, journeys, totals, coupons, Mercado Pago payments (create, read, cancel, simulate), orders |
| Kitchen | 7 | Open or collected orders, stream (SSE), status forward and one step back, "Acabou", close the day, pace |
| Back office | 40 | Login, store, media and images, devices, menus and schedules, sections, items and availability, modifier groups, swap sells, badges, discount rules, owner cancel, pace, daily report |

## Reading the file

- `x-comanda: true` on a property = a field Comanda adds inside a v2 model (SPEC D-2). On a schema =
  a schema that is Comanda's own (`PaymentSession`, `DeviceConfig`, `DiscountRule`, `Problem`, …).
  `Allergen` lists its one addition in `x-comanda-values` (`NATURAL_LATEX`).
- `PosEntity` is a `oneOf` with a `type` discriminator; each member pins its `type` values, so a
  validator and the generated TypeScript union both tell the shapes apart.
- The `getActiveMenu` example is the complete MODELS 5.20 menu without the `TAX` entity and links.

## Decisions (agreed with the partner, COM-145)

1. **Catalogue is shared, menus are roots.** Sections, items, groups, swap sells and images are one
   catalogue; a menu is `name` + `root` + schedules (`PosEntitySectionHours`). The guest menu is
   the graph reachable from the active menu's `root`.
2. **Back-office writes are `PUT …/{id}` upserts** with ids the BFF chooses (v2 ids are POS ids).
   Every catalogue save is validated as a whole: `422 MENU_INVALID` lists each broken link, empty
   group, empty swap sell, loop, bad id, incomplete combo or link MODELS 5.4 does not follow
   (`Problem.errors[].rule` + `.entity`).
3. **Product ids are unique across `ITEM`, `SIZED_ITEM`, `COMBO_MEAL`**, so `crossSellIds` and
   `/v2/admin/items/{itemId}` are unambiguous. Cross-sells are edited on the item.
4. **An option is linked from at most one group of the same parent**, so the Core API finds an order line's
   group from its parent (`OrderItem` has no group id).
5. **`OrderItem.itemPrice` is optional on requests**: the kiosk sends ids only; the Core API prices every line
   and ignores client prices and totals.
6. **Section hours are resolved by the Core API**: outside its `availableHours` a section is sent with
   `available: false`. `included` on groups is ignored in the pilot.
7. **Exactly one order per paid basket**: `POST /v2/orders` is idempotent on `basketId`, and the Core API must
   place the order from the Mercado Pago webhook when the kiosk never calls it.
8. **Availability**: one path for products, options and sizes
   (`PUT /v2/admin/items/{itemId}/availability`) and the kitchen's `PUT /v2/kitchen/availability`;
   both answer a `LightMenuResponse`.

## Front end (Kai)

```bash
# In apps/web
npm run mock          # the stateful mock on :4020 behind Prism on :4010, which validates every call
npm run mock:smoke    # with the mock running: every operation through Prism
npm run gen:api       # contract/openapi.yaml → src/lib/core-api.d.ts
npm run lint:contract
```

The BFF reaches the Core API at `CORE_API_URL` (`http://localhost:4010` with the mock), through the
server-only client in `apps/web/src/lib/core/client.ts` (`coreApi()`). The device and owner tokens
never reach the browser.

## Back end (Bruno, Java)

The Core API is written in Java (it was planned in Go; nothing in the contract depends on the
language). Generate the server interfaces and the models from `openapi.yaml` and implement them;
do not write them by hand, so a contract change breaks the build instead of drifting. Any generator
that reads OpenAPI 3.0.3 works. With OpenAPI Generator, for example, the `spring` generator in
interface-only mode gives the interfaces to implement, one method per `operationId`.

What the BFF sends and expects, where a Java stack usually needs a setting:

| Topic | What the contract needs |
|:--|:--|
| Money | `Money` is a JSON **number** with at most 2 decimals. Use `BigDecimal` in code (the schema says `double` only for the wire), round half up, and never write it as a string or in cents. |
| Absent values | Leave an optional field out when it has no value. `null` is valid only where the schema says `nullable: true`. A field that is both required and nullable (`DeviceConfig.nextOpeningAt`) must be there, as `null`. Lists the reader walks (`root`, `links`) are `[]`, never `null`. |
| Timestamps | ISO 8601 in UTC with `Z` (`2026-11-10T12:00:00Z`), never an epoch number. |
| Unknown fields | Ignore what the client sends and the schema does not need: the kiosk may send prices and totals, and they are ignored. |
| Errors | **Every** answer that is not 2xx or 304 is `application/problem+json` with `type`, `title`, `status` and `code`, including the ones a framework writes by itself: unknown route (`404 NOT_FOUND`), missing or expired token (`401 UNAUTHORIZED`), a body that breaks a field rule (`422 VALIDATION_FAILED`; the contract has no `400`). The BFF switches on `code`. |
| Tokens | Two bearer tokens: device (`POST /v2/devices/auth`) and owner (`POST /v2/admin/auth/login`), `expiresIn` in seconds. On a `401` the BFF signs the device in again and repeats the call once. The owner has no refresh: when the token expires the owner types the password again, so its lifetime is the length of a back-office session (the mock uses 8 h, and 15 min for devices). |
| Time limits | The BFF gives up on any call after **5 s** (30 s for pictures) and treats a timeout or a `5xx` as "outcome unknown". `POST /v2/payments` and `POST /v2/orders` are then repeated with the same `Idempotency-Key` for up to 15 s, so both must answer fast and return the first result for a repeated key. |
| Caching | `ETag` on `GET /v2/devices/me/config` and `GET /v2/menus/active`; a matching `If-None-Match` answers `304` with no body. |
| Kitchen stream | `text/event-stream`, each event flushed as it happens, a `: ping` comment every 15 s, no compression or buffering in between. The BFF opens it from the server with the device token in `Authorization`. |
| Pictures | `POST /v2/admin/media` is `multipart/form-data` (the back office sends at most 5 MB, images only). See "Open questions" for where pictures are read. |
| CORS | Not needed: only the Next.js server calls the Core API, never a browser. |
| First data | No operation creates the store or the owner, so the Core API starts with one store and one owner. Devices are created in the back office (`POST /v2/admin/devices`). |
| Mercado Pago | The webhook Mercado Pago calls is the Core API's own endpoint and is not in this contract. |

`GET /v2/orders/{number}` is in the contract but the app does not call it today.
`POST /v2/payments/{id}/simulate` is called only in tests, never by the app.

What the contract expects from the implementation:

- **Pricing**: `POST /v2/totals` and `POST /v2/orders` price every line from the catalogue; client
  prices and totals are ignored.
- **Order number**: `customerCheckNumber` is a sequence per store per business day (the day starts
  at `businessDayCutoff`).
- **Idempotency**: store key, hash of the body and the response for at least 24 h.
- **Menu by schedule**: evaluate menu schedules in the store's timezone. `close` before `open` runs
  past midnight; the closing minute is closed. A forced menu wins until `forcedUntil`.
- **ETag**: change it whenever the menu, its entities, availability or the language change.
- **Payments**: Mercado Pago Pix (QR + copy-paste) and Point (the kiosk's `paymentTerminalId`).
  `POST /v2/payments/{id}/simulate` must answer `404 SIMULATION_DISABLED` against a real account.
- **Kitchen stream**: Server-Sent Events with `order.paid`, `order.status_changed` and
  `store.pace_changed`, a ping every 15 s.
- **Kitchen order version**: `version` starts at 1 when paid and goes up by one on every status
  change, with a `history` entry. A move with `expectedVersion` that no longer matches is
  `409 STALE_ORDER_VERSION`. Backward moves (READY → PREPARING, COLLECTED → READY) only on the
  order's own business day.
- **Store pace**: one per store. PAUSED sets `atCapacityMode` on every kiosk until `pausedUntil`,
  then the Core API returns to NORMAL by itself and sends `store.pace_changed`. The wait time on the
  success screen is the owner's minutes for NORMAL or BUSY.

The mock in `apps/web/mock/v2` is a working example of every operation (TypeScript, in memory):
when the contract's words leave a doubt, it shows the behaviour the front end was built against.
`apps/web/mock/smoke.ts` calls all 64 operations in order.

## Checking the Core API against the contract

```bash
# Core API on :8080; Prism validates every request and response that passes through
npx @stoplight/prism-cli proxy contract/openapi.yaml http://localhost:8080 -p 4010 --errors
```

Then run the app with `CORE_API_URL=http://localhost:4010`, and `CORE_MEDIA_URL` and
`CORE_STREAM_URL` set to `http://localhost:8080` (Prism cannot pass pictures or a stream through).
Any field the Core API returns that the contract does not describe (or the other way round) comes
back as an error, so drift shows up during development, not on the kiosk. `README.md` at the root
has the rest of the local setup.

## Changing the contract

1. Edit `openapi.yaml` in a pull request. Both partners approve.
2. Bump `info.version`: patch for docs and examples, minor for additions, major for anything that
   breaks a client (rename, removal, new required field). Breaking changes are agreed first.
3. Run `npx @redocly/cli lint contract/openapi.yaml`.
4. Regenerate both sides in the same pull request. Never edit generated files by hand.

## Open questions

The pilot SPEC (section 9) settles order number reset (per business day, from
`businessDayCutoff`), offline (a "Temporariamente offline" screen, no selling from a cached menu)
and device pairing (id + secret typed at `/setup`). A price that changed during a journey is
settled by the contract: `409 BASKET_CHANGED`, and the guest confirms the new total. Still open:

- **Where pictures are read.** The contract has the upload and `PosEntityImage.url` ("absolute, or
  a path"), but no operation that serves the file. Today the app only works with a path like
  `/media/croissant.jpg`: the BFF reads it from the Core API at `GET /media/croissant.jpg`, without
  a token, and resizes it. An absolute address (a bucket, a CDN) needs a change in the app first.
  To decide, then write into `openapi.yaml`.
- Where the device secret lives on the Core API side (the BFF keeps it sealed in an HttpOnly
  cookie).
