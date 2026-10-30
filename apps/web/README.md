# Comanda web

The Next.js app that serves the kiosk (`/kiosk`), the kitchen screen (`/kitchen`) and the back
office (`/admin`), plus the BFF that talks to the Go Core API. See `../../CLAUDE.md` and
`../../docs/plan.md`.

```bash
npm install
cp .env.example .env.local
npm run mock       # Prism mock of the Core API on :4010, from contract/openapi.yaml
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm run build

npm run gen:api        # regenerate src/lib/core-api.d.ts after a contract change
npm run lint:contract
```

The Core API client (`src/lib/core/client.ts`) is server-only: importing it from a Client Component
fails the build. `/api/dev/core` (development only) authenticates against the mock and returns the
device config and the active menu.

`/styleguide` (development only) shows the "Café e trigo" tokens and fonts at 1080x1920, to compare
with `docs/prototype/screens`.
