# Feature Checklist

A tick-list of every feature and sub-feature to implement for feature parity, grouped by functional area.
Each line names its feature (`F-...`) and the requirements (`FR-...`) that define it. A feature is done when
all its requirements' acceptance criteria pass. Brand variants are listed as separate items so that a rebuild
for a subset of brands can skip the ones it does not need.

## A01 KIOSK — Start-up, configuration, availability, session and device health

### Start-up and availability
- [ ] F-KIOSK-01 Start-up and loading screen - FR-101..FR-105
  - [ ] Loading screen texts + language selector - FR-101
  - [ ] Route by brand count - FR-102
  - [ ] 5 s retry loops - FR-103, FR-104
  - [ ] Missing default language fatal - FR-105
- [ ] F-KIOSK-02 Availability screens - FR-106..FR-112
  - [ ] Lane Closed / Maintenance / At Capacity texts + variants - FR-109..FR-112
  - [ ] Visibility settings (always/behind-attract 10 s/never) - FR-110
- [ ] F-KIOSK-08 Availability entry rules - FR-106..FR-109, 132, 133
  - [ ] Trading check order - FR-132
  - [ ] Closed-kiosk derivation - FR-109
  - [ ] Lane open/close - FR-133

### Session lifecycle
- [ ] F-KIOSK-03 Idle warning and abandonment - FR-113..FR-120
  - [ ] Enablement + timeout values - FR-113
  - [ ] Warning content + suppression - FR-114
  - [ ] Continue / cancel / expiry - FR-115..FR-117
  - [ ] Disabled contexts - FR-118
  - [ ] Input resets - FR-119
  - [ ] Abandon analytics + request - FR-120
- [ ] F-KIOSK-04 Session reset - FR-121

### Global UI
- [ ] F-KIOSK-05 Notifications/banners - FR-122..FR-124
- [ ] F-KIOSK-06 Admin panel access - FR-125..FR-127
- [ ] F-KIOSK-07 Health checks + reporting - FR-128..FR-131, 135 (printer/scanner/cash/orientation; kiosk status+action posts; status terminals)
- [ ] F-KIOSK-08 Config re-check timer - FR-137 (45 s gate-screen poll)
- [ ] F-KIOSK-09 ATP/installer - FR-136 (config file, frameless window, board init+heartbeat, willappear endpoints, WiX+Shell Launcher)
- [ ] FR-134 config error retry; FR-135 global managers
- [ ] F-KIOSK-11 Admin-panel open failure - FR-127

## A02 START — Attract screen, brand selection, language selection, order type

### Attract screen
- [ ] F-START-01 Attract screen (tap to start) - FR-201..FR-205, FR-238
  - [ ] Renders after config; single brand -> /welcome, multi-brand -> /MultiBrandPage - FR-201
  - [ ] Tap/key press starts journey; ignored while interaction disabled - FR-202
  - [ ] Trading gate (maintenance/at-capacity/closed) - FR-203
  - [ ] Version + location/kiosk id text - FR-204
  - [ ] Loading overlays - FR-205
  - [ ] Active-location recovery - FR-238
  - [ ] Template variants: default / plain / carousel / cocoa / costa / itsu
- [ ] F-START-02 Attract carousel - FR-206, FR-207, FR-221
  - [ ] Rotation with per-media duration, 7 s default, video duration - FR-206
  - [ ] Failed media skipped; all-fail renders children only - FR-206
  - [ ] Time-window filtering incl. overnight; default background fallback - FR-207
- [ ] F-START-09 Welcome message dialog (NavPed headphones) - FR-239, FR-240
- [ ] F-START-10 Journey start sequence - FR-241, FR-242, FR-236, FR-234, FR-235

### Language selection
- [ ] F-START-03 Language selection - FR-210..FR-215, FR-218
  - [ ] Button only when >1 language - FR-210
  - [ ] Overlay cells sorted, default first, current ticked, greetings - FR-211
  - [ ] Select switches UI + lang/dir + menu; no-op on same language - FR-212
  - [ ] Failure notification + "Start Over" retry - FR-213
  - [ ] Close via X / background tap; focus trap - FR-214
  - [ ] Cocoa "Language updated" dialog ~2 s; can start journey - FR-215
  - [ ] Legacy overlay accessibility toggle - FR-218
- [ ] F-START-04 Automatic language reset - FR-216, FR-217
  - [ ] Single-brand 30 s reset on /welcome - FR-216
  - [ ] Multi-brand page forces kiosk default language - FR-217

### Multi-brand
- [ ] F-START-05 Multi-brand brand selection - FR-208, FR-209, FR-219..FR-221, FR-237
  - [ ] Brand cells open/ready/disabled/closed message - FR-209
  - [ ] Brand selection loads branding + language, retries 5 s - FR-219
  - [ ] Attract overlay: tap hides 60 s, trading-gated (default) - FR-208
  - [ ] Carousel only with active media - FR-221
  - [ ] Reset destination clears brand config - FR-220
  - [ ] Availability derivation removes order types, closes brands - FR-237
- [ ] F-START-06 Multi-brand welcome (language) page - FR-226, FR-227
  - [ ] Inline language cells + Continue button - FR-227
  - [ ] Skipped for <2 languages - FR-227

### Order type
- [ ] F-START-07 Order type selection - FR-222..FR-226, FR-228..FR-230, FR-243
  - [ ] Only DINEIN/TAKE_OUT, DINEIN first - FR-222
  - [ ] Screen shown conditionally (types>1 OR langs>1 OR loyalty) - FR-223
  - [ ] Selection stores type, filters menu, routes on - FR-224, FR-225
  - [ ] Back: multi-brand welcome vs session reset - FR-226
  - [ ] Cocoa composition (nav bar/footer, language reload) - FR-228
  - [ ] KIOSK_THEMING images + row/column direction - FR-229
  - [ ] Auto-select after sign-in when single type - FR-230
  - [ ] Multi-branch page composition - FR-243
  - [ ] Variants: default / cocoa / costa / itsu / bk / shakeshack / multi-branch
- [ ] F-START-08 Loyalty prompt on order type screen - FR-231..FR-233
  - [ ] Banner visibility rules (NST_YOYO/Accesso never; Avolta gate; multi-sign-in; legacy scanner) - FR-231
  - [ ] Pre-basket sign-in routing - FR-232
  - [ ] 2 s logged-in overlay only when >1 order type - FR-233

## A03 MENU — Menu browsing and item customisation

- [ ] F-MENU-01 Menu load + order-type filtering - FR-301..FR-303, 312
- [ ] F-MENU-02 Category browsing - FR-304..FR-309
  - [ ] Cells open levels; lazy 60-batch; staggered animation; back; header/wait-time; cocoa nav+banners
  - [ ] Variants: default/cocoa/costa/itsu/bk/v2/shakeshack/boparan/sco
- [ ] F-MENU-03 Item cells - FR-310,311,318..320
  - [ ] Minimum/"from" price, servicePriceOverride, images+placeholder, kcal, Popular
- [ ] F-MENU-04 Item details/variant - FR-313..FR-317,325,326
  - [ ] Default variant, qty, Continue vs Add, age notice, auto-advance
- [ ] F-MENU-05 Labels/tags - FR-321,322 (chips, tag pages/schedules, impressions)
- [ ] F-MENU-06 Allergen/nutritional - FR-323,324
- [ ] F-MENU-07 Option groups - FR-327..FR-336 (min/max, supersede, defaults, nested, invisible, roles, dynamic pricing)
- [ ] F-MENU-08 Ingredient customisation - FR-337..FR-339
- [ ] F-MENU-09 Combos - FR-340..FR-342
- [ ] F-MENU-10 Quantity - FR-326,327,348
- [ ] F-MENU-11 Cross-sell - FR-343,344
- [ ] F-MENU-12 Item-added + review - FR-340,345,346,349
- [ ] F-MENU-13 Back navigation - FR-307
- [ ] F-MENU-14 Product search (SCO) - FR-347
- [ ] Accessibility announcements/focus - FR-350

## A04 BASKET — Order summary, checkout preparation and age verification

- [ ] F-BASKET-01 Lines - FR-401..FR-408 (grouped display, a11y labels, remove confirm, edit-if-options, stepper, age badge, scanned/added split, grouping)
- [ ] F-BASKET-02 Totals/fees/tax - FR-409..FR-416 (fields, visibility, fee rules, recompute triggers, queue, PLEASE WAIT, a11y, stale suppression)
- [ ] F-BASKET-03 Empty + pay gates - FR-417..FR-422 (empty, disabled states, donation, BRL limit, line-limit, browse modal)
- [ ] F-BASKET-04 Reset confirm - FR-423..FR-425
- [ ] F-BASKET-05 Gate - FR-426..FR-427, 430 (conditions, content, remove, guest_left)
- [ ] F-BASKET-06 PIN - FR-428..FR-429 (4 digits, confirm-only submit, attempts 5, locked/unavailable/error outcomes, guards)
- [ ] F-BASKET-07 Challenge-25 - FR-432..FR-434 (copy, checkbox age, approve/decline)
- [ ] F-BASKET-08 Retention - FR-431 (nonce+location+fingerprint)
- [ ] F-BASKET-09 Badge/toast/declined - FR-406, 434..436 (18+ always, 2s toast, declined screen, guest_left)
- [ ] F-BASKET-10 CPF/CNPJ - FR-437..FR-441
- [ ] F-BASKET-11 Extras - FR-442..FR-446 (rows, scan button, discounts modal, charity/gift-card, vouchers line)
- [ ] Variants: default/cocoa/costa/bk/boparan/itsu/shakeshack/v2/sco
- [ ] F-BASKET-12 Add-time age-restriction notice - F-BASKET-05

## A05 SCAN — Scan routing, Scan-and-Go and scan feedback surfaces

- [ ] F-SCAN-01 Dispatch - FR-501..FR-508 (guard, route precedence, per-screen handlers)
- [ ] F-SCAN-02 Item scan - FR-509..FR-514 (original-menu match, add+tag, refusal, not-found, clear, grouped removal)
- [ ] F-SCAN-03 SCO page + modal - FR-515..FR-520, 534 (content, reopen, self-close, single surface, banner+carousel, tagging, browse-modal)
- [ ] F-SCAN-04 Not-found - FR-521..FR-524 (10 s, copy, legacy modal, placement)
- [ ] F-SCAN-05 Restricted refusal - FR-525..FR-528 (copy, 7 s, analytics, flag semantics)
- [ ] F-SCAN-06 Hardware - FR-529..FR-533 (HID buffer, serial, status checks, suppression, terminal status)

## A06 LOYALTY — Providers, sign-in, sign-out, order history

- [ ] F-LOYAL-01 Providers/methods - FR-601..FR-612 (provider selection, routing, guards, picker, manual entry, in-flight, success, sign-out, spinner, banner copy)
- [ ] F-LOYAL-02 Avolta - FR-613..FR-620 (QR, phone, validation, pre-basket, signup steps, routing)
- [ ] F-LOYAL-03 Multi-method - FR-603..FR-607, 610 (guards, picker, entry, in-flight, spinner)
- [ ] F-LOYAL-04 Face-ID - FR-621..FR-623, 643 (entry, error, success, gate)
- [ ] F-LOYAL-05 Logged-in + sign-out - FR-608..FR-609, 611, 624..625 (banner, overlay, copy, sign-out)
- [ ] F-LOYAL-06 Sign-up/terms - FR-619, 626..627 (steps, fetch, acceptance gate)
- [ ] F-LOYAL-07 Error dialogs - FR-617..FR-618, 628..634, 639..640 (existing/unknown phone, signup, signin, details, guard, analytics)
- [ ] F-LOYAL-08 Order history - FR-635..FR-638, 641..642, 644 (list, reorder, errors, empty, gate, loading)
- [ ] F-LOYAL-09 Additional sign-in surfaces - FR-605..FR-610
- [ ] FR-644 (second-pass loyalty surface)

## A07 DISCOUNTS — Coupons, rewards, restaurant and senior discounts

- [ ] F-DISC-01 Entry points - FR-701..FR-710 (manual page, scan page, basket button, classification, banner copy, routes, analytics, scan-only, processing guard)
- [ ] F-DISC-02 Apply pipeline - FR-711..FR-722 (queue-wait, routing, success overlays, second-code, already-added, replacement, senior, analytics, restaurant modal, recompute, entry-method, unknown)
- [ ] F-DISC-03 Awards - FR-723..FR-728 (auto-show, totals refresh, confirm, more-rewards, LoyaltyV2 popup, discounts list)
- [ ] F-DISC-04 Void - FR-729..FR-733 (by type, silent, failure, cleanup, row removal)
- [ ] F-DISC-05 Limit/banners - FR-734..FR-738 (limit, added note, detection, focus, headless)
- [ ] F-DISC-06 Legacy + errors - FR-739..FR-744 (invalid dialog, add error, legacy page, Accesso, details, itsu)
- [ ] F-DISC-07 Additional discount surfaces - FR-723..FR-744

## A08 PAYMENT — Method choice, authorisation, errors, tips, donation

- [ ] F-PAY-01 Chooser - FR-801..FR-808 (readiness list, names, single/multi, back, partial reversal, crypto notice, EBT, analytics)
- [ ] F-PAY-02 Card/PED flow - FR-809..FR-816 (authorising, request, polling 1s floor, success, totals, cash states, cancel, start flags)
- [ ] F-PAY-03 Errors - FR-817..FR-824 (error screen, 702, expired, cancel confirms, ATP, analytics, variants)
- [ ] F-PAY-04 Partials - FR-813, 815, 825..828 (list, cancel, remaining, single-kind splits)
- [ ] F-PAY-05 Tips - FR-829..FR-834 (presets, custom, no-tip, totals, continue, edit)
- [ ] F-PAY-06 Donation + banners - FR-835..FR-840 (modal, providers, EBT banner, loyalty banner, wait-time, analytics)
- [ ] F-PAY-07 Order placement - FR-841..FR-846 (single-flight, request, injection, response, totals, line-limit)
- [ ] Variants: cocoa / default / bk / costa / itsu / shakeshack / sco
- [ ] F-PAY-03 Error codes - FR-847..FR-848

## A09 ALTPAY — Cash, crypto, gift card, room charge, app payment, Face-ID

- [ ] F-ALTPAY-01 Cash - FR-901..FR-910 (insert, polling floor, states, change, cancel, fatal, readiness, rounding, partials, end-cash)
- [ ] F-ALTPAY-02 Crypto - FR-911..FR-918 (QR, poll, expired, cancel confirm, unavailable, start guard, placement, analytics)
- [ ] F-ALTPAY-03 Gift card - FR-919..FR-930 (balances, insufficient, custom amount, manual modes, PED, scan, already-added, error, remainder, purchase, expiry, analytics)
- [ ] F-ALTPAY-04 Room charge - FR-931..FR-938 (picker, form, validation, checkout, hide-info, error, auth request, analytics)
- [ ] F-ALTPAY-05 App payment - FR-939..FR-942 (page, code submit, authorise, analytics)
- [ ] F-ALTPAY-06 Face-ID - FR-943..FR-948 (camera, 2FA PIN, invalid PIN, processing, cancel, failure)
- [ ] F-ALTPAY-07 Payment-cancel dialogs - F-ALTPAY-02/03/04/06
- [ ] F-ALTPAY-03/05 Second-pass FRs - FR-949..FR-950

## A10 POST — Success page, notifications, receipts, wait-time

- [ ] F-POST-01 Success page - FR-1001..FR-1010 (content, done/pick-store, footers, number rule, a11y, auto-return, variants, wait-time, name, source)
- [ ] F-POST-02 Notifications - FR-1011..FR-1018 (buzzer, tent, table, phone, name, storage, puck, analytics)
- [ ] F-POST-03 Receipts - FR-1019..FR-1026 (print, failure, email modal, sent, SMS, QR, options, analytics)
- [ ] F-POST-04 Wait + waiting - FR-1027..FR-1030 (waiting screen, source, email-disabled, submit)
- [ ] F-POST-05 Auto-return - FR-1031..FR-1034 (done, pick-store, notification reset, loyalty reset)

## A11 PRES — Theming, accessibility, keyboards, formatting, analytics

- [ ] F-PRES-01 Theming - FR-1101..FR-1110 (gate, tokens, overrides, CSS, logos, primitives, actions, fallback, errors)
- [ ] F-PRES-02 Accessibility - FR-1111..FR-1122 (toggle, classes, trap, NavPed, announcements, RTL, brand screens, languages, modal focus, layout, analytics, direction change)
- [ ] F-PRES-03 Keyboards - FR-1123..FR-1130 (layouts, tabbed, numeric, limits, currency map, Avolta, focus, submit)
- [ ] F-PRES-04 Formatting - FR-1131..FR-1138 (money, helpers, languages, localization, ratios, primitives, RTL, Sentry)
- [ ] F-PRES-05 Analytics - FR-1139 (full 56-event catalogue + screen views + Sentry)
- [ ] F-PRES-06 A11y texts + primitives - FR-1111..FR-1130

## A12 SCO — Self-checkout screens, clerk validation, template catalogue

- [ ] F-SCO-01 SCO screens - FR-1201..FR-1214 (home, product, summary, payment journey, help, help requested, cancel help, help analytics, staff login, clerk PIN, login a11y, login error, staff actions, clerk service)
- [ ] F-SCO-02 Template catalogue - FR-1215..FR-1220 + data-and-integrations.md table (SCO routing, slot map, brand alternatives, cinnamon/v3, cocoa email-disabled, mode routing)
- [ ] F-SCO-03 Further template texts - F-SCO-02
