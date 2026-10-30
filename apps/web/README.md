# Comanda web

The Next.js app that serves the kiosk (`/kiosk`), the kitchen screen (`/kitchen`) and the back
office (`/admin`), plus the BFF that talks to the Go Core API. See `../../CLAUDE.md` and
`../../docs/plan.md`.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm run build
```

`/styleguide` (development only) shows the "Café e trigo" tokens and fonts at 1080x1920, to compare
with `docs/prototype/screens`.
