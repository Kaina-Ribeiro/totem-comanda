# Business Rules and Validations

The rules, restrictions, validations, calculations, status transitions and configuration switches that
shape the behaviour described in `features.md`. Roles and permissions across the whole application come
first; each functional area then lists its own rules, input validations (field, whether required, rules,
error shown) and the configuration settings that switch its behaviour (setting, effect, default).

## Roles and permissions (whole application)

| Role | How the application recognises it | What it allows | Where |
|:--|:--|:--|:--|
| Guest | Anyone at the kiosk; no sign-in needed | Ordering, paying, receipts, language and accessibility choices | All areas |
| Signed-in loyalty member | A guest counts as signed in exactly when a loyalty sign-in has succeeded in the current session; nothing else (no token or kiosk context) is required | Rewards, awards, member banners, order history and reorder | A06, A07 |
| Staff member (age approval) | A 4-digit staff PIN verified by the backend for the current order and location | Approving or declining age-restricted items for that order only | A04 |
| Staff member (self-checkout) | Staff sign-in on the SCO staff screen (PIN checked as described in A12) | Staff screens and staff actions in SCO mode | A12 |
| Operator / technician | Knows the hidden admin gesture (5 taps within 4 seconds on the hidden admin area of cocoa screens) | Opens the admin panel, which is served by the local kiosk service, not by this application | A01 |

Rules that hold for every role:
- No role is remembered between sessions. A session reset signs the loyalty member out and discards any
  staff approval (A01 F-KIOSK-04, A04 F-BASKET-08).
- A staff approval is bound to one order: a new order, a different location or a changed set of restricted
  items makes it invalid (A04).
- The application holds no user accounts of its own; every identity check (loyalty, staff PIN, clerk) is
  sent to a backend operation and the kiosk acts on the answer.

## A01 KIOSK — Start-up, configuration, availability, session and device health

### Rules

### BR-KIOSK-01 - Landing route by brand count
After configuration: 1 configured brand -> `/welcome`; 2 or more -> `/MultiBrandPage`.

### BR-KIOSK-02 - Retry loop
Failed configuration or branding loads retry automatically every 5 s (cache-not-ready included). No guest action required; loader/error stays meanwhile.

### BR-KIOSK-03 - Default language required
Language setup uses the brand's `language.default`, falling back to kiosk `defaultLanguage`; neither present => maintenance-mode error path.

### BR-KIOSK-04 - Maintenance mode
When the kiosk config marks maintenance mode, the app clears config/session state and routes to `/maintenanceMode`. Deactivation clears the flag and reloads to `/`.

### BR-KIOSK-05 - At-capacity mode
When the config marks at-capacity, the app routes to `/atCapacityMode`; guests cannot order.

### BR-KIOSK-06 - Closed-kiosk derivation
`isDineInAvailable` false removes `DINEIN`; `isTakeOutAvailable` false removes `TAKE_OUT` from each brand's offered order types. A brand with zero remaining order types is marked closed. If every brand is closed, the kiosk is closed.

### BR-KIOSK-07 - Lane-closed visibility
Two SEPARATE settings control closed/unavailable presentation (verified in code):
- `carrouselSettings.closedMessage.closedMessagingAvailability` gates the Lane Closed screen: `ALWAYS_SHOW` (default) -> blocking Lane Closed; `NEVER_SHOW` -> no closed screen (closed kiosk goes to welcome without lane-closed); `SHOW_BEHIND_ATTRACT_SCREENS` -> content shown but auto-returns to `/welcome` after 10 s (cocoa).
- `carrouselSettings.unavailableScreenVisibility` gates the generic unavailable-screen presentation used by the carousel/unavailable flows (same enum; default `ALWAYS_SHOW`).
When `carrouselSettings.closedMessage` is absent entirely, the kiosk defaults to always showing the Lane Closed screen.

### BR-KIOSK-08 - Closed message content
Cocoa Lane Closed uses `carrouselSettings.closedMessage.title`/`description` when configured; otherwise "Closed".

### BR-KIOSK-09 - Trading check order
At journey start: maintenance -> `/maintenanceMode`; at-capacity -> `/atCapacityMode`; closed kiosk -> `/laneClosed` (when shown). Any failure aborts the start.

### BR-KIOSK-10 - Lane transitions
Close lane -> clear state + `/laneClosed`. Open lane -> `/welcome`.

### BR-KIOSK-11 - Idle timer config
Idle checking enabled only when `idleTimerIntervalMilliseconds` > 0. Effective timeout = configured ms (default 30,000), minimum 1 s. The same value is reused as the warning's own auto-expiry.

### BR-KIOSK-12 - Idle counter resets
Any click, mouse move or key press resets the idle counter to zero.

### BR-KIOSK-13 - Idle warning
At timeout, if no notification is showing, display "Are you still there?" with "Cancel my order" (destructive) and "Continue". Unanswered within the timeout => auto-abandon.

### BR-KIOSK-14 - Idle-disabled contexts
No idle checking while: on the current root screen (`/welcome`/`/MultiBrandPage`), loading `/`, any payment screen (authorizing, cash payment/change, crypto, Face-ID, app, processing cash, gift-card PED, payment, payment success, print receipt), help-requested, lane closed, maintenance, at-capacity, during config load, during scan processing, or while the warning itself is up.

### BR-KIOSK-15 - Session reset
Reset posts a session-reset request (`orderNonce`, `orderTotal`, `currency`, `locationId`), fires `journey_end` (`automatic` timeout / `next_order_button` manual), clears all journey state, routes to the root screen, and clears the active brand on multi-brand.

### BR-KIOSK-16 - Admin gesture
5 taps on the admin area within 4,000 ms opens the admin panel (slower resets the count). A cash-health check runs first; an `errorImageUrl` response shows an error-image dialog that staff can bypass or dismiss; check failure opens the panel anyway.

### BR-KIOSK-17 - Single modal notification
Only one modal notification is displayed at a time; sources (e.g. the idle warning) must check whether one is already visible before showing.

### BR-KIOSK-18 - Printer check scope
Printer status is checked when `printerEnabled` and not in maintenance, each time the guest lands on: menu, order summary, order type, product search, loading, welcome. Up to 3 retries at 3 s (partially confirmed).

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| `idleTimerIntervalMilliseconds` | No | >0 enables idle checking; else default 30,000 is not applied unless flag on | None (feature just off) |
| `language.default` / `defaultLanguage` | Yes | Brand default else kiosk default | Maintenance-mode error |
| `closedMessage.title/description` | No | Overrides cocoa lane-closed text | Falls back to "Closed" |
| Cash health `errorImageUrl` | No | When returned, blocks auto-open of admin panel | ATP error dialog with image |

### Calculations and decision logic
- Idle timeout = `idleTimerIntervalMilliseconds` (default 30,000) / 1000, floored at 1 s.
- Closed kiosk = every brand closed after order-type stripping.
- Trading check = maintenance? -> at-capacity? -> closed? (first match wins).

### Status transitions
- Availability: READY -> MAINTENANCE / AT_CAPACITY / CLOSED -> back on flag clear or lane open.
- Idle: ACTIVE -> WARNING (timeout) -> CONTINUES (input/Continue) or ABANDONED (cancel/expiry).
- Journey end: reset -> cleared state -> root screen.

### Roles and permissions
- Guest: start screens, notifications only.
- Staff: hidden admin gesture, ATP error dialog actions, lane open/close (staff scope in A12).

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `idleTimerIntervalMilliseconds` | Idle warning timeout; 0 disables | 30,000 ms when enabled |
| `printerEnabled` | Printer status checks on listed screens | false |
| `carrouselSettings.closedMessage.closedMessagingAvailability` | Lane Closed presentation: `ALWAYS_SHOW`/`SHOW_BEHIND_ATTRACT_SCREENS`/`NEVER_SHOW` | `ALWAYS_SHOW` |
| `carrouselSettings.unavailableScreenVisibility` | Unavailable-screen presentation (carousel/unavailable flows) | `ALWAYS_SHOW` |
| `carrouselSettings.closedMessage` | Custom closed title/description | none -> "Closed" |
| `language.default` / `defaultLanguage` | Required language fallback chain | `en-gb` when absent |
| `isDineInAvailable`/`isTakeOutAvailable` | Strip order types; may close brand | null = available |
| `isOpen`, the brand ready flag | Brand availability on selector | `isOpen` false |
| Brand count (`brandConfigs`) | Landing route + reset destination | 1 -> `/welcome` |
| `scanner`/scan-processing | Suppresses idle checking | - |
| Maintenance / at-capacity flags in kiosk config | Route to unavailable screens | off |

## A02 START — Attract screen, brand selection, language selection, order type

### Rules

### BR-START-01 - Language button needs more than one language
The language selector entry point is rendered only when the active brand offers 2 or more supported languages. Cocoa can force it visible on the order-type nav bar (a force-visible option).

### BR-START-02 - Language list ordering
Supported languages are sorted alphabetically by language name (case-insensitive); the configured default language is pinned to the first position.

### BR-START-03 - Single-brand language auto-reset (30 s)
On a single-brand kiosk, while on `/welcome`, a guest-changed language silently reverts to the remembered default after 30,000 ms. The timer restarts if the language changes again; it is disabled off `/welcome` and on multi-brand kiosks, and fires immediately when re-enabled with a non-default language. Reset is silent (no analytics, no error UI).

### BR-START-04 - Multi-brand page forces kiosk default language
On `/MultiBrandPage` (and not while branding is loading), the active language is forced to the kiosk-level `defaultLanguage`. The active language code is written to the document `lang` attribute and `dir` is set `rtl`/`ltr` accordingly.

### BR-START-05 - Carousel media scheduling
Each carousel media is active only when the device local time (24-hour string) is within `timeStart`–`timeEnd`. `timeStart > timeEnd` means the window crosses midnight. Media missing either bound is always active. Media without `url` is dropped. When no media is active, the default background image is used (cocoa: per screen ratio `9_16`/`16_9`/`3_2`; others: `branding.backgroundImage`).

### BR-START-06 - Carousel timing and failure handling
Slide duration = media `duration` ms, default 7,000 ms; for videos (`.mp4`, `.webm`, `.ogg`, detected via `id` query param first then URL) the slide lasts the video's own duration (fallback 7,000 ms). Failed media is skipped; all-failed means no background at all. No rotation for fewer than 2 media. Videos autoplay muted, loop, no controls.

### BR-START-07 - Multi-brand attract overlay behaviour
The multi-brand carousel covers the brand grid only when it has time-active media. A tap hides it for 60,000 ms (default template: only if the kiosk is trading; itsu template: unconditionally). The back/cancel control re-shows it immediately.

### BR-START-08 - Brand selectable only when open and ready
A brand cell triggers selection only when `isOpen` AND the brand's data is ready AND interaction is enabled. The button is disabled when the brand is neither open nor ready.

### BR-START-09 - Closed brand presentation
A non-open brand cell shows an info icon and "Sorry, we're closed" (`multibrand.storeClosed`) and renders dimmed.

### BR-START-10 - Closed-kiosk derivation
Before the trading check: `isDineInAvailable === false` removes `DINEIN`, `isTakeOutAvailable === false` removes `TAKE_OUT` from each brand's `orderTypes`; a brand with no remaining order types is marked `isOpen = false`; if all brands are closed (or all have both services unavailable), the kiosk is closed and shows Lane Closed (when its visibility rules allow).

### BR-START-11 - Order type whitelist and order
Only `DINEIN` and `TAKE_OUT` are valid kiosk order types; any other configured value is filtered out. `DINEIN` always sorts before `TAKE_OUT`.

### BR-START-12 - When the order-type screen is shown
`/orderType` is shown during journey start when ANY of: the restaurant has >1 filtered order type; the brand has >1 supported language; loyalty is enabled (`authConfig.loyaltySettings.enabled`). Otherwise the first order type is applied silently.

### BR-START-13 - Default order type
The default order type is the first filtered order type (i.e. `DINEIN` when offered); fallback is `DINEIN` when the list is empty.

### BR-START-14 - Multi-brand welcome skipped for <2 languages
When the welcome template resolves to the multi-brand language page and the selected brand has fewer than 2 supported languages, `/welcome` is bypassed and journey start runs immediately after branding loads.

### BR-START-15 - Trading gate on journey start
Journey start first checks: maintenance mode -> maintenance screen; at-capacity -> at-capacity screen; closed kiosk (BR-START-10) -> Lane Closed screen (when shown). Any failure aborts start before creating the order or firing analytics.

### BR-START-16 - Language selection on the cocoa attract screen starts the journey
On cocoa `/welcome`, choosing a DIFFERENT language shows the ~2 s "Language updated" dialog and then starts the journey with analytics `started_by = language_selector`. Choosing the current language just closes the overlay (`languageChanged: false`, journey NOT started by this path).

### BR-START-17 - Active location recovery
If there is no active location id on the welcome screen, the app returns to the root/loading route. If the active location id matches no configured brand, the first configured brand is loaded automatically.

### BR-START-18 - Interaction gate
All start actions (attract tap, brand select) are ignored while the kiosk accepting input is false.

### BR-START-19 - Back from order type
Back on `/orderType`: with the multi-brand welcome template and >1 brand language -> `/welcome` (session kept); otherwise a full session reset to the root screen (`/MultiBrandPage` multi-brand, `/welcome` single brand).

### BR-START-20 - Post-order-type routing
After order type selection: not signed in AND `supportsPreBasketSignin` -> loyalty logging page; else SCO-mode-on-cocoa -> Scan-and-Go page; else order history available -> order history page; else menu home. `onboarding_completed` analytics fires with `source = service_selection`.

### BR-START-21 - Loyalty banner visibility (cocoa order-type)
Never for NST_YOYO or Accesso loyalty. Avolta: per Avolta screen gate. Multi-sign-in style: `supportsPreBasketSignin` AND loyalty enabled. Legacy: loyalty enabled AND (scanner available OR reward barcode present).

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Brand `orderTypes` | Yes (implicit) | Filtered to `DINEIN`/`TAKE_OUT`; empty result marks brand closed | Brand cell: "Sorry, we're closed"; all closed -> Lane Closed |
| Language `default` | Yes | Brand default else kiosk `defaultLanguage`; neither -> maintenance-mode error | Maintenance screen (via config error handling) |
| Carousel `url` | Yes | Entries without it are dropped | None (entry ignored); all-fail -> no background |
| Carousel `timeStart`/`timeEnd` | No | 24-h strings; inverted range = overnight window | None (media just inactive) |
| Language pack request | Yes | Loaded from local resource bundle or remote language endpoint | Notification + "Start Over" retry button |

### Calculations and decision logic
- Order-type screen decision = `loyaltyEnabled OR languages.length > 1 OR filteredOrderTypes.length > 1` (BR-START-12).
- Default order type = first filtered order type else `"DINEIN"` (BR-START-13).
- Brand-grid layout: <4 brands small, 4–6 medium, ≥7 large; accessibility mode enlarges.
- Cocoa welcome action buttons hidden when `!isOpen` AND closed-messaging visibility = `NEVER_SHOW` (visibility default `ALWAYS_SHOW`; other values `SHOW_BEHIND_ATTRACT_SCREENS`).

### Status transitions
- Journey: ATTRACT -> (language overlay) -> ORDER_TYPE (optional) -> LOYALTY_SIGNIN (optional) -> MENU/SCAN-AND-GO/ORDER_HISTORY.
- Brand: selected (open+ready) -> branding loading -> active brand; closed/not-ready brands stay unselectable.
- Language: default -> guest-selected -> (30 s idle on `/welcome`, single brand) -> default; multi-brand selector always forces kiosk default.

### Roles and permissions
- Guest: all start-area interactions.
- Staff: cocoa welcome exposes an admin-panel entry button (behaviour owned by A01/A12).
- NavPed/audio-navigation users: welcome dialog + focusable attract area ("Tap here to get started").

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `restaurant.orderTypes` | Which order types offered (filtered to DINEIN/TAKE_OUT) | config |
| `language.default` (brand) / `defaultLanguage` (kiosk) | Initial + reset language; ordering pin | `"en-gb"` when absent in brand config |
| `language.supported` | Languages in selector; >1 enables button | none |
| `restaurant.branding.carousel` | Attract media list (url, duration, timeStart/timeEnd, altText, locale) | none |
| `multiBranding.carousel` | Multi-brand attract overlay media | none |
| `branding.backgroundImage` / per-ratio defaults | Fallback attract background | none |
| `isDineInAvailable` / `isTakeOutAvailable` | Remove order type; may close brand | null (available) |
| `isOpen` / the brand's data is ready | Brand cell enabled | `isOpen` default false |
| `authConfig.loyaltySettings.enabled` / `supportsPreBasketSignin` | Order-type screen shown / loyalty routing | false |
| `avoltaEnabled`, `isLoyaltyNstYoyo`, `isLoyaltyAccesso` | Loyalty banner variant/suppression on order-type screen | false |
| `KIOSK_THEMING` feature + `orderTypePage` page overrides (`eatInImage`, `takeAwayImage`, `orderTypeButtonsDirection`) | Custom order-type images + layout | row layout, default icons |
| `scoModeEnabled` (+ cocoa home page) | Post-order-type destination = Scan-and-Go | false |
| `closedMessagingAvailability` / `unavailableScreenVisibility` (`ALWAYS_SHOW`/`SHOW_BEHIND_ATTRACT_SCREENS`/`NEVER_SHOW`) | Cocoa welcome action buttons hidden when closed + `NEVER_SHOW` | `ALWAYS_SHOW` |
| Template `welcomePage` / `orderTypePage` / `multiBrandPage` values | Which screen variant renders (see Variants in SCR-START-01/03/05) | `welcomePage`/`orderTypePage` |

## A03 MENU — Menu browsing and item customisation

### Rules

### BR-MENU-01 - Order-type availability
Entities and options render only when their `serviceAvailability` flag matches the current order type (`dineInFlag` for DINEIN, `takeOutFlag` for TAKE_OUT; absent flags default to available). Empty categories after filtering are removed.

### BR-MENU-02 - Display order
All menu entities (categories, items, option groups, options) sort ascending by `displayOrder`.

### BR-MENU-03 - Lazy batches
Category and item grids render 60 cells per batch; scrolling loads the next batch.

### BR-MENU-04 - Breadcrumb navigation
Selecting a category pushes it on the breadcrumb; Back pops to the parent level and discards the item draft; root Back follows the A02/A04 reset rules.

### BR-MENU-05 - Displayed item price
Cell/detail price is the minimum real price: base + cheapest required selections for forced groups (min==max>0), excluding `COMBO_MAIN` and `SURCHARGE` dynamic contributions; `servicePriceOverride` replaces the base price per order type; `showFromPrice` flags "from" display.

### BR-MENU-06 - Image fallback
Failed or missing images render a placeholder (cocoa: initial-letter tile; other templates hide the image).

### BR-MENU-07 - Single-child containers
An entity with exactly one item child can select that item directly (analytics use the child).

### BR-MENU-08 - Default selections
`defaultOption` pre-selects unless it has nested modifiers; options with `defaultQuantity` > 0 pre-select at that quantity (takes precedence over `defaultOption` when both exist); `COMBO_MAIN` auto-selects its configured default.

### BR-MENU-09 - Age-restriction notice
Items/options with `verificationAge` or `ageRestriction` > 0 trigger the "You may need photo ID" confirm before the first restricted add (simple items at add time, option items at confirm); confirmation is remembered for the order session. The full age-verification flow is A04.

### BR-MENU-10 - Auto-advance rules
`ITEM_WITH_OPTIONS` auto-advance jumps straight to options on item select; `OPTION_GROUP_MAX_SELECTION` auto-continues ~200 ms after a group reaches its maximum. Both are config-gated auto-advance rules.

### BR-MENU-11 - Nutritional disclaimer
The calorie disclaimer banner shows only when the restaurant enables its disclaimer feature.

### BR-MENU-12 - Group selection arithmetic
`minimum` = required count; `maximum` = cap (0/absent = unlimited). `maximum` = 1 replaces; `maximum` > 1 toggles and blocks past the cap; per-option `maximumQuantity` > 1 enables a stepper bound by both.

### BR-MENU-13 - Continue gating
The stepper's continue is enabled when selections >= `minimum` (or group optional, or a supersede selected). Button label shows running total ("Next {price}" / "Done {price}" legacy; "Continue"/"Add to Order {total}" cocoa).

### BR-MENU-14 - Invisible groups
Standard group with `minimum` = 1, exactly 1 option and no nested options is applied silently and never shown. Cocoa additionally hides `INGREDIENTS`, `INGREDIENT_MODIFIERS`, `COMBO_MAIN` roles from the stepper (dedicated screens).

### BR-MENU-15 - Required modifier
`MODIFIERS` with `minimum` = `maximum` = 1 is treated as `REQUIRED-MODIFIER`.

### BR-MENU-16 - Supersede
A `supersede` option deselects and blocks all other options in its group.

### BR-MENU-17 - Nested groups
Selecting an option with `optionGroups` opens its nested screen; required nested groups must be satisfied; leaving a required nested group empty via Back unselects the parent option; in combo context, optional nested groups are edited only from the review screen.

### BR-MENU-18 - Forced-combo option pricing
For groups with `minimum` = `maximum` > 0, displayed option price = option minimum price - group's cheapest-required baseline (`MINIMUM_PRICING_MODEL`) or default-option baseline (`DEFAULT_SELECTION_PRICING_MODEL`, which can yield negative deltas).

### BR-MENU-19 - Role routing
`MODIFIERS`/`REQUIRED-MODIFIER`/`UPSELLS` -> stepper; `INGREDIENTS`/`INGREDIENT_MODIFIERS` -> ingredient customisation; composite `TOGGLE` groups -> customisation toggles; `COMBO_MAIN` -> combo main modal; `SURCHARGE` -> priced options excluded from combo math.

### BR-MENU-20 - Ingredient edits
Add/Added toggles ingredient options; composite toggles pick positive/negative with `defaultChoice` pre-selects; Reset restores defaults; changes are announced for screen readers.

### BR-MENU-21 - Combo main editing
`COMBO_MAIN` is excluded from the inline stepper and from minimum-price math; it is edited only via the "Select main Item" modal from the review screen.

### BR-MENU-22 - Combo pricing models
`MINIMUM_PRICING_MODEL` (default): forced groups priced relative to cheapest required picks. `DEFAULT_SELECTION_PRICING_MODEL`: priced relative to the configured default option; cheaper picks show negative line prices on review.

### BR-MENU-23 - Quantity
Item quantity minimum 1; decrement disabled at 1; quantity changes rebuild the draft; option-level quantity 0 deselects.

### BR-MENU-24 - Cross-sell trigger
After item confirm: show cross-sell iff draft items map to a `crossSellGroup` with resolvable entities AND no group currently presented AND cross-sell not disabled; only the first matching group is offered.

### BR-MENU-25 - Cross-sell add
Cocoa requires >=1 selected to enable "Add to Order"; "No Thanks"/Done dismisses; restricted suggestions go through the age notice.

### BR-MENU-26 - Draft lifecycle
Item work happens in an order draft; confirmation moves items to the order, clears the draft, recomputes totals (`ITEM_ADDED`) and returns to the item's category level; silent confirms skip the overlay.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Option group `minimum` | No | Selections >= minimum required to continue | Continue disabled |
| Option group `maximum` | No | Cap; 0 = unlimited | Extra options disabled |
| Option `maximumQuantity` | No | Per-option qty cap | Stepper capped |
| `verificationAge`/`ageRestriction` | No | >0 triggers photo-ID notice | Dialog before add |
| `tagsPages` | No | Restrict tag to pages | Tag not rendered elsewhere |
| `serviceAvailability` | No | Order-type gating | Entity hidden |

### Calculations and decision logic
- Minimum price = base + Σ cheapest-N picks per forced group (min==max>0), or default-option baseline under `DEFAULT_SELECTION_PRICING_MODEL`; `COMBO_MAIN`/`SURCHARGE` excluded.
- Forced-option displayed price = option minimum price - baseline (can be negative under default model).
- Cross-sell show = group resolves && none presented && !disabled.
- Option-group show = required-and-visible (not invisible group, role routed to stepper).

### Status transitions
- Draft: empty -> items+options -> confirmed -> order; edits re-enter via update flow.
- Option stepper: group N -> N+1 -> ingredient/composite -> review -> confirm -> menu (+cross-sell).
- Tag: scheduled window -> active/inactive.

### Roles and permissions
- Guest: all browsing/customisation.
- Staff: menu content comes from configuration; no staff controls on these screens besides shared nav/admin entries (A01/A12).

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `serviceAvailability.dineInFlag`/`takeOutFlag` | Order-type availability | true |
| `defaultEntity` | Pre-selected child variant | first child |
| `defaultOption` / `defaultQuantity` | Pre-selected option / qty | none/0 |
| `minimum`/`maximum`/`maximumQuantity`/`supersede` | Selection rules per group/option | 0/0/0/false |
| `comboPricingLogic` | `MINIMUM_PRICING_MODEL`/`DEFAULT_SELECTION_PRICING_MODEL` | MINIMUM |
| `showFromPrice` | "From" price display | false |
| `showCategoriesPrice` | Category price display | true |
| `customizedItemTags` + schedule fields | Badge overlays per page/schedule | none |
| `itemLabels` | Chips on product info | none |
| `verificationAge`/`ageRestriction` | Age-notice gating | 0 |
| `crossSellGroup.crossSells` | Suggestion items | none |
| Auto-advance rules (`ITEM_WITH_OPTIONS`, `OPTION_GROUP_MAX_SELECTION`) | Skip Continue presses | off |
| `scoModeEnabled` | SCO menu presentation | false |
| `giftCardPurchaseSettings` | Gift-card banner on cocoa menu | none |
| Nutritional disclaimer feature | Disclaimer banner | off |

## A04 BASKET — Order summary, checkout preparation and age verification

### Rules

### BR-BASKET-01 - Line identity
Each order line is one order item (item + options + quantity); identical lines (same item and same options) merge into one displayed row with combined quantity, sorted by item name. Internally they stay separate lines.

### BR-BASKET-02 - Remove confirmation
Line removal asks for confirmation before deleting in every variant except shakeshack (direct remove); the delete triggers a totals recalculation.

### BR-BASKET-03 - Edit requires options
The Edit affordance appears only when the item has option groups; an item without configurable options offers Remove only.

### BR-BASKET-04 - Restricted line badge
`ageRestriction` > 0 renders an "18+" badge ONLY when SCO mode is on and `ageRestrictedApprovalAvailable` is `true`; the badge always reads "18+" regardless of the item's real age; the same suffix is appended to the line's accessibility label.

### BR-BASKET-05 - Totals recompute is queued
Every basket/discount/tip/charity mutation queues a totals call; calls never run with an empty basket (the POS rejects empty lists); while a recalculation runs, stale values are suppressed and cocoa shows "Updating Your Order" on the checkout-load recalculation plus "PLEASE WAIT" on pay.

### BR-BASKET-06 - Fee display rules
Fees with `total` <= 0 or blank names are hidden; when visible fees sum >= `serviceCharge` the aggregate Service Charge line is suppressed; a fee named "round up" displays the charity name; cocoa totals announcements include all visible fees.

### BR-BASKET-07 - Pay gates run in order
Donation prompt (A08) -> BRL limit -> basket item-line limit -> SCO browse-menu modal -> age-verification gate -> payment routing. First matching gate wins and stops the flow.

### BR-BASKET-08 - BRL transaction limit
BRL orders with `orderTotal` > 1,000,000 minor units (R$ 10,000.00 exactly allowed) are hard-blocked at pay with "Order total is too high" / "This order exceeds the maximum payment amount. Please remove some items or contact a member of staff." (checked before all other gates).

### BR-BASKET-09 - Basket item-line limit
The POS rejecting the order for too many item lines (`BASKET_ITEM_LIMIT_EXCEEDED`, matched from any error shape — top-level `errorCode`, nested `response.data.errorCode`, or embedded in the message) sets a flag that blocks pay with "Too many items in your order" / "You have reached the maximum number of items allowed for a single order. Please remove some items before continuing."; a successful totals recalculation clears it; a cocoa item-add rejection rolls the item back.

### BR-BASKET-10 - Empty basket and loading
Empty baskets show the empty state, disable pay and skip totals calls; pay is disabled while totals load.

### BR-BASKET-11 - Order reset needs confirmation
Whole-order reset shows a confirmation ("Go back"/"Cancel order"); only confirmation abandons the journey.

### BR-BASKET-12 - Age gate conditions
The gate applies ONLY when ALL of: `scoModeEnabled` `true`, `ageRestrictedApprovalAvailable` `true` (tri-state — `undefined`/`null`/`false` all keep it off), the order needs verification, and at least one restricted item was scanned. Browse-menu-only restricted items keep the "Have your ID ready" journey. Flag `false` = no approver -> restricted items never reach the basket at scan time (A05).

### BR-BASKET-13 - PIN rules
PIN is 4 digits, submitted only by explicit confirm (never on the 4th digit); wrong PIN clears + "PIN not recognised. Try again."; 5 attempts per order then locked; the request posts `{locationId, orderNonce, pin}`.

### BR-BASKET-14 - PIN outcomes
Valid -> Challenge-25 (attempts reset); invalid -> attempt consumed; locked/lockTransition -> locked screen + `age_verification_locked` event; 404 -> unavailable screen; network/malformed/server -> service-unavailable message.

### BR-BASKET-15 - Challenge-25 confirmation
Approve is enabled only after ticking "I confirm I have applied Challenge 25 and the customer is {max required age} or over" — the highest required age drives the text even though the badge reads 18+.

### BR-BASKET-16 - Approval binds to nonce+fingerprint
The approval context records order nonce + location + restricted-basket fingerprint (line identity, quantity, required age); a new nonce resets; fingerprint divergence or location change while a challenge is pending discards the context; continuing re-validates all four.

### BR-BASKET-17 - Decline removes the items
Declining removes every age-restricted line and posts a `staff_declined` outcome before the declined screen renders; leaving the gate via Back reports `guest_left` — same outcome.

### BR-BASKET-18 - CPF/CNPJ optional and validated
Optional row + modal; CPF 11 digits + check digits, CNPJ 14 digits + check digits; mask switches by length; analytics never carry the number.

### BR-BASKET-19 - Extras behave like lines
Applied coupons/rewards/discounts/tip/charity/gift cards render as lines with removal where allowed; each mutation triggers a totals recalculation; "Only one coupon/reward/discount can be applied" notes appear on the respective rows.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| CPF | No | 11 digits + check digits | Inline error in modal |
| CNPJ | No | 14 digits + check digits | Inline error in modal |
| Staff PIN | Yes (at gate) | 4 digits, server verified, 5 attempts | "PIN not recognised. Try again." / "Team approval unavailable" |
| Basket item limit | No | Backend flag; remove items | "Too many items in your order" |
| BRL order total | No | <= 1,000,000 minor units | "Order total is too high" |

### Calculations and decision logic
- showTotals (default) = total != subtotal || tax exclusive; (cocoa) adds discounts/fees/charity/subtotal-changed.
- Service Charge hidden iff visible fees sum >= serviceCharge.
- Pay path = first true of: donationPrompt? -> BRL over limit? -> basketItemLimitExceeded? -> SCO browse modal? -> age gate? -> payment.
- Age gate = scoMode && `ageRestrictedApprovalAvailable` `true` && restricted items && any restricted item scanned.
- Badge = scoMode && `ageRestrictedApprovalAvailable` `true`; text always "18+".
- Challenge age = max requiredAge over restricted items; approved age recorded = same max.

### Status transitions
- Line: present -> editing -> updated; present -> removing -> removed.
- Totals: idle -> loading -> updated/error.
- Age flow: inactive -> pin -> challenge -> approved -> continuing -> payment; challenge -> declined -> declined screen -> guest return; pin -> locked / unavailable.
- Order: open -> reset confirm -> cancelled.

### Roles and permissions
- Guest: view/edit/remove lines, pay, reset (with confirm), CPF/CNPJ.
- Staff: PIN entry, Challenge-25 approve/decline, return kiosk to guest.

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `scoModeEnabled` | SCO basket split + gate/badge eligibility | false |
| `ageRestrictedApprovalAvailable` (brand, tri-state) | Age gate + badge; `false` blocks restricted items at scan | undefined |
| `punchhEnabled`/`couponEnabled`/`discountPosProviderEnabled` | Coupon/reward/discount rows + scan button | off |
| Charity/Pennies config | Donation prompt + charity lines | off |
| Tip config | Tip row | off |
| `giftCardPurchaseSettings` | Gift-card banner/rows | none |
| `cpfCnpj` feature | CPF/CNPJ capture row | off |
| BRL menu currency | Enables transaction-limit check | n/a |
| `basketItemLimitExceeded` (backend) | Blocks pay | false |
| `ageRestriction`/`verificationAge` on items | Badges + gate | 0 |

## A05 SCAN — Scan routing, Scan-and-Go and scan feedback surfaces

### Rules

### BR-SCAN-01 - Processing guard
A scan is dropped while another scan is still being processed.

### BR-SCAN-02 - Route precedence
Routing order is fixed: gift card -> app payment -> Avolta (`/orderType`) -> SCO item -> loyalty -> coupon -> drop.

### BR-SCAN-03 - Item match uses the original menu
SCO matching reads the unfiltered menu so barcode-only items resolve even when hidden from browsing.

### BR-SCAN-04 - Scan-tagging
Scanned lines carry a scanned identity (`committedScannedItemGuids`); committed scans are re-read from the basket so the modal stays consistent with removals made elsewhere.

### BR-SCAN-05 - One refusal surface
Not-found and restricted banners render on the page OR inside the modal — never both; the scanning banner does not re-open the modal while it is already open.

### BR-SCAN-06 - Refusal semantics
`ageRestrictedApprovalAvailable` `false` = refuse at scan (no item created + `age_verification_item_blocked` event); `true` = add + gate at checkout; `undefined`/`null` = add normally.

### BR-SCAN-07 - Banner timings
Not-found auto-dismisses after 10,000 ms; restricted refusal after 7,000 ms (banner + toast share the constant); successful scans clear earlier; a repeated failed scan keeps the banner up.

### BR-SCAN-08 - Scanner check gating
Status checks run only on `/welcome`/`/orderSummary` navigation, when `scannerEnabled`, outside maintenance, and skipped when the HID keyboard scanner is enabled; timeout keeps the last status, other failures mark unavailable.

### BR-SCAN-09 - HID scan validity
A valid HID scan = printable chars within 80 ms of each other + at least 4 characters + Enter terminator or 160 ms auto-complete; gaps >80 ms restart; under-length buffers are discarded; dead-key layouts decode.

### BR-SCAN-10 - Serial poll health
Avolta serial polling marks the scanner unavailable after 3 consecutive failed requests; a timeout (`ECONNABORTED`) does not count.

### Status transitions
- Scan event -> processing -> routed (item/loyalty/coupon/gift/payment/drop) -> feedback (added overlay / banners / modal).
- Refusal -> shown -> auto-dismiss 7 s -> cleared.
- Not-found -> shown -> auto-dismiss 10 s -> cleared.

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `scoModeEnabled` | Enables SCO item-first routing + Scan-and-Go page | false |
| `ageRestrictedApprovalAvailable` (brand, tri-state) | Scan-time refusal / gate at checkout / plain add | undefined |
| `avoltaEnabled` (brand) | Avolta DQR/phone sign-in routing + serial listener | off |
| `scannerEnabled` / `hidKeyboardScannerEnabled` | Scanner paths + status checks | off |
| `selfCheckoutScreens` (branding) | Carousel behind the SCO banner | none |
| `giftCardPurchaseSettings` | Gift-card scan routes exist | none |
| HID buffer config | 80 ms inter-char, 4-char min, Enter/160 ms auto-complete | defaults |

## A06 LOYALTY — Providers, sign-in, sign-out, order history

### Rules

### BR-LOYAL-01 - One provider per brand
A venue brand configures exactly one loyalty provider (Punchh/Avolta/Accesso/NST Yoyo/Pepper/LoyaltyV2); `isLoyaltyEnabled` gates every surface.

### BR-LOYAL-02 - Sign-in methods are provider-configured
`supportedSigninMethods` {phone, email, userId} + scanner support decide what shows; a single-method provider skips the picker; zero manual methods = scan-only.

### BR-LOYAL-03 - Scan is a sign-in too
Scans on loyalty screens sign the guest in; a scan while processing or while signed in is dropped.

### BR-LOYAL-04 - Guards on sign-in
Loyalty disabled/empty code -> "QR code type not supported for this location"; reward already applied -> "Code already added"; scan in flight -> dropped.

### BR-LOYAL-05 - Avolta phone rules
Manual phone requires a valid number per the selected country; DQR cards route to code sign-in; plain phone QR routes to phone sign-in; signup on an existing phone shows account-exists; signin on an unknown phone shows sign-up.

### BR-LOYAL-06 - Pre-basket sign-in is Avolta-only
An Avolta sign-in with no order creates one; other providers need an existing order.

### BR-LOYAL-07 - Failure is recoverable
Every loyalty failure lands on a dialog with Try Again / a manual fallback / Close plus an expandable details section; the order is never lost.

### BR-LOYAL-08 - Analytics on every attempt
a loyalty sign-in analytics event (type, entry method, screen, success, message) records type, entry method, screen, success and message.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Loyalty code | Yes | Non-empty, loyalty enabled | "QR code type not supported for this location" |
| Phone (Avolta) | Yes | Valid per selected country | Continue disabled / normalisation log |
| Terms (signup) | Yes | Fetched + accepted | "Failed to load Terms & Conditions" |

### Status transitions
- Signed out -> signing in -> signed in -> (optional) signed out.
- Signup -> creating -> success / failed / existing-account.

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `isLoyaltyEnabled` | Gates all loyalty surfaces | off |
| `punchhEnabled`/`avoltaEnabled`/`isLoyaltyAccesso`/`isLoyaltyNstYoyo`/Pepper/LoyaltyV2 flags | Select provider | off |
| `supportedSigninMethods` | Available methods | provider |
| `faceIdSigninEnabled` | PopID button | off |
| `scoModeEnabled` | Loyalty entry on `/orderType` etc | false |

## A07 DISCOUNTS — Coupons, rewards, restaurant and senior discounts

### Rules

### BR-DISC-01 - One discount kind per order
Only one discount kind (coupon, loyalty reward, restaurant, senior) can be applied at once; a second apply prompts removal or shows the limit/already-added surfaces.

### BR-DISC-02 - Queue-wait feature
`AWAIT_QUEUE_BEFORE_DISCOUNT` (159) makes apply wait for the order queue to clear and drop duplicates while a discount/scan is being processed.

### BR-DISC-03 - Type routing
The code is classified before routing: Comanda/Punchh/Loyalty/restaurant/senior/unknown; unknown fires no request.

### BR-DISC-04 - Success overlay per type
Coupon -> "Coupon added to order"; reward -> "Reward added to order"; discount -> "Discount added to order"; Avolta -> "You have unlocked your Club Avolta discount." + tier label.

### BR-DISC-05 - Senior rules
`seniorDiscountEnabled` gate; already-applied -> "Code already added"; `minimumAge` failure -> age-specific error; other failures -> generic.

### BR-DISC-06 - Award-selection rules
Auto-show only when provider supports it + awards exist; suppressed at the discount limit; Punchh refreshes totals first (modal still shows on failure); more remaining -> follow-up prompt.

### BR-DISC-07 - Void by type
Removal routes to the right void; silent void runs during submit/cancel; last removal clears the applied state.

### BR-DISC-08 - Limit/replacement messaging
Limit -> "Discount limit reached"/"To apply a different code you must remove one from your order."; limited-use coupon -> "Unlock your discount with ID code" + enter the ID as a second code; swap -> "Replace your current discount?".

### BR-DISC-09 - Entry-method tracking
Scan/manual/unknown rides the request + analytics; every attempt fires sign-in/add events.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Coupon code | Yes | Non-empty, valid per type | Invalid-coupon dialog / scan-error page |
| Senior ID | Yes | Senior feature + age | "citizens aged {n} or over" |
| Restaurant code | Yes | Feature + non-empty | Apply disabled / generic error |

### Status transitions
- No discount -> applying -> applied -> removed/voided.
- Awards -> selection -> confirmed -> applied.
- Scan page -> manual / apply / error.

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `couponEnabled`/`punchhEnabled`/`discountPosProviderEnabled`/`seniorDiscountEnabled` | Entry points + banners | off |
| `isLoyaltyEnabled` + provider flags | Loyalty/reward flows | off |
| `isAwardsSelectionEnabled` | Awards modal | off |
| `AWAIT_QUEUE_BEFORE_DISCOUNT` (159) | Queue-wait before apply | off |
| Maximum-discount rule | Limit surfaces | provider |

### BR-DISC-10 - Maximum-discount decision
Whether further discounts can be added is decided by the backend order-totals field `hasReachedMaximumDiscountLimit`; when it is true the limit state shows. The cap value itself is venue configuration, not a client constant — the kiosk acts on the flag.

### BR-DISC-11 - Coupon-type detection
A scanned/typed code is classified by client detectors that test provider formats (punch type, senior-discount type, user-as-QR-code, redemption code, single-scan code, Pepper sign-in code); each detector wraps a format check supplied by the provider. Exact per-provider patterns are configuration/provider values, not fixed client constants.

## A08 PAYMENT — Method choice, authorisation, errors, tips, donation

### Rules

### BR-PAY-01 - Only runnable methods are offered
Method list = device readiness + enabled features; a method whose device is down is hidden, not disabled.

### BR-PAY-02 - Partials reverse on re-entry
Re-entering the chooser with partials cancels them first; a failed cash cancel is non-fatal.

### BR-PAY-03 - Status polling has a floor
Cash-status polls wait at least 1,000 ms between calls and only on supporting routes; other payment polls run to a terminal state.

### BR-PAY-04 - Error code 702 is a discount path
`702` routes to the second-code-required flow, not a payment error.

### BR-PAY-05 - Submits are single-flight
A second order submit is dropped while one is in flight; injection failure never re-charges a paid order.

### BR-PAY-06 - Tip is optional and recomputed
A chosen tip joins the totals (the pre-tip total is preserved); no tip is a valid choice.

### BR-PAY-07 - Donation precedes payment
The donation step runs before the payment method flow and resumes it on apply/skip.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Payment method | Yes | Runnable method picked | Chooser stays |
| Card | Yes | Provider auth | Error screen / expired dialog |
| Tip | No | Preset or custom amount | Custom modal validation |

### Status transitions
- Method -> authorising -> authorised -> placing -> placed/failed.
- Partial -> reversed -> full again.
- Cash: waiting -> processing -> collect-change/cancel.

### Roles and permissions
- Guest: choose method, pay, tip, donate, cancel (with confirm).

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `cardReaderReady`/`cashReaderReady` | Method visibility | device |
| `foodStampEnabled` | EBT option | off |
| `giftcardPaymentTypes[]` | Gift-card buttons | none |
| Crypto/room/app/Face-ID features | Their buttons | off |
| `donationProvider` + `KioskDonationView` | Modal vs inline donation | none |
| Tip config | Preset choices + custom | off |
| `config.waitTime` | Wait-time line | unset |
| `isFoodStampPayment` | Food-stamp banner | false |

### Payment error-code table (v2 errors + authorise-time PE04)

Each v2 response carries `errorCode` + `message` + `reference` + `success`. The kiosk maps the code to a title/subtitle on the payment error screen; the screen's Try Again returns to the authorising flow for retriable errors, while fatal errors show only the back/OK action to the basket or method chooser. ("Retry offered" below = whether the retriable button state is set; `updateErrorState`'s third argument `false` marks fatal.)

| Code | Meaning | Text shown (default English) | Retry? | Buttons go to | Kept/cleared |
|:--|:--|:--|:--|:--|:--|
| `PE01` | Guest cancelled on the terminal | "Payment cancelled" / "Do you want to try paying again?" | Yes | Try Again -> retry; back -> chooser | Payment state cleared |
| `PE02` | Card removed too early / read error | "Card removed too early" / "Sorry, your payment was not completed. Try paying again, or ask our staff for help." | Yes | Try Again -> retry | Cleared |
| `PE03` | Card declined | "Payment was declined" / declined subtitle | Yes | Try Again -> retry | Cleared |
| `PE04` | Refund error during authorise | "Payment not completed" / "Please see a team member at the register. They will verify your payment and complete your order." | No | Only the error action -> PaymentError screen | Kept pending staff verification |
| `PE05` | Food-stamp payment-type change needed | Food-stamp payment-type-change text | Yes | Try Again | Cleared |
| `PE06` | Payment not completed | "Payment not completed" / "Please see a team member at the register. They will verify your payment and complete your order." | No | Error action only | Kept |
| `PE07` | Insufficient funds | Insufficient-funds text | Yes | Try Again | Cleared |
| `PE08` | Terminal communication error | "Communication error" / "We were unable to communicate with the payment terminal. Please try again, or ask our staff for help." | Yes | Try Again | Cleared |
| `PE09` | Terminal session expired | "Terminal session expired" / "The payment terminal session has expired. Please check the terminal screen and ask our staff for assistance." | No | Error action only | Kept |
| `LEGACY` / `PE00` / unknown | Generic failure | "Payment Failed" / general subtitle | Yes | Try Again | Cleared |

### Legacy (v1) + POS-injection errors

| Error | Text shown | Retry? | Buttons | Kept/cleared |
|:--|:--|:--|:--|:--|
| User cancelled (v1) | "Payment cancelled" / "Do you want to try paying again?" | Yes | Try Again | Cleared |
| Not connected | "Card removed too early" | Yes | Try Again | Cleared |
| General (v1/unknown) | "Payment Failed" / general subtitle | Yes | Try Again | Cleared |
| Punchh error | Provider-specific popup (old popup error surface) | Per dialog | Popup actions | Kept |
| Order injection / POS failure | Default: "Thanks for your payment, but we weren't able to complete your order!" / "You have not been charged. Please contact staff for assistance."; cocoa: "We were unable to complete your order" / "You have not been charged. Please contact a member of our team for assistance." | No | Error action only | Kept |

### BR-PAY-08 - Fatal vs retriable errors
`PE04`, `PE06`, `PE09` and order-injection failures are fatal (no Try Again); all other v2 and legacy errors offer Try Again.

## A09 ALTPAY — Cash, crypto, gift card, room charge, app payment, Face-ID

### Rules

### BR-ALT-01 - Cash polls with a floor
Cash status polls wait at least 1,000 ms between calls and only on supporting routes.

### BR-ALT-02 - Cash journey states drive the screens
waiting -> processing -> collect-change / collect-change-to-cancel; a fatal machine error ends on the error path; cancelling returns the money.

### BR-ALT-03 - Crypto expiry abandons
An expired crypto payment shows a dialog; confirming abandons the journey (`crypto_payment_expired`), cancelling keeps the order.

### BR-ALT-04 - Cancels confirm
Cash, crypto, Face-ID cancels all ask for confirmation first; crypto cancel warns it empties the basket.

### BR-ALT-05 - Gift card in full or partial
Balance covers -> pay in full; short -> apply the whole balance and continue for the remainder; custom amount chooses how much to spend.

### BR-ALT-06 - Gift-card apply errors are typed
`GIFT_CARD_ALREADY_ACTIVATED` -> already-added dialog; other failures -> gift-card error dialog.

### BR-ALT-07 - Room charge validates before checkout
Details validate against the property's `roomChargePaymentTypes`; valid -> checkout confirm; invalid -> error dialog.

### BR-ALT-08 - Face-ID = camera + optional 2FA PIN
The camera validates; the provider may ask a PIN (bad PIN -> "Enter a valid code.", retry allowed); attempts bounded by the provider session.

### BR-ALT-09 - Alternative methods are features
Each method shows only when its feature and device are ready (A08 chooser); scans route per A05.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Cash | n/a | Inserted >= due | Machine handles / change screen |
| Crypto code | n/a | Valid wallet payment | Expired dialog |
| Gift card | Yes | Valid card + funds | Already-added / gift-card error |
| Room details | Yes | Validate per payment types | RoomChargeConfirmError |
| Face-ID PIN | When asked | Provider PIN | "Enter a valid code." |
| App code | Yes | Valid payment code | Payment error (A08) |

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `cashReaderReady` + cash machine health | Cash method + status | device |
| Crypto feature | Crypto method | off |
| `giftcardPaymentTypes[]` | Gift-card buttons + modes | none |
| `giftCardPurchaseSettings` | Purchase banner/denominations | none |
| `roomChargePaymentTypes` + hotels | Room-charge flow | none |
| App-payment feature | App payment | off |
| `faceIdPaymentEnabled` | Face-ID payment | off |

### Gift-card PED error-code table

When the card is read on the payment terminal (PED lookup) the response `errorCode` maps to the gift-card error dialog; a non-PED failure shows the card-state messages instead.

| Code | Text shown (default English) | Retry? | Buttons |
|:--|:--|:--|:--|
| `PE01` | "Payment cancelled" | Yes | Try again |
| `PE02` | "Card removed too early" / "Sorry, your payment was not completed. Try paying again, or ask our staff for help." | Yes | Try again |
| `PE08` | "Communication error" / "We were unable to communicate with the payment terminal. Please try again, or ask our staff for help." | Yes | Try again |
| `PE09` | "Terminal session expired" / "The payment terminal session has expired. Please check the terminal screen and ask our staff for assistance." | Yes | Try again / other method |
| other PED code | "Gift card read failed" / "Sorry, we were unable to read your gift card. Please try again or choose another payment method." | Yes | Try again / other method |
| Expired card | "Your gift card expired" / "Your gift card is no longer valid. Please choose another payment method." | No | Other method |
| Empty card | "Your gift card is empty" | No | Other method |
| Already activated | "Card Already in Use" / "This gift card has already been activated. Use a different card to proceed." | No | Other card/method |

### BR-ALTPAY-08 - Gift-card errors split by source
PED-lookup failures use the `PE0x` codes; card-state failures (expired/empty/already-added) use their own texts and send the guest to another method.

### BR-ALTPAY-09 - Crypto expiry + gift-card bounds + room-charge fields
- Crypto expiry is decided by the backend response field `timeoutSeconds`; when it elapses the payment-expired dialog shows.
- Gift-card amount bounds are decided by the card balance and `amountToPay` (minimum one minor unit, maximum the available balance).
- Room-charge guest details are decided by the venue `roomChargePaymentTypes` config (first name + room number observed on the checkout card).
- Face-ID two-factor PIN allows 3 attempts (see FR-950).

## A10 POST — Success page, notifications, receipts, wait-time

### Rules

### BR-POST-01 - Order number shortens only for long digit strings
`posCheckNumberDisplayLength` truncates a digits-only, longer number to its last N digits; anything else shows in full.

### BR-POST-02 - Loyalty footers follow sign-in
Punchh checked-in -> "You have earned points on this order"; failed -> the claim-on-receipt line.

### BR-POST-03 - One notification identifier per order
The method's identifier (buzzer/tent/table/phone/name) is stored once on the order; guest name is mandatory under feature 162.

### BR-POST-04 - Receipt channels are config-driven
`kioskReceiptOptions` chooses print/email/SMS/QR; each failure has its own surface (staff message, error dialog) without blocking the reset.

### BR-POST-05 - Wait-time comes from the order response
`waitTime` drives "Current wait time is about {n} minute(s)".

### BR-POST-06 - Reset clears everything
Done or auto-return clears order, notifications, loyalty and receipt state for the next guest.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Buzzer/tent/table number | Yes | Numeric entry | Inline validation |
| Phone | Yes | Valid phone | Continue disabled / SmsErrorDialog |
| Guest name | Feature 162 | Non-empty | Continue disabled |
| Email | Yes | Valid email | Send disabled |

### Status transitions
- Paid -> waiting -> success -> (notification -> receipt ->) done/auto-reset.

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `posCheckNumberDisplayLength` | Last-N digit display | unset |
| `kioskReceiptOptions` | Receipt channels | config |
| `KIOSK_GUEST_NAME_MANDATORY` (162) | Name required | off |
| Notification methods | Which pages run | config |
| `waitTime` | Wait-time line | unset |
| Email enabled | Email receipt surface | config |

### BR-POST-07 - Email and phone validation
An email address is valid when it has no spaces, exactly one "@", at least one character before the "@", and after the "@" a domain containing at least one "." with characters on both sides (for example `a@b.co`). The same rule is used for email receipts and email loyalty sign-in. The address is re-checked on every keystroke; while it is invalid the Send button stays disabled. Phone numbers for phone notification are checked by the backend phone validation operation; while the answer is "invalid" its message is shown and Continue stays disabled.

### BR-POST-08 - Fulfilment (puck) trigger
Puck fulfilment alerts fire on order placement where the venue runs a puck system — decided by the fulfilment service being enabled in venue configuration.

## A11 PRES — Theming, accessibility, keyboards, formatting, analytics

### Rules

### BR-PRES-01 - Theming is feature-gated
`KIOSK_THEMING` (170) enables the server theme; off = brand defaults.

### BR-PRES-02 - Page overrides beat the base theme
Per-page + order-type overrides win over global tokens.

### BR-PRES-03 - Accessibility is a mode, not a separate app
One `accessibilityModeEnabled` flag switches layout + classes on every surface; every interactive element carries the accessibility classes.

### BR-PRES-04 - Focus and announcements always work
Modals trap focus; NavPed moves through sections/elements; announcements fire on every change.

### BR-PRES-05 - Direction follows language
`dir` on `<html>` follows the active language (RTL for right-to-left languages).

### BR-PRES-06 - Keyboards match the field and language
Per-language layouts; `maxLength`/`inputPattern` constrain entry; numeric fields get keypads; cocoa gets the tabbed keyboard.

### BR-PRES-07 - Everything is measured
Every interaction and screen view fires an analytics event; errors go to Sentry.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Keyboard input | Per field | `maxLength` + `inputPattern` | Keys blocked |

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `KIOSK_THEMING` (170) | Server theme | off |
| `accessibilityModeEnabled` | Accessible layout | off |
| Language list | Picker + keyboards + dir | config |
| `screenRatios` | Layout variants | device |
| `analyticsSettings` | Analytics config | config |
| Theme/page overrides | Look | brand |

### BR-PRES-08 - Analytics screen names, theme tokens, keyboard keys
- Screen-view names are decided by the page-tracking map — each route maps to its analytics screen name.
- Theme tokens are decided by `tokenMap` (server theme keys -> CSS variables); the full token set is whatever the server sends.
- Each on-screen keyboard layout ships its own key set per language file (arabic, chinese, english_gb, french, german, japanese, korean, russian, spanish + numeric).

## A12 SCO — Self-checkout screens, clerk validation, template catalogue

### Rules

### BR-SCO-01 - SCO is a mode + a template tree
`scoModeEnabled` + the SCO `mode` tree swap the journey; the same basket/payment mechanics apply with SCO surfaces.

### BR-SCO-02 - Help is a first-class flow
Guests request help; staff unlock with a PIN against `kioskConfig.pinCode`; actions run via `/clerk`.

### BR-SCO-03 - Staff actions
Reset Session / Approve Item / Delete Item / Print last receipt / Done.

### BR-SCO-04 - Templates are per-slot overrides
the screen template catalogue records every slot value per brand; the catalogue table lists them.

### BR-SCO-05 - Scans route the same way
SCO item-first then loyalty/coupon (A05); legacy ScannerManager shows the unrecognised modal.

### Validations

| Field | Required | Rules | Error shown |
|:--|:--|:--|:--|
| Staff PIN | Yes | Match `kioskConfig.pinCode` | Wrong-login-code message |

### Configuration switches

| Setting | Effect | Default |
|:--|:--|:--|
| `scoModeEnabled` | SCO mode | false |
| `kioskConfig.pinCode` | Staff PIN | config |
| Template slot values | Brand UI | per brand |
| Clerk service | `/clerk` endpoint | venue |

### BR-SCO-06 - Clerk action payloads
Clerk actions are sent to the `/clerk` endpoint carrying the action; the staff PIN is matched against `kioskConfig.pinCode`. Exact action payloads are backend-defined.
