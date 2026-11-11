# Comanda

Self-service ordering kiosk ("totem") for a bakery. Guests order on a vertical touch screen, pay
with Pix or card, and pick up at the counter. The same app has a kitchen screen and a back office
for the owner.

```
Kiosk / kitchen / owner browser
   │ HTTPS
   ▼
Next.js app (apps/web)   kiosk, kitchen, back office and the BFF
   │ REST/JSON /v2       contract/openapi.yaml
   ▼
Core API (Java)  ──  PostgreSQL
```

The Core API is not built yet. Until it is, the app runs against a **stateful mock** of it that
lives in this repository, so you can run everything on one machine with Node.js and nothing else:
no database, no Docker.

| Folder | What |
|:--|:--|
| `apps/web/` | The Next.js app: `/kiosk`, `/kitchen`, `/admin` and the BFF |
| `apps/web/mock/` | The mock Core API |
| `contract/` | `openapi.yaml`, the API contract, and how each side uses it |
| `docs/` | Pilot spec, plans, data model, prototype, reference specs |
| `deploy/cubeship/` | Dockerfiles of the deployed apps |
| `infra/kiosk/` | Setup kit for the kiosk board |

## Requirements

- **Node.js 24** and npm. The mock runs its TypeScript files directly with `node`, so an older
  Node will not start it.
- Ports **3000** (app), **4010** and **4020** (mock) free.

## Run it

Every command runs in `apps/web`.

1. Install the dependencies.

   ```bash
   cd apps/web
   npm install
   ```

2. Create your environment file.

   ```bash
   cp .env.example .env.local
   ```

3. Generate the cookie key and paste it into `.env.local` as `DEVICE_COOKIE_SECRET`. The other
   values in the file already point at the local mock.

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

4. Start the mock Core API in one terminal and leave it running.

   ```bash
   npm run mock
   ```

5. Start the app in a second terminal.

   ```bash
   npm run dev
   ```

6. Open <http://localhost:3000>.

## Open each area

The home page lists the three areas. A browser is **one device**: a browser paired as the kiosk
cannot open the kitchen, and the other way round. Use a second browser or a private window to have
both open at once.

| Area | How to open it | Sign-in |
|:--|:--|:--|
| Kiosk | **Totem** on the home page | None. In development the button pairs this browser as the mock's kiosk |
| Kitchen | **Cozinha** on the home page | None. Pairs this browser as the mock's kitchen screen |
| Back office | **Back office**, or `/admin` | `dono@padaria.test` / `padaria-teste` (mock seed, `apps/web/mock/state.ts`) |

The kiosk is designed for a 1080x1920 portrait screen. In a desktop browser, open the developer
tools, switch to the responsive mode and set that size.

To pair a browser by hand, as a real device does, open `/setup` and type a device id and its
secret: `KIOSK-TBT-001` / `s3cr3t-from-provisioning` or `KITCHEN-TBT-001` / `kitchen-s3cr3t`.

## Useful while developing

```bash
npm run mock:orders -- 3                # 3 paid kiosk orders now (kitchen board, daily report)
npm run mock:orders -- 3 --days-ago 7   # ...on the same weekday last week (home, report)
npm run mock:smoke                      # calls every operation through the contract validator
```

All three need the mock running.

- **`/dev/mock`** (development only) switches the mock's scenario: open with the morning or the
  afternoon menu, closed, maintenance, at capacity, device disabled, secret rotated, Core API down.
  It also decides a payment that is waiting.
- **Payments** are simulated. A Pix or card payment is approved by itself after 3 seconds. Start
  the mock with `MOCK_PAYMENT_OUTCOME=DECLINED`, `EXPIRED` or `NONE` to see the other screens; with
  `NONE` the payment waits until you decide it on `/dev/mock`.
- **The mock keeps everything in memory.** Restarting it brings back the seeded bakery and clears
  orders and edits.
- **Prism** sits in front of the mock on port 4010 and checks every request and response against
  `contract/openapi.yaml`. A call that breaks the contract fails loudly instead of passing by.
- `/styleguide` (development only) shows the colour tokens and fonts at kiosk size.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

After any change to `contract/openapi.yaml`:

```bash
npm run lint:contract   # lint the contract
npm run gen:api         # regenerate src/lib/core-api.d.ts (never edit it by hand)
```

## Environment variables

Set in `apps/web/.env.local`. `.env.example` has every one with a comment.

| Variable | With the mock | What it is |
|:--|:--|:--|
| `CORE_API_URL` | `http://localhost:4010` | Core API base URL, without `/v2`. Required |
| `DEVICE_COOKIE_SECRET` | 32 random bytes, base64 | Key that encrypts the device and owner cookies. Required |
| `CORE_MEDIA_URL` | `http://localhost:4020` | Where menu pictures are read and uploaded. Defaults to `CORE_API_URL` |
| `CORE_STREAM_URL` | `http://localhost:4020` | Where the kitchen event stream is opened. Defaults to `CORE_API_URL` |
| `MOCK_CONTROL_URL` | `http://localhost:4020/__mock` | Control endpoint of the mock, for `/dev/mock` and the pairing buttons. Development only |
| `DEV_DEVICE_ID`, `DEV_DEVICE_SECRET` | `KIOSK-TBT-001`, empty | Device used by `/api/dev/core`, a development smoke test. Optional |

`CORE_MEDIA_URL` and `CORE_STREAM_URL` exist only because Prism cannot pass pictures or a stream
through. With the mock they point past Prism, at the mock's own port.

The mock reads its own variables when it starts: `MOCK_PORT` (4020), `PRISM_PORT` (4010),
`MOCK_PAYMENT_OUTCOME` (`APPROVED`), `MOCK_PAYMENT_DELAY_MS` (3000).

## Run against the real Core API

When a Core API is running (say on port 8080), no code changes. In `.env.local`:

1. Set `CORE_API_URL=http://localhost:8080`.
2. Remove `CORE_MEDIA_URL`, `CORE_STREAM_URL` and `MOCK_CONTROL_URL`.
3. Restart `npm run dev`.

Without the mock there are no pairing buttons: sign in to `/admin` with an owner that exists in the
Core API, create the devices there, and pair each browser at `/setup`.

To have every call checked against the contract while the Core API is being built, put Prism
between the two and point `CORE_API_URL` at Prism instead (port 4010 below):

```bash
npx @stoplight/prism-cli proxy contract/openapi.yaml http://localhost:8080 -p 4010 --errors
```

Keep `CORE_MEDIA_URL` and `CORE_STREAM_URL` pointing at the Core API itself in that case.
`contract/README.md` lists what the Core API has to do behind each operation.

## Troubleshooting

| What you see | Why | Fix |
|:--|:--|:--|
| `CORE_API_URL is not set` or `DEVICE_COOKIE_SECRET is not set` | No `.env.local`, or the key is empty | Steps 2 and 3 of "Run it", then restart `npm run dev` |
| The kiosk or the kitchen shows "temporariamente offline", or the home page has plain links instead of buttons | The mock is not running | `npm run mock` |
| `/kiosk` or `/kitchen` sends you to `/setup` | This browser is not paired | Use the button on the home page, or pair at `/setup` |
| **Cozinha** opens the kiosk | This browser is paired as the kiosk and the mock is not reachable to switch it | Start the mock, then use the button again |
| `EADDRINUSE` on 4010 or 4020 | Another mock is running (another worktree, for example) | Stop it, or start this one with `MOCK_PORT` and `PRISM_PORT` set and update the three URLs in `.env.local` |
| Orders and menu edits are gone | The mock restarted | Expected: it keeps everything in memory |

## More

- `CLAUDE.md`: architecture, rules and working agreements.
- `docs/pilot-v2/SPEC.md`: what the pilot is.
- `contract/README.md`: the contract's rules and the Core API's side.
- `RELEASING.md`: branches, tags and deploys.
