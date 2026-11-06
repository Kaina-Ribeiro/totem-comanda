# Consolidation brief

17 readers inventoried every line of the reference specs into
`C:\Users\gabri\AppData\Local\Temp\claude\04db63de2688a51b\981b5e83-8290-4722-be79-38fadc994231\scratchpad\inventory\`
(B1, D1–D13, K1, K2, KDS1 `.md`; ignore `B1-part*`, `B1-items*`, `B1-fixed`, `B1-head`, `B1-notes`).
Row format: `| Ref | Where | What | v2 model | Area | Scope | T | Comanda |`. Also read
`reading-brief.md` (same folder as this file) for the original rules and `reading-progress.md` for
each reader's key findings. You consolidate ONE area (given in your prompt) across ALL inventories.

## Decisions now final (Kai + partner, 5–6 Nov 2026) — they override the readers' Scope column

1. All data models follow `C:\Users\gabri\Desktop\totem\MODELS.md` (v2) to the letter. Money is a
   decimal in BRL (not cents). Ids are strings as in v2.
2. Comanda does not play the POS-integration role: `/internal/v2/*`, venue `config`, init/destroy,
   pos-health, raw-menu, pos-data, POS menu sync/import → OUT.
3. **Capabilities Comanda needs that v2 lacks are added as new fields directly on the v2 models**
   (e.g. `ITEM.visible`, `ITEM.unavailableUntil`, `ITEM.dailyLimit`, allergen trace values,
   promotion rules), not as a separate extension block. List each one you need.
4. Channels: **kiosk** (exists: guest orders and pays), **waiter mobile site** (new: waiter places
   orders for a table, onto an open check), **QR menu mobile site** (new: guest opens via QR code and
   only views the menu, cannot order), **kitchen** (exists), **back office** (exists, desktop + phone).
5. Tax by order type: DINEIN, PAY_AT_TABLE and table orders → `seatTax`; TAKE_OUT, PICKUP, DRIVE_THRU →
   `pickupTax`; DELIVERY, DELIVEROO → `deliveryTax`.
6. Service charge (e.g. 10%): the percentage is store config (new field); the Core computes it and
   sends the amount in `ServiceCharge.value`.
7. DELIVERY, PICKUP, DRIVE_THRU, DELIVEROO and scheduled orders (`dateToFire`, `pickupTime`): exist in
   the model only; no screen creates them now → tag `MODEL-ONLY`.
8. Back in scope from v2: `Customer` (name, phone, email) and cash as a tender (`tenderId`), tips
   (`tipAmount`), donations (`donationAmount`), service charges, codes and promotions (`Award` CODE,
   PROMOTION, ITEM). Still out: consent workflows and legal documents, demo mode, events/bookings,
   repeat order, guest conversion, SaaS billing.
9. Vendor-specific payment methods (gift card, room charge, stored value, food stamp, face-ID, crypto,
   app gateways) → OUT. v2 only records the tender.
10. Brief cuts (unchanged): one visual template / no multi-brand; one restaurant / no multi-store;
    no loyalty (points, stamps, loyalty providers/awards, external loyalty ids); no Scan-and-Go and
    no staff age approval; no split bill (one order paid with several payments); no guest walks away;
    no accessibility mode.
11. Hardware (payment terminal, printers, scanners, cash machines, board) → `HW-LATER` (phase 4).
    Work now: front end + BFF + mock only; partner builds Go later exactly per the models.
12. Waiter and QR app screens are drawn (as a proposal) in the canvas at
    `C:\Users\gabri\Documents\projects\comanda\docs\prototype\full\project\` (README's "Full canvas"
    section in `docs/prototype/README.md`). Glance at it for the waiter/QR/table areas only.

## Output

Write ONE file at the path in your prompt:

```
# <Area> — consolidated requirements

## Summary
3–6 bullets: counts by verdict, biggest gaps, what Comanda already has.

## Features
One row per DISTINCT feature (dedupe: the dashboard FR, checklist, catalogues, data models and domain
files repeat the same thing; merge them and keep all source refs).
| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
Verdict: IN · MODEL-ONLY · CUT (which brief cut) · OUT (decision n) · HW-LATER.
Group rows under ### headings by sub-area. Keep numbers, enums and copy text exact.

## New fields to add to the v2 models
| Entity.field | Type | Meaning | Why (feature #) |

## Open questions for Kai
Only what the decisions above do not settle. Each with 2–3 lettered options and a ⭐ pick.

## Spec contradictions and defects not to copy
```

Do not drop an IN item to save space. If a row's Area is wrong for its content, still include it in
the right area file you own, or skip it if another area owns it (areas: kiosk, waiter-table-qr,
kitchen, backoffice-menu, backoffice-store-ops, platform).

Reply in at most 5 lines: path, feature counts by verdict, number of new v2 fields, number of open
questions, the single biggest risk.
