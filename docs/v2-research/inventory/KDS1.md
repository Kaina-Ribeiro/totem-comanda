# Inventory KDS1

Spec root: `C:\Users\gabri\Desktop\totem\kds-functional-specifications\kds-functional-specifications\`
Model map: `C:\Users\gabri\Desktop\totem\MODELS.md` (sections 5, 8, 9 read; 5.20 example, 6, 7, 10 not read).
Comanda column: `docs/plan-next.md` (4 Nov 2026, v0.2 state). Scope legend as in the brief.
Merged rows: CFG-070..074 (one env row). Client-only flags (data-models.md:56) and README/checklist boilerplate are described in Notes, not as rows.

## Coverage

| File | Lines read | Total lines |
|:--|--:|--:|
| README.md | 165 | 165 |
| api-and-integrations.md | 110 | 110 |
| business-rules.md | 218 | 218 |
| configuration-and-settings.md | 97 | 97 |
| data-models.md | 204 | 204 |
| error-and-offline-handling.md | 114 | 114 |
| feature-checklist.md | 165 | 165 |
| features.md | 596 | 596 |
| functional-requirements.md | 188 | 188 |
| kitchen-workflows.md | 115 | 115 |
| order-lifecycle.md | 165 | 165 |
| printing-and-receipts.md | 108 | 108 |
| real-time-and-synchronization.md | 84 | 84 |
| screens-and-interactions.md | 334 | 334 |
| user-journeys.md | 190 | 190 |
| **Total** | **2853** | **2853** |

## Items

### README and scope boundaries

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| README-PURPOSE | README.md:10-20 | App purpose: monitor orders, accept, prepare, ready, dispatch, complete, cancel, no-show, refund, print, kitchen and aggregate views, loyalty scan, sold-out, history, report, POS sync (mixed scope, see rows) | n/a | platform | IN | | PART |
| README-SCOPE-1 | README.md:74-76 | No item-level preparation status; only item action is sold out on the menu, not the order | OrderItem (no status field) | kitchen | IN | | NO |
| README-SCOPE-2 | README.md:77-82 | No recall or reopen to an open status; closed orders still offer cancel menu and notify | n/a | kitchen | IN | | NO |
| README-SCOPE-3 | README.md:83-84 | "Delayed order" = age colouring of pending rows and time filters only; no SLA timer | n/a | kitchen | IN | | PART |
| README-SCOPE-4 | README.md:85-87 | No offline mode, no write queue; local storage only for device config, prefs, sign-in flag, language, last admin email, print-all options, printed-order record | n/a | platform | IN | | HAS |
| README-GAP-1 | README.md:94-97 | Defect: print-all options modal dependency injection; Print or Cancel likely throws. Do not copy | n/a | kitchen | HW | | NO |
| README-GAP-2 | README.md:98-101 | Defect: refund PENDING exclusion compares undefined property; unreachable in practice | n/a | backoffice | ? | | NO |
| README-GAP-3 | README.md:102-104 | Defect: `labelPerItem` template referenced, none exists; treat as unsupported | n/a | kitchen | HW | | NO |
| README-GAP-4 | README.md:105-107 | Defect: failed status PUT keeps optimistic status until a refresh or event (same as FEAT-022, BR-012) | Order.status | kitchen | IN | | PART (G-K12, v0.2 bug) |
| README-GAP-5 | README.md:108-110 | Defect: analytics "max orders reached" event fires with no UI | n/a | platform | EXT | | NO |
| README-GAP-6 | README.md:111-113 | Defect: detail footer cannot move ACCEPTED to READY; kitchen card can (BR-021, WF-3) | Order.status | kitchen | IN | | PART |
| README-GAP-7 | README.md:114-116 | Defect: notification textarea disabled in simplified mode; presets only | n/a | backoffice | ? | | NO |

### API and integrations

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| API-HDR | api-and-integrations.md:3-10 | Every /api call sends venue-id, app-version, cacheBuster; keep-alive header when stay-signed-in; elevated-login header on cancel and refund calls (FR-033) | n/a | platform | IN | | PART |
| API-ERR-GLOBAL | api-and-integrations.md:12-14 | Status handling: 401 logout + invalid-credentials toast; 402 server message; 403 not-authorized and clears user during order fetch; 409 loyalty; 500 server-error toast; other unknown-error toast | n/a | platform | IN | | PART |
| API-ERR-CODES | api-and-integrations.md:16-17 | App error codes PAYMENT_REFUNDED, REFUND_NOT_SUPPORTED, REFUND_CHARGE_NOT_FOUND, REFUND_AMOUNT_INVALID | n/a | backoffice | ? | | NO |
| API-NORETRY | api-and-integrations.md:17-18 | No automatic retries; only the 2 s throttled poll and manual or full refresh | n/a | platform | IN | | PART |
| API-01 | api-and-integrations.md:24 | Login: POST users/auth?permissions=system_update {username, password, domain} returns user and session (FEAT-001) | n/a | platform | IN | Y | PART |
| API-02 | api-and-integrations.md:25 | Revalidate session: GET users/auth on route guard | n/a | platform | IN | | PART |
| API-03 | api-and-integrations.md:26 | Logout: DELETE auth token; endpoint path Inferred | n/a | platform | ? | | ? |
| API-04 | api-and-integrations.md:27 | Session keep-alive GET /api/updateProxySession (every 3 h in main layout) | n/a | platform | IN | | ? |
| API-05 | api-and-integrations.md:28 | SSO providers list GET /api/domains/platform?app=... | n/a | platform | EXT | | NO |
| API-06 | api-and-integrations.md:29 | SSO domain detail GET /api/domains/{id} (OpenID config, shape Inferred) | n/a | platform | EXT | | NO |
| API-07 | api-and-integrations.md:30 | SSO token exchange POST users/auth/token/{domain} | n/a | platform | EXT | | NO |
| API-08 | api-and-integrations.md:31 | Admin venue list GET /api/venues?adminId&expand=outlets | n/a | platform | CUT (multi-store, rule 5) | | NO |
| API-09 | api-and-integrations.md:32 | Super-user venue search GET /api/venues?name (min 3 chars) | n/a | platform | CUT (multi-store, rule 5) | | NO |
| API-10 | api-and-integrations.md:33 | Venue load GET /api/venues/{id}?expand=settings,outlets,taxsettings | StoreConfigurationResponse (9.10); Tax (8.3) | bff | IN | | PART |
| API-11 | api-and-integrations.md:34 | Owner check GET /api/venues/{id}/owner; gates Items tab and re-auth | n/a | backoffice | IN | Y | PART |
| API-12 | api-and-integrations.md:35 | Feature flag GET /api/venues/{venueId}/features/{featureId}; any failure means off | n/a | platform | ? | | NO |
| API-13 | api-and-integrations.md:36 | Venue messages GET /api/venues/{id}/messages (PresetMessage list, cached per venue) | n/a | kitchen | ? (plan cut: customer messages) | | NO |
| API-14 | api-and-integrations.md:37 | Save lead time POST /api/venues/{id}/leadtime {leadTime, leadTimeTTL: null} | StoreConfigurationResponse.liveFlag (9.10) | kitchen | IN | | NO |
| API-15 | api-and-integrations.md:38 | List orders GET /api/orders with status csv, outletIds, offset; since=lastUpdate for incremental | SubmitOrderResponse (9.5) fields | bff | IN | | PART |
| API-16 | api-and-integrations.md:39 | Order detail GET /api/orders/{id}?expand=items,taxes,event,canRefund,payments,orderAwards,offers[,outlet][,locker] | SubmitOrderResponse (9.5) | bff | IN | | PART |
| API-17 | api-and-integrations.md:40 | Update status PUT /api/orders/{id} with full order including status and statusReason | n/a | kitchen | IN | | PART |
| API-18 | api-and-integrations.md:41 | Accept (charge) POST /api/orders/{id}/charge | Payment (8.8) | kitchen | ? (PENDING gate) | | NO |
| API-19 | api-and-integrations.md:42 | Reject POST /api/orders/{id}/reject {content, sms} | n/a | kitchen | ? | | NO |
| API-20 | api-and-integrations.md:43 | Notify customer POST /api/orders/{id}/notify {content, sms} | n/a | kitchen | ? (plan cut: customer messages) | | NO |
| API-21 | api-and-integrations.md:44 | Cancel POST /api/orders/{id}/cancel {statusReason} with elevated-login header, fire and forget | n/a | kitchen | IN | Y | NO |
| API-22 | api-and-integrations.md:45 | Payments to refund GET /api/orders/{id}/paymentstorefund (elevated header) | Payment (8.8) | backoffice | ? (refund) | | NO |
| API-23 | api-and-integrations.md:46 | Refund POST /api/orders/{id}/refund {orderRefund{type, amount, reason, paymentId, transaction}} | Payment (no refund model in v2) | backoffice | ? (refund) | | NO |
| API-24 | api-and-integrations.md:47 | Status history GET /api/orders/{id}/history returns {updated, status, statusReason}[] | n/a | kitchen | IN | | NO |
| API-25 | api-and-integrations.md:48 | Tracking URL GET /api/orders/{id}/trackingUrl | n/a | bff | ? | | NO |
| API-26 | api-and-integrations.md:49 | Complete orders PUT /api/orders/completeorders?venueId&listStatus&pickupTime (empty body) | n/a | kitchen | IN | | NO |
| API-27 | api-and-integrations.md:50 | History query GET /api/orders: status csv, orderBy=updated, limit=25, since, before, offset | n/a | backoffice | IN | | NO |
| API-28 | api-and-integrations.md:51 | Report query GET /api/orders: minCreated, maxCreated, status PENDING,PAID,READY,PREPARING,COMPLETED,NOSHOW,DELIVERED, no limit | n/a | backoffice | IN | | NO |
| API-29 | api-and-integrations.md:52 | Item sold out POST /api/items/{menuItemId}/soldout {id, availabilityType NEXT_AVAILABLE_DAY, availableDate null} | ITEM.available (5.9) | kitchen | IN | | NO |
| API-30 | api-and-integrations.md:53 | Modifier sold out POST /api/modifieritems/{modifierItemId}/soldout (includes modifierId) | ITEM.available (option) | kitchen | IN | | NO |
| API-31 | api-and-integrations.md:54 | Loyalty refund POST /api/loyalty/awards/refund | Award (8.10) | backoffice | CUT (loyalty, rule 5) | | NO |
| API-32 | api-and-integrations.md:55 | Loyalty validate GET /api/loyaltycampaigns/usercampaigns?barcode | n/a | kitchen | CUT (loyalty, rule 5) | | NO |
| API-33 | api-and-integrations.md:56 | Loyalty add stamps POST usercampaigns/{id}?sourceVenueId | n/a | kitchen | CUT (loyalty, rule 5) | | NO |
| API-34 | api-and-integrations.md:57 | Loyalty redeem POST usercampaigns/{id}/redeem {venueId}; 409 handled | n/a | kitchen | CUT (loyalty, rule 5) | | NO |
| API-35 | api-and-integrations.md:58 | POS light menu GET /api/menuposservice/venue/{id}/lightmenu | PosLightMenuItem (no v2) | backoffice | POS (rule 2) | | NO |
| API-36 | api-and-integrations.md:59 | Last sync execution GET menuposservice/.../lastexecution | n/a | backoffice | POS (rule 2) | | NO |
| API-37 | api-and-integrations.md:60 | Execute sync POST menuposservice/.../syncschedules/execute | n/a | backoffice | POS (rule 2) | | NO |
| API-38 | api-and-integrations.md:61 | Events list GET /api/venues/{id}/events?after&expand=allEventTimes,slots | n/a | kitchen | ? (events, plan cut) | | NO |
| API-39 | api-and-integrations.md:62 | Event slots GET /api/events/{id}/slots/available?scheduleStartDate | n/a | kitchen | ? (events, plan cut) | | NO |
| INT-BRIDGE-PRINT | api-and-integrations.md:70-78 | Native host bridge print: HTML, ESC_POS (line width 42, SunmiV2 32), raw data for host formatting, callback-id variant; bridge error toast 4 s | n/a | kitchen | HW | | NO |
| INT-BRIDGE-SETTINGS | api-and-integrations.md:74-78 | Bridge printer settings get and save, line-width save, Epson discovery 60 s, init(address, model), hasSettings gates Device Settings | n/a | kitchen | HW | | NO |
| INT-BROWSER-PRINT | api-and-integrations.md:80-81 | No bridge: system print dialog about 400 ms after render | n/a | kitchen | HW | | NO |
| INT-SCANNER | api-and-integrations.md:83-87 | Keyboard-wedge scanner: start char 120, Enter terminator, min length 4, about 40 ms per char; used by order search and loyalty | n/a | kitchen | ? (plan cut: scanner search) | | NO |
| INT-MAP | api-and-integrations.md:89-95 | Postcode link builds external maps directions URL; destination is customer address or lat/long; hidden for deleted users | Address (8.7) | kitchen | EXT | | NO |
| INT-SSO | api-and-integrations.md:97-99 | SSO popup: provider OpenID URL; return page posts params back; app exchanges at users/auth/token/{domain} | n/a | platform | EXT | | NO |
| INT-ERRTRACK | api-and-integrations.md:101-103 | Error-tracking service with venueId and outletIds context; env and release from build config; optional | n/a | platform | EXT | | NO |
| INT-ANALYTICS | api-and-integrations.md:105-106 | Analytics: page views per route and click events; optional | n/a | platform | EXT | | NO |
| INT-AUDIO | api-and-integrations.md:108-110 | HTML5 audio with bundled alarms (Light Bells, Foghorn, Honk Honk, Phone Ring) and autoplay permission flow | n/a | kitchen | IN | | NO |

### Business rules

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| BR-001 | business-rules.md:8-11 | Payment captured only on accept; PENDING shows "Payment will not be processed until you accept the order" | Payment (8.8) | kitchen | ? (no PENDING gate in plan) | | NO |
| BR-002 | business-rules.md:13-15 | Accept and Reject only on PENDING detail (UI); backend validation Unknown | n/a | kitchen | ? | | NO |
| BR-003 | business-rules.md:17-19 | Reject and notify need non-empty message; a preset counts as content | n/a | kitchen | ? | | NO |
| BR-004 | business-rules.md:21-23 | Preset type: PENDING uses ORDER_REJECT; other statuses use ORDER_NOTIFY | PresetMessage (no v2) | kitchen | ? | | NO |
| BR-005 | business-rules.md:25-27 | sms flag = 1 when SEND_SMS_ORDER_UPDATE is on, else 0 | n/a | kitchen | EXT (SMS vendor) | | NO |
| BR-006 | business-rules.md:29-33 | Cancel, no-show, refund need admin re-auth; user must own the configured venue; elevated id sent in header | n/a | backoffice | IN | Y | NO |
| BR-007 | business-rules.md:35-38 | Cancel menu hidden only for NOSHOW, CANCELLED, PENDING; shown for COMPLETED, REJECTED, DELIVERING too | n/a | kitchen | IN | | NO |
| BR-008 | business-rules.md:40-42 | No-show only when paymentType = CASH | Payment (no cash in v2) | kitchen | ? (no cash in plan) | | NO |
| BR-009 | business-rules.md:44-49 | Refundable when isRefundable and total minus refund > 0, or awards with refundUserId null; available = round2(total - refund) | n/a | backoffice | ? (refund) | | NO |
| BR-010 | business-rules.md:51-54 | Partial refund at most remaining balance (explicit max message); partial disabled for awards | n/a | backoffice | ? (refund) | | NO |
| BR-011 | business-rules.md:56-58 | Refund reasons: Out of stock (default), Customer cancellation, Customer complaint | n/a | backoffice | ? (refund) | | NO |
| BR-012 | business-rules.md:60-63 | Status transitions optimistic: set before PUT, blocking mask, no revert on error | Order.status | kitchen | IN | | PART |
| BR-013 | business-rules.md:65-68 | New-order alert only if not already known and status in OPEN set; PENDING excluded in simplified mode | n/a | kitchen | IN | | NO |
| BR-014 | business-rules.md:70-72 | Merge by updated timestamp: replace only when payload updated differs; dedupe by id (contradicts real-time doc, see Notes) | Order.updatedAt (contract proposal) | kitchen | IN | | PART |
| BR-015 | business-rules.md:74-76 | Incremental fetch at most once per 2 s; follow-up scheduled if one is in flight | n/a | kitchen | IN | | HAS |
| BR-016 | business-rules.md:78-81 | Initial load pages while page size >= limit (500 event venue, else 200); dedupe across pages | n/a | kitchen | IN | | ? |
| BR-017 | business-rules.md:83-85 | Time-window filter keeps orders with (pickupTime or created) before now + window; re-evaluated every 60 s | SubmitOrderRequest.pickupTime | backoffice | IN | | NO |
| BR-018 | business-rules.md:87-91 | Event expansion from 1 week ago; one entry per occurrence "DD/MM/YYYY HH:mm - name"; unknown eventIds fetched | n/a | backoffice | ? (events) | | NO |
| BR-019 | business-rules.md:93-95 | DELIVERING in closed group when DISPATCH_COMPLETE_ORDER on; in open group when off | OrderType.DELIVERY | kitchen | IN | | NO |
| BR-020 | business-rules.md:97-99 | Kitchen board = ACCEPTED, PAID, PREPARING; excludes PENDING and DELIVERY pending; sorted by pickupTime or created ascending | n/a | kitchen | IN | | PART |
| BR-021 | business-rules.md:101-104 | Footer gating: Preparing only from ACCEPTED; Ready only from PAID or PREPARING; With Driver needs new UI + DELIVERY + READY | Order.status | kitchen | IN | | PART |
| BR-022 | business-rules.md:106-111 | Complete-all sends listStatus ACCEPTED,PREPARING,READY,DELIVERING (no PAID) and pickupTime=now; exact backend selection Unknown | n/a | kitchen | IN | | NO |
| BR-023 | business-rules.md:113-115 | Auto-accept charges every PENDING order after each load or update when autoExcept on | n/a | kitchen | ? (PENDING gate) | | NO |
| BR-024 | business-rules.md:117-120 | Auto-print once per order per device (print store plus memory flag) | n/a | kitchen | HW | | NO |
| BR-025 | business-rules.md:122-124 | Print queue one job per 2 s; one job may carry N copies of one order | n/a | kitchen | HW | | NO |
| BR-026 | business-rules.md:126-129 | Receipt template order: ESC_POS emulation, then label, labelPerItem (missing), NEW_PRINTED_RECEIPT, default | n/a | kitchen | HW | | NO |
| BR-027 | business-rules.md:131-134 | Sold-out sets NEXT_AVAILABLE_DAY on menu item or modifier item; does not alter the order | ITEM.available (5.9) | kitchen | IN | | NO |
| BR-028 | business-rules.md:136-139 | Lead time Standard/Busy/Peak; 99999 means Closed Venue; TTL expiry falls back to Standard | StoreConfigurationResponse.liveFlag (9.10) | kitchen | IN | | NO |
| BR-029 | business-rules.md:141-143 | Service name fallback: pickupName or "COLLECTION ORDER"; deliverName or "DELIVERY ORDER"; toSeatName or "TO SEAT ORDER" | OrderType DINEIN (to-seat) | kitchen | IN | Y | NO |
| BR-030 | business-rules.md:145-147 | "Event Time" label when order has event and eventTime equals pickupTime; otherwise "Prepare by" | SubmitOrderRequest.dateToFire / pickupTime | kitchen | IN (event part ?) | | NO |
| BR-031 | business-rules.md:149-151 | Modifier order: by position ascending with flag (negatives and missing last); otherwise by id | OrderItem.position (8.2) | kitchen | IN | | ? |
| BR-032 | business-rules.md:153-155 | Items tab and owner check gate the POS sync view | n/a | backoffice | POS (rule 2) | Y | NO |
| BR-033 | business-rules.md:157-159 | Sync banner shown only if last run within 3 h; poll 30 s (5 s while running) | n/a | backoffice | POS (rule 2) | | NO |
| BR-034 | business-rules.md:161-164 | Loyalty: barcode validation; redeem clears card (409 means not enough cards); stamps 1 to 999, default 1 | Award (8.10) | kitchen | CUT (loyalty, rule 5) | | NO |
| BR-035 | business-rules.md:166-169 | Keypad search needs 3 or more digits and exact id match in loaded set; scanner hits open orders only | n/a | kitchen | ? (plan cut: order search on open board) | | NO |
| BR-036 | business-rules.md:171-173 | Every request carries venue-id; orders, venue data, messages, leadtime and POS data are venue-scoped | n/a | platform | CUT (multi-store, rule 5) | | NO |
| BR-037 | business-rules.md:176-179 | History query: status csv, orderBy=updated, limit 25, since or before, offset; append and dedupe; 500 ms throttle | n/a | backoffice | IN | | NO |
| BR-038 | business-rules.md:181-184 | Report: minCreated and maxCreated; status set includes DELIVERED, which is not in the status enum (see Notes) | n/a | backoffice | IN | | NO |
| BR-039 | business-rules.md:186-189 | CASH: currency badge, "Cash Order. Cash due on delivery/collection" block, change-required amount | Payment (no change field in v2) | kitchen | ? (no cash in plan) | | NO |
| BR-040 | business-rules.md:191-193 | PAID stamp without frame when venue country = NO | n/a | kitchen | ? (country rule; not Brazil) | | NO |
| BR-041 | business-rules.md:195-197 | Super user (system_update) gets venue name search (min 3 chars) instead of dropdown | n/a | platform | CUT (multi-store, rule 5) | Y | NO |
| BR-042 | business-rules.md:199-203 | Delivery address string: flatNumber, buildingName, "streetNumber address1", address2, address3, city, postcode, country; deleted user gives n/a | Address (8.7) | kitchen | IN | | NO |
| BR-043 | business-rules.md:205-207 | Account feature checks run in parallel at bootstrap; any failure means flag off | n/a | platform | ? | | NO |
| BR-044 | business-rules.md:209-211 | Quick-set: exactly one admin venue and one outlet means auto-save and proceed | n/a | platform | ? (device setup) | | NO |
| BR-045 | business-rules.md:213-215 | Any 401 deletes token and returns to login; 403 during order fetch clears user and routes to Settings | n/a | platform | IN | Y | PART |
| BR-046 | business-rules.md:217-218 | /api requests carry cacheBuster timestamp query parameter | n/a | platform | IN | | ? |

### Configuration and settings

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| CFG-001 | configuration-and-settings.md:13 | venueId (number, required); scopes every API call | n/a | platform | CUT (multi-store, rule 5) | | NO |
| CFG-002 | configuration-and-settings.md:14 | outletIds (number array); outlet filter and realtime channels; empty means venue channel | n/a | kitchen | ? (outlets) | | NO |
| CFG-003 | configuration-and-settings.md:15 | Currency ccy and symbol from venue; symbol if 1 char else "$" | n/a | platform | IN | | HAS (BRL via Intl) |
| CFG-004 | configuration-and-settings.md:16 | autoPrint: false or 1 to 10 copies; auto-print accepted orders | n/a | kitchen | HW | | NO |
| CFG-005 | configuration-and-settings.md:17 | autoExcept: auto-accept all PENDING orders (default false) | n/a | kitchen | ? | | NO |
| CFG-006 | configuration-and-settings.md:18 | Printer template default or label; labelPerItem unsupported; enables print-all modal | n/a | kitchen | HW | | NO |
| CFG-007 | configuration-and-settings.md:19 | accountId: feature-flag scope | n/a | platform | ? | | NO |
| CFG-008 | configuration-and-settings.md:20 | Order fetch expand list: items,taxes,event plus outlet and locker when flagged | n/a | platform | ? | | n/a |
| CFG-009 | configuration-and-settings.md:21 | Page limit 500 (event venue) or 200 (default) | n/a | platform | IN | | ? |
| CFG-010 | configuration-and-settings.md:22 | isEvent: event filter, phone hidden on receipts | n/a | kitchen | ? (events) | | NO |
| CFG-011 | configuration-and-settings.md:28 | Alarm sound key; default Foghorn; or NONE | AlarmPreferences (local) | kitchen | IN | | NO |
| CFG-012 | configuration-and-settings.md:29 | Alarm repeat 0 (once) to 600001 (infinite); slider step 15000 | AlarmPreferences (local) | kitchen | IN | | NO |
| CFG-013 | configuration-and-settings.md:30 | Hide alarm popup: show (default) or hide | AlarmPreferences (local) | kitchen | IN | | NO (plan: no hide-popup setting) |
| CFG-014 | configuration-and-settings.md:31 | Language: 23 locales; default browser exact, then prefix, then Catalan | n/a | platform | ? | | PART (PT and EN) |
| CFG-015 | configuration-and-settings.md:32 | Stay signed in flag; adds keep-alive header | n/a | platform | IN | | ? |
| CFG-016 | configuration-and-settings.md:33 | Last admin email, prefills re-auth | n/a | backoffice | IN | Y | NO |
| CFG-017 | configuration-and-settings.md:34 | Print-all options {printOnlyNew true, selectedStatus PREPARING, updateStatus} | PrintAllOptions (local) | kitchen | HW | | NO |
| CFG-018 | configuration-and-settings.md:35 | Legacy token key read once, moved to header, removed | n/a | platform | ? (legacy, not needed) | | n/a |
| CFG-019 | configuration-and-settings.md:36 | Printed-order store: order id to pickupTime or created | PrintStoreRecord | kitchen | HW | | NO |
| CFG-020 | configuration-and-settings.md:42 | Printer emulation: EscPos, StarLine, StarGraphic, Epson (plus series), SunmiV2 | PrinterSettings | kitchen | HW | | NO |
| CFG-021 | configuration-and-settings.md:43 | Printer address; hidden for SunmiV2 | PrinterSettings | kitchen | HW | | NO |
| CFG-022 | configuration-and-settings.md:44 | Line width: 42 default, 32 for SunmiV2; only when bridge supports it | PrinterSettings.lineWidth | kitchen | HW | | NO |
| CFG-030 | configuration-and-settings.md:50 | leadTime minutes; 99999 shows Closed Venue | StoreConfigurationResponse.liveFlag | kitchen | IN | | NO |
| CFG-031 | configuration-and-settings.md:51 | defaultLeadTime, busyLeadTime, peakLeadTime: Standard, Busy, Peak options | n/a | kitchen | IN | | NO |
| CFG-032 | configuration-and-settings.md:52 | leadTimeTTL: current leadTime applies while in future (venue timezone), else Standard | n/a | kitchen | IN | | NO |
| CFG-033 | configuration-and-settings.md:53 | trackingUrl enables Track drivers navbar link | n/a | bff | ? | | NO |
| CFG-034 | configuration-and-settings.md:54 | title: receipt header (store name) | StoreConfigurationResponse.locationName (9.10) | kitchen | IN | | PART (Loja name) |
| CFG-035 | configuration-and-settings.md:55 | deliveryPhone on receipt venue block | StoreConfigurationResponse.phone (9.10) | kitchen | IN | | NO (G-A20) |
| CFG-036 | configuration-and-settings.md:56 | pickupName, deliverName, toSeatName service-name overrides | OrderType DINEIN (to-seat) | kitchen | IN | Y | NO |
| CFG-037 | configuration-and-settings.md:57 | taxSettings.taxId printed as VAT No. on receipts | Tax (8.3); fiscal fields open | kitchen | ? (fiscal, phase 4) | | NO |
| CFG-038 | configuration-and-settings.md:58 | country NO removes PAID stamp border | n/a | kitchen | ? | | NO |
| CFG-039 | configuration-and-settings.md:59 | eventFlag: event filter, phone hidden on receipts, limit 500 | n/a | kitchen | ? (events) | | NO |
| CFG-040 | configuration-and-settings.md:60 | demoFlag: demo banner, modal, "** DEMO **" receipts | n/a | platform | ? (plan cut: demo mode) | | NO |
| CFG-041 | configuration-and-settings.md:61 | Timezone for TTL and event times (Inferred) | StoreConfigurationResponse hours (9.10) | platform | IN | | HAS (America/Sao_Paulo) |
| CFG-042 | configuration-and-settings.md:62 | Locale and currency for formatting | n/a | platform | IN | | HAS |
| CFG-050 | configuration-and-settings.md:68 | SEND_SMS_ORDER_UPDATE: notify and reject send sms=1 | n/a | kitchen | EXT (SMS) | | NO |
| CFG-051 | configuration-and-settings.md:69 | NEW_PRINTED_RECEIPT: new receipt template and modifier ordering | n/a | kitchen | HW | | NO |
| CFG-052 | configuration-and-settings.md:70 | TRACK_ORDER: track link on delivery orders | n/a | kitchen | ? | | NO |
| CFG-053 | configuration-and-settings.md:71 | LOYALTY_MANUAL_SCAN: scan loyalty button and modal | n/a | kitchen | CUT (loyalty, rule 5) | | NO |
| CFG-054 | configuration-and-settings.md:72 | DISPLAY_PROMOTION_NAMES: one discount line per promotion name | Discount (8.4, 9.2) | kitchen | IN | | NO |
| CFG-055 | configuration-and-settings.md:73 | SIMPLIFIED_ORDERS_SCREEN: reduced list, PENDING excluded, notes textarea disabled | n/a | kitchen | ? | | NO |
| CFG-056 | configuration-and-settings.md:74 | SOLD_OUT_ORDERS_SCREEN: sold-out buttons on items and modifiers | ITEM.available | kitchen | IN | | HAS (Esgotados, today only) |
| CFG-057 | configuration-and-settings.md:75 | DISPATCH_COMPLETE_ORDER: DELIVERING joins closed group | OrderType DELIVERY | kitchen | IN | | NO |
| CFG-058 | configuration-and-settings.md:76 | ORDERS_SCREEN_NEW_UI: new-UI body class; Ready labels; With Driver and Completed gating | n/a | kitchen | ? | | NO |
| CFG-059 | configuration-and-settings.md:77 | QR_CODE: QR block on receipts when trackingUrl exists; enables track link | n/a | kitchen | HW | | NO |
| CFG-060 | configuration-and-settings.md:78 | ORDERS_SCREEN_OUTLET_INFO: outlet expand, Location column and labels | n/a | kitchen | ? (outlets) | | NO |
| CFG-061 | configuration-and-settings.md:79 | LOCKER_INTEGRATION: locker expand, PIN column, locker panels | n/a | kitchen | ? (plan cut: locker pickup) | | NO |
| CFG-070-074 | configuration-and-settings.md:85-89 | Environment (merged row): API base URL; realtime key and cluster per environment; app version header; error-tracking DSN, env and release (EXT); analytics id (EXT). No values in spec | n/a | platform | IN | | PART |

### Data models: order

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| DM-ORDER-ID | data-models.md:10 | id (number), unique display and search key | SubmitOrderResponse.number (string) | kitchen | IN | | HAS |
| DM-ORDER-STATUS | data-models.md:11 | status enum: PENDING, ACCEPTED, PAID, PREPARING, READY, DELIVERING, COMPLETED, NOSHOW, REJECTED, CANCELLED, PAYMENT_FAILED | none (no status in v2) | kitchen | IN | | PART |
| DM-ORDER-STATUSREASON | data-models.md:12 | statusReason free text for cancel, reject, no-show (rendered sanitized HTML) | n/a | kitchen | IN | | NO |
| DM-ORDER-TYPE | data-models.md:13 | type enum: PICKUP (collection, default), DELIVERY, SEAT, VOUCHER | OrderType (8.1): SEAT maps to DINEIN; VOUCHER has no equivalent | kitchen | IN | Y | PART |
| DM-ORDER-PAYMENTTYPE | data-models.md:14 | paymentType: CASH or CARD (Inferred set) | Payment.tenderId (8.8); no cash concept | kitchen | ? (no cash in plan) | | NO |
| DM-ORDER-CREATED | data-models.md:15 | created datetime (receipt "Received") | SubmitOrderRequest.dateCreated (8.12) | kitchen | IN | | PART |
| DM-ORDER-UPDATED | data-models.md:16 | updated datetime: merge and dedupe cursor | n/a (proposed updatedAt, G-K3) | kitchen | IN | | NO |
| DM-ORDER-PICKUP | data-models.md:17 | pickupTime: collection or delivery target | SubmitOrderRequest.pickupTime (8.12) | kitchen | IN (pre-order conflict, see Notes) | | NO |
| DM-ORDER-PREPAREBY | data-models.md:18 | prepareByTime overrides pickupTime for "Prepare by" and kitchen time | SubmitOrderRequest.dateToFire (8.12) | kitchen | IN | | NO |
| DM-ORDER-DELIVERYTIME | data-models.md:19 | deliveryTime (Inferred, not provable from client) | n/a | kitchen | ? | | NO |
| DM-ORDER-SLOT | data-models.md:20 | pickupSlot name, bold in list | n/a | kitchen | ? | | NO |
| DM-ORDER-EVENT | data-models.md:21-23 | eventId, eventTime, event: presence enables Event labels; "Event Time" when eventTime equals pickupTime | n/a | kitchen | ? (events; plan cut: event pickup) | | NO |
| DM-ORDER-ITEMS | data-models.md:24 | items: OrderItem list (expand=items) | SubmitOrderRequest.items (8.11) | kitchen | IN | | HAS |
| DM-ORDER-TAXES | data-models.md:25 | taxes: Tax list (expand=taxes) | Tax (8.3) | kitchen | IN | | NO |
| DM-ORDER-SUBTOTAL | data-models.md:26 | subtotal money | TotalsRequest.subTotal (8.11) | backoffice | IN | | NO |
| DM-ORDER-DISCOUNT | data-models.md:27-28 | discount aggregate; discounts list with named lines (promotion-names flag) | Discount (8.4) | backoffice | IN | | NO |
| DM-ORDER-FEE | data-models.md:29 | fee money (fees on the order) | ServiceCharge (8.5) / serviceChargeTotal | backoffice | IN (conflicts with decision 16, see Notes) | Y | NO |
| DM-ORDER-TIP | data-models.md:30-32 | tip, driverTip (preferred for display), tips list (label fallback "Tip" or "Driver Tip") | Payment.tipAmount (8.8) | backoffice | IN | | NO |
| DM-ORDER-DONATED | data-models.md:33 | donated: charity donation money | Payment.donationAmount (8.8) | backoffice | IN | | NO |
| DM-ORDER-TAX | data-models.md:34 | tax: total tax | TotalsRequest.taxTotal (8.11) | backoffice | IN | | NO |
| DM-ORDER-TOTAL | data-models.md:35 | total money | TotalsRequest.total (8.11) | backoffice | IN | | NO |
| DM-ORDER-REFUND | data-models.md:36 | refund: refunded so far | n/a (no refund in v2) | backoffice | ? (refund) | | NO |
| DM-ORDER-PAID | data-models.md:37 | paid datetime or bool; drives PAID stamp | n/a | kitchen | IN | | NO |
| DM-ORDER-REFUNDABLE | data-models.md:38 | isRefundable: backend is authority for refund eligibility | n/a | backoffice | ? (refund) | | NO |
| DM-ORDER-VERIFICATION | data-models.md:39 | verificationCode: confirmation code, shown in simplified list and receipt | SubmitOrderResponse.customerCheckNumber (9.5) (mapping unsure) | kitchen | ? | | NO |
| DM-ORDER-USER | data-models.md:40 | user {name, phoneWithDialingCode, deleted?}; deleted gives n/a address | Customer (8.6) firstName, lastName, phoneNumber | kitchen | ? (rule 4 vs plan cut: guest name and contact) | | NO |
| DM-ORDER-DELIVERYADDR | data-models.md:41 | deliveryAddress, preferred over flat fields | Address (8.7) | kitchen | IN | | NO |
| DM-ORDER-FLATADDR | data-models.md:42 | Flat address fallback: flatNumber, buildingName, streetNumber, address1-3, city, postcode, country | Address (8.7) | kitchen | IN | | NO |
| DM-ORDER-NOTES | data-models.md:43 | notes: SPECIAL REQUESTS | SubmitOrderRequest.specialNotes (8.12) | kitchen | IN | | NO |
| DM-ORDER-DELIVERYNOTES | data-models.md:44 | deliveryNotes: DELIVERY REQUESTS | n/a (no v2 field) | kitchen | ? | | NO |
| DM-ORDER-OUTLET | data-models.md:45-46 | outletId and outlet (station; expand outlet) | n/a | kitchen | ? (outlets) | | NO |
| DM-ORDER-LOCKER | data-models.md:47 | locker object (expand locker) | n/a | kitchen | ? (plan cut: locker pickup) | | NO |
| DM-ORDER-TRACKING | data-models.md:48-49 | trackingUrl; qrCode generated client-side | n/a | kitchen | ? | | NO |
| DM-ORDER-DEMO | data-models.md:50 | demoFlag: "Demo Order" label | n/a | platform | ? (plan cut: demo mode) | | NO |
| DM-ORDER-ASAP | data-models.md:51 | asapFlag false shows "DELAY PREP" on new receipt | SubmitOrderRequest.dateToFire (absent means now) | kitchen | IN | | NO |
| DM-ORDER-CHANGE | data-models.md:52 | changeRequired money for cash orders | n/a | kitchen | ? (cash) | | NO |
| DM-ORDER-AWARDS | data-models.md:53 | awards list (expand orderAwards) | Award (8.10) | backoffice | CUT (loyalty, rule 5) | | NO |
| DM-ORDER-PAYMENTS | data-models.md:54 | payments list (expand payments) | Payment (8.8), IPayment (9.3) | backoffice | IN | | NO |
| DM-ORDER-HISTORY | data-models.md:55 | history: StatusHistoryEntry list via /history | n/a | kitchen | IN | | NO |

### Data models: order items, modifiers, venue, payments and other entities

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| DM-ITEM-MENUID | data-models.md:62 | menuItemId: groups aggregate view; sold-out target | OrderItem.id (8.2) | kitchen | IN | | PART |
| DM-ITEM-NAME | data-models.md:63-64 | internalName (display) and name (some templates) | OrderItem.name (8.2) | kitchen | IN | | HAS |
| DM-ITEM-QTY | data-models.md:65 | qty | OrderItem.quantity (8.2) | kitchen | IN | | PART |
| DM-ITEM-PRICE | data-models.md:66 | price and total money per item | OrderItem.itemPrice, totalPrice, total (8.2) | backoffice | IN | | NO |
| DM-ITEM-NOTES | data-models.md:67 | notes: "Special instructions" on the line | OrderItem.specialNotes (8.2) | kitchen | IN | | NO (G-T7) |
| DM-ITEM-MODIFIERS | data-models.md:68 | modifiers: list ordered by id, or by position with flag | OrderItem.modifiers, parentId, position (8.2) | kitchen | IN | | PART |
| DM-ITEM-MEAL | data-models.md:69, 84-85 | mealDealItems: nested item list under the parent, aggregated recursively | COMBO_MEAL, COMBO_MAIN, COMBO_SIDE (5.14); order-line shape not explicit | kitchen | IN | | NO |
| DM-ITEM-SOLDOUT | data-models.md:70 | soldOut bool, set client-side after the call | ITEM.available (5.9) | kitchen | IN | | NO |
| DM-MOD-ID | data-models.md:76 | Modifier id, default sort key | OrderItem.uniqueId (8.2) | kitchen | IN | | PART |
| DM-MOD-POSITION | data-models.md:77 | position: sort key with flag; negatives and missing last | OrderItem.position (8.2) | kitchen | IN | | NO |
| DM-MOD-ITEMID | data-models.md:78-79 | modifierItemId and modifierId: sold-out target and body fields | OrderItem.id plus parent uniqueId (8.2) | kitchen | IN | | NO |
| DM-MOD-PARENT | data-models.md:80 | parentId: nested styling | OrderItem.parentId (8.2) | kitchen | IN | | NO |
| DM-MOD-NAMEQTY | data-models.md:81-82 | internalName or name; qty above 1 shown as "name (xN)" | OrderItem.name, quantity (8.2) | kitchen | IN | | NO |
| DM-VENUE-ID | data-models.md:91 | Venue id | StoreConfigurationResponse (no id) | platform | CUT (multi-store, rule 5) | | NO |
| DM-VENUE-NAMES | data-models.md:92 | internalName and name; settings dropdown uses internal name | StoreConfigurationResponse.locationName (9.10) | platform | IN | | PART |
| DM-VENUE-SETTINGS | data-models.md:93, 106-116 | VenueSettings: title, leadTime, default, busy, peak, leadTimeTTL, trackingUrl, deliveryPhone, messages | StoreConfigurationResponse (9.10) | kitchen | IN | | PART |
| DM-VENUE-OUTLETS | data-models.md:94 | outlets list | n/a | kitchen | ? (outlets) | | NO |
| DM-VENUE-TAX | data-models.md:95-96 | taxSettings {taxId}; venue tax config object | Tax (8.3) | kitchen | ? (fiscal) | | NO |
| DM-VENUE-COUNTRY | data-models.md:97 | country string | n/a | platform | ? | | NO |
| DM-VENUE-ADDRESS | data-models.md:98 | address1-3, city, county, postcode for receipt header | Address (8.7); StoreConfigurationResponse | kitchen | IN | | NO |
| DM-VENUE-SERVICENAMES | data-models.md:99 | pickupName, deliverName, toSeatName | OrderType DINEIN (to-seat) | kitchen | IN | Y | NO |
| DM-VENUE-EVENTFLAG | data-models.md:100 | eventFlag above 0: event filter, hides phone, limit 500 | n/a | kitchen | ? (events) | | NO |
| DM-VENUE-DEMOFLAG | data-models.md:101 | demoFlag above 0: demo banner | n/a | platform | ? (plan cut: demo mode) | | NO |
| DM-VENUE-FEATURES | data-models.md:102-103 | accountId (flag scope); features string list (local) | n/a | platform | ? | | NO |
| DM-VENUE-OWNER | data-models.md:104 | owner bool via /owner endpoint | n/a | backoffice | IN | Y | PART |
| DM-OUTLET | data-models.md:118 | Outlet {id, name, locationId, locationName} for location label | n/a | kitchen | ? (outlets) | | NO |
| DM-EVENT | data-models.md:120-125 | Event {id, name, eventTimes, schedules to slots}; occurrence entry {eventId, eventTime, fullName, slots}; slot {name} | n/a | kitchen | ? (events, plan cut) | | NO |
| DM-PAYREC | data-models.md:129-137 | Payment record: id, action CHARGE, REFUND, PARTIAL_REFUND; status SUCCESS; amount; children refunds; canRefund; refunded (derived) | Payment (8.8) has no refund action | backoffice | ? (refund) | | NO |
| DM-TRANSACTION | data-models.md:139-141 | Derived refund transaction row {payment, amount, refunded, canRefund} | n/a | backoffice | ? (refund) | | NO |
| DM-AWARD | data-models.md:143-144 | Award {description, loyaltyProviderType, externalId, refundUserId} sent on loyalty refund | Award (8.10) | backoffice | CUT (loyalty, rule 5) | | NO |
| DM-DISCOUNTLINE | data-models.md:145-146 | Discount {name, discount} for promotion-name lines | Discount (8.4) | backoffice | IN | | NO |
| DM-TAXLINE | data-models.md:148 | Tax {displayName, taxRate, net, tax}: one line each plus total | Tax (8.3) taxRate, taxTotal, netTotal | kitchen | IN | | NO |
| DM-TIP | data-models.md:151 | Tip {label, amount}; label fallback "Tip" or "Driver Tip" | Payment.tipAmount (8.8) | backoffice | IN | | NO |
| DM-LOCKER | data-models.md:153-154 | Locker {lockerId, operatorKey (PIN), address, pickupSlot} | n/a | kitchen | ? (plan cut: locker pickup) | | NO |
| DM-STATUSHISTORY | data-models.md:156 | StatusHistoryEntry {updated, status, statusReason} | n/a | kitchen | IN | | NO |
| DM-PRESET | data-models.md:158-159 | PresetMessage {type ORDER_REJECT or ORDER_NOTIFY, name, content}; label = name or first 20 chars | n/a | kitchen | ? (plan cut: customer messages) | | NO |
| DM-DEVCONFIG | data-models.md:161-165 | DeviceConfiguration in local storage: venueId, outletIds, ccy, autoPrint, autoExcept, template, limit, isEvent | n/a | platform | ? (device pairing) | | PART (Aparelhos) |
| DM-ALARMPREF | data-models.md:167-170 | AlarmPreferences {sound, repeatMs, hidePopup} | n/a | kitchen | IN | | NO |
| DM-PRINTSTORE | data-models.md:172-173 | PrintStoreRecord: order id to pickupTime or created | n/a | kitchen | HW | | NO |
| DM-PRINTERSET | data-models.md:176-178 | PrinterSettings {address, model, lineWidth} | n/a | kitchen | HW | | NO |
| DM-PRINTALL | data-models.md:180-182 | PrintAllOptions {printOnlyNew, selectedStatus, updateStatus (name Inferred)} | n/a | kitchen | HW | | NO |
| DM-LOYALTYCAMP | data-models.md:184-185 | LoyaltyUserCampaign {id, barcode, card state} | n/a | kitchen | CUT (loyalty, rule 5) | | NO |
| DM-POSLIGHT | data-models.md:187 | PosLightMenuItem {id, name, price, available} | ITEM.available (5.9) partial | backoffice | POS (rule 2) | | NO |
| DM-SYNCEXEC | data-models.md:189-191 | SyncExecution: status IN_PROGRESS, PENDING, COMPLETED, COMPLETED_WITH_ERRORS, FAILED; createdLocalDateTime; details | n/a | backoffice | POS (rule 2) | | NO |
| DM-USER | data-models.md:193-195 | User or session {id, email, permissions system_update, venue admin list}; token in Authorization header | n/a | platform | IN | Y | PART |

### Features

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| FEAT-001 (FR-001) | features.md:14-30 | Password login: email and password; POST auth with domain and system_update; failure toast "Incorrect username or password" and device config cleared | n/a | platform | IN | Y | PART |
| FEAT-002 (FR-002) | features.md:32-46 | SSO: provider buttons from platform list; popup flow; token exchange; section hidden when no providers | n/a | platform | EXT | | NO |
| FEAT-003 (FR-003) | features.md:48-55 | Stay signed in (persisted) adds keep-alive header; keep-alive call every 3 h in main layout | n/a | platform | IN | | ? |
| FEAT-004 (FR-028) | features.md:57-63 | Language: 23 locales; resolution order stored, browser exact, browser prefix, Catalan | n/a | platform | ? | | PART |
| FEAT-005 (FR-029) | features.md:65-71 | Logout with "Are you sure?"; token DELETE; clears config and orders; stops keep-alive | n/a | platform | IN | | ? |
| FEAT-006 (FR-004) | features.md:77-91 | Device config screen: venue dropdown, outlet checkboxes, printer template, auto-accept, auto-print copies 1 to 10; "A venue is required" toast; no-venue sticky error | n/a | platform | ? (device setup) | | NO |
| FEAT-007 (FR-004) | features.md:93-98 | Quick-set: exactly one venue and one outlet auto-saves and proceeds | n/a | platform | ? | | NO |
| FEAT-008 (FR-004) | features.md:100-107 | Super-user venue search by name, min 3 chars ("Name must have at least 3 characters") | n/a | platform | CUT (multi-store, rule 5) | Y | NO |
| FEAT-009 (FR-005) | features.md:113-130 | Order list columns: #, PIN, type icon (collection, delivery, to-seat, voucher; cash badge), notes, location, details, status (hidden for PENDING and ACCEPTED), time; "Showing X of Y open orders"; "No Results"; row flash on updated | n/a | backoffice | IN | Y | NO |
| FEAT-010a (FR-008) | features.md:132-141 | Pending bar "N order(s) waiting to be accepted (click to view)" and carousel sorted by pickup time (none last, id tie-break), "i of N" | n/a | kitchen | ? (pending flow not in plan) | | NO |
| FEAT-010b (FR-008) | features.md:142-146 | Pending row ageing: banner "NEW ORDER REQUIRING CONFIRMATION"; states A about 30 s, B about 60 s, C; older than 60 s starts at C | n/a | kitchen | ? (pending) | | NO |
| FEAT-011 (FR-006) | features.md:148-166 | Filters: all open, by event (event venues), time windows (under 30 min, 1 h, 2 h, 3 h, today, 24 h, 2 days, week); outlet dropdown; event and slot dropdowns | SubmitOrderRequest.pickupTime (time windows) | backoffice | IN (events and outlets ?) | | NO |
| FEAT-012 (FR-007) | features.md:168-170 | Sorting: header click sorts, second click reverses; default pickupTime or created ascending | n/a | backoffice | IN | | NO |
| FEAT-013 (FR-010) | features.md:172-176 | Numeric keypad search: 3 or more digits, exact open-order id opens detail | n/a | kitchen | ? (plan cut: order search on open board) | | NO |
| FEAT-014 (FR-010) | features.md:178-185 | Barcode-scanner order search; "No open order found for number X" warning 3 s; suspended during loyalty modal | n/a | kitchen | ? (plan cut: scanner search) | | NO |
| FEAT-015 | features.md:191-202 | Simplified list (flag SIMPLIFIED_ORDERS_SCREEN): #, code, type, notes, name, time; inline Ready, Complete, Notify; PENDING never listed or alerted; alarm on ACCEPTED | n/a | kitchen | ? | | NO |
| FEAT-016 (FR-009) | features.md:208-217 | New-order alert: alarm with repeat; tab title flashes "N New Order(s)" and "Orders"; badge; popup "You received N new order(s)" unless hidden; reset on select, OK or kitchen action | n/a | kitchen | IN | | NO |
| FEAT-017 (FR-009) | features.md:219-227 | Alarm preferences: enable, sound (Light Bells, Foghorn default, Honk Honk, Phone Ring, None), repeat slider labels Once, N seconds, N minutes, Infinite; Hide Popup | AlarmPreferences | kitchen | IN | | NO |
| FEAT-018 (FR-009) | features.md:229-234 | Autoplay modal: if sound not ready within 1 s, ask "Would you like to play a sound when new orders arrive?"; No sets None | n/a | kitchen | IN | | NO |
| FEAT-019a | features.md:240-251 | Detail header and service banner: close (button, ESC, backdrop, re-click toggles); Print; cancel-menu hidden for NOSHOW, CANCELLED, PENDING; title "#id: customer name"; service name by type (delivery, to-seat, VOUCHER, collection) | OrderType; BR-029 | kitchen | IN | Y | NO |
| FEAT-019b | features.md:252-262 | Detail content: locker panel, PAID stamp, verification code, Demo label, address, postcode map link, telephone, event name, Prepare by or Event Time, Delivery by, slot, Track order, API-unavailable alert | Address (8.7); dateToFire | kitchen | ? (mixed: address and prepare-by IN; locker, events, slot, demo ?) | | NO |
| FEAT-019c | features.md:263-266 | Detail items: "qty x name", price; per-item and per-modifier Sold out (hidden once sold out); "name (xN)"; nested style; meal-deal items; Special instructions | OrderItem (8.2) | kitchen | IN | | PART |
| FEAT-019d | features.md:267-268 | Notes blocks: SPECIAL REQUESTS (order notes) and DELIVERY REQUESTS (delivery notes) | specialNotes (8.12); no delivery-note field | kitchen | IN | | NO |
| FEAT-019e | features.md:269-272 | Totals block: Subtotal; discount lines; Fees; each tax; Driver Tip or Tip; Donation; Total; Refund and Remaining | TotalsRequest (8.11); ServiceCharge (8.5) | backoffice | IN | Y | NO |
| FEAT-019f | features.md:273-274 | Cash block: "Cash Order. Cash due on delivery/collection" and change amount | n/a | kitchen | ? (cash) | | NO |
| FEAT-020 | features.md:276-282 | Accept (charge) on PENDING: warning text; POST charge; PAYMENT_REFUNDED alert text; other errors "API unavailable" | Payment (8.8) | kitchen | ? (PENDING gate) | | NO |
| FEAT-021 | features.md:284-288 | Reject: opens notification panel; POST reject {content, sms} | n/a | kitchen | ? | | NO |
| FEAT-022a | features.md:290-296 | Footer actions: Preparing only from ACCEPTED; Ready from PAID or PREPARING (labels Ready for Delivery or Ready for Collection); With Driver (new UI, DELIVERY, READY); Completed per flag | Order.status | kitchen | IN | | PART |
| FEAT-022b | features.md:297-302 | Mechanics: optimistic local status; PUT full order with expands preserved; blocking mask; failure keeps local status (gap 4) (FR-013) | n/a | kitchen | IN | | PART |
| FEAT-023 (FR-014) | features.md:304-314 | Cancel with admin re-auth: cancel menu, embedded login (last email prefilled), owner check, Cancel order, notes, "Confirm cancellation"; errors "Incorrect username or password" and "Sorry, you do not have sufficient access privileges..."; then History | n/a | kitchen | IN | Y | NO |
| FEAT-024 (FR-014) | features.md:316-319 | No-show, CASH only: "Mark as no show", notes, status NOSHOW with reason | n/a | kitchen | ? (cash) | | NO |
| FEAT-025 (FR-015) | features.md:321-343 | Refund: transaction list, Partial or Full, amount at most remaining (max message), reasons, confirmation "Are you sure you want to refund <amount> to the customer? This action cannot be undone.", result panel; award refund via loyalty | Payment (8.8); no refund model | backoffice | ? (refund, phase 4) | | NO |
| FEAT-026 (FR-012) | features.md:345-358 | Customer notifications: required text or preset (ORDER_REJECT for PENDING, ORDER_NOTIFY else; label = name or first 20 chars); success toast "Message sent" 2 s; error "Error: API Unavailable, please try again later." | n/a | kitchen | ? (plan cut: customer messages) | | NO |
| FEAT-027 (FR-016) | features.md:360-363 | Status history table Date, Time, Status, Notes; fetched once per order per session | n/a | kitchen | IN | | NO |
| FEAT-028 (FR-017) | features.md:365-377 | Sold-out item or modifier with NEXT_AVAILABLE_DAY; button hides on success; error "Error making (modifier) item sold out, please try again." | ITEM.available (5.9) | kitchen | IN | | NO |
| FEAT-029 (FR-018) | features.md:379-383 | Track order: fetch trackingUrl if absent; new tab; failure "Error : API Unavailable..." | n/a | kitchen | ? | | NO |
| FEAT-030 (FR-018) | features.md:385-389 | QR code on receipt with text "Use QR code to track the delivery." | n/a | kitchen | HW | | NO |
| FEAT-031 (FR-018) | features.md:391-396 | Locker integration: PIN column, locker icon, locker panel, receipt "Locker Details" block | n/a | kitchen | ? (plan cut: locker pickup) | | NO |
| FEAT-032 (FR-018) | features.md:398-403 | Location label: locker id, else outlet name plus location; cached per order | n/a | kitchen | ? (outlets) | | NO |
| FEAT-033 (FR-019) | features.md:409-419 | Complete all: confirm "This will change the status of all past, open orders to COMPLETED. Are you sure you want to continue?"; disabled with no orders; error "Server internal error" 5 s | n/a | kitchen | IN | | NO |
| FEAT-034 (FR-020) | features.md:421-435 | Print all: default template prints filtered list by pickup; other templates open options modal (only-new, update status to Preparing); known injection defect | n/a | kitchen | HW | | NO |
| FEAT-035 (FR-020) | features.md:437-439 | Single order print with copies = auto-print copies or 1 | n/a | kitchen | HW | | NO |
| FEAT-036 (FR-021) | features.md:441-444 | Auto-accept: charges every PENDING after each load or update (fire and forget) | n/a | kitchen | ? (PENDING gate) | | NO |
| FEAT-037 (FR-021) | features.md:446-450 | Auto-print: each unprinted ACCEPTED order printed once per device with 1 to 10 copies | n/a | kitchen | HW | | NO |
| FEAT-038 (FR-022) | features.md:456-465 | Kitchen view: header "Pending Orders: N"; cards for ACCEPTED, PAID, PREPARING; header, body and footer (see SCR-005 rows) | Order.status | kitchen | IN | Y | PART (3 columns) |
| FEAT-039 (FR-022) | features.md:467-472 | Aggregate view: sums by menuItemId across ACCEPTED, PAID, PREPARING; variants by joined modifier ids; recursive meal deals; sorted by name | OrderItem (8.2) | kitchen | IN | | NO |
| FEAT-040 | features.md:474-485 | Lead-time dropdown: "Preparation time: <name> (<min> mins)" or "Closed Venue" at 99999; Standard, Busy, Peak; POST leadtime; TTL-aware; hidden for event venues | StoreConfigurationResponse.liveFlag | kitchen | IN | | NO |
| FEAT-041 | features.md:487-490 | Track drivers navbar link when venue.settings.trackingUrl exists | n/a | kitchen | ? | | NO |
| FEAT-042 | features.md:496-510 | History: filter All closed or Cancelled; date Latest, under 24 h, Custom (default now minus 24 h to now, Go); 25 per page; Load more; 500 ms throttle; realtime merges; closed orders still actionable | n/a | backoffice | IN | | NO |
| FEAT-043 | features.md:512-518 | Report: From and To default now minus 8 h to now; GO; Orders count, Total, Discount, aggregated items | n/a | backoffice | IN | | NO |
| FEAT-044 | features.md:524-542 | Loyalty manual scan: SCAN, KEYBOARD, CHOOSE_OPTION, REDEEM, STAMPS (1 to 999, default 1), SUCCESS, ERROR; 409 "Unable to redeem award, not enough cards" | Award (8.10) | kitchen | CUT (loyalty, rule 5) | | NO |
| FEAT-045 | features.md:548-563 | Items tab (owner only): unavailable items table 20 per page; Last Sync; Sync now confirm "Sync process duration can take up to 10 minutes."; banners; polling 30 s or 5 s | n/a | backoffice | POS (rule 2) | Y | NO |
| FEAT-046 | features.md:569-574 | Demo banner "You are currently running in demo mode >" and modal | n/a | platform | ? (plan cut: demo mode) | | NO |
| FEAT-047 | features.md:576-580 | Toast area: sticky, per-route, next-route lifetimes; dismissable | n/a | platform | IN | | PART |
| FEAT-048 (FR-003) | features.md:582-584 | Session keep-alive: GET /api/updateProxySession every 3 h in main layout | n/a | platform | IN | | ? |
| FEAT-049 (FR-032) | features.md:586-590 | White-label theming: logo, login background, favicon, CSS override per deployment | n/a | platform | CUT (multi-brand, rule 5) | | NO |
| FEAT-050 (FR-032) | features.md:592-596 | Telemetry (optional): analytics events and error tracking with venue context; app works without | n/a | platform | EXT | | NO |

### Screens

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| SCR-001-ENTRY | screens-and-interactions.md:17-28 | Shell on entry: redirect to Settings if no device config; loader; 13 account flags checked in parallel (failure means off); owner check gates Items tab; keep-alive starts (FR-030) | n/a | platform | IN | | ? |
| SCR-001-NAV | screens-and-interactions.md:30-39 | Navbar: tabs List (badge), Kitchen, Aggregate, Report, History, Items (owner); lead-time dropdown; Track drivers link; alarm bell; refresh (full reload); venue menu: Settings, Device Settings (bridge only), Logout "Are you sure?" | n/a | kitchen | IN | | PART |
| SCR-001-MOBILE | screens-and-interactions.md:41-42 | Mobile: hamburger; badge, refresh and "Orders" brand stay visible; menu collapses on route change | n/a | platform | IN | | ? |
| SCR-001-OVERLAYS | screens-and-interactions.md:44-50 | Overlays: blocking mask (order action, lead-time save), spinner, toast area, hidden print canvas, autoplay modal, printer settings modal | n/a | platform | IN | | PART |
| SCR-001-GUARD | screens-and-interactions.md:52-55 | Route guard: no user means GET auth; failure clears config, stops keep-alive, goes to login; data-view attribute; analytics page view | n/a | platform | IN | | PART |
| SCR-002 | screens-and-interactions.md:59-71 | Login: language selector; email and password validation; "Signing in..." state; stay signed in; SSO buttons when configured; redirect to requested route | n/a | platform | IN (SSO EXT) | Y | PART |
| SCR-003 | screens-and-interactions.md:75-93 | Order list full mode: red pending bar; action row (Scan loyalty, Complete all, Print all, Search); filter row; counter; columns; row states; "No Results"; new-order popup (SCR-012c) | n/a | backoffice | IN | Y | NO |
| SCR-004 | screens-and-interactions.md:97-103 | Simplified list: columns #, code, type, notes, name, time; inline Ready, Complete, Send notification; no pending bar, no batch buttons | n/a | kitchen | ? | | NO |
| SCR-005-HEADER | screens-and-interactions.md:109-113 | Kitchen board header "Pending Orders: N". Card header: location label (outlet-info flag, not locker) or Locker id and Pin; "#id"; calendar time; type icon (locker icon for lockers) | Order type (DINEIN for to-seat); pickupTime | kitchen | IN | Y | PART |
| SCR-005-BODY | screens-and-interactions.md:114-115 | Card body: items "qty x name"; nested modifiers (nested style for children); meal-deal items; "SPECIAL REQUESTS" block for order notes | OrderItem.modifiers, specialNotes (8.2, 8.12) | kitchen | IN | | PART |
| SCR-005-FOOTER | screens-and-interactions.md:116-118 | Card footer: "Preparing" (hidden when PREPARING; sets PREPARING, dismisses alert); "READY" or "Ready for Collection" or "Ready for Delivery" (sets READY; card leaves board) | Order.status | kitchen | IN | | PART |
| SCR-005-EMPTY | screens-and-interactions.md:119 | Empty board: spinner while requests pending; no empty-state text | n/a | kitchen | IN | | NO |
| SCR-005-GAP (absent) | screens-and-interactions.md:112-113 | Absent on the card: no table number, seat, guest count, waiter or check element. To-seat appears only as a type icon and service name (BR-029) | none in KDS; v2 has IPosCheck.guestCount, employeeId, displayText (9.7) | kitchen | ? (table scope unknown) | Y | NO |
| SCR-006 | screens-and-interactions.md:123-126 | Aggregate view: summed "qty x name" rows with muted variant rows; sorted by name; read-only | OrderItem (8.2) | kitchen | IN | | NO |
| SCR-007-MAIN | screens-and-interactions.md:130-153 | Detail main panel: header (close, print, cancel menu, "#id: name", created date, status link); service banner and cash badge; locker panel; PAID stamp; verification code; Demo label; address and postcode link; phone; event; Prepare by or Event Time; Delivery by; slot; Track order; items with Sold out; SPECIAL REQUESTS and DELIVERY REQUESTS; totals; cash block | mixed | kitchen | ? (mixed) | | NO |
| SCR-007-PENDING | screens-and-interactions.md:155-156 | PENDING footer: payment warning, Accept (charge), Reject (opens notification panel) | Payment (8.8) | kitchen | ? | | NO |
| SCR-007-FOOTER | screens-and-interactions.md:158-160 | Non-PENDING footer: Preparing (ACCEPTED), Ready (PAID, PREPARING), With Driver, Completed (per FEAT-022), Send Notification | Order.status | kitchen | IN | | PART |
| SCR-007-SUB | screens-and-interactions.md:162-177 | Sub-panels: status history table; notification panel (required textarea, presets, Send, Back); cancel menu (Cancel order, Refund order, Mark as no show); admin re-auth; cancel and no-show confirmations; refund panel; result panel | n/a | kitchen | IN (cancel, history) / ? (refund, notes) | Y | NO |
| SCR-008 | screens-and-interactions.md:181-186 | Refund panel: transaction radios; Partial or Full; amount with money mask; reason select; Submit, confirmation, result with Try again and Done | n/a | backoffice | ? (refund, phase 4) | | NO |
| SCR-009 | screens-and-interactions.md:190-194 | Report view /report: From and To default now minus 8 h to now; GO; Orders, Total, Discount, aggregated items | n/a | backoffice | IN | | NO |
| SCR-010 | screens-and-interactions.md:198-204 | Numeric keypad 1-9, C, 0, backspace; 3 or more digits with exact match opens detail; no match stays editable | n/a | kitchen | ? (plan cut: order search on open board) | | NO |
| SCR-011 | screens-and-interactions.md:208-212 | Pending carousel: each PENDING as full detail; "i of N"; prev and next; ESC or backdrop closes; index clamped on list change | n/a | kitchen | ? (pending) | | NO |
| SCR-012a | screens-and-interactions.md:218-219 | Complete-all confirm text, Cancel or Continue | n/a | kitchen | IN | | NO |
| SCR-012b | screens-and-interactions.md:220 | Print-all confirm "This will print all open orders..." | n/a | kitchen | HW | | NO |
| SCR-012c | screens-and-interactions.md:221 | New-order popup "You received N new order(s)" with OK (hidden when Hide Popup) | n/a | kitchen | IN | | NO |
| SCR-012d | screens-and-interactions.md:222 | Print-all options modal for non-default template | n/a | kitchen | HW | | NO |
| SCR-013 | screens-and-interactions.md:226-230 | Autoplay permission modal: "Would you like to play a sound when new orders arrive?" No (sets None) or Yes | n/a | kitchen | IN | | NO |
| SCR-014 | screens-and-interactions.md:234-240 | Alarm bell dropdown: Hide Popup; repeat slider; sound list with preview; persists per device | AlarmPreferences | kitchen | IN | | NO |
| SCR-015 | screens-and-interactions.md:244-250 | Preparation-time dropdown in navbar: current name and minutes or Closed Venue; Standard, Busy, Peak; POST leadtime; blocking mask | StoreConfigurationResponse.liveFlag | kitchen | IN | | NO |
| SCR-016 | screens-and-interactions.md:254-257 | Demo mode modal: explains venue not live; OK | n/a | platform | ? (plan cut: demo mode) | | NO |
| SCR-017 | screens-and-interactions.md:261-269 | Printer settings modal: emulation select; address; line width; Epson Find Printer (60 s); saves "Epson_<series>"; width resets on emulation change | PrinterSettings | kitchen | HW | | NO |
| SCR-018 | screens-and-interactions.md:273-278 | Print-all options modal: only-new (default on); update-status checkbox and select; Cancel or Print | PrintAllOptions | kitchen | HW | | NO |
| SCR-019 | screens-and-interactions.md:282-285 | Toast area: stacked info, warning, danger banners; dismissable; dwell auto-dismiss | n/a | platform | IN | | PART |
| SCR-020 | screens-and-interactions.md:289-297 | Loyalty modal: SCAN, KEYBOARD, CHOOSE_OPTION, REDEEM confirm, STAMPS 1-999, SUCCESS, ERROR; close blocked during requests | Award (8.10) | kitchen | CUT (loyalty, rule 5) | | NO |
| SCR-021 | screens-and-interactions.md:301-307 | Items tab (owner only): unavailable items table 20 per page; sync schedule; Sync now confirm; banner; FAILED ITEMS modal | n/a | backoffice | POS (rule 2) | Y | NO |
| SCR-022 | screens-and-interactions.md:311-323 | Settings screen: venue select or super-user search; outlet checkboxes; printer template Default or Label Printer; Advanced (auto-accept, auto-print with copies 1 to 10); Save (venue required), Cancel, Logout; quick-set; no-venue error | n/a | platform | ? (device pairing; multi-venue CUT) | | PART (Aparelhos) |
| SCR-ROLE | screens-and-interactions.md:327-334 | Role summary: owner check gates Items tab and re-auth; super user gets search; admin re-auth requires owner; demo venue effects | n/a | platform | IN | Y | PART |

### Kitchen workflows

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| WF-1 | kitchen-workflows.md:10-22 | New order arrival: alarm, title flash, badge, popup; "new" means not known and status in OPEN set (simplified: non-PENDING) | n/a | kitchen | IN | | NO |
| WF-2 | kitchen-workflows.md:24-29 | Accept single order: POST charge; ACCEPTED merges and closes; auto-print may follow | Payment (8.8) | kitchen | ? (PENDING gate) | | NO |
| WF-3 | kitchen-workflows.md:31-42 | Preparation pipeline ACCEPTED to PREPARING to READY; READY from ACCEPTED, PAID or PREPARING via card but only PAID or PREPARING via footer; card leaves board at READY | Order.status | kitchen | IN | | PART |
| WF-4 | kitchen-workflows.md:44-50 | Handover: READY non-delivery to COMPLETED; READY delivery plus new UI to DELIVERING to COMPLETED; external driver apps may complete | n/a | kitchen | IN | | NO |
| WF-5 | kitchen-workflows.md:52-59 | Batch completion at close: complete-all PUT with listStatus and pickupTime; success full reload; error toast | n/a | kitchen | IN | | NO |
| WF-6 | kitchen-workflows.md:61-65 | Alert dismissal on select, OK or kitchen action resets counter, sound, title flash, badge | n/a | kitchen | IN | | NO |
| WF-7 | kitchen-workflows.md:67-74 | Correction flows: cancel and no-show (admin re-auth), refund (status unchanged), reject (PENDING only) | n/a | kitchen | IN (cancel) / ? (others) | | NO |
| WF-8 | kitchen-workflows.md:76-83 | Automatic flows: auto-accept every PENDING; auto-print each ACCEPTED once per device; auto-accept feeds auto-print | n/a | kitchen | ? (auto-accept) / HW (auto-print) | | NO |
| WF-9 | kitchen-workflows.md:85-88 | Item availability: sold-out from detail changes menu availability, not order state | ITEM.available | kitchen | IN | | NO |
| WF-10 | kitchen-workflows.md:90-94 | Lead time and closed mode changes propagate via settings-update events | StoreConfigurationResponse.liveFlag | kitchen | IN | | NO |
| WF-11 | kitchen-workflows.md:96-101 | Refresh and recovery: manual refresh, main view entry or full-refresh event resets collection (lastUpdate 0, alerting off), reloads, re-enables alerting | n/a | kitchen | IN | | PART |
| WF-12 | kitchen-workflows.md:103-107 | Aggregate preparation: totals across in-progress orders; read-only; no item statuses | OrderItem (8.2) | kitchen | IN | | NO |
| WF-MULTI | kitchen-workflows.md:109-115 | Multi-device: shared backend and channels; each action is an API write with no lock; last write wins (Inferred); fetch merge uses updated | n/a | platform | IN | | PART |

### Order lifecycle

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| OL-STATUS | order-lifecycle.md:5-21 | 11 statuses with meanings; DELIVERING shown as OUT_FOR_DELIVERY; display-only award states ISSUED, EXPIRED, REDEEMED, INCOMPLETE | none | kitchen | IN | | PART |
| OL-GROUPS | order-lifecycle.md:25-35 | Groups: Open (PENDING, ACCEPTED, PAID, READY, PREPARING, plus DELIVERING if flag off); Closed (COMPLETED, NOSHOW, REJECTED, CANCELLED, PAYMENT_FAILED, plus DELIVERING if flag on); kitchen = ACCEPTED, PAID, PREPARING | n/a | kitchen | IN | | NO |
| OL-T-PENDING | order-lifecycle.md:41-44 | PENDING to ACCEPTED via Accept (charge), auto-accept or external source | Payment (8.8) | kitchen | ? | | NO |
| OL-T-REJECT | order-lifecycle.md:42 | PENDING to REJECTED with message | n/a | kitchen | ? | | NO |
| OL-T-PREP | order-lifecycle.md:45, 48 | ACCEPTED or PAID to PREPARING via PUT | Order.status | kitchen | IN | | PART |
| OL-T-READY | order-lifecycle.md:46, 49 | PAID or PREPARING to READY via footer or card; ACCEPTED to READY via kitchen card only; card leaves board | Order.status | kitchen | IN | | PART |
| OL-T-COMPLETEALL | order-lifecycle.md:47 | ACCEPTED, PREPARING, READY, DELIVERING to COMPLETED by complete-all (pickup before now, Inferred) | n/a | kitchen | IN | | NO |
| OL-T-DRIVER | order-lifecycle.md:50-52 | READY to DELIVERING (With Driver: new UI, DELIVERY); DELIVERING or READY to COMPLETED | n/a | kitchen | IN | | NO |
| OL-T-COMPLETED | order-lifecycle.md:53 | Any open non-PENDING status to COMPLETED when new-UI flag is off | n/a | kitchen | IN | | NO |
| OL-T-CANCEL | order-lifecycle.md:54 | Any status except PENDING, NOSHOW, CANCELLED to CANCELLED with admin re-auth, fire and forget | n/a | kitchen | IN | Y | NO |
| OL-T-NOSHOW | order-lifecycle.md:55 | CASH orders, same statuses, to NOSHOW with admin re-auth | n/a | kitchen | ? (cash) | | NO |
| OL-T-EVENT | order-lifecycle.md:56 | order-update event with status merges immediately with no updated comparison | n/a | platform | IN | | PART |
| OL-T-FETCH | order-lifecycle.md:57 | Fetch merge only when updated differs; dedupe by id | n/a | platform | IN | | PART |
| OL-T-REFRESH | order-lifecycle.md:58 | Full or manual refresh rebuilds collection from server | n/a | platform | IN | | PART |
| OL-T-REFUNDED | order-lifecycle.md:59 | Accept on PENDING with external refund: PAYMENT_REFUNDED error, stays PENDING | n/a | kitchen | ? | | NO |
| OL-NOREOPEN | order-lifecycle.md:61-67 | No reopen; closed orders still offer cancel menu (except PENDING, NOSHOW, CANCELLED), refund, no-show for CASH, and Send notification | n/a | kitchen | IN | Y | NO |
| OL-MANUAL-AUTO | order-lifecycle.md:71-78 | Manual vs automatic transitions: auto-accept, auto-print (no status change), print-all status update, complete-all; external sources can move orders | n/a | kitchen | IN | | NO |
| OL-CANCEL-EFFECTS | order-lifecycle.md:82-89 | Refunds do not change status; cancel is fire-and-forget; History "Cancelled orders" filter queries CANCELLED only | n/a | backoffice | IN | | NO |
| OL-VISIBILITY | order-lifecycle.md:93-104 | Visibility per view: List, simplified list, pending bar, kitchen, aggregate, History, Report | n/a | kitchen | IN | | PART |
| OL-SORT-ALERT | order-lifecycle.md:108-111 | Alarm fires when order enters open set (simplified: when ACCEPTED); status change inside open set does not re-alarm | n/a | kitchen | IN | | NO |
| OL-ITEM-STATE | order-lifecycle.md:115-117 | No item statuses; only sold-out | OrderItem | kitchen | IN | | NO |

### Printing and receipts

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| PR-PIPE | printing-and-receipts.md:3-16 | Queue one job per 2 s; hidden canvas renders template; dispatch bridge HTML, ESC_POS or data, then alt bridge, then browser (about 400 ms); empty queue shows "Nothing to print" 2 s | n/a | kitchen | HW | | NO |
| PR-TEMPLATE | printing-and-receipts.md:20-26 | Template selection table (ESC_POS, label, labelPerItem missing, NEW_PRINTED_RECEIPT, default) | n/a | kitchen | HW | | NO |
| PR-DEFAULT | printing-and-receipts.md:30-51 | Default receipt: locker block, QR block, title, VAT no., service name, confirmation code, DEMO, customer, venue, event, prepare-by, delivery-by, pickup slot, items, notes, totals (promo discounts, Fees, tip, donation, PAID stamp, refund, tax lines), footnote, cash lines | mixed | kitchen | HW | Y | NO |
| PR-NEW | printing-and-receipts.md:53-56 | New receipt: "Order #:", "Customer:" block, larger type, "DELAY PREP" when asapFlag false | SubmitOrderRequest.dateToFire | kitchen | HW | | NO |
| PR-LABEL | printing-and-receipts.md:58-62 | Label template: name, address, items with modifiers, special requests with warning icon, service name, "Order #id - code", times, pickup slot; no prices | mixed | kitchen | HW | Y | NO |
| PR-ESCPOS | printing-and-receipts.md:64-66 | ESC-POS template: same model with single-line and indent markers | n/a | kitchen | HW | | NO |
| PR-CONVERT | printing-and-receipts.md:70-80 | HTML to ESC/POS converter: font size, bold, align, indent, single-line, barcode (for example barcode-c39), feeds, cut; width 42 or 32 | n/a | kitchen | HW | | NO |
| PR-SETTINGS | printing-and-receipts.md:84-90 | Printer settings: emulation list; address hidden for SunmiV2; line width; Epson Find Printer 60 s saves "Epson_<series>"; emulation change resets width | PrinterSettings | kitchen | HW | | NO |
| PR-PRINTALL | printing-and-receipts.md:94-101 | Print-all options: only-new (default on); update status to Preparing; sort by delivery address and pickupTime; known defect | PrintAllOptions | kitchen | HW | | NO |
| PR-STORE | printing-and-receipts.md:105-108 | Print store per device: order id to pickupTime or created; blocks reprints; not shared across devices | PrintStoreRecord | kitchen | HW | | NO |

### Real-time and synchronization

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| RT-TRANSPORT | real-time-and-synchronization.md:5-12 | Transport: third-party pub/sub over WebSocket; native host bridge preferred when present | n/a | platform | EXT | | PART (SSE) |
| RT-CHANNELS | real-time-and-synchronization.md:16-19 | Channels order.outlet.<id> per outlet, else order.venue.<venueId>; rebuilt when config applies | n/a | platform | ? (outlets) | | NO |
| RT-EV-UPDATE | real-time-and-synchronization.md:23-25 | order-update event: if status present, merge now; notify per-view callbacks; then throttled fetch | Order.status | kitchen | IN | | PART |
| RT-EV-SETTINGS | real-time-and-synchronization.md:26 | settings-update: merge venue settings when venueId matches (lead time updates live) | StoreConfigurationResponse | kitchen | IN | | NO |
| RT-EV-FULL | real-time-and-synchronization.md:27 | full-refresh: complete reload | n/a | platform | IN | | PART |
| RT-EV-CONNECT | real-time-and-synchronization.md:28 | Connection established: first connect ignored; later connects run catch-up fetch | n/a | platform | IN | | HAS |
| RT-LOAD-INITIAL | real-time-and-synchronization.md:32-35 | Initial load: paged GET with outletIds and status csv; dedupe; auto-accept and auto-print; lastUpdate = max(updated); enable alerts | n/a | kitchen | IN | | ? |
| RT-LOAD-INCR | real-time-and-synchronization.md:36-38 | Incremental: since=lastUpdate (or status=open when 0); throttle 2 s; one follow-up if in flight | n/a | kitchen | IN | | HAS |
| RT-MERGE | real-time-and-synchronization.md:39-48 | Merge: dedupe by id; alerting on and updated differs replaces; unknown open id appends and alarms; alerting off appends silently; 401 or 403 clears collection | n/a | kitchen | IN | | PART |
| RT-REFRESH | real-time-and-synchronization.md:49-51 | Full refresh (view entry, refresh button, full-refresh event): reset, reload venue, full load | n/a | kitchen | IN | | PART |
| RT-CATCHUP | real-time-and-synchronization.md:52-53 | Catch-up on reconnect: throttled incremental fetch | n/a | platform | IN | | HAS |
| RT-MULTI | real-time-and-synchronization.md:57-60 | Multi-display sync: same events to all devices; History rows merge live | n/a | platform | IN | | PART |
| RT-CONFLICT | real-time-and-synchronization.md:64-76 | Simultaneous actions: optimistic status, no locking; last write wins (Inferred); events merge without the updated guard (stale overwrite risk) | Order.updatedAt (proposal) | platform | IN | | NO |
| RT-UNKNOWN | real-time-and-synchronization.md:80-84 | Unknowns: event delivery guarantees, event vs REST ordering, payload completeness, idempotency of completeorders, accept, reject | n/a | platform | ? | | NO |

### Error and offline handling

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| ER-TOASTS | error-and-offline-handling.md:13-22 | Global toasts: REFUND_* codes 5 s; 401 invalid credentials 5 s; 403 not authorized (sticky); 500 server error 5 s; other unknown server error 5 s | n/a | platform | IN | | PART |
| ER-EXCEPTIONS | error-and-offline-handling.md:24-25 | Uncaught exceptions: spinners hidden, fatal notification, reported to error tracking | n/a | platform | IN | | ? |
| ER-RT-DROP | error-and-offline-handling.md:29-37 | Realtime disconnect: no offline UI; orders stay as last fetched; catch-up on reconnect; missed alerts only if still new | n/a | platform | IN | | PART |
| ER-BACKEND-DOWN | error-and-offline-handling.md:39-44 | Backend down or 5xx: server-error toast; views keep data; no automatic retry; next poll retries | n/a | platform | IN | | PART |
| ER-FAILED-ACTION | error-and-offline-handling.md:46-51 | Failed order action: mask clears; alert "API Unavailable"; optimistic status NOT reverted | Order.status | kitchen | IN | | PART |
| ER-MISSED | error-and-offline-handling.md:53-55 | Missed updates: since-fetch on reconnect; full refresh on view entry | n/a | platform | IN | | HAS |
| ER-DUP | error-and-offline-handling.md:57-59 | Duplicates: dedupe by id; event payloads merge only when updated differs | n/a | platform | IN | | PART |
| ER-INVALID | error-and-offline-handling.md:61-64 | Invalid data: flag failures mean off; missing fields render n/a or empty | n/a | platform | IN | | ? |
| ER-RACE | error-and-offline-handling.md:66-68 | Two devices race: last write wins; no locking, no conflict UI | n/a | platform | IN | | NO |
| ER-STALE | error-and-offline-handling.md:70-72 | Stale data: time filters re-evaluate every 60 s; refresh button; staleness bounded by navigation | n/a | platform | IN | | PART |
| ER-COMPLETEALL | error-and-offline-handling.md:74-76 | Complete-all failure: modal closes; toast "Server internal error"; partial completion possible (Unknown) | n/a | kitchen | IN | | NO |
| ER-RELOAD | error-and-offline-handling.md:78-82 | Reload: route guard re-validates; config read from storage; orders reload; alerting re-arms after load; print store prevents reprints | n/a | platform | IN | | ? |
| ER-SESSION | error-and-offline-handling.md:84-86 | Session expiry: any 401 deletes token and goes to login; route guard failure clears config | n/a | platform | IN | Y | PART |
| ER-AUTOPLAY | error-and-offline-handling.md:88-89 | Autoplay blocked: permission modal; No sets sound None (persisted); Yes retries under user gesture | n/a | kitchen | IN | | NO |
| ER-PRINT | error-and-offline-handling.md:91-96 | Print failures: bridge error toast 4 s; "Nothing to print"; browser cancel silent; failed job does not stop queue; print store not rolled back | n/a | kitchen | HW | | NO |
| ER-LOYALTY | error-and-offline-handling.md:98-100 | Loyalty failures: unknown barcode error step; redeem 409 message; close blocked during calls | Award (8.10) | kitchen | CUT (loyalty, rule 5) | | NO |
| ER-SYNC | error-and-offline-handling.md:102-105 | Sync failures (Items tab): execute error toast; list load toasts; banner states; polling resumes | n/a | backoffice | POS (rule 2) | | NO |
| ER-SETTINGS | error-and-offline-handling.md:107-109 | Settings save failures: missing venue toast; no venues means sticky error and logout; flag failures mean off | n/a | platform | ? | | NO |
| ER-FIRE-FORGET | error-and-offline-handling.md:111-114 | Fire-and-forget (cancel, auto-accept): failures only via global toasts; list re-syncs on next fetch | n/a | kitchen | IN | | NO |

### Feature checklist (test restatements)

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| CHK-AUTH | feature-checklist.md:7-17 | 9 checkboxes restating FEAT-001 to FEAT-005, FR-001 to FR-003, BR-045; no new behaviour | n/a | platform | IN | | ? |
| CHK-DEVICE | feature-checklist.md:19-29 | 9 checkboxes restating FEAT-006 to FEAT-008, SCR-022; no new behaviour | n/a | platform | ? | | NO |
| CHK-LIST | feature-checklist.md:31-45 | 13 checkboxes restating FEAT-009 to FEAT-012, SCR-003, BR-039 | n/a | backoffice | IN | | NO |
| CHK-SIMPLE | feature-checklist.md:47-52 | 4 checkboxes restating FEAT-015 and SCR-004 | n/a | kitchen | ? | | NO |
| CHK-ALERT | feature-checklist.md:54-60 | 5 checkboxes restating FEAT-016 to FEAT-018 | n/a | kitchen | IN | | NO |
| CHK-DETAIL | feature-checklist.md:62-86 | 23 checkboxes restating FEAT-019 to FEAT-032, SCR-007, BR-007, BR-008, BR-010, BR-021, BR-030 | n/a | kitchen | IN | | PART |
| CHK-BATCH | feature-checklist.md:88-101 | 12 checkboxes restating FEAT-033 to FEAT-037, BR-022 to BR-026, printing | n/a | kitchen | IN | | NO |
| CHK-KITCHEN | feature-checklist.md:103-109 | 5 checkboxes restating FEAT-038, FEAT-039, JRN-005, SCR-005 | n/a | kitchen | IN | | PART |
| CHK-HISTORY | feature-checklist.md:111-118 | 6 checkboxes restating FEAT-042, FEAT-043, BR-037, BR-038, JRN-024 | n/a | backoffice | IN | | NO |
| CHK-RT | feature-checklist.md:120-130 | 9 checkboxes restating real-time doc, BR-014, BR-015, JRN-020, JRN-021 | n/a | platform | IN | | PART |
| CHK-VENUE | feature-checklist.md:132-142 | 9 checkboxes restating FEAT-040, FEAT-041, FEAT-046, FEAT-047, BR-029, BR-032 | n/a | kitchen | ? | | NO |
| CHK-LOYALTY | feature-checklist.md:144-150 | 5 checkboxes restating FEAT-044, FEAT-045, BR-034 | n/a | kitchen | CUT / POS | | NO |
| CHK-ERROR | feature-checklist.md:152-158 | 5 checkboxes restating error doc and FR-031 | n/a | platform | IN | | PART |
| CHK-CONFIG | feature-checklist.md:160-165 | 4 checkboxes restating CFG-001 to CFG-061, BR-043, FR-033 | n/a | platform | IN | | PART |

### Functional requirements (merged into the rows above; FR ids are cited in the Ref column)

FR-001 to FR-033 each restate one FEAT or BR row. The FR id is cited in the matching row's Ref. No separate rows.

### User journeys

| Ref | Where | What | v2 model | Area | Scope | T | Comanda |
|:--|:--|:--|:--|:--|:--|:--|:--|
| JRN-001 | user-journeys.md:15-22 | First-time setup, single venue and outlet: login, quick-set, auto-save, list | n/a | platform | ? | | NO |
| JRN-002 | user-journeys.md:24-31 | Multi-venue or super-user setup: venue, outlets, template, auto options, Save; errors | n/a | platform | CUT (multi-store, rule 5) | | NO |
| JRN-003 | user-journeys.md:33-43 | Receive and accept: alarm, OK or pending bar, detail, Accept, ACCEPTED, list and kitchen; auto-accept variant | n/a | kitchen | ? (accept gate) | | NO |
| JRN-004 | user-journeys.md:45-51 | Reject pending with message: presets, Send, REJECTED | n/a | kitchen | ? | | NO |
| JRN-005 | user-journeys.md:53-61 | Prepare to completion: Preparing, Ready, hand over, Completed; simplified inline variant; detail requires Preparing first (gap 6) | Order.status | kitchen | IN | | PART |
| JRN-006 | user-journeys.md:63-68 | Delivery with driver dispatch: With Driver, DELIVERING, external or internal completion | n/a | kitchen | IN | | NO |
| JRN-007 | user-journeys.md:70-76 | Cancel with admin re-auth: cancel menu, login, owner, notes, Confirm, History | n/a | kitchen | IN | Y | NO |
| JRN-008 | user-journeys.md:78-81 | Mark cash order as no-show | n/a | kitchen | ? (cash) | | NO |
| JRN-009 | user-journeys.md:83-90 | Refund payment: transaction, Partial or Full, amount, reason, Submit, result | n/a | backoffice | ? (refund) | | NO |
| JRN-010 | user-journeys.md:92-95 | Notify customer mid-lifecycle: preset or text, Send, toast | n/a | kitchen | ? | | NO |
| JRN-011 | user-journeys.md:97-101 | Search and open order by number or scan | n/a | kitchen | ? (plan cut: search on open board) | | NO |
| JRN-012 | user-journeys.md:103-106 | Work through pending queue via carousel | n/a | kitchen | ? (pending) | | NO |
| JRN-013 | user-journeys.md:108-115 | Print receipts: single, batch, automatic | n/a | kitchen | HW | | NO |
| JRN-014 | user-journeys.md:117-122 | Scan loyalty card: redeem or stamps | n/a | kitchen | CUT (loyalty, rule 5) | | NO |
| JRN-015 | user-journeys.md:124-128 | Mark item sold out mid-service | ITEM.available | kitchen | IN | | NO |
| JRN-016 | user-journeys.md:130-134 | Change prep time or close ordering; Closed Venue display; live update on other devices | StoreConfigurationResponse.liveFlag | kitchen | IN | | NO |
| JRN-017 | user-journeys.md:136-139 | Complete all open orders at close of day | n/a | kitchen | IN | | NO |
| JRN-018 | user-journeys.md:141-145 | Review past or cancelled orders in History | n/a | backoffice | IN | | NO |
| JRN-024 | user-journeys.md:147-161 | Cancel, refund or no-show a closed order from History; progression buttons mostly absent on closed orders | n/a | backoffice | IN (cancel) / ? (refund) | Y | NO |
| JRN-019 | user-journeys.md:163-167 | Shift report: From and To default last 8 h; GO; totals and aggregated items | n/a | backoffice | IN | | NO |
| JRN-020 | user-journeys.md:168-173 | Multi-device: status change on A reaches B via order-update; last write wins | n/a | platform | IN | | PART |
| JRN-021 | user-journeys.md:175-178 | Reconnection catch-up: incremental fetch merges missed changes | n/a | platform | IN | | HAS |
| JRN-022 | user-journeys.md:180-184 | Owner POS sync monitoring: Items tab, banner, Sync now | n/a | backoffice | POS (rule 2) | Y | NO |
| JRN-023 | user-journeys.md:186-190 | Session expiry mid-shift: 401, login, may need Settings again | n/a | platform | IN | | PART |

## Notes

### 1. Tables, checks, guest count and waiters (rule 3)

- The KDS has **no** table number, guest count, waiter, check, bill, tab, request bill, call waiter or pay-at-table concept.
- The only table-related facts are: `type = SEAT` (DM-ORDER-TYPE), the "to-seat" name (BR-029, CFG-036, DM-VENUE-SERVICENAMES, PR-LABEL, PR-DEFAULT) and the "Fees" line (DM-ORDER-FEE, FEAT-019e).
- The kitchen card (SCR-005-HEADER to SCR-005-FOOTER, SCR-005-GAP) shows only location or locker, `#id`, time and a type icon. There is no slot for table, seat, guest count or waiter.
- The staff rows that touch identity or permissions are flagged Y: login, owner check, admin re-auth, user session, super user, last admin email.
- v2 coverage for the new features: `OrderType` DINEIN and PAY_AT_TABLE (8.1); `ITEM.seatFlag` (5.9); `Hours.seat` (9.10); `SubmitOrderRequest.openCheck` and `notes` (8.12, notes may carry a table reference); `IPosCheck` with `number`, `guestCount`, `employeeId`, `isOpenedByPosEmployee`, `checkOpenedAtInUTC`, `displayText` (9.7); `GetCheckRequest` and `PayCheckRequest` (8.14, table in config); `ValidateTableRequest` (8.15, response model undefined in 9.13); `ServiceCharge` (8.5).
- v2 gaps for this feature: no call-waiter, request-bill or waiter model; `employeeId` is the POS employee, not a Comanda waiter. These need a design decision.

### 2. What v2 cannot express (KDS fields with no v2 match)

- Order status enum and status history (`StatusHistoryEntry`), statusReason, sold-out duration (v2 has `available` only), item `soldOut`.
- Kitchen pace (Normal, Busy, Paused) and wait minutes; v2 has `liveFlag` only.
- Outlet or station, locker, event, occurrence, slot, pickup slot, delivery notes, verification code (only `customerCheckNumber` is close), change due, refund, tracking URL, demo flag, asap flag (partly via `dateToFire`).
- Undo or backward transitions and the "não retirado" outcome are not in the KDS; they come from plan-next decisions 2 and G-K9.

### 3. Conflicts between v2 (rule 4) and plan-next or decisions

- **Scheduled orders:** rule 4 keeps `pickupTime` and `dateToFire`; plan-next decision 17 says pre-orders are not in the pilot.
- **Delivery:** rule 4 keeps delivery; plan-next cuts "delivery and marketplaces".
- **Customer name and contact:** v2 has `Customer` (8.6); plan-next cuts "guest name and contact". Marked `?`.
- **Fees and service charge:** rule 4 keeps service charges; plan-next decision 16 says no fee for the pilot. Marked Y.
- **Cash:** KDS no-show and change-due are CASH-only; plan-next says no cash in Comanda. Marked `?`.
- **Customer messages (notify, reject, SMS):** plan-next cuts "customer order is ready" messages and SMS receipts.
- **Locker, event pickup, outlets:** plan-next cuts locker and event pickup; rule 5 is silent. Marked `?`.
- **Keypad and scanner search on the open board:** plan-next cuts it; rule 5 is silent. Marked `?`.

### 4. Internal contradictions in the KDS spec

- **DELIVERED:** the report status set (FEAT-043 at features.md:515-516, BR-038 at business-rules.md:182-183, API-28 at api-and-integrations.md:51) contains DELIVERED. The status enum (data-models.md:11, order-lifecycle.md:5-17) has no DELIVERED.
- **Realtime merge:** BR-014 (business-rules.md:70-72) and error-and-offline-handling.md:57-59 say event payloads merge only when `updated` differs. real-time-and-synchronization.md:25 and 73-76 and order-lifecycle.md:56 say an order-update event with status merges immediately with no comparison. Two sections disagree; the spec's own risk note agrees with the second.
- **ACCEPTED to READY:** allowed from the kitchen card (order-lifecycle.md:46, WF-3) but not from the detail footer (FEAT-022 at features.md:297-298, JRN-005 at user-journeys.md:60-61). Documented as gap 6.
- **Cancel after close:** BR-007 and JRN-024 allow cancel on COMPLETED and REJECTED orders. This is a business question for Comanda: cancel after pickup should probably be blocked.
- **Complete-all selection:** WF-5 says pickupTime at or before now, BR-022 and FEAT-033 say "before now", and the request sends `pickupTime=now`. The exact selection is Unknown.

### 5. Spec-admitted unknowns

- Exact complete-all selection (BR-022, FEAT-033).
- Whether the backend rejects stale writes (RT-CONFLICT, ER-RACE).
- Event delivery guarantees and ordering (RT-UNKNOWN).
- Whether order-update payloads are full orders or patches (real-time doc).
- Idempotency of completeorders, accept and reject (RT-UNKNOWN).
- Logout endpoint path (API-03), OpenID config shape (API-06).
- deliveryTime (DM-ORDER-DELIVERYTIME), `updateStatus` field name, and several data types are marked Inferred in data-models.md.
- Event and daily-limit behaviour not defined beyond the flag description.

### 6. Spec defects not to copy

- README gaps 1 to 7 (print-all injection, refund check, labelPerItem, optimistic revert, analytics-only event, detail footer gap, simplified textarea).
- Fixed timings in the KDS (ageing 30 s and 60 s in FEAT-010, 2 s incremental throttle in BR-015, 60 s filter re-evaluation in BR-017, 3 h keep-alive in FEAT-048) are KDS defaults, not Comanda rules.
- Pending (PENDING) and accept or charge flow: Comanda's kiosk pays before the kitchen sees the order; confirm before building it.

### 7. Coverage and reading notes

- Every file was read to its last line. Counts in the Coverage table are the `wc -l` totals.
- Client-only flags (data-models.md:56: `$$printed`, `$cancelled`, `$updating`, `current`) are not rows.
- README pattern text (document map, evidence legend, coverage summary, ID conventions: README.md:39-70, 118-165) has no behaviour and is not a row.
- Feature checklist: 118 checkboxes in 14 sections (counted with awk); each restates a FEAT, FR, BR, SCR or CFG row. Section rows are kept as test-coverage rows.
- FR-001 to FR-033 restate FEAT or BR rows; the FR id is in the Ref of the matching row.
- MODELS.md read: sections 5.1 to 5.19 (except the 5.20 example), 8.1 to 8.17, 9.1 to 9.13. Not read: section 5.20 (complete example), 6 (light menu), 7 (raw menu), 10 (checklist).
- Merged rows: CFG-070 to CFG-074 (one row).
- Comanda column reflects plan-next.md (4 Nov 2026). Where plan-next cuts an item that rule 5 does not list, Scope is `?`, not CUT.
