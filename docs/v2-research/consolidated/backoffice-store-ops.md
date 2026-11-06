# Back office, store and operations — consolidated requirements

## Summary

- **116 feature rows** (98 in the Features table, 18 in the Coverage pass at the end). By first verdict word, the Features table has IN 44 · MODEL-ONLY 7 · CUT 15 · OUT 26 · HW-LATER 1 · OPEN 5. The Coverage pass adds IN 9 · OUT 6 · CUT 2 · not this area 1. Rows marked "IN for X; CUT for Y" count as IN.
- **New v2 fields:** 20 rows, about 75 individual fields. **Open questions:** 12.
- **Biggest gaps in v2:** store address and coordinates, dine-in and take-out hour flags, special dates, order capacity per service, kiosk settings, refunds, and store tenders (cash). None of these exist in MODELS.md yet.
- **Already in Comanda (per the inventories):** the owner's home screen (partial), the order list (planned as G-A2), the store details form (partial), the kiosk dine-in/take-out switches (partial), and the live/offline flag (partial).
- **Scope decisions applied:** delivery, collection (PICKUP), delivery zones and scheduled pre-orders are MODEL-ONLY (brief decision 7, partner answer 4B). Service charges are IN with a store-config percentage (decision 6). Customer name, phone and email are IN (decision 8). Tips, donations and cash are IN (decision 8). Vendor payments, SaaS billing, legal documents, consent flows, e-mail and external providers are OUT.
- **Biggest risk:** the owner's hours and capacity settings are the largest block (about 80 fields). They cover services that Comanda does not sell (collection, delivery). If they are built as specified, the back office grows without a matching kiosk flow. Build only dine-in and take-out now, and keep the rest as MODEL-ONLY.

Sources: `D1`–`D8`, `D11`, `D12`, `D13` inventories (back-office rows), `B1` and `KDS1` for cross-checks. Decisions are from the consolidation brief (5–6 Nov 2026).

## Features

### Store details and status

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 1 | Store details editor | Required: name (max 100), phone (max 100), contact email (max 128), address line 1 (max 255), town/city (max 100), postcode (max 45), latitude, longitude. Optional: address lines 2 and 3 (max 255), description (max 255), cuisine tags. Blank optional fields save as null. Explicit Save and Discard. Country is not edited. Address change geocodes after a 500 ms pause. Details and phone settings save as two requests, not atomically: one success message after both, otherwise a generic failure. Use `saveBoth()` (CLAUDE.md). | `StoreConfigurationResponse.locationName`, `email`, `phone` exist; NEW: address fields, latitude, longitude, description, cuisineTags (see new fields) | PART | IN | D11 FEAT-015, CFG-034..045; D8 ENT-012, BR-006..007, ERR-007; D5 FEAT-015; D4 FEAT-015 |
| 2 | Store live or offline | Live and offline are selectable. Switching to live asks for confirmation. Choosing the same mode does nothing. Live without a usable payment type shows the payment-eligibility error and stays offline. Other failures show a retry error. | `StoreConfigurationResponse.liveFlag` (1/0) | PART | IN | D11 CFG-059, store states; D8 BR-008, ERR-008, ENT-016; D5 FEAT-018 |
| 3 | Demo mode | Third operational mode (live, demo, offline). Demo ordering. | none | NO | OUT (decision 8: demo mode out) | D11 CFG-059; D13 Notes; D8 ENT-016 |
| 4 | Locked internal states (on hold, cancelled) | Shown as disabled modes. Not settable or undoable by the owner. | none | NO | OUT (no internal states in MVP) | D11 store states; D8 BR-008 |
| 5 | Store-wide kiosk warning | Shown on the kiosk when the store is offline, closed or not accepting orders. Title required (max 50). Body required (max 140). Optional popup. Condition enum: offline / closed / not accepting orders. Publish goes to the single store. | NEW: `StoreConfigurationResponse.warnings[]` (condition, title, body, showPopup); `liveFlag` covers "offline" only | PART | IN | D12 CFG-713..716, FEAT-082; D13 Notes |
| 6 | Preparation times | Three store lead times in minutes (unit not stated): normal (required, non-negative integer), busy, peak. "Peak" is a separate state from "Pausado" in plan-next. Normal time is the default. | NEW: `StoreConfigurationResponse.preparationTime` {normal, busy, peak} | NO | IN | D11 CFG-056..058, FEAT-017; D5 FEAT-017; D2 FR-804 |
| 7 | Store special-instruction settings | Store defaults for item notes. Enabled: default off. Item-note visibility: default on (off for all items, or on for all). Customer note required: default off. Max characters: default 60 (positive integer). Title: default empty, max 130. Default customer text is bounded by the max. Dependent fields are disabled when off. Disabling does not delete history. Store defaults are separate from item overrides. | `OrderItem.specialNotes` (item level); NEW: `StoreConfigurationResponse.specialInstructions` {enabled, itemNotesVisible, customerNoteRequired, maxLength, title, defaultText} | NO | IN | D11 FEAT-016 (store form), CFG-046..051; D4 FEAT-016 |
| 8 | Review widget (external review provider) | Provider B. Enabled default off. Place ID required when enabled. Place IDs of 20 characters or fewer fail local validation. Longer IDs are checked by the provider after a 600 ms pause. Show rating and show count: default on. Configuration only. | none | ? | OUT (third-party provider; no v2 model; see Open question 7) | D11 FEAT-016 (review), CFG-052..055; D8 BR-010 |
| 9 | Marketplace provider store status (Open or Closed per delivery marketplace) | One row per configured delivery provider. Fetch returns Open or Closed; failure shows Unknown with reload retry. A change sends provider type and selected status, with feedback. | `OrderType.DELIVEROO` (channel only) | NO | MODEL-ONLY (DELIVEROO is model-only; brief decision 7) | D11 FEAT-019, CFG-060; D5 FEAT-019; D8 ERR-009 |
| 10 | Store list and bulk status changes | Organisation store list. Bulk live/offline changes with partial-failure handling. | none | NO | CUT (brief rule 10: one restaurant) | D4 FEAT-018; D5 SCR-033; D11 store states |
| 11 | Store group administration | Groups of stores with name (max 100), coordinates, image (max 2 MB), applications and member stores. Group membership alone does not inherit settings. | none | NO | CUT (brief rule 10: multi-store, store groups) | D13 FEAT-014, CFG-027..033; D4 FEAT-014; D8 ENT-010/011 |
| 12 | Organisation service selection (which stores take collection, delivery, seat) | Enabled stores and groups per service. Event stores excluded. Groups left empty are removed. Save publishes; failure resets to the prior saved state. | none | NO | CUT (brief rule 10: multi-store) | D11 FEAT-023, CFG-093..095; D8 BR-012..013, ENT-020 |

### Online services (collection, delivery, seat)

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 13 | Collection service (pickup) settings | Enable (CFG-064), display name (CFG-075, max 50), minimum order (CFG-072), reject-after (CFG-078, unit not stated). Comanda sells take-out as TAKE_OUT; "collection" is PICKUP. | `OrderType.PICKUP` availability | NO | MODEL-ONLY (PICKUP exists in model only; brief decision 7) | D11 FEAT-021, CFG-064, CFG-072, CFG-075, CFG-078; D7 FEAT-021 |
| 14 | Delivery service settings | Enable (CFG-066), area description (CFG-065, max 500), contact phone (CFG-071, max 45), delivery charge (CFG-067, money or percentage, max 99999999.99), delivery discount (CFG-068, percentage stored as fraction), delivery time (CFG-069, unit not stated), free delivery above (CFG-070), minimum order (CFG-073, max 99999999.99), display name (CFG-076, max 50), tax group (CFG-083). | `OrderType.DELIVERY`; `StoreConfigurationResponse.deliveryCharge` (number, no percentage type) | NO | MODEL-ONLY (DELIVERY exists in model only; brief decision 7) | D11 FEAT-021, CFG-065..073, CFG-076, CFG-083; D8 ENT-018 |
| 15 | Delivery zones | Zone name (CFG-089, required, max 100), delivery fee (CFG-084, required), lead time (CFG-085, required integer), radius 0.5 to 10 (CFG-086) or custom map (CFG-092), tax group (CFG-090), external ID (CFG-087, max 45), minimum basket (CFG-088), free-delivery threshold (CFG-091). Geographic matching and overlap precedence are Unknown. | none needed now (no zone entity until delivery is built) | NO | MODEL-ONLY (brief decision 7) | D11 FEAT-022, CFG-084..092; D8 ENT-019, BR-009; D4 FEAT-022 |
| 16 | Delivery service container | Navigation container for the delivery settings above. | none | NO | MODEL-ONLY (follows row 14) | D4 FEAT-020; D5 FEAT-020 |
| 17 | Seat (order to table) service settings | Enable (CFG-081), display name (CFG-077, max 50), minimum seat order (CFG-074), seat delivery time (CFG-082, required integer), auto-accept (CFG-063) and reject-after (CFG-080, unit not stated). Owner: waiter area. | Item `seatFlag` (5.19); `Hours.seat` (9.10) | NO | IN (owner: waiter-table-qr) | D11 FEAT-021, CFG-074, CFG-077, CFG-080..082; D13 Notes |
| 18 | Automatic acceptance and reject timeout | Auto-accept or manual accept per service (CFG-061..063). Reject timeout shown only when the automatic-reject-timeout capability is on and auto-accept is off. | none | NO | OUT (no order-acceptance step in MVP; kitchen "accept" is in the kitchen area) | D11 FEAT-021, CFG-061..063, CFG-078..080; D8 BR-011, DEP-061 |
| 19 | Online service save model | Valid changes auto-save after a 1-second debounce (FEAT-021). Other screens use explicit Save and Discard (FEAT-015). | none | NO | IN (Comanda uses explicit save, see defects) | D11 FEAT-021; D5 FEAT-021; D7 FORM-018 |

### Opening hours and special dates

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 20 | Base store hours | Period row = weekdays + open + close (+ optional capacity profile). Defaults: open 00:00, close 23:59, weekdays none selected. A closed or unselected period disables its time inputs. Save needs a non-empty first base opening period. Server validation runs first; any returned row missing open or close rejects the save. Failure: "unable to save". Reset restores the loaded hours. | `Hours` (9.10): `day` (1 Sunday to 7 Saturday), `open`, `close`, `opening` (format `HH:mm:ss.SSS` in v2; spec uses `HH:mm`) | NO | IN | D11 FEAT-024..026, CFG-096..099; D8 BR-014, ERR-010 |
| 21 | Dine-in and take-out hours (per service) | Each service is "same as base" or custom. Custom starts with one empty row; switching back to same-as-base removes custom rows. Dine-in: CFG-110..114. Take-out: CFG-115..119. Dine-in is not stated as table-based. | NEW: `Hours.dineIn` (1/0), `Hours.takeOut` (1/0). v2 has pickup, delivery, seat only. | NO | IN (open question 2) | D11 CFG-110..119; D8 BR-015; D13 Notes |
| 22 | Seat/table hours | Same-as-base or custom. Hours, weekdays, capacity profile for seat orders. Owner: waiter area. | `Hours.seat` = 1 (9.10); item `seatFlag` | NO | IN (owner: waiter-table-qr) | D11 CFG-120..124 |
| 23 | Collection and delivery hours | Same structure as row 21, with pickup and delivery flags. | `Hours.pickup` (1/0), `Hours.delivery` (1/0) | NO | MODEL-ONLY (brief decision 7) | D11 CFG-100..109; D1 FR-105..109 |
| 24 | Operational hours (used by media schedules) | Selected "operating period" with open, close and capacity profile. The spec does not define what "operational" means. Assumed here to be the base hours. | `Hours` (9.10) | NO | IN (assumed = base hours; see Notes) | D11 CFG-125..127; D12 CFG-548, CFG-559 |
| 25 | Warning when a service is changed | If kiosk attract-screen schedules use a service, a warning confirmation appears before the change. It is a warning, not a block. | none | NO | IN | D11 FEAT-024..026; D8 BR-016 |
| 26 | Special dates and exceptional hours (record) | Internal name (CFG-146, required, max 255). Internal description (CFG-145, required, max 1024). Single date (default) or range (CFG-142). Hours type (CFG-144, required): closed (default "Closed stores"), custom hours for a single day, common hours for a range, custom hours per day. Closed day = midnight to 23:59 with an explicit closed marker. Single date has end null. Start later than end is rejected before submit. Store-closed toggle (CFG-151). Customer message (CFG-147, optional, max 140) shown on the kiosk. | NEW: `SpecialDate` {id, internalName, internalDescription, customerMessage, dateMode, startDate, endDate, storeClosed, periods[{open, close}]} | NO | IN (brief rule 1, plan-next G-A5) | D11 FEAT-030, CFG-141..151; D8 BR-017, ERR-011, DEP-240..242; D5 FEAT-030 |
| 27 | Special dates: draft and publish | Draft save needs internal name, description and at least one day or period. Publish also needs at least one checked, available store (single store: always true). Actions: create, edit, duplicate, delete, publish. Separate confirmation for discard, draft save and publish. List filters: closed or custom; live, scheduled, performed, draft. New record: single date, start today, end tomorrow. | status on `SpecialDate` (draft, published) | NO | IN | D11 FEAT-030; D8 BR-018; D13 FEAT-030 |
| 28 | Special dates vs base hours | Precedence between special dates and base hours is not defined by the spec. | none | NO | OPEN (open question 3) | D11 FEAT-030, Unknowns; D8 BR-019 |

### Capacity and pace

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 29 | Kitchen order capacity | Shared kitchen limit (non-negative integer), used with the service capacity settings. Save and publish the capacity configuration. | NEW: `StoreConfigurationResponse.kitchenOrderCapacity` | NO | IN | D11 CFG-134; D4 FEAT-027; D5 ACT-111..115 |
| 30 | Order capacity per service | For dine-in, take-out and seat (and collection and delivery, which are MODEL-ONLY): default, expanded and reduced limits (non-negative integers, max 11 characters for the default). Each service has its own required interval (positive integer). Active profile chosen per period. | NEW: `OrderCapacity` {service, defaultLimit, expandedLimit, reducedLimit, intervalMinutes, activeProfile} | NO | IN for dine-in and take-out and seat; MODEL-ONLY for collection and delivery | D11 FEAT-027..029, CFG-128..140; D7 FORM-023; D6 |
| 31 | Capacity admission rule | How a limit is applied across services and what the kiosk shows when a limit is reached is not defined. | none | NO | OPEN (open question 5) | D7 FEAT-029; D11 FEAT-027..029 |

### Kiosk settings and media (one template)

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 32 | Kiosk dine-in and take-out switches | Dine-in and take-out both default on. They cannot both be off; each switch is disabled while the other is off. | `OrderType.DINEIN`, `OrderType.TAKE_OUT` (8.1); NEW: `KioskSettings.dineInEnabled`, `takeOutEnabled` | PART (G-A18: both off bug already logged) | IN | D12 FEAT-063, CFG-534, CFG-536 |
| 33 | Kiosk idle timer | Choices: disabled, 45 s (default), 1 m, 2 m, 3 m. "Disabled" sets enabled=false; timed choices set enabled=true. After the interval an inactive session resets. | NEW: `KioskSettings.idleTimeoutSeconds` (0, 45, 60, 120, 180) | PART | IN | D12 FEAT-063, CFG-535 |
| 34 | Closed and unavailable message priority | Each is one of: always shown (default), behind attract screens, never. | NEW: `KioskSettings.closedMessagePriority`, `unavailableMessagePriority` | NO | IN | D12 CFG-539, CFG-546 |
| 35 | Attract media (portrait fallback) | Portrait 9:16 default content enabled (CFG-544) and default media, image or video (CFG-545). Scheduled media list shown in order (CFG-557). Image display duration: default 15 s (CFG-550; shown in seconds, saved in milliseconds). Alt text per media (CFG-553). | NEW: `KioskSettings.attractMedia[]` {type, url, altText, order}; `durationSeconds` | PART | IN (video: open question 11) | D12 FEAT-064, CFG-544, CFG-545, CFG-550, CFG-553, CFG-557 |
| 36 | Media upload | Upload images or videos. Max 20 MB. Formats: JPEG, PNG, GIF, MP4, WebM, OGG. Recommended (not required) sizes: portrait 1080x1920, landscape 1920x1080, 1080x720. Overlap and schedule conflicts: winner not defined. | none (asset store) | NO | IN (images) / open for video | D12 FEAT-064 (upload), CFG-554 |
| 37 | Landscape media defaults | Landscape 16:9 and 3:2 default content and media (CFG-540..543). | none | NO | OUT (kiosk is portrait only, CLAUDE.md) | D12 CFG-540..543 |
| 38 | Media schedules | Advanced schedule on or off (CFG-547). Source: custom hours or operational hours (CFG-548). Single date or date range (CFG-555, CFG-556, CFG-560, CFG-549). Weekday and time periods (CFG-558). Select operational hours (CFG-559, required). | `StoreConfigurationResponse.hours` (9.10) for the operational source | NO | IN (weekday schedules: open question 11) | D12 FEAT-064, CFG-547..560 |
| 39 | Template types | Attract Screens (default; immutable after creation). Loyalty Sign In (CFG-563). Self Checkout. | NEW: `KioskSettings.templateType` | NO | IN for Attract Screens; CUT for Loyalty Sign In (brief rule 10: loyalty); OPEN for Self Checkout (open question 11) | D12 CFG-563 |
| 40 | Kiosk template internal fields | Internal name (CFG-552, max 100), internal description (CFG-551, max 250), title (CFG-538). Store association (CFG-537). | none | NO | IN for internal name and description (admin only); CUT for title and store association (brief rule 10) | D12 CFG-533, CFG-537..538, CFG-551..552 |
| 41 | Guest-conversion banner | Campaign shown on the kiosk to convert guests to accounts (banner colours, images, title, buttons). | none | NO | OUT (decision 8: guest conversion out) | D13 FEAT-058, CFG-470..486; D5 FEAT-058 |
| 42 | Store card display and store discovery (listing) | Card fields and order, default service (delivery, collection, to table), default sort (closest, fastest), scroll direction, naming term, description and hours visibility. | none | NO | CUT (brief rule 10: one restaurant, no store listing) | D13 FEAT-062, CFG-518..532; D12 notes |
| 43 | Store tags | Name, description, draft and published, banner or list position, store selection. | none | NO | CUT (brief rule 10: store discovery) | D13 FEAT-061, CFG-513..517 |
| 44 | Store categories and hero sections (discovery) | Published categories and hero sections, with store eligibility rules, schedules and display order. | none | NO | CUT (brief rule 10: multi-store discovery) | D13 FEAT-059..060, CFG-487..512 |

### Tips, service charges and tenders

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 45 | Service charges (fees) | Create, edit, delete. Name, internal description and display name required. Percentage or fixed. Percentages divided by 100 on save. Tax group. Targets. POS flag: out (decision 2). Store config holds the percentage; the Core computes the amount and sends `ServiceCharge.value`. Example: 10 %. | NEW: `StoreConfigurationResponse.serviceChargePercent`; `ServiceCharge.value` (8.5) | NO | IN (brief decision 6; plan-next decision 16 said no fee, superseded) | D5 FEAT-048; D4 FEAT-048; D1 FR-1041..1048; D11 Notes |
| 46 | Tips | Tip amount on payment (`tipAmount`). The spec has no tip setting screen or rule in the back office inventories. | `Payment.tipAmount` (8.8) (exists) | NO | IN (brief decision 8); the setting is OPEN (open question 8) | Brief decision 8; no spec row found |
| 47 | Donations | Donation amount on payment. A full refund excludes the donation until the rest is refunded. | `Payment.donationAmount` (8.8) (exists) | NO | IN (brief decision 8) | D5 FEAT-074; D8 BR-048 |
| 48 | Store payment methods (tenders) | Each method: visible/enabled toggle (CFG-689), customer display name (CFG-690, max 100). Cash = pay at receipt (tender). Enabling and renaming are separate saves. Cash as tender: `tenderId`. | NEW: `StoreTender` {tenderId, enabled, displayName}; `Payment.tenderId` (8.8) | NO | IN (cash only; brief decision 8) | D13 FEAT-079, CFG-689..690; D5 ACT-557..559; D4 FEAT-079 |
| 49 | Card processor connection and payment portal | Connect a card processor, open the processor portal, set up a guest payment account. | none | NO | OUT (decision 9: vendor payment methods out) | D5 ACT-560..562; D13 FEAT-079 |
| 50 | Organisation payment settings | Organisation-level payment account and onboarding. | none | NO | OUT (decision 9) | D13 FEAT-080; D5 FEAT-080 |
| 51 | Managed payments (transactions, payouts, disputes, financing) | Transactions and payout details, disputes workspace, merchant financing, export. | none | NO | OUT (decision 9: vendor) | D13 FEAT-078; D5 FEAT-078; D4 FEAT-078 |
| 52 | Credit and dispute adjustments (super admin) | Credit or dispute with principal, fee (default 0 for credit, 15 for dispute), total, external dispute reference. Apply rejects missing or non-positive totals. | none | NO | OUT (decision 9: vendor) | D13 CFG-680..688, FEAT-078; D8 BR-052, ERR-021 |
| 53 | Receipt QR code and NFC-e (remote module) | Dynamic receipt QR code module, loaded by organisation ID. Fiscal identity: seller tax details (FEAT-051). | none | NO | HW-LATER (phase 4: NFC-e, CLAUDE.md) | D13 FEAT-099; D4 FEAT-051, FEAT-099; D5 FEAT-051 |

### Orders, refunds and customers

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 54 | Orders list and detail | Order list guarded by order-read. Status filter. Statuses: open, in progress, closed, rejected, cancelled. Customer, transaction, item, tax and payment info. Refresh. Tracking link: spec status unclear (open question 9). | `OrderItem` (8.2), `Payment` (8.8) | NO | IN (order list is G-A2) | D13 FEAT-074; D5 SCR-153, ACT-494..497; D3 FR-1238..1243 |
| 55 | Refund (full or partial) | Pick an eligible payment (`Payment`). Amount: min 0.01, max = paid minus already refunded. Full or partial. Reason required: "Out of stock", "customer cancellation", "customer complaint". Full refund excludes the donation until the rest is refunded. Confirm is explicit and irreversible. Invalid form sends nothing. Success refreshes and closes; failure keeps the editor open and shows the service error. Completed refunds are not promised reversible. | NEW: `Refund` {id, paymentId, amount, reason, type, status} | NO | IN (phase 4 with the payment provider; the MVP simulates payment) | D13 FEAT-074, CFG-628..631; D8 BR-047..048, ERR-020; D7 FORM-085 |
| 56 | Refund of a loyalty award | Refund of a pseudo-currency award (loyalty). | Award type PSEUDO_CURRENCY (8.10) | NO | CUT (brief rule 10: loyalty) | D13 CFG-630; D5 FEAT-046 |
| 57 | Resend refund e-mail | After a refund, e-mail the customer. | none | NO | OUT (no e-mail in MVP; digital receipts out) | D5 ACT-498..504 |
| 58 | Customer record | First name and last name (required, max 100 each). Email (max 100, conditionally required). Phone (required, max 100). | `Customer` (8.6): `firstName`, `lastName`, `email`, `phoneNumber` (exist) | NO | IN (brief decision 8) | D13 FEAT-073, CFG-622..625; D8 ENT-*; brief decision 8 |
| 59 | Customer marketing opt-in and notes | Marketing opt-in per customer; internal notes (no length limit) linked to an order. | none | NO | OUT (decision 8: consent out; notes not in decision 8) | D13 FEAT-073, CFG-626..627; D13 Notes |
| 60 | Customer eligibility for offers | Choose all customers or specific customers only for an offer. The spec types the field as Boolean but lists two named choices. | none | NO | CUT (customer targeting; accounts out) | D13 CFG-620 |
| 61 | Assisted ordering for a customer (external) | Opens an external assisted-ordering service with a scoped token. Order entry is Unknown. | none | NO | OUT (external system; not in brief) | D13 FEAT-073; D5 FEAT-073 |

### Home, reports and analytics

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 62 | Home dashboard (Início) | Summary cards: revenue, orders, new and returning customers. Navigation, help and community links. The dashboard read is capability PERM-002. Retrieve dashboard endpoint: API-284. | Reads from orders and `Customer` (returning customers need a customer key: open question 10) | PART (placeholder today) | IN | D13 FEAT-012; D4 FEAT-012; D5 SCR-057; D6 API-284; D7 PERM-002 |
| 63 | Operational reports | Report types (in scope): orders, refunds, cancelled orders, revenue, summary and cards, promotions and promotion usage, new customers, paying customers, busiest days, table bills, table-bill summary. Periods: today, yesterday, last 7, 14 and 30 days, last year, month-to-date, year-to-date, custom. Filters: dates, report type. Read-only. Restricted users see a subset. | `Payment` (8.8), `Award` (8.10), `PosCheck` (9.7) for table bills | PART | IN | D13 FEAT-077, CFG-672; D5 FEAT-077, SCR-011; D11 Notes |
| 64 | Report types out of scope | Loyalty report (CUT rule 10). Busiest events, new delivery areas (MODEL-ONLY: events and delivery). Marketing-consent filter (OUT decision 8). Store filter (CUT, multi-store). Store invoice, stock, unregistered customers: spec only lists them. | none | NO | CUT (loyalty, multi-store); MODEL-ONLY (events, delivery areas); OUT (marketing consent); OPEN (stock, store invoice, unregistered customers, open question 10) | D13 FEAT-077, CFG-671, CFG-674; D5 FEAT-077 |
| 65 | Saved report views | Save filters, sort, visible columns and a view name (max 64). Set as my default view. Per user. | NEW: `ReportView` {name, filters, sort, columns, isDefault, userId}. Needs the staff model (open question 1). | NO | IN | D13 CFG-675..679; D5 ACT-550..553 |
| 66 | Managed-payments analytics | Overview, transactions, payouts, disputes, settings, financing. | none | NO | OUT (decision 9: vendor) | D13 FEAT-078; D5 ACT-538..553 |

### Users, roles and account

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 67 | Users, roles and invitations | List of users with scoped roles and pending invitations. Invite by email (max 100) and name (max 100). Roles required (at least one). New invitations default to Administrator. Roles come from the service. Stores on hold or cancelled cannot get new invitations. Deleting a role removes the user only when no role remains. Resend keeps or edits the scope; 409 gives a conflict message. Owner: backoffice. Waiter role: the spec defines roles only through the service; a "waiter" role is not specified. | NEW: `Staff` {id, name, email, role}; none in v2 (decision 11 defers second login) | NO | OPEN (open question 1) | D13 FEAT-013, CFG-021..024, BR-004..005, BR-500..501, ERR-006, ERR-031; D8 ENT-009; D5 ACT-036..041, ACT-639 |
| 68 | Target scope on users (organisation, groups, stores) | Invitations and roles target the whole organisation, store groups or single stores. | none | NO | CUT (store groups; multi-store). The single-store scope is part of row 67. | D13 CFG-022, CFG-025..026 |
| 69 | Restricted-item approval PIN | 4-digit PIN for approving restricted items. Rejects repeated digits and sequences (1234, 4321, 9876 and others). Needs approval permission. | none | NO | CUT (brief rule 10: staff age approval) | D13 CFG-015 |
| 70 | Account settings: email, password, language | Change email (new email max 100, current password), change password (old, new, confirm; mismatched confirmation blocks submit), owner dashboard language. Email change confirmation link (`/email-success/{token-id}`). Wrong current password and email-in-use have their own messages. | none (owner account, platform) | NO | IN (language choice: confirm) | D13 FEAT-005, FEAT-010, CFG-006..014, CFG-016; D5 FEAT-010 |
| 71 | Account newsletter, marketing and support-email preferences | Monthly client newsletter, general marketing, support emails. | none | NO | OUT (decision 8: consent out) | D13 CFG-008, CFG-009, CFG-011; D5 ACT-026..028 |
| 72 | Billing summary and card update (SaaS billing) | Next billing date and amount; card form (number, CVC, expiry). | none | NO | OUT (decision 8: SaaS billing out) | D13 FEAT-011, CFG-017..020; D5 FEAT-011 |
| 73 | Sign-in, federated login and invitation sign-up | Email and password sign-in; identity-provider discovery; invitation sign-up with invite key; identity migration. Owner: platform. | none | PART (platform) | OUT for federated login and identity migration (EXT); the email and password sign-in belongs to the platform area | D13 FEAT-001..004, CFG-001..005; D8 ENT-001..002 |
| 74 | Interface language (owner dashboard) | Language choice for the dashboard UI. | none | ? | IN (see row 70) | D13 CFG-016; D5 ACT-025 |

### Devices

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 75 | Device pairing and device list (kiosk, kitchen) | No device management row exists in the store-ops inventories. The only device row is a table-bill "shared device" flag (DEP-F43). Pairing and secret storage are open in `docs/data-model-and-api.md`. | none | NO | OPEN (not in the spec inventories; see open question 12) | D8 DEP-F43; CLAUDE.md "Open questions" |

### Notifications, feed and messages

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 76 | Order message templates | Rich-text body (max 512) and short name (max 100), saved automatically. | none | NO | OUT (digital receipts out) | D12 FEAT-083, CFG-717..718; D5 FEAT-083 |
| 77 | Application messages | Application selector (required), internal name (max 255), display text (max 1024, HTML check), title (max 255). | none | NO | OUT (no application in MVP) | D12 FEAT-084, CFG-719..721; D5 FEAT-084 |
| 78 | Recipient e-mail lists (order placement, rejection, special dates, organisation) | Comma or semicolon lists, trimmed, de-duplicated; invalid entries flagged. | none | NO | OUT (no e-mail in MVP) | D12 FEAT-085/086, CFG-722..725; D5 FEAT-085..086 |
| 79 | External activity feed for staff (StaffFeed) | Organisation feed enable (default off), organisation UUID, seven card-field toggles and three action toggles (default on), per-user subscription, new-order alerts. Kitchen card fields are kitchen-area rows. | none | NO | OUT (external provider) | D12 FEAT-087, CFG-732..741; D13 CFG-010; D5 FEAT-087 |
| 80 | Kitchen staff card toggles and actions | Show collection time, customer name, instructions, items, location, total; accept, cancel and complete actions. Owner: kitchen. | `SubmitOrderRequest.pickupTime`, `Customer`, `specialNotes`, `OrderItem`, `total` | PART | IN (owner: kitchen area; listed here for traceability) | D12 CFG-726..740 |
| 81 | Kiosk and kitchen warnings | See row 5. | see row 5 | PART | IN | D12 CFG-713..716 |
| 82 | Email banner and footer (order e-mail) | Banner image, footer rich text (max 800). | none | NO | OUT (digital receipts out) | D12 FEAT-081, CFG-711 |

### Styling, legal and allergen notices

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 83 | Consumer styling and themes (logo, colours, background, banner, nav, text colours) | Several themes: online ordering, store landing, mobile home, store list, table-bill loading. Image fields max 2 MB. Preview and publish to entities. | none | NO | CUT (brief rule 10: one visual template; open question 9) | D12 FEAT-081, CFG-691..708; D5 FEAT-081 |
| 84 | Organisation landing page banner | Banner colour and image on the organisation landing page. | none | NO | CUT (brief rule 10: multi-store) | D12 CFG-704..705 |
| 85 | Legal documents (terms, privacy, accessibility, allergy info, cookie consent) | Five document kinds, each hosted rich text or an external URL. Preview, reset, save and publish. Legal area container. | none | NO | OUT (decision 8: legal documents out) | D12 FEAT-066..069, CFG-564..584; D4 FEAT-066..069, FEAT-091; D5 FEAT-066..069 |
| 86 | One privacy or legal notice line on the kiosk | One short notice line (G-A19 in plan-next). Full document is out. | none | NO | IN (one line of text; wording owner: Kai) | D5 FEAT-067 (note); D4 FEAT-067 |
| 87 | Accessibility statement | Accessibility statement document. | none | NO | CUT (brief rule 10: accessibility mode) | D5 FEAT-068; D4 FEAT-068 |
| 88 | Cookie-consent document | Cookie consent document. | none | NO | OUT (decision 8: consent out) | D5 FEAT-069; D4 FEAT-069 |
| 89 | Allergen policy text and link | Allergen policy as hosted rich text or external URL (CFG-595..599: link label max 255, URL, show link, body). Owner: menu area for the allergen list. | none (`ITEM.allergens` is menu area) | NO | IN (one policy text or link shown on the kiosk) | D12 FEAT-070, CFG-595..599, CFG-597 (typed Boolean) |
| 90 | Allergen consent prompts (POS consent) | Consent enabled, title, description, blocked message, outcome message, POS item id and name, send consent to POS, consent for online orders. | none | NO | OUT (decision 8: consent workflows out; POS out, decision 2) | D12 FEAT-070, CFG-585..594, CFG-587..590 |
| 91 | Guest custom fields (legacy customer or location field) | Legacy custom field: required flag, name (max 100), placeholder (max 150). | none | NO | OUT (no custom-field model in v2; see open question 4) | D12 CFG-604..606 (kiosk) |
| 92 | Table-bill custom fields, templates and messages | Heading, subheading, title, instructions, trigger and repeat for guest inputs at the table bill. Owner: waiter area. | none | NO | OPEN (waiter area; see its file) | D12 FEAT-071, CFG-607..619; D13 Notes |

### Outlets, seats and events

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 93 | Seat or table number ranges (locations) | Location group label (required, max 100), location name (required, max 100), type (max 12). Seat number start and end (max 9999 each). Free-text location entry option. Owner: waiter area. | `ValidateTableRequest.tableNumber` (string); the spec uses integer ranges | NO | IN (owner: waiter-table-qr; open question 1 for seat type) | D11 FEAT-075, CFG-641, CFG-643..647; D4 FEAT-075 |
| 94 | Outlet record (sales point linked to a menu) | Outlet name (max 100), description and directions (max 255), external ID (max 255), menu association, order routing (who receives it is not stated). | none | NO | CUT if it means a second venue (brief rule 10); otherwise OPEN | D11 FEAT-075, CFG-633..642; D4 FEAT-075 |
| 95 | Events and scheduled collection slots | Event name (max 100), description (max 255), image, recurrence (once, daily, weekly, monthly, yearly), collection slots with offsets, pre-order opening (today, one week, two weeks, custom), segment duration. | NEW (later): `dateToFire`, `pickupTime` (SubmitOrderRequest, 8.12) | NO | MODEL-ONLY (brief decision 7; pre-orders conflict with plan-next decision 17) | D11 FEAT-076, CFG-632..667; D8 BR-050..051; D5 FEAT-076 |

### Shared rules

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 96 | Money and percentage inputs | Money: max 99999999.99, optional empty = null, formats on blur, keeps the last valid value. Percentages: shown 0 to 100, stored as a fraction (4 decimals; tax field 6). Money is a decimal in BRL (decision 1). | 8.x money as decimal; percentages as fractions | NO | IN | D13 shared-interactions; D8 BR-038 |
| 97 | Integer and HTML validators | Integer sanitiser strips non-digits; max-integer default 2147483646. HTML, hex-colour and email validators are separate. | none | NO | IN | D13 shared-interactions; D11 CFG-044 |
| 98 | Form save rules | Required fields block submit. Failures show retry or failure feedback. A saved indicator is not confirmed when the request has no error handler (defect). | none | PART | IN | D8 ERR-007; D12 FEAT-085/086 |

## New fields to add to the v2 models

| Entity.field | Type | Meaning | Why (feature #) |
|:--|:--|:--|:--|
| StoreConfigurationResponse.address (addressLine1, addressLine2, addressLine3, city, postcode) | string (max 255, 255, 255, 100, 45) | Store postal address | 1 |
| StoreConfigurationResponse.latitude, longitude | number | Map location, synced with the map marker | 1 |
| StoreConfigurationResponse.description | string (max 255) | Customer-facing description | 1 |
| StoreConfigurationResponse.cuisineTags | string[] | Store cuisines | 1 |
| StoreConfigurationResponse.preparationTime {normal, busy, peak} | integer (minutes; unit open) | Lead times by store state | 6 |
| StoreConfigurationResponse.warnings[] {condition, title, body, showPopup} | enum (OFFLINE, CLOSED, NOT_ACCEPTING); string (title max 50, body max 140); boolean | Kiosk warning copy | 5 |
| StoreConfigurationResponse.specialInstructions {enabled, itemNotesVisible, customerNoteRequired, maxLength, title, defaultText} | boolean; integer (default 60); string (title max 130) | Store defaults for item notes | 7 |
| StoreConfigurationResponse.serviceChargePercent | decimal fraction | Service-charge rate, computed by the Core (decision 6) | 45 |
| StoreConfigurationResponse.kitchenOrderCapacity | integer >= 0 | Shared kitchen limit | 29 |
| StoreConfigurationResponse.tenders[] {tenderId, enabled, displayName} | string; boolean; string (max 100) | Payment tenders on or off (cash) | 48 |
| Hours.dineIn | integer (1/0) | Window applies to dine-in | 21 |
| Hours.takeOut | integer (1/0) | Window applies to take-out | 21 |
| OrderCapacity {service, defaultLimit, expandedLimit, reducedLimit, intervalMinutes, activeProfile} | enum (DINEIN, TAKE_OUT, SEAT); integers; positive integer interval | Order limits per service | 30 |
| SpecialDate {id, internalName, internalDescription, customerMessage, dateMode, startDate, endDate, storeClosed, periods[{open, close}], status} | string (255, 1024, 140); enum (SINGLE, RANGE); date; boolean; enum (DRAFT, PUBLISHED) | Exceptional hours and closures | 26, 27 |
| KioskSettings {dineInEnabled, takeOutEnabled, idleTimeoutSeconds, closedMessagePriority, unavailableMessagePriority, templateType} | boolean; integer (0, 45, 60, 120, 180); enum (ALWAYS, BEHIND_ATTRACT, NEVER); enum (ATTRACT, SELF_CHECKOUT) | One kiosk template | 32–34, 39 |
| KioskSettings.attractMedia[] {type, url, altText, order, durationSeconds} | enum (IMAGE, VIDEO); string; string; integer; integer (default 15) | Attract screen media | 35, 36 |
| StoreTender {tenderId, enabled, displayName} | string; boolean; string (max 100) | Cash as a payment method | 48 |
| Refund {id, paymentId, amount, reason, type, status} | string; string; decimal (min 0.01); enum (OUT_OF_STOCK, CUSTOMER_CANCELLATION, CUSTOMER_COMPLAINT); enum (FULL, PARTIAL); enum | Refunds | 55 |
| Staff {id, name, email, role} | string; string (max 100); string (max 100); enum (open: admin, waiter?) | Staff accounts and roles (only if open question 1 = per-person login) | 67 |
| ReportView {name, filters, sort, columns, isDefault, userId} | string (max 64); object; object; string[]; boolean; string | Saved report views | 65 |

Not needed now: `Payment.tipAmount` and `Payment.donationAmount` (exist), `Customer` (exists), `OrderType` (exists), `ServiceCharge` (exists), delivery zone (MODEL-ONLY, no field until delivery is built).

## Open questions for Kai

Each question has a pick (⭐). Only questions that the decisions above do not settle.

1. **Staff login and the waiter role.** How do waiters and staff sign in?
   - A. Per-person accounts with roles (admin, waiter); full spec FEAT-013. Biggest build.
   - B. ⭐ One device token per tablet, and the waiter is identified by a PIN for the check (`IPosCheck.employeeId`). Smallest build for the pilot. Trade-off: no per-person audit.
   - C. Defer roles to phase 2; the owner uses one login.

2. **Dine-in and take-out hours.** Hours (v2) has only pickup, delivery and seat flags.
   - A. ⭐ Add `Hours.dineIn` and `Hours.takeOut` (new fields, matches the spec). Trade-off: one more field for the partner to build.
   - B. Reuse `pickup` for take-out. Trade-off: wrong meaning, and PICKUP is model-only.
   - C. One schedule for all services. Trade-off: loses the per-service hours in the spec.

3. **Special dates vs base hours.** The spec does not say which wins.
   - A. ⭐ A special date replaces the base hours for its days; a closed special date closes the day.
   - B. Base hours win; a special date only closes days.
   - C. The last saved rule wins. Trade-off: unpredictable for the owner.

4. **Custom fields and legacy location field.** Is the guest custom field (CFG-604..606) needed?
   - A. ⭐ No; drop it for the MVP. Trade-off: none for the pilot.
   - B. Keep one free-text field on the table bill (waiter area).

5. **Capacity when the limit is reached.** What does the kiosk do?
   - A. ⭐ Block new orders for that service and interval, with a message. Trade-off: needs the interval logic.
   - B. Warn but allow. Trade-off: no real limit.
   - C. Share one limit across services. Trade-off: matches the spec's kitchen capacity, but harder to explain.

6. **Preparation time unit.** The spec does not say whether the lead times are minutes.
   - A. ⭐ Minutes. Trade-off: none known.
   - B. Seconds.

7. **External providers.** Review widget, marketplace status, managed payments, StaffFeed, recipient e-mails.
   - A. ⭐ Confirm all out of the MVP.
   - B. Keep the StaffFeed alert for the kitchen only. Trade-off: needs an external service.

8. **Tip setting.** Tips are IN (decision 8), but the spec has no screen for them.
   - A. ⭐ Free amount at checkout only; no setting. Trade-off: no preset percentages.
   - B. Preset percentages in store config (new field).
   - C. Tips off in the MVP.

9. **Theme and logo.** The spec has a full theme editor. Brief rule 10 allows one visual template.
   - A. ⭐ The approved prototype only; no store editor. Trade-off: the store name is not editable on the kiosk.
   - B. Store name and logo only. Trade-off: a small editor to build.
   - C. Full colours. Trade-off: outside the one-template rule.

10. **Home dashboard and returning customers.** The "new and returning customers" card needs a key.
    - A. ⭐ Phone number (the Customer record has it, decision 8). Trade-off: the same phone for two people counts as one.
    - B. Email. Trade-off: fewer customers give an email.
    - C. No customer cards in the MVP.

11. **Kiosk media.** Video, weekday schedules, and the Self Checkout template type.
    - A. ⭐ Images only; attract screen only; schedules by date range. Trade-off: no video or weekday rules.
    - B. Images and video. Trade-off: heavy on the ARM board (CLAUDE.md performance rules).

12. **Devices.** No device rows exist in the store-ops spec. Pairing and secret storage are open in `docs/data-model-and-api.md`.
    - A. ⭐ Decide in the platform area first. Trade-off: this file cannot close the item.

## Spec contradictions and defects not to copy

- **Money:** the spec uses cents (FR-420, D2) and a decimal in BRL (decision 1). CLAUDE.md still says "integer cents". Update CLAUDE.md with the release PR (repo rule).
- **Hours format:** v2 uses day 1 = Sunday and `HH:mm:ss.SSS`; menu section hours use day names and `HH:mm:ss`. The spec's `HH:mm` defaults need conversion.
- **Save model:** FEAT-021 auto-saves after 1 s; FEAT-015 uses explicit Save and Discard, on the same screen family. Comanda uses explicit save.
- **Empty error handlers:** FEAT-085/086 show "saved" on a local edit, and the request error handlers are empty. Do not copy.
- **Non-atomic saves:** store details and phone settings save as two requests (FEAT-015, BR-006). Use `saveBoth()`.
- **Phone length:** store phone max 100 (CFG-044), service contact phone max 45 (CFG-071).
- **Required and optional at once:** CFG-663 is labelled both "Optional" and "Required". CFG-661 gives two maximums (256 and 100).
- **Same label, different fields:** CFG-049 and CFG-052 are both "Enabled". CFG-653 and CFG-654 are both "Choose collection slots:".
- **Copied effect text:** CFG-085 (zone delivery time) has the effect text of CFG-660 (lead time).
- **Threshold names:** CFG-091 is "upper basket threshold" but FEAT-022 calls it the free-delivery threshold. CFG-070 is vague.
- **Latitude and longitude:** numbers with a "max 100 characters" rule (CFG-038, CFG-039).
- **Typed as Boolean but not Boolean:** CFG-620 (two named choices), CFG-597 (a mode with two values), CFG-022 ("Boolean/reference"). CFG-020 ("Maximum 99") is a numeric max for a two-digit year.
- **Image sizes:** group image 2 MB (FEAT-014) vs no limit (CFG-028); kiosk media upload 20 MB (FEAT-064) vs 2 MB in another row (D12 notes).
- **Seconds vs milliseconds:** media duration is shown in seconds and saved in milliseconds (CFG-550).
- **Copy errors (do not copy):** "up to100" (CFG-068), "next100" (CFG-670), "Save this settings" (CFG-675), double full stops (CFG-015, CFG-059), "is0.01" (FORM-085).
- **Store card fixed slots:** indices 0, 1, 7 (FEAT-062) vs positions 1, 2, 8 (CFG-522). Same slots, different base. Store card display is CUT anyway.
- **Duplicate routes:** two opening-hours paths, two capacity paths, offers and offers-v2 (navigation). Do not copy.
- **Dine-in and take-out both off:** the spec forbids it (FEAT-063); Comanda has the bug (G-A18). Fix it.
- **Shared route:** SCR-031 and SCR-159 both use `/dashboard/payments`.
- **"Peak" vs "Pausado":** the spec's peak lead time (CFG-058) is not the plan's Pausado state.
- **Operational hours undefined:** CFG-125..127 ("operational") is never defined. Assumed to be base hours (row 24).
- **Unknowns the spec admits:** overnight and overlap of periods (FEAT-024); special-date precedence (FEAT-030); zone matching (FEAT-022); units of reject-after and delivery time (CFG-069, CFG-078..080, CFG-082, CFG-085); radius unit (CFG-086); "custom fields" and "parent location" (CFG-632, CFG-635); "sync" in schedule frequency (CFG-651); who receives outlet routing (FEAT-075).
- **Plan conflicts already settled by the brief:** pre-orders vs plan decision 17 (brief rule 4 and decision 7 treat them as model-only); service charge vs plan decision 16 (decision 6: IN); delivery vs plan cut (decision 7: model-only).

## Coverage pass: feature rows added (rows 99–116)

Added after the first pass. Each row is a feature found in D1–D7 or D8 that the first pass did not list. Rows owned by another area are kept here for traceability and marked with their owner.

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model (existing field, or NEW: entity.field) | Comanda today (HAS/PART/NO) | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 99 | Card processor connection success | Screen after connecting a card processor (read or launch). | none | NO | OUT (decision 9: vendor payments) | FEAT-009 (D4, D7) |
| 100 | Menu list, menu detail, item editor, modifier editor, menu tree, item badges | Menu editing screens. Owner: backoffice-menu. This file does not define them. | ITEM, SIZED_ITEM, MODIFIERS, CATEGORY (menu area) | PART | IN (owner: backoffice-menu) | FEAT-031, 032, 033, 034, 035, 036 (D4, D5, D8 ENT-025..034) |
| 101 | Custom tags and tag actions | Create tags and tag actions that trigger messages or external links. | none | PART | OUT (customer tagging and messaging; not in brief) | FEAT-037 (D4, D5 ACT-197..205, ENT-035) |
| 102 | Catalog health checks | Diagnostic checks on the catalogue. Health checks are IN. Menu templates oversight is CUT (brief rule 10: one template). Owner: backoffice-menu. | none | NO | IN (health checks, owner backoffice-menu) and CUT (templates) | FEAT-038 (D4, D8 BR-200..264, ENT-036) |
| 103 | Menu publish, POS menu sync, external sync log, external validator, menu import and push | Publish to targets, publish log, scheduled POS sync, import and force push. | none | NO | OUT (decision 2: POS integration; publish targets CUT rule 10). Owner: backoffice-menu. | FEAT-039, 040, 041, 042, 043 (D4, D5, D8 BR-030..036, ERR-012..015, ENT-037..042) |
| 104 | Offers, legacy promotions and award promotions (codes) | Offer editor (percentages stored as fractions). Legacy offer editor. Award promotions with code, promotion and item types. Customer targeting is CUT. Loyalty awards are CUT. Owner: promotions. | Award CODE / PROMOTION / ITEM (8.10); Discount (8.4) | PART | IN (codes and promotions, decision 8). Customer targeting and loyalty awards: CUT (rule 10). | FEAT-044, 045, 047 (D4, D5 ACT-271..286, ENT-043..048, BR-037..039) |
| 105 | Tax groups, tax rates per channel, taxes container | Tax group selects rates per channel. Rates shown as percentages, stored as fractions. Tax by order type follows decision 5. Owner: tax area (D10). | TAX (8.3): pickupTax, deliveryTax, seatTax (voucher and booking unused) | NO | IN (decision 5) | FEAT-049, 050, 052 (D4, D5 ACT-305..316, ENT-051..053, BR-038) |
| 106 | Kiosk promotions (code list and POS adjustment) | Kiosk promotion list with code, verification mode, enable or disable. The POS adjustment part is out. | Discount, Award (8.4, 8.10) | NO | IN (code list); OUT (POS adjustment, decision 2) | FEAT-053 (D5 ACT-317..325, D7 FEAT-053) |
| 107 | Loyalty campaign settings | Stamp target, earning rule, reward rule, loyalty message, appearance. | none | NO | CUT (brief rule 10: loyalty) | FEAT-054 (D4, D5 ACT-326..330, ENT-056) |
| 108 | Suggestive selling (simple rule) and advanced cross-sell host | Simple rule: name, title, eligibility conditions, suggested items (default count 7, ordered low to high price), schedule. The advanced cross-sell module is a remote host. Owner: promotions or menu. | CROSS_SELLS (5.18), untyped | PART | IN (simple rule); OUT (advanced remote module, EXT) | FEAT-055 (D5 ACT-331..340), FEAT-056 (D5 ACT-341) |
| 109 | Repeat ordering (settings and analytics) | Carousel title, show image, what to show, quantity default 7. Analytics on repeat orders by customer. | none | NO | OUT (decision 8: repeat order out) | FEAT-057 (D4, D5, D13 FEAT-057) |
| 110 | Hero sections (web homepage) | Hero sections with schedule and store selection. | none | NO | CUT (brief rule 10: multi-store discovery) | FEAT-060 (D4, D13 FEAT-060) |
| 111 | Navigation containers: product settings, menu, promotions, operational settings, store settings, store management | Containers with no rules of their own; they open child screens. Owner: the area of each child screen. | none | PART | IN (navigation only; follows the child rows) | FEAT-065, 088, 089, 092, 093, 094 (D4, D5 ACT-440, ACT-611, ACT-614..616) |
| 112 | Table-bill container (open checks, pay at table) | Container for table-bill settings. Owner: waiter-table-qr. | IPosCheck (9.7), OrderType PAY_AT_TABLE | NO | IN (owner: waiter-table-qr) | FEAT-072 (D4, D5 ACT-483) |
| 113 | Notifications container | Container for the notification child screens. Each child is in rows 76–79 (OUT). | none | NO | OUT (follows rows 76–79) | FEAT-090 (D5 ACT-612) |
| 114 | Legal container | Container for legal documents. | none | NO | OUT (decision 8: legal documents out) | FEAT-091 (D4, D5 ACT-613) |
| 115 | Shared controls and cross-cutting interactions | Tag autocomplete, schedule and period editors, uploaders, date and time controls, dialogs, validators. Rules as in rows 96–98. | none | PART | IN | FEAT-101 (D4, D7; D13 shared-interactions) |
| 116 | Platform shell, authentication container, application root, signed-in container, dashboard shell | Platform routing and shell. Owner: platform. | none | PART | Not this area (platform). Listed for traceability. | FEAT-095, 096, 097, 098 (D4) |

Note: FEAT-086 (store recipients) is covered by row 78 (OUT). FEAT-024 to FEAT-030 are covered by rows 20 to 31. FEAT-046 (credit promotions) is covered by row 56 (CUT) and row 107 (CUT).

## Coverage

How each source was checked. The three layers below cover every row in D1–D8 that is in this area.

**1. Spec ID resolution (automated).** Each FR, SCR, ACT and FORM id (1,189 unique) was looked up in the reference spec, and the FEAT id it belongs to was read from that line. All 1,189 resolved to a parent FEAT. Each parent FEAT is mapped to a row above, or to another area in the table below.

**2. Rows read one by one.** D11, D12 and D13 (all backoffice rows, full read). D8 BR, ERR and DEP rows (all in-area rows, read in full). D8 ENT rows (every ENT-id listed, mapped to a FEAT). D8 JOURNEY headline rows (106, each mapped to its feature by title).

**3. Rows mapped by group (not read one by one).** D6 API endpoints (about 200 ids, grouped by theme), AI-2..7 (agent intent notes), D7 PERM (30), GATE (6), UNK (about 14), DLG (13) and ERR (4) rows. Their features are named in the groups above. The D8 JOURNEY step rows (about 220) inherit their headline's feature.

| Source | In-area rows checked | Skipped (owner area) |
|:--|:--|:--|
| D1 functional-requirements (FR 1–440) | all FR rows resolved to FEAT | menu FR rows (backoffice-menu); table rows FR-063, FR-074, FR-077, FR-080..082 (waiter-table-qr) |
| D2 functional-requirements (FR 430–890) | all FR rows resolved to FEAT | menu FR rows (backoffice-menu); FR-1041..1048 (service charge, row 45) kept here |
| D3 functional-requirements (FR 880–1390) | all FR rows resolved to FEAT | menu and POS rows (backoffice-menu, decision 2); table and seat rows (waiter-table-qr) |
| D4 feature-checklist | all FEAT rows | FEAT-031..036, 038..045 (backoffice-menu, POS); FEAT-061..063 kept (rows 42 and 43) |
| D5 screens and actions catalogue | all SCR and ACT rows that resolve to a FEAT | menu and POS screens (backoffice-menu); kiosk promotion ACT-317..325 kept (row 106) |
| D6 API catalogue | endpoints grouped by theme | POS, menu, import and sync endpoints (backoffice-menu, decision 2); kitchen and table endpoints (waiter-table-qr, kitchen) |
| D7 features, forms, roles, verification | FEAT, FORM and PERM rows | menu forms (backoffice-menu); kiosk forms (kiosk); platform gates (platform) |
| D8 business rules, ENT, DEP, ERR | all in-area rows | menu diagnostics BR-200..264 (backoffice-menu); POS BR-033..036 (decision 2) |
| D8 user journeys | 106 headlines mapped | menu, POS and publish journeys (backoffice-menu); table-bill journey (waiter-table-qr) |
| D8 data models (CFG rows, 527) | mapped by range to D11, D12, D13 rows | CFG-607..619 (waiter-table-qr); CFG-726..740 (kitchen); CFG-587..594 (POS, decision 2) |

**Result.** Every resolvable feature in this area has a row. Two parts are mapped by group, not row by row: the D6 API endpoints and the D7 PERM, GATE, UNK, DLG and ERR rows. This is stated openly so Kai can ask for a row-by-row pass on them.

**Counts after the pass:** 116 feature rows in total (98 from the first pass, plus 18 added here). Added rows by first verdict word: IN 9 (rows 100, 102, 104, 105, 106, 108, 111, 112, 115), OUT 6 (rows 99, 101, 103, 109, 113, 114), CUT 2 (rows 107, 110), not this area 1 (row 116). The 98 counts in the Summary are unchanged; the new rows add to them as listed above.
