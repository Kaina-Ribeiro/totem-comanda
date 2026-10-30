# Comanda web

The Next.js app that serves the kiosk (`/kiosk`), the kitchen screen (`/kitchen`) and the back
office (`/admin`), plus the BFF that talks to the Go Core API. See `../../CLAUDE.md` and
`../../docs/plan.md`.

```bash
npm install
cp .env.example .env.local
npm run mock       # stateful mock Core API (mock/) behind Prism on :4010, validated against the contract
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm test
npm run build

npm run gen:api        # regenerate src/lib/core-api.d.ts after a contract change
npm run lint:contract
```

The Core API client (`src/lib/core/client.ts`) is server-only: importing it from a Client Component
fails the build.

## Devices

Each kiosk and kitchen screen is provisioned once at `/setup` with the device id and secret from
the back office (with the mock: `KIOSK-TBT-001` and any secret). The BFF keeps them encrypted in
an HttpOnly cookie (`DEVICE_COOKIE_SECRET`) and exchanges them for a short-lived token kept in
server memory (`src/lib/device`). `/kiosk` and `/kitchen` send unprovisioned browsers to `/setup`.

## Mock Core API

`mock/` is an in-memory Core API seeded with the prototype's bakery (devices, morning and afternoon
menus by schedule). Prism runs in front of it in proxy mode with `--errors`, so any request or response
that breaks `contract/openapi.yaml` fails loudly. Each story adds the operations it needs to
`mock/server.ts`; unmocked ones answer `404 NOT_FOUND`.

Seeded devices: `KIOSK-TBT-001` / `s3cr3t-from-provisioning` and `KITCHEN-TBT-001` / `kitchen-s3cr3t`.
`/dev/mock` (development only) switches the mock's scenario (open morning or afternoon, closed,
maintenance, at capacity, device disabled, secret rotated) and can simulate the Core API being down.
`npm run mock:raw` is the old stateless Prism mock from the contract examples.

`/api/dev/core` (development only) authenticates against the mock and returns the
device config and the active menu.

## Deploy (Cubeship)

Project `comanda` on Cubeship builds two apps from `main` of this repo: `web`
(`deploy/cubeship/web.Dockerfile`, port 3000, HTTPS) and `mock` (`deploy/cubeship/mock.Dockerfile`,
internal only). `web` reaches the mock at `http://cubeship-comanda-production-mock:4010` (Prism) and
`:4020` (media, kitchen stream). When the Go API exists, point `CORE_API_URL` at it and delete `mock`.

Production is the test environment for now. With `MOCK_AUTO_DEVICES=1` on `mock`, `/setup` accepts any
device id (letters, digits, `-`, `_`) and any secret: an unknown id registers itself on the first
"Conectar aparelho", as a kitchen screen if it starts with `KITCHEN` or `COZINHA`, otherwise as a kiosk.
Use a separate browser (or private window) per device, since each browser holds one device. The
mock keeps everything in memory, so a restart or deploy clears orders and edits; devices register
again on their next sign-in. Remove the flag before the pilot. `SIMULATED_PAYMENT_OUTCOME` on `web`
(`AUTHORISED` by default, `FAILED`, `MANUAL`) sets the simulated card terminal's answer.

`/styleguide` (development only) shows the "Café e trigo" tokens and fonts at 1080x1920, to compare
with `docs/prototype/screens`.
