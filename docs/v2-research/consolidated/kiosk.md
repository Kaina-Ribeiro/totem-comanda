# Kiosk — consolidated requirements

## Summary

- **207 features:** 144 IN · 35 CUT · 17 OUT · 10 HW-LATER · 1 MODEL-ONLY.
- **Comanda today (from the readers' plan-next column, not checked in code):** 22 HAS · 51 PART · 119 NO · 15 unknown. The core path (attract, menu, basket, totals, order number) is mostly there; the rules around it are not.
- **Biggest gaps:** item visibility and sold-out rules; promotion rules (v2 Award holds results only); kiosk messages and store-level kiosk settings; item-builder rules (exclusive option, default option, composite toggle, group roles); cash and tip/donation values.
- **New v2 fields:** 58 field rows in the "New fields" table, most of them for the item builder, promotions and kiosk settings.
- **Open questions for Kai:** 12 (Q1 to Q12). The ones that block build work first: Q10 (sold-out display), Q4 (service charge), Q11 (cash without a machine), Q9 (order number).
- **Biggest risk:** the spec computes minimum prices, negative deltas and fees inside the app. CLAUDE.md says the Go API decides every price, so the kiosk may only display quoted values. Also: "authorised" counted as "paid" in the spec, which the plan rejects.

**Basis:** read every kiosk-labelled row of K1 (159), K2 (467), B1 (375) and D1, D2, D4, D5, D6, D8, D12, D13 (70, 106, 31, 16, 30, 256, 43, 37). D3, D7, D9, D10, D11 and KDS1 have no kiosk-labelled rows; the kiosk-relevant ones are cited where they touch promotions, item flags or kiosk hours.

**Language:** written in English, as the brief template. Spec UI copy is quoted as in the spec; PT-BR copy is marked "to define" where the spec gives only EN.

## Features

Verdicts follow the brief. `[T]` marks rows that touch tables, checks, waiters or seats (owner: waiter-table-qr for the table side).

### A. Trading state and closed screens

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-001 | Loading screen | Title "Preparing your experience", text "The kiosk is starting up..."; shown until config loads; config load retries every 5 s (spec; the plan uses 10 s for the offline screen) | — | ? | IN | K1 F-KIOSK-01; K2 FR-101, FR-205; B1 BR-KIOSK-02 |
| K-002 | Trading check order | First match wins at journey start: maintenance, then at capacity, then closed; any failure aborts the start. Order-type list empty = closed | StoreConfiguration.liveFlag, OrderType | PART | IN | K1 BR-KIOSK-09, BR-START-15; K2 FR-132, FR-203, FR-237; B1 BR-SES-03 |
| K-003 | Store mode precedence | Modes: Offline, Maintenance, Closed, Paused (at capacity), Live (plan decision 14). Store open = opening <= now < closing in the store timezone; dine-in OR take-out open; weekday 1 = Sunday to 7 = Saturday. Close minute is exclusive (see defects) | StoreConfiguration.liveFlag, StoreConfiguration.timezone (NEW), hours per channel | PART | IN | B1 BR-SES-03, BR-SES-04, DM-XC-02, CHK-SES-004; B1 DM-SES-01b |
| K-004 | Closed screen | Title "CLOSED"; logo + title + subtitle only, no buttons; fallback title "Closed". Shown when the lane is closed | StoreConfiguration.liveFlag; NEW StoreConfiguration.kiosk.closedMessage | HAS | IN | K1 F-KIOSK-02, BR-KIOSK-08; K2 FR-111; B1 ENT-KIOSK-03 |
| K-005 | Unavailable (maintenance) screen | Title "KIOSK CURRENTLY UNAVAILABLE", no buttons. Clearing maintenance clears the flag and reloads to / | — | HAS | IN | K1 F-KIOSK-02; K2 FR-106, FR-107, FR-111 |
| K-006 | At-capacity screen | "Sorry, our kitchen is currently at capacity" + "We will resume taking orders shortly."; guests cannot order. The at-capacity flag now comes from store pace (plan decision 3) | NEW StoreConfiguration.atCapacity (or pace via waitTime) | HAS | IN | K1 F-KIOSK-02, BR-KIOSK-05; K2 FR-108; B1 BG-BKG-08b |
| K-007 | Closed and unavailable message visibility | Priority for the closed message: ALWAYS_SHOW (default), SHOW_BEHIND_ATTRACT_SCREENS (back to attract after 10 s), NEVER_SHOW. Unavailable message has its own priority (default Always shown) | NEW StoreConfiguration.kiosk.closedMessage.visibility; NEW StoreConfiguration.kiosk.unavailableVisibility | NO | IN | K1 BR-KIOSK-07; K2 FR-110; D2 FR-539, FR-546; D12 CFG-539, CFG-546 |
| K-008 | Operational warning message | Condition: offline, closed or not accepting orders. Title required, max 50; body required, max 140; "also show as popup" yes/no. Default text per state if no custom text | NEW StoreConfiguration.kiosk.warning {condition, title, body, popup} | PART | IN | D2 FR-713..716; D4 FEAT-082, SCR-217; D5 FEAT-082 ACT-577..584; D12 CFG-713..716; D8 FORM-098 |
| K-009 | Config re-check on entry screens | Config reloads every 45 s, only on entry screens (root, closed, maintenance, at capacity). A new config applies only while the guest is still on an entry screen. A fetch over 1 s shows loading and blocks taps. Errors retry next tick | StoreConfiguration (open/closed state) | ? | IN | K1 F-KIOSK-08; K2 FR-137 |
| K-010 | Offline screen (no cache) | When no configuration or menu cache is ready, show the temporarily offline screen, retry every 10 s. Server returns state "not ready" with HTTP 200, never an HTTP error. No order queue offline (CLAUDE.md) | — (state, not in v2) | PART | IN | B1 BR-SES-01, BR-BKG-06, EP-MNU-01, INT-02, FEAT-BKG-02; CLAUDE.md (Offline) |
| K-011 | Configuration load failure | Loading-configuration error with a retry that runs setup again | — | ? | IN | K2 FR-134; K1 F-KIOSK-01 |
| K-012 | Lane closed by operator | Operator closes the lane: clear session, show closed. Lane open: go to the welcome screen | StoreConfiguration.liveFlag | ? | IN | K1 BR-KIOSK-10; K2 FR-133 |
| K-013 | Default language missing | Spec: no default language on brand or kiosk is a fatal error (maintenance error path). Plan: PT-BR is the default, EN second | StoreConfiguration.defaultLanguage (NEW) | ? | IN | K2 FR-105; K1 BR-KIOSK-03 (spec says en-gb fallback; see defects) |
| K-014 | Kiosk service switches | Kiosk dine-in and take-out switches (default on). At least one stays on; a switch is disabled while the other is off. A switch off removes that order type from the kiosk | NEW StoreConfiguration.kioskOrderTypes (DINEIN, TAKE_OUT flags) | PART | IN [T] | D12 FEAT-063, CFG-534, CFG-536; D8 DEP-209, DEP-210, BR-041; K1 BR-KIOSK-06 |
| K-015 | Multi-store and store groups for kiosk settings | Kiosk settings templates published to selected stores or store groups; per-store kiosk settings page | — | NO | CUT (multi-store) | D5 SCR-160..165; D2 FR-537; D6 CFG-537, CFG-561, CFG-562; D8 CFG-537, CFG-561, CFG-562 |

### B. Attract screen and language

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-016 | Tap to start | Tap or key press anywhere on the attract screen starts the journey. Default text "Tap here to get started". Ignored while the kiosk is not accepting input | Order (create) | HAS | IN | K1 F-START-01, BR-START-18; K2 FR-202, UJ-START-01 |
| K-017 | Attract media carousel | Images shown in sequence behind the attract screen. Duration per media (plan default 15 s; spec default 7 s, see defects). Videos autoplay muted (see Q5). Time window per media; overnight window when start > end. Failed media is skipped. Fallback image when none is active | NEW IMAGE.displaySeconds, IMAGE.schedule, IMAGE.kind | NO | IN | K1 F-START-02; K2 FR-206, FR-207, ENT-START-01; D2 FR-550, FR-557, FR-558; D4 FEAT-064; D6 CFG-540..560; D8 CFG-547..563; D12 CFG-557, CFG-558 |
| K-018 | Attract media management | Upload image (advertised limit 20 MB, listed formats); alt text required for single media; list order; duration in seconds (saved as ms); internal name required, max 100; internal description max 250; enable or disable schedule | IMAGE.url, IMAGE.altText, IMAGE.displaySeconds (NEW) | NO | IN | D2 FR-551..554; D5 SCR-058..063, FEAT-064 ACT-417..439; D12 CFG-550..553; D7 JOURNEY-013 |
| K-019 | Portrait fallback media | Fallback for portrait 9:16 when no media is active. Landscape fallbacks are out (see landscape row) | NEW IMAGE.kind = PORTRAIT_FALLBACK | NO | IN | K2 FR-207; D2 FR-544, FR-545; D12 CFG-544, CFG-545 |
| K-020 | Landscape fallback media (16:9, 3:2) | Landscape media for landscape screens | — | NO | OUT (CLAUDE.md: totem is portrait 1080x1920 only) | D2 FR-540..543; D12 CFG-540..543; K2 FR-542, FR-543 |
| K-021 | Store logo and text fallback | Logo of the store on welcome; if none, store name in text. Floating logo falls back when image fails | NEW StoreConfiguration.logo (IMAGE) | NO | IN | K2 FR-708, FR-1105 |
| K-022 | Language choice on attract | Language button shown only when more than one language. Overlay sorted by name with the default pinned first. Choosing a language loads its pack; same language = no-op. Languages: PT-BR and EN only (CLAUDE.md), not the 33 locales of the spec | StoreConfiguration.defaultLanguage; NEW Order.languageCode | PART | IN | K1 F-START-03; K2 FR-210, FR-211, FR-212, FR-118, UJ-START-03; CLAUDE.md |
| K-023 | Language pack failure | Error notification with "Start Over" (retry); analytics change_language_error | — | ? | IN | K1 F-START-03; K2 FR-213 |
| K-024 | Single-brand language revert | On attract, a language the guest picked reverts to the default after 30 s, silently | — | NO | IN | K1 F-START-04; K2 FR-216; UJ-START-03 |
| K-025 | Bilingual texts with fallback | Menu name, description and short name have an EN version; missing EN falls back to PT | NEW ITEM.translations (and CATEGORY.translations) | PART | IN | B1 FR-MNU-003, EP-MNU-05; K2 FR-1118; D6 CFG-194, CFG-205 |
| K-026 | Multi-brand welcome and brand grid | Brand grid, brand carousel, "Pick a store", welcome page for several brands, closed brands greyed | — | NO | CUT (multi-brand) | K1 F-START-05, F-START-06, BR-KIOSK-01; K2 FR-102, FR-201, FR-208, FR-209, FR-217, FR-220, FR-221, FR-227, FR-243, FR-1002, FR-1032; UJ-START-04, UJ-START-05, UJ-E2E-02 |
| K-027 | Visual templates and per-brand themes | Per-brand template, theme, CSS, colours, logos, banners, order-type titles per template (cocoa, costa, itsu, bk, shakeshack, multi-branch); online ordering appearance settings | — | NO | CUT (one visual template) | K1 F-START-07, F-START-09; K2 FR-112, FR-219, FR-228, FR-229, FR-694..708; B1 FEAT-MNU-02, FR-MNU-005, EP-MNU-02..04; D7 FEAT-081 |
| K-028 | Store text for welcome | Version string and location id shown small on welcome (diagnostic); hidden on the brand carousel | — | NO | IN | K2 FR-204 |
| K-029 | Welcome dialog for headphones | NavPed headphone plug starts screen reader and a welcome dialog ("Welcome to the text to speech kiosk experience") | — | NO | CUT (accessibility) | K2 FR-239, FR-240; K1 F-START-09; UJ-START-07 |
| K-030 | Right-to-left and extra language layouts | RTL direction, 33 locale files, keyboard layouts for nine languages | — | NO | OUT (CLAUDE.md: PT-BR and EN only) | K2 FR-1116, FR-1122, FR-1123, FR-1133, FR-1137 |

### C. Session, idle and reset

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-031 | Idle timer | Runs only when the timeout is above 0. Default 30,000 ms in the spec (Q1). Minimum 1 s. Any click, mouse move or key press resets it. Off on: payment screens, help, closed, unavailable, at capacity, loading, scan reading, open warning | NEW StoreConfiguration.kiosk.idleTimeoutSeconds (0 = off) | HAS | IN | K1 F-KIOSK-03, BR-KIOSK-11, BR-KIOSK-12, BR-KIOSK-14; K2 FR-113, FR-118, FR-119 |
| K-032 | Idle warning | Title "Are you still there?" (EN copy in spec; PT copy to define). Buttons "Cancel my order" (destructive) and "Continue". Never stacks over another notification. Continue hides it and restarts the count. Unanswered = abandon | — | PART | IN | K1 SCR-KIOSK-05, BR-KIOSK-13; K2 FR-114, FR-115, FR-117, UJ-KIOSK-03 |
| K-033 | Abandon the journey | On cancel from the warning or timeout: reset the session, record abandon with reason IDLE_TIMEOUT, go to the start. Unpaid order is abandoned; gift-card readings (out) are not needed | Order (status ABANDONED, NEW operation) | PART | IN | K2 FR-116, UJ-KIOSK-03; B1 DM-SES-03, EP-SES-04, FEAT-SES-04, INT-06, UJ-E2E-03 |
| K-034 | Session reset | Clears order, session, notifications and loyalty/discount state; goes to the start. Reset call on the server is logging only (always success) | Order | HAS | IN | K2 FR-121, FR-1033; B1 FR-SES-002, EP-SES-02, DM-SES-02, FEAT-SES-02 |
| K-035 | Journey start on server | Tapping start creates an empty order (nonce, default order type) and tells the server the journey started. One extra try (~200 ms) on connection errors only. A failure does not block the guest. Clears stored payment data of the previous journey | Order | PART | IN | K2 FR-241, FR-242; B1 BR-SES-05, BR-SES-06, FR-SES-003, EP-SES-03, INT-05, PAY-CLEAR |
| K-036 | Modal notifications | One modal notification at a time; title, zero or more buttons (default or destructive); optional timeout runs an action. Retryable error offers "Start Over" which re-runs the failed action. Callers check visibility first | — | ? | IN | K1 F-KIOSK-05, SCR-KIOSK-06, BR-START-18; K2 FR-122, FR-123, FR-124 |
| K-037 | Auto return after success | On the success screen, no tap for the idle time returns to the start and clears order, notifications and discounts | Order | HAS | IN | K1 F-POST-05, BR-POST-06; K2 FR-1006, FR-1031; UJ-POST-01 |
| K-038 | Kiosk status telemetry | Sends kiosk status (APPLICATION_STARTING, APPLICATION_START_FAILED, TRADING, UNAVAILABLE) with reason (MAINTENANCE, AT_CAPACITY, STORE_CLOSED, UNKNOWN) and key actions. For the owner only | — | PART | IN | B1 DM-OPS-02, FEAT-OPS-04, EP-OPS-04, EP-OPS-05, FR-OPS-005 |
| K-039 | Admin diagnostics on totem | Hidden staff gesture (5 taps in 4 s) opens the totem admin panel; the panel needs cash-machine health and an ATP error dialog first | — | NO | HW-LATER (fase 4) | K2 FR-125, FR-126, FR-127, UJ-KIOSK-04, OP-KIOSK-07 |
| K-040 | Lane status by time of day | Store open or closed uses the store timezone and times; no store open = closed screen | StoreConfiguration.timezone (NEW) | PART | IN | B1 BR-SES-04; K1 BR-KIOSK-06 |

### D. Order type

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-041 | Kiosk order types | Guest chooses Eat In (DINEIN, "Eat In") or Take Away (TAKE_OUT, "Take Away"). DINEIN always sorts first. DELIVERY and other types are filtered out before display. Button labels in spec are EN; PT-BR labels to define | OrderType (DINEIN, TAKE_OUT) | HAS | IN [T] | K1 BR-START-11, F-START-07; K2 FR-222, ENT-START-03; B1 DM-ORD-01 |
| K-042 | Order-type screen shown only when needed | Shown only if there is more than one order type or more than one language. Otherwise the first type applies silently. Tap records the type, filters the menu and moves on. Default = first filtered type; DINEIN if the list is empty | OrderType; Order.orderType | HAS | IN | K1 F-START-07, BR-START-13; K2 FR-223, FR-224, FR-225, UJ-START-02 |
| K-043 | Back on order-type screen | Back on the order-type screen resets the session to the root | Order | ? | IN | K1 BR-START-19; K2 FR-226 |
| K-044 | Order-type screen in branded style | Cocoa title "What service would you like today?", footer with language and accessibility, custom Eat In / Take Away images, row or column button direction | — | NO | CUT (one visual template) | K2 FR-228, FR-229; K1 F-START-07 (copy per template) |
| K-045 | Delivery, pickup, drive-thru, Deliveroo and scheduled orders | Exist in the model only. No screen creates them now. Scheduled orders (dateToFire, pickupTime) and pre-orders are not on the kiosk | OrderType (DELIVERY, PICKUP, DRIVE_THRU, DELIVEROO); Order.dateToFire, Order.pickupTime | NO | MODEL-ONLY (decision 7) | K2 FR-222 (note); D6 CFG-648..667, API-257, API-258 (conflicts with plan decision 17) |
| K-046 | Kiosk item availability per channel | Item flags: dine-in, take-out, pickup, delivery, seat (table) and the price override per channel. The kiosk shows only items allowed for the chosen type | ITEM.dineinFlag, ITEM.takeoutFlag, ITEM.pickupFlag, ITEM.deliveryFlag, ITEM.seatFlag | PART | IN [T] | D1 FR-195, FR-212, FR-214; D6 CFG-182..188, CFG-064; D9 CFG-195, CFG-214, FEAT-033; D2 FR-637, FR-646 |
| K-047 | Kiosk dine-in and take-out hours | Dine-in and take-out periods: base hours or custom hours, capacity profile, opening and closing time, weekdays (defaults 00:00 to 23:59, "Same as base"). Owned by back office store ops; kiosk reads the result | StoreConfiguration hours per channel (DINEIN, TAKE_OUT) | NO | IN [T] | D11 CFG-110..119; D1 FR-110..119 |

### E. Menu browsing and item builder

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-048 | Menu loaded once per journey | Menu loads at journey start and stays in memory. A newer menu only swaps in when a new journey starts, never mid-order. Two views (dine-in, take-out) by service availability | ITEM.dineinFlag, ITEM.takeoutFlag | HAS | IN | K1 F-MENU-01; B1 BR-BKG-02, UJ-MNU-01; K2 FR-241 |
| K-049 | Display order | Categories, items, option groups and options show in display order (spec: displayOrder ascending; MODELS: list order). Used as the single rule (see defects) | Link order in CATEGORY.links, MODIFIERS.links | ? | IN | K1 BR-MENU-02; K2 FR-303; B1 DT-MNU-01 |
| K-050 | Category navigation and back | Tap a category: opens its sub-categories or items; breadcrumb shows the path; back pops one level and discards an unsaved item draft. Level change: short slide-in, 40 ms stagger, first 25 cells. Grids render in batches of 60 | CATEGORY links to CATEGORY and ITEM | HAS | IN | K1 F-MENU-02, F-MENU-13, BR-MENU-03; K2 FR-304, FR-305, FR-306, FR-307 |
| K-051 | Menu header | Header shows the category name, or "Browse the menu" / "Product Search"; wait-time line appears when the kitchen reports a wait | — | ? | IN | K2 FR-308; K1 F-MENU-02 |
| K-052 | Empty and unavailable categories removed | A category with no available item after the type filter is removed (recursive). Items unavailable never appear | CATEGORY, ITEM.available | HAS | IN | K1 BR-MENU-02, UJ-MENU-01; K2 FR-312; B1 BR-MNU-01, BR-MNU-02, FR-MNU-002 |
| K-053 | Hidden vs sold out vs sold out until a time | Hidden: not shown at all (visible = no). Sold out: greyed or removed (see Q10). Sold out until a date and time: comes back by itself. Daily limit: sold out once the daily quantity is used | NEW ITEM.visible, ITEM.unavailableUntil, ITEM.dailyLimit | NO | IN | D1 FR-183, FR-247; D6 CFG-181, CFG-182, CFG-183; D9 notes (G-A4, G-T1, P1); D8 notes (daily limit); K1 F-MENU-03 |
| K-054 | Item card | Name or short name, image (placeholder when the image fails; plain placeholder, not the cocoa initial tile), price, calories as "{n} kcal", short description | ITEM.name, ITEM.shortName, ITEM.description, ITEM.calories, IMAGE | PART | IN | K1 F-MENU-03, BR-MENU-06; K2 FR-311, FR-320, FR-323 |
| K-055 | Price shown on the card | Shown price = base + cheapest pick of each forced group (min = max > 0). "From" price when showFromPrice. Price override per order type replaces the base. The final price is the Go quote; the card shows only what Go sends (CLAUDE.md) | ITEM.price, ITEM.dineInPriceOverride, ITEM.takeOutPriceOverride; NEW ITEM.showFromPrice | PART | IN | K1 F-MENU-03; K2 FR-310, FR-318, FR-319; CLAUDE.md |
| K-056 | Kitchen wait line | "Current wait time is about {n} minute(s)" under the category header when the kitchen reports a wait | NEW StoreConfiguration.waitTimeMinutes | NO | IN | K1 F-MENU-02; K2 FR-308; B1 DM-XC-02 (waitTime = pace, decision 4) |
| K-057 | Item labels (chips) | Label chips with translated text (itemLabel code, EN falls back to PT). Customised tags shown as badges, filtered by tags pages and schedules | NEW ITEM.labels | NO | IN | K1 F-MENU-05; K2 FR-321, FR-322 |
| K-058 | Item flag badge (selo) | Badge with text, background colour and text colour; shown on the item card and detail; can show on a schedule; "Display text" is show or hide | NEW ITEM.badge {text, bgColor, textColor, schedule} | NO | IN | D1 FR-261, FR-265..272; D1 FR-317 |
| K-059 | Popular badge | Badge on the default option (cocoa only) | — | NO | CUT (one visual template) | K1 F-MENU-03; K2 FR-320 |
| K-060 | Nutrition disclaimer | Banner "Nutrition & Allergen Information" with 2,000-calorie advice; only when the feature is on (default off) | Feature flag only | NO | IN | K1 F-MENU-06; K2 FR-324 |
| K-061 | Allergens on item | Fixed allergen list on the item. Trace values: contains, may contain ("pode conter"), not informed ("não informado"), per decision 3 | ITEM.allergens (NEW trace values) | NO | IN | K1 F-MENU-06; K2 FR-323; D8 notes (allergen trace values) |
| K-062 | Age notice before adding | Item with ageRestriction > 0 (and no options): "You may need photo ID" with Cancel / Confirm, asked once per order. Add-time notice on the confirmation. No staff approval | ITEM.ageRestriction, ITEM.alcoholic | NO | IN | K1 SCR-MENU-12, F-BASKET-12; K2 FR-325, UJ-MENU-02; D1 FR-189, FR-199 |
| K-063 | Item without options | Item with no visible required options is added straight to the order and the "Added" overlay shows | ITEM | HAS | IN | K2 FR-313; K1 F-MENU-04 |
| K-064 | Sizes on item detail | Size list (SIZED_ITEM); default size preselected; button "Add to Order {total}", "Continue" (options exist) or disabled (no size chosen). Auto-advance straight to options for items with options | SIZED_ITEM, ITEM links | PART | IN | K1 F-MENU-04, F-MENU-04 auto-advance; K2 FR-314, FR-315, FR-317; D1 FR-186 |
| K-065 | Quantity on the item | Starts at 1; minus disabled at 1. Increase rebuilds the draft at N; button total = price x N. Identical lines count as one quantity | OrderItem.quantity, ITEM.maxChoices | HAS | IN | K1 F-MENU-10; K2 FR-326, FR-348 |
| K-066 | Option group minimum and continue | Continue enabled only when the group minimum is met or the group is optional. Maximum 0 = no limit. Label shows running total. Per-option stepper 0 to the option maximum; 0 removes the option | MODIFIERS.min, MODIFIERS.max, ITEM.maxChoices | PART | IN | K1 F-MENU-07, business rules 275-279; K2 FR-327, FR-330; UJ-MENU-02 |
| K-067 | Replace or toggle, and auto-advance at maximum | Group maximum 1: a new choice replaces the old one. Maximum above 1: options toggle up to the cap (cocoa blocks at the cap; legacy drops the oldest). When the maximum is reached, the screen moves on after about 200 ms | MODIFIERS.max | PART | IN | K1 F-MENU-07; K2 FR-328, FR-336 |
| K-068 | Exclusive option (supersede) | Choosing the option deselects and blocks all other options of the group, whatever the maximum. Enabling it clears the flag on siblings. Confirmation when it is set; warns when another option loses its status | NEW MODIFIERS.supersedes (on the option link) | NO | IN | K1 F-MENU-07; K2 FR-329; D1 FR-257 (G-A8) |
| K-069 | Nested option groups | An option with its own groups opens a sub-screen. A required empty nested group blocks. Back on an empty required group unselects the parent. "Customise" reopens it | ITEM links to MODIFIERS (nested); OrderItem.modifiers | PART | IN | K1 F-MENU-07; K2 FR-333 |
| K-070 | Invisible single-choice group | Standard group with minimum 1, exactly 1 option and no nested groups: applied automatically, never shown | MODIFIERS.min, MODIFIERS.max | ? | IN | K1 F-MENU-07; K2 FR-332 |
| K-071 | Mandatory single choice | Group with minimum = maximum = 1 is a mandatory single choice (REQUIRED-MODIFIER) | MODIFIERS.min, MODIFIERS.max; NEW enum REQUIRED | ? | IN | K1 F-MENU-07; K2 FR-334 |
| K-072 | Group roles | Roles: MODIFIERS, REQUIRED-MODIFIER, UPSELLS, INGREDIENTS, INGREDIENT_MODIFIERS, SURCHARGE (left out of forced pricing), COMBO_MAIN, composite TOGGLE | MODIFIERS.modifierType (MODI, SIZE, INGR, SURC, INGM); NEW enum UPSELL, REQUIRED | PART | IN | K1 F-MENU-07; K2 FR-335 |
| K-073 | Default option preselected | Group's default option is preselected unless it has nested groups. Options with a default quantity above 0 come preselected at that quantity | NEW MODIFIERS.defaultOption; ITEM.defaultQuantity | PART | IN | K1 F-MENU-04, F-MENU-07; K2 FR-316; D1 FR-248 |
| K-074 | Forced-group price delta | Option price shown as its price minus the cheapest baseline. Negative deltas can show "+/-" | ITEM.price, MODIFIERS.min, MODIFIERS.max | NO | IN | K1 F-MENU-07; K2 FR-331 (see defects on client-side pricing) |
| K-075 | Ingredient customisation | Screen "Customise {item}": Add / Added toggles with price; Reset (disabled when nothing changed); Cancel; Save Changes. Reset restores item defaults | MODIFIERS.modifierType = INGR, INGM; ITEM.defaultQuantity | NO | IN | K1 F-MENU-08; K2 FR-337, FR-339 |
| K-076 | Composite TOGGLE option | Option with POSITIVE, NEGATIVE or no state, default from defaultChoice. Negative shows "Removed" | NEW ITEM.toggleDefault (POSITIVE, NEGATIVE, NONE) | NO | IN | K1 F-MENU-08; K2 FR-338 |
| K-077 | Combo: main item and sides | COMBO_MAIN picked by the menu default; changed only by "Select main Item" on the review (Confirm / Cancel). Combo sides via COMBO_SIDE | COMBO_MEAL, COMBO_MAIN, COMBO_SIDE (MODELS 5.14) | PART | IN | K1 F-MENU-09; K2 FR-341; UJ-MENU-04 |
| K-078 | Combo pricing models | Two models: MINIMUM_PRICING_MODEL and DEFAULT_SELECTION_PRICING_MODEL. Negative line prices are possible in the spec (see defects); the Go API decides | COMBO_MEAL.price; option price on COMBO_MAIN / COMBO_SIDE | NO | IN | K2 FR-342; K1 F-MENU-09 |
| K-079 | Suggestive selling after add | After adding an item that matches a rule: "Would you like anything else?" Only the first matching rule. Choose with a stepper; "Add to Order" disabled until one is chosen; "No Thanks" or "Done" | SWAP_SELL (MODELS 5.17; cross-sell is not in MODELS 5.18) | HAS | IN | K1 F-MENU-11; K2 FR-343, FR-344, UJ-MENU-03; D4 FEAT-055; D6 CFG-446..469; D8 ENT-057, ENT-058 |
| K-080 | Item added overlay | "Added To Order" overlay, 500 ms default, tap dismisses. Silent adds skip it. Totals recalculate on add | OrderItem | ? | IN | K1 F-MENU-12; K2 FR-345 |
| K-081 | Review before adding | Title "Review your choices": each option with quantity badge and line price; "Change main", "Customise"; button "Add to Order {total}" or "Update Order {total}" for an edit | OrderItem.totalPrice | PART | IN | K1 F-MENU-12; K2 FR-340, FR-349 |
| K-082 | Product search | Route /productSearch exists only for self-checkout; default template shows "not implemented" | — | NO | CUT (Scan-and-Go / self-checkout) | K1 F-MENU-14; K2 FR-347 |
| K-083 | Section display options | showCategoriesPrice (hide category prices); section starts collapsed on the consumer menu; default item preselected in a section | NEW CATEGORY.showPrice, CATEGORY.startCollapsed, CATEGORY.defaultItemId | NO | IN | K1 F-MENU-02; D1 FR-156, FR-159, FR-162 |
| K-084 | Section hours per channel | Section hidden outside its schedule per channel (delivery, dine-in, pickup, take-out, to seat). Day 1 = Sunday to 7 = Saturday; overnight windows allowed; hours are in the store timezone | NEW CATEGORY.availableHours.orderType (channel); CATEGORY.availableHours | PART | IN [T] | D1 FR-160, FR-165, FR-168..173, FR-180; B1 BR-MNU-01, FR-MNU-002 |
| K-085 | Ordering window by date | Section can only be ordered inside a date window: start and end date, start and end time (on the first and last day), store timezone. Shown message to the guest about the change, max 140 | NEW CATEGORY.orderingWindow {startDate, endDate, startTime, endTime, message} (see Q6) | NO | IN (see Q6) | D1 FR-175..179, FR-147 (G-T4); D1 FR-175 |
| K-086 | Barcode lookup to add an item | Matching a scanned barcode to a menu item (scan-and-go) | ITEM.barcodes | NO | CUT (Scan-and-Go) | K1 F-SCAN-02; K2 FR-505, FR-509 |
| K-087 | Menu images | Item and section images via IMAGE; placeholder on failure | IMAGE | PART | IN | D1 FR-154, FR-174, FR-185; B1 DM-MNU-04 |

### F. Basket and totals

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-088 | Basket lines | Name, chosen options, quantity, price. Identical lines (same item, options, quantities) merge into one row with summed quantity, sorted by item name | OrderItem (uniqueId, quantity, total) | HAS | IN | K1 F-BASKET-01; K2 FR-401, FR-408 |
| K-089 | Remove a line | Remove needs a confirmation (two taps or a dialog "Remove Item?"). Totals recalculate | OrderItem | HAS | IN | K1 F-BASKET-01; K2 FR-403 |
| K-090 | Edit a line with options | Edit (Update) offered only when the item has option groups; reopens the customisation; button "Update Order" | OrderItem.modifiers | PART | IN | K1 F-BASKET-01; K2 FR-349, FR-404 |
| K-091 | Quantity on a basket line | +/- stepper on the line; totals recalculate | OrderItem.quantity | ? | IN | K2 FR-405; UJ-BASKET-01 |
| K-092 | Totals block | Lines: Sub Total, Tax (when prices are tax-exclusive or configured), Service Charge, named fees, Discounts, donation, Total. Block shows only when total differs from subtotal or tax is exclusive. Discount and fee values are hidden while prices load, so no stale total shows | Totals (subTotal, taxTotal, serviceChargeTotal, discountTotal, total); ServiceCharge; Payment.donationAmount | PART | IN [T] | K2 FR-409, FR-410, FR-416; K1 F-BASKET-02; B1 DM-ORD-04, ORCH-TOTALS |
| K-093 | Tax by order type | Tax on the order by type: dine-in and table orders to seatTax; take-out, pickup and drive-thru to pickupTax; delivery to deliveryTax. One tax line per rate. Tax is computed by Go, never by the app | TAX (seatTax, pickupTax, deliveryTax); OrderItem.itemTax | ? | IN | Decision 5; K1 F-BASKET-02; D10 (TAX groups per channel); D3 (no TAX column for DINEIN, TAKE_OUT) |
| K-094 | Service charge line | "Service Charge" line hidden when the sum of visible fees is at least the service charge. Fee with total 0 or no name hidden. Fee named "round up" shows the charity name. Percentage set in store config; Go computes the value (decision 6). Whether it applies to dine-in only or to all orders: see Q4 | NEW StoreConfiguration.serviceChargePercent; ServiceCharge (value from Go) | NO | IN (see Q4) [T] | K1 F-BASKET-02; K2 FR-411; decision 6; D10 FEAT-053 notes (plan decision 16 says no fee in pilot) |
| K-095 | Pay button waits for totals | Pay button shows "PLEASE WAIT" and is disabled until totals arrive | — | PART | IN | K2 FR-414; K1 BR-BASKET-10 |
| K-096 | Empty basket | Text "Your basket is empty"; pay disabled; totals call skipped | OrderItem | HAS | IN | K1 BR-BASKET-10; K2 FR-417 |
| K-097 | Pay button label | "Confirm & Pay"; disabled states carry text for the screen reader (accessibility part is cut) | — | HAS | IN | K2 FR-418 |
| K-098 | Maximum order total | Totals above R$ 10,000.00 block payment with "Order total is too high". Equal is allowed. Checked first among pre-payment gates | NEW StoreConfiguration.maxOrderTotal (BRL 10000.00) | NO | IN | K1 BR-BASKET-08; K2 FR-420 (spec is 1,000,000 minor units; see defects) |
| K-099 | Maximum basket lines | Error "Too many items in your order" (server code BASKET_ITEM_LIMIT_EXCEEDED). Pay disabled until the basket recalculates below the limit. Value of the limit is not in the spec | NEW StoreConfiguration.maxItemLines | NO | IN | K2 FR-421 |
| K-100 | Cancel the whole order | "Cancel Order?" with "Go back" (closes, keeps basket) and "Cancel order" (clears and goes to the welcome screen) | Order | PART | IN | K1 F-BASKET-04; K2 FR-423, FR-424, UJ-BASKET-02 |
| K-101 | Donation row in basket | Row "Charity Donate" with amounts and "Donate"; the donation amount joins the total. Donation provider integration is out | Payment.donationAmount | NO | IN (provider OUT) | K1 F-BASKET-11; K2 FR-445; B1 FR-ORD-009 |
| K-102 | Tip row in basket | Row "Tip" with "Edit" reopens the tip step; tip joins the total | Payment.tipAmount | NO | IN | K1 F-BASKET-11; K2 FR-834 |
| K-103 | Vouchers check line | "Checking for vouchers" while discount checks run (cocoa only) | — | NO | CUT (one visual template) | K2 FR-446 |
| K-104 | CPF or CNPJ on the receipt | Optional on the summary: "CPF/CNPJ on receipt? (optional)". CPF 11 digits, CNPJ 14 digits with check digits; mask changes at 11 digits; empty clears; shown masked; never logged | SubmitOrderRequest.invoiceCpfCnpj | HAS | IN | K1 F-BASKET-10; K2 FR-437, FR-438, FR-439, FR-440; UJ-BASKET-05 |
| K-105 | Gift-card lines and banner in basket | Gift-card purchase banner, gift-card rows and their totals | — | NO | OUT (decision 9) | K1 F-BASKET-11; K2 FR-445, FR-928, FR-929 |
| K-106 | Line totals for a line removed by the age gate | Removing a restricted group at the gate deletes all its lines | OrderItem | NO | CUT (staff age approval) | K2 FR-430 |

### G. Pre-payment gates and age

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-107 | Pre-payment gates order | Gates in order, first match wins: donation question, maximum order total, maximum basket lines, age gate (cut), then the payment chooser | Totals.total, OrderItem count | PART | IN | K1 F-BASKET-03, BR-BASKET-08; K2 FR-419, FR-420, FR-421; UJ-PAY-01 |
| K-108 | Age approval by staff (PIN, Challenge 25) | Age gate on self-checkout and approval brands: lists restricted items; "Staff approval" button; staff PIN (4 digits, 5 attempts, locked, unavailable copy); "Challenge 25" checkbox "I confirm I have applied Challenge 25..."; "Approved" toast; "Verification Declined" / "Return kiosk to guest" | — | NO | CUT (staff age approval) | K1 F-BASKET-05..09; K2 FR-426..436, UJ-BASKET-03, UJ-BASKET-04, UJ-E2E-04; B1 EP-ORD-02 (clerk PIN returns {}) |
| K-109 | 18+ marks on lines | Restricted lines show "18+" badge; approved lines say "Item Authorised"; screen reader suffix | — | NO | CUT (staff age approval) | K2 FR-402, FR-406, FR-407; K1 F-BASKET-09 |

### H. Codes, coupons and promotions

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-110 | Enter a coupon code | Screen "Enter your coupon code" with a code keypad; submit applies the code. One coupon per order; a second code shows "Code already added" / "Only one code may be applied to an order." | Award (type CODE); Discount | PART | IN | K1 F-DISC-01; K2 FR-701, FR-715, FR-713, UJ-DISC-01; B1 BR-LOY-01, FEAT-LOY-01 (couponing kept) |
| K-111 | Coupon success and replace | "Coupon added to order" / "Discount added to order". Swapping a discount asks "Replace your current discount?" (Continue / Cancel). Discount limit: "Discount limit reached" + "To apply a different code you must remove one from your order." | Discount | NO | IN | K2 FR-713, FR-716, FR-734, FR-735 |
| K-112 | Invalid code and failure dialogs | Invalid code: "QR code not valid" / "This QR code can not be used at this location" (copy says QR for typed codes; see defects). Add failure: "Discount Error" / "A problem occurred while adding your discount". "More details" expands the error fields. Remove failure: "Sorry, your discount could not be removed." | Discount | NO | IN | K1 F-DISC-06; K2 FR-731, FR-739, FR-740, FR-743; B1 BR-LOY-01 (void retries) |
| K-113 | Remove a discount | Remove asks for confirmation ("Remove Coupon?" / "Remove discount?"), voids it by type, recalculates totals. Removing the last one clears the applied state | Discount | PART | IN | K2 FR-442, FR-732, FR-733; K1 F-BASKET-11; UJ-DISC-04 |
| K-114 | Limited-use coupon needs an ID code | Banner "Unlock your discount with ID code" for limited-use coupons | NEW Award.requiresIdCode | NO | IN | K2 FR-714 |
| K-115 | Restaurant discount code entry | Modal with code input; Apply disabled until a code is typed; "PLEASE WAIT" while applying | Discount | NO | IN | K2 FR-719 |
| K-116 | Discount list | "Your Discounts" modal: "Discount total", "Add Discount", "Close". Points balance is loyalty (cut) | Discount, Award | PART | IN | K2 FR-444, FR-728 |
| K-117 | Kiosk promotion record (menu of promotions) | Promotion name required, nonblank, max 100 (customer-facing); description optional, max 255 (whitespace saved as null); enabled (off does not delete history); banner yes/no with banner text required; pop-up yes/no; customer offer text; allowed for guests (no account needed). Toggle is optimistic and disabled while a change is pending | NEW Award.displayName, Award.description, Award.enabled, Award.banner, Award.bannerText, Award.popup, Award.guestAllowed | NO | IN | D1 FR-318, FR-319, FR-334, FR-351, FR-356, FR-357, FR-359, FR-376, FR-432..434; D4 SCR-179..182, FORM-055; D6 CFG-432..434; D10 FEAT-053, CFG-432..434 |
| K-118 | Promotion rules | Start and end date and time; minimum basket value; targets (items or sections); once per order; daily limit; discount cap. Eligibility rules are ours to model (v2 gives results only) | NEW Award.startsAt, Award.endsAt, Award.minBasketValue, Award.targets, Award.maxUsesPerOrder, Award.dailyLimit, Award.discountCap | NO | IN | D10 FEAT-053 (readers' finding); D1 FR-335, FR-369; K1 F-BASKET-11; B1 BR-LOY-02 (maxNumberOfDiscountsPerOrder) |
| K-119 | Promotion code | Promotion by code: code required, max 100 (typed by the guest). Code-based application is one of the modes | NEW Award.code | PART | IN | D1 FR-335, FR-369; D1 FR-335 |
| K-120 | Promotion verification mode | "Staff verification required" or self-service. Staff verification needs a staff step (see Q7) | NEW Award.verification (SELF_SERVICE, STAFF) | NO | IN (see Q7) | D4 FORM-055, CFG-436; D10 CFG-436; D7 FEAT-053 |
| K-121 | Senior discount by age | Discount type by minimum age; age error below the minimum. Not in the brief cut list (see Q12) | NEW Award.minimumAge | NO | IN (see Q12) | K2 UJ-DISC-02; B1 EP-LOY-06, EP-LOY-07, FR-LOY-006, FR-LOY-007; B1 BR-LOY-02 |
| K-122 | Awards and rewards after sign-in | Award selection "Select Your Discount..." with "Confirm Selection"; "More rewards available"; "Add New Discount" pop-up with "Your Balance" | Award (loyalty awards) | NO | CUT (loyalty) | K1 F-DISC-03; K2 FR-723, FR-725, FR-726, FR-727, UJ-DISC-03; B1 EP-LOY-08 |
| K-123 | Legacy scan-coupon pages | Branded legacy coupon pages and their scan error pages | — | NO | CUT (Scan-and-Go) | K1 F-DISC-06 (legacy); K2 FR-741; K2 FR-744 |
| K-124 | Coupon by scanner or QR | "SCAN QR CODE" page with "enter manually"; scanner on the basket; scan on coupon screens applies the code | Discount | NO | HW-LATER (leitor) | K1 F-DISC-01; K2 FR-702, FR-703, FR-707, FR-738 |
| K-125 | Extra discount texts | "Gift Card added to order", "Discount not valid", SMS receipt error | — | NO | CUT (loyalty) | K1 F-DISC-07 |
| K-126 | Promotion popup or banner on the menu | Pop-up or banner for a promotion (see promotion record) | Award.popup, Award.banner | NO | IN | D1 FR-318, FR-356, FR-376 |

### I. Payment

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-127 | Payment chooser | Title "Choose payment". Methods built from device readiness and feature flags (card only when the reader is ready; cash when offered). One runnable method goes straight to its flow; several show the chooser. Back returns to the summary | Payment.tenderId (CARD, CASH) | PART | IN | K1 F-PAY-01, BR-PAY? (readiness); K2 FR-801, FR-802, FR-803, FR-804; UJ-PAY-01 |
| K-128 | Cash as a payment choice | "Cash" appears as a tender. How it is taken without a cash machine: see Q11 | Payment.tenderId = CASH | NO | IN (see Q11) | K2 FR-802, FR-803; decision 8 |
| K-129 | Cash machine: insert, count, change, cancel | Insert screen "Insert cash", amount due, running "Amount paid"; waiting, processing money, cancelling, collect change; "Take your change" / "Change Due"; cancel returns the money; fatal error "Received a fatal error from cash machine." | Payment.amount, Payment.changeAmount (NEW) | NO | HW-LATER (fase 4) | K1 F-ALTPAY-01; K2 FR-814, FR-901, FR-903, FR-904, FR-906, UJ-ALTPAY-01; B1 DM-PAY-05, PAY-03..06, ENT-ALT-01, DT-PER-01, FEAT-PAY-02, UJ-PAY-03 |
| K-130 | Cash rounding discount | Rounding discount on cash totals (cashRoundingDiscount) | Discount | NO | HW-LATER (fase 4) | K2 ENT-ALT-01 |
| K-131 | Card flow on the terminal | "Authorising" screen while the transaction runs; status checked at least once per second; success continues to save the order. Terminal (PED) reads the card | Payment.tenderRef, Payment.authCode, Payment.cardScheme, Payment.cardLast4Digits | PART | IN (screen); terminal HW-LATER | K1 F-PAY-02, business rules 641-642; K2 FR-809; UJ-PAY-01 |
| K-132 | Card terminal adapters | One adapter per terminal provider (Adyen, FreedomPay, Ocius, Wirecard, Heartland, Worldpay, Planet, etc.); selection by gateway name; per-provider timeouts and retries | Payment | NO | HW-LATER (fase 4) | B1 PROV-PED, PROV-SEL, FR-PAY-001, INT-35, FEAT-PAY-01, ORCH-PAY; K1 F-PAY-02 |
| K-133 | Payment error screen | Title and subtitle; "Try Again" when retryable; back or "OK" when fatal. Gateway codes PE01 to PE09 and LEGACY map to texts. Code mapping is part of the terminal work | Payment.errorCode | NO | IN (screen); codes HW-LATER | K1 F-PAY-03, BR-PAY-08; K2 FR-817, FR-847; B1 PAY-ECODES, DM-PAY-02, VAL-PAY |
| K-134 | Authorisation timeout | Dialog "payment expired" when the authorisation times out | Payment.state | NO | IN | K2 FR-819 |
| K-135 | Cancel a running payment | Cancelling a running payment asks for confirmation first | Payment | NO | IN | K2 FR-820 |
| K-136 | Tip step | Tip step before paying: preset percentages (values in Q8), custom amount in a modal (apply / cancel), "no tip" choice, "Continue" starts payment. Jar icon fills by size (EMPTY, LOW, MEDIUM, HIGH, FULL) | Payment.tipAmount; NEW StoreConfiguration.tipPresets | NO | IN (values see Q8) | K1 F-PAY-05; K2 FR-829..833, FR-834, UJ-PAY-03 |
| K-137 | Donation prompt before payment | Donation modal before paying; "apply" or "skip" resumes the payment path. Amounts from store config (values in Q8). Donation provider is out | Payment.donationAmount; NEW StoreConfiguration.donationAmounts | NO | IN (provider OUT) | K1 F-PAY-06; K2 FR-419, FR-835, UJ-PAY-04; B1 FR-ORD-009 |
| K-138 | Zero-amount payment | Order fully covered by a coupon finishes with no payment transaction | Payment.amount = 0 | NO | IN | B1 BR-PAY-04, PAY-01 |
| K-139 | Automatic refund on failure after authorisation | If the order cannot be saved after authorisation, the payment is refunded or voided. If the refund fails, status CANCEL_OR_REFUND_ERROR shows to the owner | Payment.state | NO | IN | B1 BR-PAY-05, FR-PAY-007, INT-30 |
| K-140 | Payment states that release the order | Authorised (AUTHORIZED) is not paid in the plan; a paid order follows the Go order status (CAPTURED, SUCCESS). Spec counts AUTHORIZED as success (see defects) | Payment.state, Order.status | PART | IN | B1 BR-PAY-03, PAY-STATES, DM-PAY-04, FR-PAY-007 |
| K-141 | Order not saved after payment | Copy "Thanks for your payment, but we weren't able to complete your order!" / "You have not been charged. Please contact staff for assistance." No retry | Order.status | NO | IN (copy to fix, see defects) | K2 FR-848; B1 VAL-ORD, EP-ORD-01 |
| K-142 | Wait time on payment screen | "Current wait time is about {n} minute(s)" when the wait is set | NEW StoreConfiguration.waitTimeMinutes | PART | IN | K1 F-PAY-06; K2 FR-839 |
| K-143 | Pre-payment order check | Order must have a type and at least one item; otherwise an error (not a silent empty result) | Order | PART | IN | B1 FR-ORD-002, VAL-ORD, DT-ORD-01 |
| K-144 | Pay with another method: gift card | Gift-card balance check, pay in full or partial, custom amount, insufficient balance, card PIN, gift-card purchase | Payment.tenderId (out) | NO | OUT (decision 9) | K1 F-ALTPAY-03, BR-ALTPAY-08; K2 FR-919..929, FR-949; B1 DM-SVC-01, SVC-01..02, FEAT-SVC-01, FR-SVC-002, UJ-ALTPAY-03 |
| K-145 | Pay with another method: stored value | Heartland and other stored-value inquiry, redeem and reverse | Payment.tenderId (out) | NO | OUT (decision 9) | B1 SVC-05..07, FR-SVC-005..007, FEAT-SVC-03, VAL-SVC |
| K-146 | Pay with another method: room charge | Hotel picker "Select Hotel", room details, reservation check, "Charge room", error dialog | Payment.tenderId (out); Customer (out) | NO | OUT (decision 9) | K1 F-ALTPAY-04; K2 FR-931..936; B1 SVC-03, SVC-04, FEAT-SVC-02, UJ-XD-04 |
| K-147 | Pay with another method: crypto | Crypto QR page "Scan the QR code to pay", expiry and cancel dialogs, polling until settled | Payment.tenderId (out) | NO | OUT (decision 9) | K1 F-ALTPAY-02; K2 FR-911..916; B1 PAY-09..11, PROV-CRYPTO, UJ-PAY-05 |
| K-148 | Pay with another method: app payment | Pay by a scanned code in a payment app | Payment.tenderId (out) | NO | OUT (decision 9) | K1 F-ALTPAY-05; K2 FR-939, FR-503; B1 PAY-16, PROV-APP |
| K-149 | Pay with another method: face recognition | Face camera, two-factor PIN, 3 attempts, "Processing Face ID payment" | Payment.tenderId (out) | NO | OUT (decision 9) | K1 F-ALTPAY-06, BR-ALTPAY-09; K2 FR-943..950; B1 PAY-12..15, PROV-FACEID, UJ-ALTPAY-05 |
| K-150 | Food stamps (EBT) | Food-stamp method and banner "order is flagged EBT"; food-stamp cross-check refunds | Payment.tenderId (out) | NO | OUT (decision 9) | K2 FR-807, FR-837; B1 BR-PAY-07, FR-PAY-006, PAY-02 |
| K-151 | Split payment (several methods on one order) | Pay part with one method and the rest with another; the chooser shows the remaining amount; partial payments reversed on re-entry | Payment (several per order) | NO | CUT (split bill) | K1 F-PAY-04, F-ALTPAY-07; K2 FR-805, FR-821, FR-827, FR-909, FR-927; B1 BR-ORD-09, FR-PAY-008, UJ-PAY-02, EP-ORD-03, INT-19; K2 UJ-E2E-05 |
| K-152 | Payment screen cancel guard | Cancel dialogs for payment, crypto, face recognition and split payments | Payment | NO | IN (payment cancel) / CUT (split) | K1 F-ALTPAY-07; K2 FR-820 |
| K-153 | Branded payment error pages | Branded error pages (bk, costa, itsu, shakeshack) | — | NO | CUT (one visual template) | K2 FR-824 |

### J. Order completion, notification and receipt

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-154 | Waiting screen while the order is sent | Waiting screen until the order response; then success | — | PART | IN | K1 F-POST-04; K2 FR-1027; UJ-POST-01 |
| K-155 | Order timeout: check and retry | Server timeout (504): check the order status up to 3 times at 5 s (spec). Plan: retry the same request with the same Idempotency-Key within 15 s, show "verificando seu pedido" (see defects) | Order (Idempotency-Key) | PART | IN | B1 BR-ORD-04, FR-ORD-004, INT-14, EP-ORD-01; K1 F-POST-04; CLAUDE.md (Idempotency-Key) |
| K-156 | Success screen and order number | Title; "Order number" and the number; "Done" goes to the start. Shows the customer check number | SubmitOrderResponse.number, SubmitOrderResponse.customerCheckNumber | HAS | IN | K1 F-POST-01; K2 FR-1001, FR-1002; UJ-POST-01 |
| K-157 | Order number display length | Show the last N digits when the number is longer than the display length (config posCheckNumberDisplayLength). Reset rule for the number is open (see Q9) | NEW StoreConfiguration.orderNumberDisplayLength; Order.number | PART | IN (see Q9) | K1 BR-POST-01; K2 FR-1004; B1 DM-PAY-03 |
| K-158 | Wait time on success | "Current wait time is about {n} minute(s)" from the order response | NEW SubmitOrderResponse.waitTimeMinutes | PART | IN | K2 FR-1008; K1 BR-POST-05 |
| K-159 | Buzzer number capture | "Grab a buzzer and enter the number below"; "Please come to the collection point when the buzzer goes off." The number is stored once on the order | NEW Order.notification {type: BUZZER, value} | NO | IN | K2 FR-1011, UJ-POST-02, ENT-POST-01; B1 DM-ORD-08 |
| K-160 | Tent card or table number capture | "Grab a tent card and enter the number below" / "Find a free table and we will bring your order over."; "Enter your table number below" (dine-in) | NEW Order.notification {type: TENT_CARD or TABLE, value} | NO | IN (see Q3) [T] | K1 F-POST-02; K2 FR-1012, FR-1013, UJ-POST-02 |
| K-161 | Guest name | Name captured (optional; mandatory when feature 162 is on); shown on the success screen. Customer data is back in scope (decision 8) | Customer.firstName | NO | IN | K1 F-POST-02; K2 FR-1009, FR-1015, ENT-POST-01; decision 8 |
| K-162 | Phone for SMS alerts | Phone entry for SMS; invalid keeps Continue disabled; failure shows SmsErrorDialog. Digital receipts are open (see Q2) | Customer.phoneNumber | NO | IN (see Q2) | K2 FR-1014, UJ-POST-03; K1 F-POST-02 |
| K-163 | Print receipt | Print choice per receipt options; failure: "Still need a receipt? Please ask our staff at the counter."; journey continues | — | NO | HW-LATER (fase 4) | K1 F-POST-03; K2 FR-1019, FR-1020; B1 FEAT-RCP-03, EP-RCP-04, EP-RCP-05, FR-RCP-003..005, DM-RCP-02 |
| K-164 | Email receipt | Modal "emailReceiptTitle", "This email will not be used for marketing purposes", Cancel / Send Receipt; sent state "receiptSentTitle" / "receiptSentSubtitle"; email valid when no spaces, one "@", a domain with a dot | Customer.email | NO | IN (see Q2) | K1 F-POST-03, BR-POST-07; K2 FR-1021, FR-1022; B1 FR-RCP-001, EP-RCP-01 |
| K-165 | SMS receipt | SMS receipt per receipt options; failure shows SmsErrorDialog | Customer.phoneNumber | NO | IN (see Q2) | K2 FR-1023; B1 EP-RCP-02, INT-80 |
| K-166 | QR receipt and fiscal QR | QR or photo receipt per receipt options; fiscal QR code from the order response (NFC-e is phase 4) | FiscalQR (SubmitOrderResponse.fiscalQrCodeData) | NO | HW-LATER (fase 4, NFC-e) | K2 FR-1024; K2 UJ-POST-03; B1 FEAT-ORD-02 |
| K-167 | Latest order receipt as HTML | HTML receipt for the latest or given order; no printer = conflict response | — | NO | IN (see Q2) | B1 EP-RCP-03, FR-RCP-002, FEAT-RCP-02, INT-81, UJ-RCP-01 |
| K-168 | Receipt channels per store | Which receipt channels appear: print, email, SMS, QR | NEW StoreConfiguration.receiptChannels | NO | IN (see Q2) | K2 FR-1025, ENT-POST-02; B1 DM-ORD-08 |
| K-169 | Done and reset after success | Done clears order, notifications and loyalty/discount state, goes to the start | Order | HAS | IN | K2 FR-1031, FR-1033, FR-1034; K1 BR-POST-06 |
| K-170 | Success screen variants | Variants per brand (cocoa, V2, buzzer, shakeshack, bk, costa, itsu, self-checkout) and a cocoa variant without the email surface | — | NO | CUT (one visual template) | K2 FR-1007, FR-1029 |
| K-171 | Success screen announcement | "Thanks for your order" announced to screen readers | — | NO | CUT (accessibility) | K2 FR-1005 |
| K-172 | Loyalty footers on success | Points earned, claim by barcode | Award | NO | CUT (loyalty) | K2 FR-1003; K1 F-POST-01 |

### K. Help and staff

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-173 | Ask for staff help | Help button on the kiosk requests staff. Copy "Help is on the way" / "Please wait." while pending. "Cancel help" cancels the request. No v2 model for a staff call (not table or check) | NO v2 model (staff call) | NO | IN [T] | K2 FR-1205, FR-1206, FR-1207, DI-A12-SCO-HELP, UJ-SCO-03; K1 F-SCO-01 (help) |
| K-174 | Staff login on the kiosk | Staff login screen with keypad; wrong code message; clerk actions (reset session, approve item, delete item, print last receipt, done) | — | NO | CUT (Scan-and-Go / self-checkout) | K1 F-SCO-01, BR-SCO-03; K2 FR-1209, FR-1211, FR-1212, FR-1213, ENT-SCO-01, UJ-SCO-02 |

### L. Self-checkout and scan-and-go (cut)

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-175 | Self-checkout mode | Self-checkout home, product, basket, payment, help screens; template tree; per-slot templates | — | NO | CUT (Scan-and-Go) | K1 F-SCO-01, F-SCO-03, BR-SCO-01..05; K2 FR-1201..1204, FR-422, FR-534, UJ-SCO-01 |
| K-176 | Scan barcode to add an item | Scan adds a menu item; scanned-items modal with remove and subtotal; "Scanned Items", "View and manage scanned items", "Remove {name} from order", "Browse Menu", "Your Order"; scanned items kept apart from added items | ITEM.barcodes | NO | CUT (Scan-and-Go) | K1 F-SCAN-02..05; K2 FR-505..520, FR-524, UJ-SCAN-01 |
| K-177 | Scan messages | "The barcode could not be recognised. Please try again or ask for help." (10 s); "Item cannot be purchased here" / "This item is age-restricted and cannot be sold at the kiosk. Please purchase it at the till." (7 s) | — | NO | CUT (Scan-and-Go) | K1 F-SCAN-04, F-SCAN-05; K2 FR-518, FR-521..526 |
| K-178 | Barcode reader hardware | Keyboard-wedge reader (80 ms gap, 4 characters minimum, ends at Enter or 160 ms) and serial reader; health checks; WebSocket broadcast; scan routing by screen | — | NO | HW-LATER (leitor) | K1 F-SCAN-06; K2 FR-501, FR-508, FR-529..532; B1 FEAT-PER-01, EP-PER-01..03, PER-SCANTYPES, DI-A05-HID |
| K-179 | Scan-to-pay routing | Scans on gift-card, app payment, loyalty and coupon screens go to their handler; other screens ignore the scan | — | NO | CUT (Scan-and-Go) | K1 F-SCAN-01; K2 FR-502, FR-506, FR-507; UJ-SCAN-02 |
| K-180 | Scan item age refusal | Restricted item scanned with approval unavailable: no item, refusal shows | ITEM.ageRestriction | NO | CUT (staff age approval) | K2 FR-511, FR-528 |

### M. Loyalty, identity and account (cut or out)

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-181 | Loyalty sign-in by scan, phone, email or id | Providers Punchh, Avolta, Accesso, NST Yoyo, Pepper, LoyaltyV2; methods (code, phone, email, user id); method picker "Link your loyalty account"; manual entry; errors "More details" | — | NO | CUT (loyalty) | K1 F-LOYAL-01, F-LOYAL-03, F-LOYAL-07, BR-LOYAL-01..08; K2 FR-602..610, FR-629, FR-630, UJ-LOYAL-01, UJ-LOYAL-02; B1 IDN-01, FR-IDN-001, FR-IDN-003, FR-LOY-001 |
| K-182 | Avolta sign-in, sign-up and terms | QR and phone sign-in; "No QR code?"; dial-code picker; sign-up with terms; "Club Avolta"; duplicate phone dialog | — | NO | CUT (loyalty) | K1 F-LOYAL-02, F-LOYAL-06; K2 FR-612..619, FR-504, FR-613..616, FR-626, FR-627, UJ-LOYAL-03; B1 IDN-04, IDN-05, IDN-06 |
| K-183 | Loyalty banners and "logged in" overlays | "You are logged in"; "Logged In Successfully" overlay; sign-out; loyalty banner on the order-type and payment screens | — | NO | CUT (loyalty) | K1 F-LOYAL-05, F-START-08, F-PAY-06; K2 FR-231, FR-233, FR-608, FR-609, FR-611, FR-624, FR-625 |
| K-184 | Repeat order and order history | "Browse past orders", reorder rows, reorder rebuilds the basket, history empty and failure copy | Order (history) | NO | OUT (decision 8: repeat order) | K1 F-LOYAL-08; K2 FR-635..641, UJ-LOYAL-04; D4 SCR-118..120, ACT-342..346; D6 CFG-466, CFG-467; D13 FEAT-057 |
| K-185 | Customer accounts and sign-up | Account sign-up with terms; "Register Error"; account-exists dialog | — | NO | CUT (loyalty) | K1 F-LOYAL-06; K2 FR-617, FR-628; B1 IDN-04 |
| K-186 | Face recognition sign-in | "Users, order here" button; face recognition failure dialog; recognised face signs the guest in | — | NO | OUT (decision 9) | K1 F-LOYAL-04; K2 FR-621..623, FR-643; B1 IDN-02, IDN-03, IDN-07, IDN-08, FEAT-IDN-02, FEAT-IDN-03 |
| K-187 | Consent and legal documents | Allergen consent prompts, consent messages, consent for POS and table bill, allergen policy page or link | — | NO | OUT (decision 8: consent workflows) | D2 FR-585..599; D12 CFG-585..599; D8 ENT-078..081, JOURNEY-014; D7 FEAT-070 |
| K-188 | Guest conversion campaigns | Banner, prompt, button and success icon styling; campaign targets; opted-out re-prompt | — | NO | OUT (decision 8: guest conversion) | D2 FR-470..484; D4 FEAT-058; D6 CFG-470..486; D13 FEAT-058; D8 JOURNEY-018 |
| K-189 | Loyalty points and rewards display | Points balance on discounts list; points on success | Award | NO | CUT (loyalty) | K2 FR-444, FR-838; K1 F-LOYAL-09 |
| K-190 | Senior-discount and loyalty-type flags | Flags seniorDiscountEnabled, loyaltyTypesEnabled, punchhEnabled gate loyalty screens | — | NO | CUT (loyalty) | B1 BR-LOY-02, LOY-PROV, FR-LOY-002 |
| K-191 | Gift card purchase and balance | Gift-card scan-to-buy, denominations, data-expiry notice | — | NO | OUT (decision 9) | K2 FR-928, FR-929; B1 SVC-01 |

### N. Accessibility, keyboard and layout

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-192 | Accessibility mode and audio navigation | Accessibility toggle and mode (larger targets, higher contrast), focus navigation, screen reader announcements, audio guidance, NavPed keys (right to tab, left to shift-tab, F8 to F15, F9 to F16) | — | NO | CUT (accessibility mode) | K1 F-PRES-02, F-PRES-06, UJ-PRES-01, UJ-E2E-08; K2 FR-218, FR-350, FR-415, FR-425, FR-1111..1115, FR-1117, FR-1120, FR-1124; B1 API-H-A11Y, API-H-AUDIO, FEAT-PER-03, PER-NAVPAD, DT-PER-02, DI-A02-NAVPED |
| K-193 | On-screen keyboard and numeric keypad | Keypad for numbers (phone, CPF, buzzer); PT and EN keyboard layouts; maxLength and input pattern; tap a field opens the matching keyboard; confirm and cancel wired to the field | Customer.phoneNumber, invoiceCpfCnpj | PART | IN | K1 F-PRES-03; K2 FR-1125, FR-1126, FR-1129, FR-1130; UJ-PRES-02 |
| K-194 | Other keyboard layouts | Layouts for arabic, chinese, japanese, korean, russian, german, french, spanish; Avolta alphabetic keyboard; tabbed keyboard | — | NO | OUT (CLAUDE.md: PT-BR and EN only) | K2 FR-1123, FR-1124, FR-1128 |
| K-195 | Money display | Currency via pt-BR BRL format (R$ 0,00); no cents in the UI | Money (decimal, BRL) | PART | IN | K2 FR-1131, FR-1127; UJ-PRES-03; CLAUDE.md |
| K-196 | Screen layouts and size variants | Variants by screen ratio; portrait and landscape; the totem is portrait only (1080x1920) | — | NO | OUT (CLAUDE.md: portrait only) | K2 FR-1135; D2 FR-542, FR-543 |
| K-197 | Modal focus | Modals move focus to the primary button; focus trap inside open modals | — | NO | CUT (accessibility mode) | K2 FR-1113, FR-1119 |
| K-198 | Store logo and brand images | Logo image with fallback; floating logo | NEW StoreConfiguration.logo | NO | IN | K2 FR-1105 |

### O. Cache, menu serving and images (kiosk side of the BFF)

| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| K-199 | Image serving | Image id checked against a whitelist; no ".."; canonical path must stay in the images folder (400 on violation); missing 404; otherwise raw bytes. Image dimensions map is off by default | IMAGE | PART | IN | B1 FEAT-MNU-03, FR-MNU-006, EP-MNU-06, INT-07, BG-BKG-04, DT-MNU-02 |
| K-200 | Menu cache update timing | A changed menu waits for the next journey; failed builds retry after 10 s; a menu with no cache returns "not ready" (offline screen) | — | PART | IN | B1 BR-BKG-02, BR-BKG-06, FEAT-BKG-02, UJ-E2E-05 |
| K-201 | Menu not ready | With no menu cache: menu call returns empty with success false; the kiosk shows the offline screen | — | PART | IN | B1 EP-MNU-01, VAL-MNU |
| K-202 | Kiosk telemetry screen and key actions | Status and key-action logs for the kiosk, with enum fields | — | PART | IN | B1 FR-OPS-005, EP-OPS-05, FEAT-OPS-04 |
| K-203 | Cash status refresh | Cash-machine status and refresh (UNKNOWN on failure) | — | NO | HW-LATER (fase 4) | B1 FEAT-OPS-05, FR-OPS-003, EP-OPS-03, EP-OPS-06 |
| K-204 | Printer and cash-machine provider setup | Printer types, cash-machine providers, status codes OK(1) to ERROR_UNKNOWN(99); re-init on config change | — | NO | HW-LATER (fase 4) | B1 INT-82, DM-RCP-02, BG-BKG-15, BG-BKG-14, DM-OPS-04 |
| K-205 | Partial payment unwind on abandon | On abandon, cancel partial payments and refund stored payments | Payment (split bill) | NO | CUT (split bill) | B1 EP-SES-04, BR-ORD-09, ORCH-CANCEL, UJ-E2E-03 |
| K-206 | Stored payment details cleared at journey start | Payment details held for the session are cleared at each new journey; never leaks between journeys | Payment | PART | IN | B1 BR-SES-06, PAY-CLEAR, PAY-PERSIST, FR-PAY-007 |
| K-207 | Payment records and HMAC signing | Payments saved on the server with HMAC signing per type; responses keep only last 4 digits and card scheme | Payment.cardLast4Digits, Payment.cardScheme | PART | IN | B1 PAY-PERSIST, PROV-PCI, CHK-PAY-014, INT-10 (signing = EXT) |

## New fields to add to the v2 models

| Entity.field | Type | Meaning | Why (feature) |
|:--|:--|:--|:--|
| ITEM.visible | boolean | Item hidden from guests, separate from sold out | Hidden vs sold out |
| ITEM.unavailableUntil | datetime | Sold out until this moment, then back by itself | Hidden vs sold out |
| ITEM.dailyLimit | integer | Units that can be sold per day; sold out after | Hidden vs sold out |
| ITEM.labels | list of {code, text} | Label chips on the item, translated | Item labels |
| ITEM.badge | {text, bgColor, textColor, schedule} | Coloured item flag (selo) on card and detail | Item flag badge |
| ITEM.showFromPrice | boolean | Show "from" price on the card | Price shown on the card |
| ITEM.toggleDefault | enum POSITIVE, NEGATIVE, NONE | Default state of a composite TOGGLE option | Composite TOGGLE option |
| ITEM.allergens (trace values) | enum CONTAINS, MAY_CONTAIN, NOT_INFORMED per allergen | "Pode conter" and "não informado" | Allergens on item |
| ITEM.translations | map language to {name, shortName, description} | EN texts; PT is the fallback | Bilingual texts |
| MODIFIERS.defaultOption | reference to one option | Option preselected in the group | Default option preselected |
| MODIFIERS.supersedes (option link) | boolean | Exclusive option: blocks the other options of the group | Exclusive option |
| MODIFIERS.modifierType (new values) | enum add UPSELL, REQUIRED | Roles that have no v2 value today | Group roles |
| CATEGORY.availableHours.orderType | enum channel (DINEIN, TAKE_OUT, DELIVERY, PICKUP, seat) | Section hours per channel | Section hours per channel |
| CATEGORY.orderingWindow | {startDate, endDate, startTime, endTime, message} | Date-restricted ordering; message to guest (max 140) | Ordering window by date (Q6) |
| CATEGORY.showPrice | boolean | Show category price | Section display options |
| CATEGORY.startCollapsed | boolean | Section starts collapsed on consumer menu | Section display options |
| CATEGORY.defaultItemId | reference | Item preselected in the section | Section display options |
| StoreConfiguration.timezone | IANA zone name | Store timezone for hours and times | Store mode, lane status |
| StoreConfiguration.defaultLanguage | enum pt-BR, en | Default kiosk language | Default language missing |
| StoreConfiguration.kioskOrderTypes | flags dineIn, takeOut | Kiosk service switches (at least one on) | Kiosk service switches |
| StoreConfiguration.atCapacity | boolean | Kitchen at capacity: shows the at-capacity screen | At-capacity screen |
| StoreConfiguration.waitTimeMinutes | integer | Kitchen wait shown on menu, payment and success | Kitchen wait line |
| StoreConfiguration.kiosk.idleTimeoutSeconds | integer, 0 = off | Idle timeout (default in Q1) | Idle timer |
| StoreConfiguration.kiosk.closedMessage | {title, description, visibility} | Closed text and priority (always, behind attract, never) | Closed screen, message visibility |
| StoreConfiguration.kiosk.unavailableVisibility | enum | Priority of the unavailable message | Message visibility |
| StoreConfiguration.kiosk.warning | {condition: OFFLINE, CLOSED, NOT_ACCEPTING; title max 50; body max 140; popup} | Operational warning | Operational warning message |
| StoreConfiguration.logo | IMAGE | Store logo; text fallback | Store logo |
| StoreConfiguration.maxOrderTotal | decimal BRL (10000.00) | Blocks payment above this total | Maximum order total |
| StoreConfiguration.maxItemLines | integer (value to define) | Maximum basket lines | Maximum basket lines |
| StoreConfiguration.serviceChargePercent | decimal | Service charge percentage; Go computes the value | Service charge line (decision 6) |
| StoreConfiguration.tipPresets | list of percentages | Tip buttons (values in Q8) | Tip step |
| StoreConfiguration.donationAmounts | list of decimal BRL | Donation buttons (values in Q8) | Donation prompt |
| StoreConfiguration.orderNumberDisplayLength | integer | Show last N digits of the order number | Order number display length |
| StoreConfiguration.receiptChannels | list (print, email, sms, qr) | Receipt options on the kiosk | Receipt channels (Q2) |
| IMAGE.displaySeconds | integer | Attract image duration | Attract media carousel |
| IMAGE.schedule | {mode: WEEKLY or DATE_RANGE, periods, startDate, endDate} | Media schedule; date part depends on Q6 | Attract media carousel |
| IMAGE.kind | enum ATTRACT, PORTRAIT_FALLBACK | Media role | Portrait fallback media |
| IMAGE.mediaType | enum IMAGE, VIDEO | Video only if Q5 says yes | Attract media carousel |
| Award.displayName | text, max 100 | Customer-facing promotion name | Promotion record |
| Award.description | text, max 255 | Optional description (whitespace saved as null) | Promotion record |
| Award.enabled | boolean | Off does not delete history | Promotion record |
| Award.banner, Award.bannerText, Award.popup | boolean, text, boolean | Banner and pop-up for the promotion | Promotion record |
| Award.guestAllowed | boolean | Usable without an account | Promotion record |
| Award.code | text, max 100 | Code typed by the guest | Promotion code |
| Award.startsAt, Award.endsAt | datetime | Validity window | Promotion rules |
| Award.minBasketValue | decimal BRL | Minimum basket for the promotion | Promotion rules |
| Award.targets | list of item or section refs | What the promotion applies to | Promotion rules |
| Award.maxUsesPerOrder, Award.dailyLimit | integer | Use limits | Promotion rules |
| Award.discountCap | decimal BRL | Maximum discount | Promotion rules, limit banner |
| Award.requiresIdCode | boolean | Limited-use coupon needs its ID code | Limited-use coupon |
| Award.verification | enum SELF_SERVICE, STAFF | Verification mode (Q7) | Promotion verification mode |
| Award.minimumAge | integer | Age threshold for a senior discount (Q12) | Senior discount |
| Order.notification | {type: BUZZER, TENT_CARD, TABLE, NAME, PHONE; value} | Who to call and the identifier | Buzzer, tent card, table |
| Order.languageCode | enum pt-BR, en | Language the guest used | Language choice |
| Order.status (value ABANDONED) and operation abandon | status value and endpoint | Unpaid order abandoned by idle timeout | Abandon the journey |
| Payment.changeAmount | decimal BRL | Change due (cash) | Cash machine (HW-LATER, field needed now) |
| SubmitOrderResponse.waitTimeMinutes | integer | Wait for this order | Wait time on success |
| Payment.tenderId (values) | enum add CASH, CARD for the kiosk | Tender choice in the chooser | Payment chooser, cash choice |

## Open questions for Kai

Only what the decisions do not settle. The starred option is the suggested pick.

### Q1. Idle timeout default

Spec says 30 s; the back-office default template says 45 s.

- A. 30 s (spec default)
- B. 45 s (back-office default) ⭐ it is the value the back office already ships
- C. Off in the pilot

### Q2. Digital receipts (e-mail, SMS, QR) in the pilot

The brief does not cut them; plan-next did. Customer data (name, phone, e-mail) is back in scope (decision 8).

- A. Out of the pilot: print or none, number on screen ⭐ keeps the plan-next cut
- B. E-mail only
- C. E-mail and SMS

### Q3. Table or tent number on the kiosk for dine-in

Spec asks the guest for a tent card or table number. The readers found dine-in is not stated as table-based.

- A. No number: buzzer only ⭐
- B. Tent card number typed by the guest
- C. Table number typed by the guest (depends on the table model of the waiter owner)

### Q4. Service charge (10 %) on the kiosk

Decision 6 defines the percentage in store config; plan decision 16 says no fee in the pilot.

- A. Show only for dine-in orders ⭐
- B. Show for all orders
- C. Off in the pilot (plan decision 16)

### Q5. Video in attract and portrait media

Spec allows video; CLAUDE.md says images through next/image.

- A. Images only in the MVP ⭐
- B. Short video files with a size limit

### Q6. Date windows (special dates and date ranges)

Needed for closures with a message, date-limited sections and attract media. v2 has no special dates (plan G-A5).

- A. Weekly schedules only in the MVP ⭐
- B. Add date windows as the new fields above

### Q7. Promotion verification

"Staff verification required" needs a staff step, which the brief cut (staff age approval is cut; the verification step is similar).

- A. Self-service only ⭐
- B. Staff PIN for promotions (reopens a cut flow)

### Q8. Tip and donation values

Spec gives no values (only "preset percentages"). Assumption if you do not answer: tips 5 / 10 / 15 % and donations R$ 2 / 5 / 10, stored in config.

- A. Use the assumed values ⭐
- B. Free amount only, no presets
- C. Your own values (send them)

### Q9. Order number shown on the kiosk

v2 does not say when the number resets (open question in docs/data-model-and-api.md).

- A. Daily sequence, resets at midnight ⭐
- B. Continuous sequence
- C. Continuous, showing only the last N digits (posCheckNumberDisplayLength)

### Q10. Sold-out items

Spec removes them from the menu; the plan (G-T1) greys them out with "Esgotado".

- A. Greyed out with "Esgotado" ⭐ (plan)
- B. Removed from the menu (spec)

### Q11. Cash without a cash machine in the pilot

Decision 8 brings cash back as a tender. There is no cash machine until phase 4.

- A. Cash is paid at the counter; the kiosk records the tender only ⭐
- B. Cash hidden until the machine exists (phase 4)

### Q12. Senior discount

Spec has it as a loyalty-linked discount; the brief does not cut it. Age-based benefit is close to the staff age approval (cut).

- A. Out of the pilot ⭐
- B. In as a discount type with a minimum age

## Spec contradictions and defects not to copy

1. **Default language:** spec makes a missing default language fatal (FR-105), but BR-KIOSK-03 falls back to en-gb. Use PT-BR as default, EN second.
2. **Sold-out items:** spec removes them (F-MENU-03), plan G-T1 greys them out. See Q10.
3. **Attract image duration:** spec default 7,000 ms (FR-206); back-office default and plan G-A10 use 15 s. Pick one (plan: 15 s).
4. **Idle timeout default:** 30 s (spec) vs 45 s (back office). See Q1.
5. **Close minute:** BR-SES-04 counts the close minute as open; DM-SES-01b says close is exclusive. Use one rule: close exclusive.
6. **Null-pointer on one of dine-in or take-out:** DM-SES-01b and EP-SES-01-ACC give a 500 when one flag is null. A defect, not a rule; never copy it.
7. **Order-type filter:** FR-222 limits the kiosk to DINEIN and TAKE_OUT; v2 has 7 values. Decision 7 settles it: kiosk shows DINEIN and TAKE_OUT, others are model-only.
8. **Money:** spec uses integer minor units and GBP in examples (ORD-WIRE, FR-420, FR-ORD-008). Decision 1: decimal BRL. The R$ 10,000.00 limit becomes 10000.00.
9. **Authorised is success:** BR-PAY-03 and PAY-STATES count AUTHORIZED as success; plan says authorised is not paid. Follow the plan (order status from Go).
10. **Order timeout:** spec polls the order 3 times at 5 s and then fails (BR-ORD-04); plan retries the same request with the same Idempotency-Key within 15 s and shows "verificando seu pedido". Use the plan and CLAUDE.md.
11. **Paid but "not charged":** FR-848 says "You have not been charged" after a payment was taken. Do not copy; the copy must match the refund rule (BR-PAY-05).
12. **Client-side price:** the spec's forced-group "minimum price" and negative deltas (FR-318, FR-331) are price calculations in the app. CLAUDE.md: prices come only from the Go API. Show only what Go sends.
13. **Combo prices:** spec allows negative line prices with DEFAULT_SELECTION. Do not allow a negative line price; Go decides the value.
14. **Display order:** spec sorts by displayOrder (FR-303); MODELS uses list order (5.2). Use one rule and state it in the API contract.
15. **QR wording for typed coupons:** "QR code not valid" is shown for a typed code. Use "código não válido" for typed codes.
16. **Stale menu kept:** INT-04 keeps the old menu on a 4xx; plan says fail closed. Use fail closed.
17. **Landscape copy and layouts:** spec has landscape and screen-ratio variants; the totem is portrait only (CLAUDE.md).
18. **Order number reset and digits:** data-model open question; see Q9.
19. **Abandon with no order:** EP-SES-04 gives 500 when order is absent (NPE). Make it a no-op.
20. **Gift-card asymmetry:** add returns 200 with success false, update and remove return 500 (BR-ORD-08). Out of scope, but do not copy the asymmetry.
21. **Idle copy:** "Are you still there?" is EN only; PT-BR copy to define.

## Cross-area notes (not counted above)

- **Waiter-table-qr:** table number, tent card (Q3), staff call (kiosk help button stays here), request bill and call waiter are theirs.
- **Backoffice-menu:** item flags, item sold-out model, promotion editing UI. Kiosk reads the result.
- **Backoffice-store-ops:** dine-in and take-out hours (D11 CFG-110..119), special-date messages (Q6).
- **Platform:** cache, config readiness, telemetry transport, Idempotency-Key handling, HMAC signing of payments.
- **Hardware (phase 4, HW-LATER):** card terminal, cash machine, printers, barcode reader, totem admin panel, ATP dialog, NFC-e.
- **Vendor payments (OUT, decision 9):** gift card, stored value, room charge, crypto, app gateway, face recognition, food stamps, donation provider.
