# Changelog

All notable changes to Comanda. Issue ids (`COM-n`) are in Linear; versions follow the app in
`apps/web/package.json`.

## [0.1.0] - 2026-10-30

First version: the front end and the BFF run end to end against a stateful mock of the Go Core
API, ready to point `CORE_API_URL` at the real one. Simulated payment; no hardware yet (phase 4).

### Foundation (E0)

- Next.js 16 app in `apps/web` with the "Café e trigo" tokens, Fraunces and Manrope (COM-5).
- Generated Core API client from `contract/openapi.yaml`, server-only (COM-6).
- Device sign-in at `/setup`: id and secret sealed in an HttpOnly cookie, short-lived token kept in
  server memory (COM-7).
- Device config with ETag and the gate screens: closed, maintenance, at capacity, disabled (COM-8).
- Heartbeat every 60 s and status reports on each state change (COM-9).
- PWA with Serwist and a "temporarily offline" screen (COM-10).
- Kiosk board setup kit in `infra/kiosk/`, untested on a board until phase 4 (COM-11).
- Stateful mock Core API behind Prism, which checks every call against the contract, with
  scenarios at `/dev/mock` (COM-23).
- Docker images and deploy on Cubeship over HTTPS (COM-22).

### Kiosk ordering (E2)

- Attract screen, PT/EN language switch and order type (COM-33).
- Menu by category, loaded once per journey (COM-34).
- Item builder: required choices, extras, nested groups, quantity (COM-35).
- Basket with edit, quantity, remove and Core API quotes (COM-36).
- CPF or CNPJ on the receipt (COM-37).
- Coupon and store discount codes (COM-38).
- Simulated payment by Pix, credit or debit, with decline and retry (COM-39).
- Order number from the Core API on the success screen, back to start in 15 s (COM-40).
- "Ainda está aí?" idle warning and reset, 30 s by default (COM-41).
- Cross-sell suggestion after adding an item (COM-42).
- The kiosk renders on a 1080x1920 stage scaled to fit any window, so it can be tested on any
  monitor.

### Back office (E1)

- Owner sign-in (COM-24), store settings (COM-25) and devices with secret rotation (COM-26).
- Menus that switch by themselves on schedule (COM-27).
- Categories and items (COM-28), options and extras (COM-29).
- Sold out with one tap, back the next day (COM-30).
- Badges and cross-sell suggestions (COM-31).
- Coupons and store discounts (COM-32).

### Kitchen and report (E3)

- Kitchen screen with paid orders in real time over SSE, polling when the stream drops (COM-43).
- Daily report: orders, revenue, eat in vs take away, best sellers (COM-44).

### Fixed

- A paid order that fails to place now shows "Chame um atendente" instead of offering to pay
  again or cancel (COM-56).
- The payment screen cancels after 2 minutes without an answer from the terminal (COM-57).
- The cancel button comes back when cancelling a payment fails (COM-58).
- A double tap on a payment method no longer starts two payments (COM-59).
- A kiosk can no longer open the kitchen, nor a kitchen screen the kiosk (COM-60).
- Menu category rail width matches the prototype; long names no longer overflow.
- The language button shows the current language.

### Known issues

- Open questions with the partner block parts of the contract: COM-13, COM-45, COM-46, COM-50,
  COM-53, COM-61.
- Minor bugs and tech debt in the backlog: COM-20, COM-21, COM-48, COM-49, COM-52, COM-54,
  COM-55, COM-62 to COM-68.

[0.1.0]: https://github.com/Kaina-Ribeiro/totem-comanda/releases/tag/v0.1.0
