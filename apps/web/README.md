# Comanda web

The Next.js app that serves the kiosk (`/kiosk`), the kitchen screen (`/kitchen`) and the back
office (`/admin`), plus the BFF that talks to the Core API.

- **Running it locally:** `../../README.md` (requirements, `.env.local`, the mock, test logins,
  troubleshooting).
- **Rules and architecture:** `../../CLAUDE.md`.
- **The API contract:** `../../contract/README.md`.

```bash
npm install
cp .env.example .env.local   # then set DEVICE_COOKIE_SECRET
npm run mock                 # stateful mock Core API behind Prism on :4010
npm run dev                  # http://localhost:3000

npm run typecheck
npm run lint
npm test
npm run build

npm run gen:api              # regenerate src/lib/core-api.d.ts after a contract change
npm run lint:contract
```

## Core API client

`src/lib/core/client.ts` (`coreApi()`) is the only way to the Core API. It is server-only:
importing it from a Client Component fails the build. Every call gives up after 5 seconds; a
timeout is an unknown outcome, never a refusal, and writes that carry an `Idempotency-Key` are
retried with the same key (`src/lib/core/retry.ts`).

## Devices

Each kiosk and kitchen screen is paired once at `/setup` with the device id and secret from the
back office. The BFF keeps them encrypted in an HttpOnly cookie (`DEVICE_COOKIE_SECRET`) and
exchanges them for a short-lived token kept in server memory (`src/lib/device`). `/kiosk` and
`/kitchen` send an unpaired browser to `/setup`. The owner's token is kept the same way
(`src/lib/admin/session.ts`); when it expires the owner signs in again.

## Mock Core API

`mock/` is an in-memory Core API seeded with the prototype's bakery (devices, morning and afternoon
menus by schedule, the owner). Its routes are in `mock/v2`, one file per area. Prism runs in front
of it in proxy mode with `--errors`, so any request or response that breaks
`contract/openapi.yaml` fails loudly. Each story adds the operations it needs; an operation the
mock does not have answers `404 NOT_FOUND`.

`/dev/mock` (development only) switches the mock's scenario and decides waiting payments.
`/api/dev/core` (development only) signs in to the Core API as `DEV_DEVICE_ID` and returns the
device config and the active menu. `npm run mock:raw` is a stateless Prism mock from the
contract's examples.

With `MOCK_AUTO_DEVICES=1` on the mock (the deployed test environments), `/setup` accepts any
device id and secret: an unknown id registers itself, as a kitchen screen if it starts with
`KITCHEN` or `COZINHA`, otherwise as a kiosk.

## Deploy

Cubeship builds two apps from a release tag, never from a branch: `web`
(`deploy/cubeship/web.Dockerfile`) and `mock` (`deploy/cubeship/mock.Dockerfile`). The flow is in
`../../RELEASING.md`. When the Core API exists, `web` gets its address in `CORE_API_URL`, loses
`CORE_MEDIA_URL`, `CORE_STREAM_URL` and `MOCK_CONTROL_URL`, and the `mock` app goes away.
