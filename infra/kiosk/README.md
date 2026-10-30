# Kiosk board setup (COM-11)

Turns an ARM board (Orange Pi or Raspberry Pi) with Debian into the Comanda kiosk: it boots
straight into Chromium in kiosk mode, inside Cage, with no desktop. Nothing else of Comanda
runs on the board (thin client, see `docs/plan.md`).

> The scripts pass `bash -n` and ShellCheck but have **not run on a real board yet**. The first
> run on the Orange Pi is part of COM-11; fix what breaks there and update this file.

## 1. Install

1. Flash Debian (arm64) for the board, boot it, connect the network, enable SSH.
2. Copy this folder to the board and run, as root:

   ```bash
   KIOSK_URL=http://192.168.1.23:3000/kiosk INSECURE_ORIGIN=http://192.168.1.23:3000 DEBUG=1 ./setup-kiosk.sh
   ```

   - `KIOSK_URL`: the Next.js server as the board sees it. For the first test, the dev
     machine on the LAN; in production, `https://kiosk.<domain>/kiosk`.
   - `INSECURE_ORIGIN`: only while testing over plain HTTP on the LAN, so the service worker
     (offline screen, COM-10) can register. Leave it empty with HTTPS.
   - `ROTATE=90` (or 180/270) if the screen does not come up in portrait.
   - `DEBUG=1` opens Chromium remote debugging on port 9222 for the measurements below.
3. `systemctl reboot`. The board should land on `/setup` (first time) and then on the kiosk.
4. On `/setup`, type the device id and secret from the back office (USB keyboard).

Settings live in `/etc/default/comanda-kiosk`; edit and reboot to change them. SSH logins get a
normal shell; only the physical console (tty1) starts the kiosk.

## 2. Measure

Record the numbers in COM-11. They decide whether this board is good enough before buying more.

| What | How | Result |
|:--|:--|:--|
| JS shipped to the kiosk | `npm run build` in `apps/web`, then `npm run analyze` (route `/kiosk`, client) | Baseline 2026-10-30: ~181 KB gzip (584 KB raw) |
| Boot to attract screen | Stopwatch from power on to the photo on screen | |
| Attract → interactive | DevTools (below) → Performance → reload; time to `load` and first interaction | |
| Scrolling a menu with photos | DevTools → Rendering → FPS meter, scroll the menu screen (phase 2) or `/styleguide` | |
| Memory after 1 h on attract | DevTools → Memory, or `free -m` over SSH | |
| GPU acceleration | Open `chrome://gpu` from DevTools, check "Hardware accelerated" | |

**DevTools on the board** (with `DEBUG=1`): on the dev machine, open an SSH tunnel
`ssh -L 9222:localhost:9222 kiosk@<board-ip>`, then `chrome://inspect` → Configure →
`localhost:9222` → inspect the kiosk tab.

## 3. Done when

The board boots straight into the kiosk with no desktop visible, and the table above is filled in.
