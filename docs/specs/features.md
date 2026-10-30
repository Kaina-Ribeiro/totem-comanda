# Feature Inventory

This folder describes everything the kiosk ordering application does, so that it can be rebuilt from
scratch without looking at the original code. It describes behaviour only. It does not describe how the
original was built, and it does not recommend an architecture.

The documents were extracted from the application at version 7.52.11.

## The application in one paragraph

A self-service ordering kiosk for restaurants, food halls, cafes, airports, hotels and stadiums. A guest
walks up to an idle attract screen, touches it, picks a brand (on kiosks that serve several brands), a
language and a service type (eat in or take away), browses the menu, customises items, reviews the basket,
optionally signs in to a loyalty programme and applies coupons or rewards, adds a tip or a charity
donation, and pays by card, cash, gift card, crypto, hotel room charge, an operator app or their face.
After payment the kiosk shows the order number, can collect a buzzer, table or tent-card number or a
name, and offers a printed, emailed, texted or QR receipt. Staff can approve age-restricted items with a
PIN, and technicians can open a hidden admin panel. Almost every behaviour is switched on, off or shaped
by configuration that the kiosk receives from its local kiosk service, and the look of each screen can be
replaced per brand by a named screen "template".

## Actors

| Actor | Who | What they do |
|:--|:--|:--|
| Guest | A member of the public at the kiosk | Orders and pays. The main actor of almost every journey. |
| Staff member | Venue employee | Approves age-restricted items with a PIN; in self-checkout (SCO) mode signs in and assists. |
| Operator / technician | Venue or platform support | Opens the hidden admin panel; configures the kiosk remotely (configuration is outside this application). |

## How to read these documents

| Document | Answers |
|:--|:--|
| `features.md` (this file) | What features exist and how each behaves |
| `user-journeys.md` | What a user does, step by step, from start to end |
| `screens.md` | Every screen, modal, overlay and banner, with its elements and states |
| `functional-requirements.md` | Testable requirements (`FR-...`) with acceptance criteria |
| `business-rules.md` | Rules, validations, calculations, status transitions, roles, configuration switches |
| `data-and-integrations.md` | Business entities, backend operations, devices and external providers |
| `feature-checklist.md` | A tick-list of every feature and sub-feature for tracking parity |

### Status of each statement

| Status | Meaning |
|:--|:--|
| **Confirmed** | The behaviour was traced in the application code or its tests. |
| **Partially confirmed** | The screen or flow was traced, but part of the behaviour is decided outside the application (backend service, configuration value, hardware). The unconfirmed part is named. |
| **Unverified** | Inferred, or only partly readable. What would settle it is named. |

Behaviour that belongs to the backend services the kiosk talks to is described only as "the kiosk sends X
and expects Y". Nothing in these documents claims to know how those services work internally.

### Identifiers

| Kind | Format | Example |
|:--|:--|:--|
| Feature | `F-<AREA>-NN` | `F-MENU-03` |
| Functional requirement | `FR-<number>`, numbered in blocks of 100 per area | `FR-301` |
| User journey | `UJ-<AREA>-NN` (`UJ-E2E-NN` for end-to-end journeys) | `UJ-PAY-02` |
| Screen, modal, overlay | `SCR-<AREA>-NN` | `SCR-BASKET-01` |
| Business rule | `BR-<AREA>-NN` | `BR-LOYAL-04` |
| Entity | `ENT-<AREA>-NN` | `ENT-MENU-01` |
| Backend operation | `OP-<AREA>-NN` | `OP-PAY-03` |

### Functional areas

| Area | Code | Requirements | Covers |
|:--|:--|:--|:--|
| A01 | KIOSK | FR-101..FR-199 | Start-up, configuration, availability (closed, maintenance, at capacity), inactivity, session reset, notifications, admin access, device health |
| A02 | START | FR-201..FR-299 | Attract screen, brand selection, language selection, order type |
| A03 | MENU | FR-301..FR-399 | Menu browsing and item customisation |
| A04 | BASKET | FR-401..FR-499 | Basket, checkout preparation, age verification |
| A05 | SCAN | FR-501..FR-599 | Barcode scanning and Scan-and-Go |
| A06 | LOYAL | FR-601..FR-699 | Loyalty sign-in, sign-up, sign-out, order history |
| A07 | DISC | FR-701..FR-799 | Coupons, awards, rewards and discounts |
| A08 | PAY | FR-801..FR-899 | Checkout, payment method choice, card payment, tips, donations, partial payments, order placement |
| A09 | ALTPAY | FR-901..FR-999 | Cash, crypto, gift card, room charge, app and Face-ID payment |
| A10 | POST | FR-1001..FR-1099 | Payment success, order notification, receipts, order number, fulfilment alerts |
| A11 | PRES | FR-1101..FR-1199 | Theming, branding, accessibility, keyboards, localization formatting, analytics |
| A12 | SCO | FR-1201..FR-1299 | Self-checkout mode, staff screens, screen template catalogue |

Gaps in a number block are intentional; numbers are never reused.

### Screen templates and brand variants

Many screens exist in several renderings. Which rendering a kiosk shows is decided by a template mapping
that the kiosk receives as configuration (screen slot to named template value, for example
`welcomeCocoaPage`). Where nothing is configured for a slot, a default rendering is used. Each feature and
screen describes the default behaviour first and then lists the functional differences of each brand
template under **Variants**. A rebuild that targets one brand only needs the default behaviour plus that
brand's variant notes.

## A01 KIOSK — Start-up, configuration, availability, session and device health

### F-KIOSK-01 - Start-up and loading screen
**Status:** Confirmed
**Description and purpose:** While the app loads kiosk configuration and branding, the root route `/` shows a loading screen so the guest never sees a blank kiosk.
**What the user can do:** Wait; change language via the language control on the loading screen (cocoa style); nothing else.
**Actions and interactions:**
- No guest controls besides the language selector.
- When a notification is active the loading content is hidden behind it.
**Expected behaviour and results:**
- Shows an animated loading image, the title "Preparing your experience" and the subtitle "The kiosk is starting up and will be ready soon. If you'd like to order now, please try another kiosk or ask a team member for assistance."
- When configuration finishes, the app navigates to `/welcome` (single brand) or `/MultiBrandPage` (more than one brand) (see area A02 BR-START-14/FR-201).
- If the menu cache is not ready, a health error is shown and the configuration load retries automatically every 5 s.
**Conditions, restrictions and edge cases:**
- Configuration or branding load failure retries automatically (branding: every 5 s).
- A missing default language (neither brand nor kiosk `defaultLanguage`) is a maintenance-mode error.
**Variants:** None (single loading screen; the language control follows the language-selector style of the active template).
**Related:** SCR-KIOSK-01, FR-101..FR-105, UJ-KIOSK-01, BR-KIOSK-01..03

### F-KIOSK-02 - Kiosk availability screens (Lane Closed / Maintenance / At Capacity)
**Status:** Confirmed
**Description and purpose:** Full-screen unavailable states shown when the kiosk cannot take orders. All three share the same title+subtitle layout over the brand background.
**What the user can do:** Read the message. Nothing else (no buttons). On the cocoa variant, when the location's closed-messaging visibility is set to show the message behind the attract screen, the screen returns to `/welcome` automatically after 10 s.
**Actions and interactions:**
- No interactive elements (guest cannot dismiss).
- Staff may still reach the admin panel via the hidden gesture (F-KIOSK-07).
**Expected behaviour and results:**
- Lane Closed: title "CLOSED" (default/costa), "Closed" (cocoa) or the configured closed message (`closedMessage.title`/`description` in the carousel settings); shakeshack shows its logo plus a closed message.
- Maintenance Mode: title "KIOSK CURRENTLY UNAVAILABLE" plus a subtitle apologizing for the inconvenience (costa defaults: "Kiosk Currentely unavailable" / "We apologize for the incovenience"; cocoa: `unavailablePage.cocoa.Maintenance.title`/`.subtitle`).
- At Capacity: "Sorry, our kitchen is currently at capacity" + "We will resume taking orders shortly." (costa/cocoa equivalents).
**Conditions, restrictions and edge cases:**
- Reached from the trading check: maintenance mode active -> maintenance screen; at-capacity mode active -> at-capacity screen; all order types unavailable / all brands closed -> Lane Closed when the lane-closed visibility rule allows (BR-KIOSK-04..08).
- Closed-message visibility setting (`ALWAYS_SHOW` default / `SHOW_BEHIND_ATTRACT_SCREENS` / `NEVER_SHOW`) controls whether the message is a full screen or a 10 s overlay returning to the attract screen (cocoa).
**Variants:** default (generic logo + message), cocoa (uses the cocoa unavailable layout + configured closed message + 10 s auto-return for behind-attract mode), costa (same layout, costa texts), shakeshack (closed logo + message). Other templates: same as default.
**Related:** SCR-KIOSK-02..04, FR-106..FR-112, BR-KIOSK-04..10

### F-KIOSK-03 - Inactivity warning and journey abandonment
**Status:** Confirmed
**Description and purpose:** When the guest stops interacting, the kiosk warns and then resets to the start screen so the next guest gets a clean journey.
**What the user can do:** Tap anywhere/key press to reset the idle counter (implicit); on the warning dialog choose "Continue" or "Cancel my order".
**Actions and interactions:**
- Idle detection listens to clicks, mouse moves and key presses; the counter ticks once per second.
- Warning notification: title "Are you still there?" with buttons "Cancel my order" (destructive) and "Continue" (default).
**Expected behaviour and results:**
- After `idleTimerIntervalMilliseconds` of inactivity (default 30,000 ms; minimum effective 1 s) the warning notification appears — unless another notification is already showing, in which case it waits.
- The warning itself auto-expires after the same timeout: no answer -> the journey is abandoned (as if "Cancel my order" was chosen but recorded as a timeout).
- "Continue" dismisses the warning and resets the idle counter; `idle_timeout` analytics fires with selection `needs_more_time` and the current screen.
- "Cancel my order" abandons the journey immediately; analytics `idle_timeout` with selection `abandon`.
- Auto-expiry abandons the journey; analytics `idle_timeout` with selection `timeout`; journey-abandoned analytics fires with `abandoned_by = idle_timeout`.
- Abandonment resets the session (back to `/welcome` or `/MultiBrandPage`, clears order/session state) and posts an abandon-journey request with reason `IDLE_TIMEOUT` (OP-KIOSK-02). A manual order cancellation uses reason `CANCELLED_BY_GUEST`.
**Conditions, restrictions and edge cases:**
- The whole idle feature is off unless `idleTimerIntervalMilliseconds` > 0 in kiosk config.
- Idle checking is disabled on: authorizing-payment, cash payment, cash change, crypto payment, Face-ID payment, app payment, processing cash, gift-card PED interaction, help-requested, Lane Closed, Maintenance, At Capacity, payment, payment success, print receipt, the loading root route, the current root screen (`/welcome` or `/MultiBrandPage`), while configuration is loading, and while a scan is being processed.
**Variants:** shakeshack has an `IdleOverlay` visual variant (partially confirmed — file exists, internals not traced). Others same as default.
**Related:** SCR-KIOSK-05, UJ-KIOSK-03, FR-113..FR-120, BR-KIOSK-11..14, OP-KIOSK-02

### F-KIOSK-04 - Session reset
**Status:** Confirmed
**Description and purpose:** Returns the kiosk to its idle screen and clears everything from the current journey.
**What the user can do:** Guests trigger it via timeout (F-KIOSK-03), the cancel/trash action, or back navigation to the start; staff via admin/staff functions.
**Actions and interactions:** No dedicated UI; it is the system's response to reset triggers.
**Expected behaviour and results:**
- `journey_end` analytics fires (`ended_by` = `automatic` for timeouts, `next_order_button` for manual reset).
- A session-reset request is posted to the local backend with `orderNonce`, `orderTotal`, `currency`, `locationId` (OP-KIOSK-01).
- Navigation goes to the root screen: `/MultiBrandPage` when more than one brand is configured, else `/welcome`; on multi-brand the active brand configuration is cleared too.
- Order, basket, draft, payment, email-form and order-notification state are cleared; NavPed navigation state is reset.
**Conditions, restrictions and edge cases:** Multi-brand reset also reloads the kiosk to the brand selector (brand config cleared).
**Variants:** None.
**Related:** UJ-KIOSK-03, FR-121, BR-KIOSK-15, OP-KIOSK-01

### F-KIOSK-05 - Global error notifications and banners
**Status:** Confirmed
**Description and purpose:** A notification system shows errors, warnings and confirmations over any screen — as a modal with buttons, a banner, or a stack of messages.
**What the user can do:** Read the message; press an action button (e.g. "Start Over" retry, "Continue", "Cancel my order"); some notifications dismiss themselves after a configured timeout.
**Actions and interactions:**
- Modal notification: title + up to several action buttons (default / destructive styles); optional auto-timeout that runs a configured action.
- Banner notification: non-blocking message bar.
- Stacked notifications (cocoa): multiple transient messages stacked.
**Expected behaviour and results:**
- Only one modal notification at a time; a new warning (e.g. idle alert) is suppressed while another notification is visible.
- Retryable errors (language change, configuration) attach a "Start Over" button that re-runs the failed action.
**Conditions, restrictions and edge cases:** Notification content, buttons and timeout are supplied by the caller (e.g. the idle warning, error handlers).
**Variants:**
- cocoa: Notification (title + message list + footer buttons; an optional `timeout`+`timeoutAction` fires the action automatically when it elapses — the idle warning uses this), NotificationContainer (animated wrapper), StackedNotifications (toast stack rendered with enter/exit animations; clicking a toast dismisses it), plus dedicated transient notifications under the payment tree (A08/A10).
- costa: same modal pattern; idle buttons "Yes" / "Cancel".
- itsu: same modal pattern; idle "Cancel Order" + continue action.
- shakeshack: `IdleOverlay` variant — "Are you still there?" with "Yes, continue" / "Exit kiosk" instead of the generic modal.
- default: Notification modal + BannerNotification (non-blocking icon + title + subtitle bar, focusable, no buttons).
- Payment-specific transient notifications (printer failed, cash change error, drink dispense) belong to their own areas (A08/A09/A10).
**Related:** SCR-KIOSK-06, FR-122..FR-124

### F-KIOSK-06 - Hidden admin panel access
**Status:** Confirmed
**Description and purpose:** Staff open the admin panel by tapping a subtle/invisible button area several times quickly — hidden from guests.
**What the user can do:** Tap the admin button area 5 times within 4 s; on an ATP error dialog choose to continue to the panel or close it.
**Actions and interactions:**
- Rapid-tap gesture: 5 taps within 4,000 ms on the admin button (banner or button variant) opens the admin panel; slower tapping resets the count.
- Before opening, a cash-machine health check runs: if it returns an `errorImageUrl`, an error dialog showing that image appears first, with options to open the panel anyway or close.
- If the health check fails to respond, the admin panel opens anyway.
**Expected behaviour and results:** `POST /admin/open` is sent to the local kiosk service, which hosts the admin panel — its CONTENT is outside this application (opened through the local kiosk service; it is not covered by area A12 of this dossier). ATP error dialog can be dismissed or overridden.
**Conditions, restrictions and edge cases:** Cocoa template only — the button sits on the welcome screen (button variant) and order-type screen (banner variant).
**Variants:** cocoa only. Other templates: no admin button found (Unverified whether another entry exists).
**Related:** SCR-KIOSK-07, UJ-KIOSK-04, FR-125..FR-127, OP-KIOSK-03

### F-KIOSK-07 - Device health checks (printer, scanner, cash, orientation, terminal)
**Status:** Confirmed
**Description and purpose:** Background checkers monitor device health and surface problems as notifications or status reports to the kiosk backend rather than as guest screens.
**What the user can do:** Nothing directly; staff see error notifications/indicators and operator devices show attention states.
**Actions and interactions:** None (automatic, side-effect only).
**Expected behaviour and results:**
- Printer: when `printerEnabled` and not in maintenance, a printer status call runs each time the route CHANGES TO `/welcome`; the result updates printer availability and printer errors are eligible to show while the guest is on the menu, order summary, order type, product search, loading or welcome screens. (Constants for up to 3 retries at 3,000 ms exist; the traced path performs one call per navigation.)
- Scanner: when `scannerEnabled` and not in maintenance, a scanner status call runs on each navigation to `/welcome` or `/orderSummary`; a request timeout keeps the last status, other failures mark it unavailable. Skipped entirely when the HID keyboard scanner is enabled.
- Cash machine: once per app start, when `cashEnabled` and `cashReaderReady` is false, a cash-status refresh request is sent; admin-panel open triggers an on-demand health fetch (F-KIOSK-06).
- Orientation: development builds only — an orientation-change listener restarts the app; production kiosks cannot rotate.
- Kiosk status/actions: `KioskStatus` (`APPLICATION_STARTING`, `APPLICATION_START_FAILED`, `TRADING`, `UNAVAILABLE` + reason `MAINTENANCE`/`AT_CAPACITY`/`STORE_CLOSED`/`UNKNOWN`, category `APPLICATION_STATUS`/`DISPLAYING_SCREEN`) posts to `POST /health/kiosk-app/status`; `KioskAction` (`START_JOURNEY_SUCCESS`, `START_JOURNEY_FAILED`, `APPLICATION_START_FAILED` + reason `FAILED_START_JOURNEY`/`FAILED_LOAD_MENU`/`FAILED_DOWNLOAD_TEMPLATE_SCRIPT_FILES`) posts to `POST /health/kiosk-app/track-key-action`; each is also written to the local metrics log. `TRADING` is set on every successful config refresh; a failing refresh sets `UNAVAILABLE` with the mapped reason.
- Component statuses (`monitoredComponent`, `requiresAttention`, message — e.g. `HELP_BUTTON`) are reported to configured status terminals via the Electron main process: UDP-discovery terminals on UDP port (default 9,837) and strict-IP terminals on TCP (default 9,838); a failed report re-runs discovery. While a component requires attention, status updates for other components are dropped.
**Conditions, restrictions and edge cases:** Checks are suppressed while in maintenance mode (printer, scanner) and only run on relevant screens.
**Variants:** None.
**Related:** FR-128..FR-131, OP-KIOSK-03..05, OP-KIOSK-07..09, BR-KIOSK-16

### F-KIOSK-08 - Maintenance mode, at-capacity and health-error entry rules
**Status:** Confirmed
**Description and purpose:** The kiosk decides it cannot trade and diverts to the right unavailable screen — both at start-up and when a guest tries to start a journey.
**What the user can do:** Nothing; staff/operator config controls the states.
**Actions and interactions:** None.
**Expected behaviour and results:**
- Maintenance mode: entered when the kiosk config flags maintenance (and on certain configuration errors, e.g. no default language). Sets a maintenance flag and shows the maintenance screen; deactivating clears config and reloads to `/`.
- At capacity: entered when the config flags at-capacity mode; shows the at-capacity screen.
- Closed kiosk: `isDineInAvailable`/`isTakeOutAvailable` = false strip the order types; brands left with no order types are marked closed; if every brand is closed the Lane Closed screen shows (subject to visibility rules).
- Opening the lane again returns to `/welcome`.
- A POS health-check failure activates maintenance mode and shows the maintenance screen (`activateMaintenanceFromPosCheck`); recovery deactivates it and returns to the root page.
- A background config re-check runs every 45,000 ms on gate screens only (root/welcome, Lane Closed, Maintenance, At Capacity): interaction is disabled during the fetch, a fetch taking >1,000 ms shows the loading state, and the new config is applied only while still on a gate screen — so a kiosk closing or opening flips screens on the next tick while mid-journey guests are unaffected until they return to a gate screen.
**Conditions, restrictions and edge cases:** These checks run at journey start (blocking start), during configuration load, and on the 45 s re-check timer on gate screens.
**Variants:** Screen visuals per F-KIOSK-02.
**Related:** FR-132..FR-135, BR-KIOSK-04..10, UJ-KIOSK-02

### F-KIOSK-09 - ATP hosting mode and Windows shell packaging
**Status:** Confirmed
**Description and purpose:** The app can run hosted inside Access's ATP board; the WiX installer packages it as the Windows kiosk shell.
**What the user can do:** Nothing directly; the operator installs and the shell/board launches the app.
**Actions and interactions:**
- ATP mode is enabled when `C:\comanda\config\kiosk-app-atp-config.json` exists.
- In ATP/production the window is frameless, non-resizable and non-maximizable.
- After load the board service is initialized: `initialize()` returns capabilities, `applicationDidStart(windowHandle)` registers the app, and a heartbeat scheduler starts; an init failure is logged ("ATP failed to initialize").
- An embedded wrapper HTTP server exposes `willappear` endpoints that bring the kiosk window to the front when the board calls them.
- `SIGTERM` closes the wrapper cleanly; debug mode adds an inspect-element context menu and F12 dev tools.
- The ATP error dialog on admin-panel open (F-KIOSK-06) is the staff-visible ATP surface.
- Installer side: a WiX installer plus Shell Launcher install/uninstall PowerShell scripts (settings.xml) set up the Windows kiosk lock-down shell.
**Expected behaviour and results:** Hosted operation under the ATP board with heartbeat and show-window callbacks.
**Conditions, restrictions and edge cases:** Debug-mode extras only in debug builds.
**Variants:** None.
**Related:** FR-136

### F-KIOSK-11 - Admin-panel open failure (second pass)
**Status:** Confirmed
**Description and purpose:** Failure copy when the hidden admin panel cannot open.
**Actions and interactions:** "Failed to open Admin Panel" + "Try to open again"; the cash-unavailable notice "Cash payments unavailable" exists for machine-down states.
**Related:** F-KIOSK-07, FR-127

## A02 START — Attract screen, brand selection, language selection, order type

### F-START-01 - Attract screen (tap to start)
**Status:** Confirmed
**Description and purpose:** The idle screen shown when the kiosk is configured and ready. Its purpose is to invite the guest to touch the screen and begin a new order journey.
**What the user can do:** Tap anywhere on the screen (or press any key on the variants that handle key presses) to start an order. Change language where a language button is shown.
**Actions and interactions:**
- Full-screen tap target covering the attract area; tap or key press starts the journey (SCR-START-01).
- Language button opens the language overlay (SCR-START-02); tapping a language does NOT start the journey on most templates — see Variants.
- Accessibility (NavPed) button toggles accessibility mode on templates that show it.
- App version and active location/kiosk id are rendered in small text at the edge of the screen.
**Expected behaviour and results:**
- Tap while interaction is enabled starts the ordering journey (F-START-10).
- Tap is ignored when the kiosk accepting input is false (e.g. config/branding still loading).
- While configuration is loading, a full-screen loading overlay covers the screen.
- If the kiosk is not trading (maintenance mode, at-capacity mode, all order types unavailable), the tap redirects to the Lane Closed / Maintenance / At Capacity screen instead of starting (BR-START-15).
- On mount of the cocoa variant the kiosk reports status "Showing welcome screen" to the kiosk-status reporter (device-health telemetry, see area A01).
**Conditions, restrictions and edge cases:**
- Language button shown only when the active brand offers more than one supported language (BR-START-01).
- On the multi-brand welcome variant, if the selected brand has fewer than 2 languages the page is skipped entirely and the journey starts immediately (BR-START-14).
- If the resolved active location id is missing, the app navigates back to the root/loading route; if the active location id does not match any configured brand, the first configured brand is loaded automatically (BR-START-17).
**Variants:**
- default (`welcomePage`): branded logo plus a single centred button labelled "Tap here to get started"; language button below when >1 language.
- `welcomePlainPage`: whole screen is the tap target (no start button); language button present; used where branding supplies only a background image.
- `welcomeCarouselPage`: full-screen media carousel behind the tap target (F-START-02); brand logo hidden whenever at least one media is shown.
- `welcomeCocoaPage` (default for the cocoa template): carousel background, invisible full-screen tap target (no visible start button), language + accessibility buttons bottom area, admin-panel button region; action buttons are hidden when the location is closed AND closed-messaging visibility is `NEVER_SHOW` (otherwise shown).
- `welcomeCostaPage`: carousel background, visible "Start your order" button, Costa language button (>1 language), accessibility button.
- `welcomeItsuPage`: static bundled background image, "touch to order!" label, "make it yours" strapline (hardcoded English, not translated), language button.
- `welcomeMultiBrandPage` (multi-branch): NOT a tap-to-start attract screen; shows language list + "Continue" button — see F-START-06.
- `welcomePage` (generic/default value) and `orderTypePage` fall back to the default implementations when a template does not override them.
- v2/v3/boparan/buzzer/cinnamon/sco: no start-area override found — same as default.
**Related:** F-START-02, F-START-03, F-START-10, SCR-START-01, UJ-START-01, BR-START-15, BR-START-18

### F-START-02 - Attract carousel (background media)
**Status:** Confirmed
**Description and purpose:** Rotating background images and videos shown behind the attract screen and behind the multi-brand selector. Media is configured per brand (`restaurant.branding.carousel`) or for the multi-brand selector (`multiBranding.carousel`).
**What the user can do:** Nothing directly — media is passive background. Media with `altText` is focusable/announced to assistive navigation.
**Actions and interactions:**
- Automatic rotation; no manual controls.
- Each image may carry `altText`; media with alt text becomes an accessibility-focusable element.
**Expected behaviour and results:**
- Images rotate in configured order; each image stays for its configured `duration` (ms); missing duration defaults to 7,000 ms.
- Videos (`.mp4`, `.webm`, `.ogg`, matched on the `id` query parameter first, then the URL) autoplay muted without controls, loop, and the slide advances when the video's own duration elapses (fallback 7,000 ms if metadata unavailable).
- Media that fails to load is skipped; if all media fails, no background is rendered (children still shown).
- Only media whose configured time window contains the current local time is shown (`timeStart`/`timeEnd`, 24h "HH:MM:SS"-style strings, compared as strings). Windows where `timeStart > timeEnd` span midnight. Media without both bounds is always active (BR-START-05).
- If no media is currently active, the brand's default background image is shown instead (cocoa resolves it per screen aspect ratio 9_16 / 16_9 / 3_2; carousel/costa variants use `branding.backgroundImage`).
- First render shows the first media without animation; transitions between slides animate only when there are 2+ media.
**Conditions, restrictions and edge cases:**
- Media entries without `url` are dropped before scheduling.
- A per-language media filter exists (`locale` / `useAsDefaultLocale` fields: exact locale match, else default-locale match, else all media) but no call site in the start screens was found — Unverified whether used elsewhere.
- Carousel rotation does not restart on each render; the timer is set after the current media finishes loading.
**Variants:** cocoa and costa welcome pages and the multi-brand selector share the same carousel behaviour and rules; the default/plain welcome pages have no carousel.
**Related:** SCR-START-01, SCR-START-03, BR-START-05, BR-START-06, ENT-START-01

### F-START-03 - Language selection
**Status:** Confirmed
**Description and purpose:** Lets the guest switch the whole UI (and the menu content) to one of the brand's supported languages.
**What the user can do:** Open the language overlay from the attract screen (and from the order-type screen on cocoa), pick a language, or close the overlay without choosing.
**Actions and interactions:**
- Language button: shows the current language name (and a language icon on the plain/cocoa/costa style); tap opens the overlay (SCR-START-02).
- Overlay: one selectable cell per supported language, in the active language list order; the current language is ticked/highlighted; each cell shows the language name plus a per-language greeting ("Hello"/"Bonjour"/…) from the localization pack (`languageSelector.hello.<code>`).
- Close via the X button (aria-label default "Close language selection dialogue") or by tapping the dimmed background.
- The (non-plain) legacy overlay also exposes an accessibility-mode toggle button in a corner of the overlay.
**Expected behaviour and results:**
- Selecting a different language loads that language's localization pack; while it loads, a full-screen loading overlay is shown; then the whole UI switches, including `lang` and `dir` (RTL support) document attributes.
- Re-selecting the already-active language is a no-op (no reload, no analytics).
- On the cocoa template a "Language updated" confirmation dialog appears after selection (SCR-START-06) and closes automatically ~2 s after the language finishes loading (or fires the caller's callback — see BR-START-16).
- If the language pack fails to load, an error notification with a "Start Over" button is shown; pressing it retries the same language change.
- On the welcome screen of single-brand cocoa, choosing a language starts the order journey after the ~2 s confirmation dialog and marks the journey as started by the language selector (BR-START-16).
**Conditions, restrictions and edge cases:**
- Button hidden when the brand has 0 or 1 supported languages; cocoa can force it visible (a force-visible option on the order-type nav bar).
- Language list is sorted alphabetically by name with the configured default language pinned first (BR-START-02).
- Language packs are loaded once and cached for the session.
**Variants:**
- default/legacy overlay (used by `welcomePage`, `welcomePlainPage`): header "Language Selection", grid of language cells (~280 px each), accessibility toggle.
- plain overlay (used by carousel, cocoa, costa, itsu, multi-branch screens): header icon + title, list of cells with greeting text, X close button, scroll shadow on the header; cocoa passes overlay title "Select a language" and Costa "Select a language"; itsu uses the plain default ("Language Selection" with current-language parameter).
- `welcomeMultiBrandPage` embeds the language cells inline on the page (no overlay, no open/close) — see F-START-06.
**Related:** SCR-START-02, SCR-START-06, FR-210..FR-218, UJ-START-03, BR-START-01..BR-START-04

### F-START-04 - Automatic language reset
**Status:** Confirmed
**Description and purpose:** Returns the kiosk UI to the configured default language so the next guest always starts in the default language.
**What the user can do:** Nothing — automatic.
**Actions and interactions:** None.
**Expected behaviour and results:**
- Single-brand kiosks: while on `/welcome`, if the guest changed the language, the language silently reverts to the remembered default after 30 s (BR-START-03). Off `/welcome`, or on multi-brand kiosks, this timer is disabled; when it becomes enabled again and language differs, it resets immediately.
- Multi-brand kiosks: whenever the app is on `/MultiBrandPage` (and not loading branding), the language is forced to the kiosk-level `defaultLanguage` (BR-START-04). The switch also writes the active language code and text direction (`rtl`/`ltr`) onto the document element.
- Reset uses the "set language" path: silent (no analytics event, no error notification on failure — failures are logged only).
**Conditions, restrictions and edge cases:** The remembered "default" is the first language observed; on multi-brand it is the kiosk config `defaultLanguage`. The 30 s timer restarts if the language changes again.
**Variants:** None.
**Related:** BR-START-03, BR-START-04, FR-216, FR-217

### F-START-05 - Multi-brand brand selection
**Status:** Confirmed
**Description and purpose:** On kiosks serving more than one brand (food-court style), the root screen after loading is a brand picker instead of an attract screen.
**What the user can do:** Tap a brand logo to select that restaurant; tap the carousel overlay to reveal the selector; use the back button to bring the attract carousel back.
**Actions and interactions:**
- Brand cells: one per configured location; tap selects the brand when it is open and ready.
- Closed/not-ready brands render dimmed with an info icon and "Sorry, we're closed" (`multibrand.storeClosed`); the cell button is disabled when the brand is neither open nor ready (BR-START-08, BR-START-09).
- Header title "What are you craving today?" (`multibrand.headerTitle`).
- Attract overlay: when the multi-brand carousel has currently-active media it covers the selector; a single tap hides it for 60 s, then it returns automatically — but only if the kiosk is trading (BR-START-07). The navigation bar's back/cancel button re-shows it immediately.
- Version and kiosk id shown at the edge when the carousel is not covering the screen.
**Expected behaviour and results:**
- Selecting a brand loads that brand's template, theme, CSS and default language, updates analytics location id, then navigates to `/welcome` — or skips welcome entirely and starts the journey when the welcome template is the multi-brand language page and the brand has <2 languages (BR-START-14).
- Branding load failure retries automatically every 5 s until success.
- While branding or config is loading, a full-screen loader covers the selector.
- Layout adapts to brand count (<4 small, 4–6 medium, ≥7 large) and enlarges in accessibility mode.
**Conditions, restrictions and edge cases:**
- Taps are ignored while the kiosk accepting input is false.
- A brand whose restaurant has no remaining order types is marked closed (BR-START-10).
- `isDineInAvailable`/`isTakeOutAvailable` = false remove the corresponding order type from the brand before this screen (BR-START-10).
**Variants:**
- itsu (`multiBrandItsuPage`): same cells/closed-state logic; carousel tap does NOT check trading status before hiding; a dedicated bottom bar has an accessibility toggle plus an "x cancel" button that re-shows the carousel.
- default (`multiBrandPage` mapping in the multi-branch template): as described above.
- Other templates do not override the multi-brand page.
**Related:** SCR-START-03, UJ-START-04, BR-START-07..BR-START-10, FR-219..FR-226

### F-START-06 - Multi-brand welcome (language) page
**Status:** Confirmed
**Description and purpose:** After a brand is picked on a multi-brand kiosk whose welcome screen is the multi-brand language page, `/welcome` shows an inline language picker ("Prefer another language?") instead of a tap-to-start attract screen.
**What the user can do:** Pick a language (switching happens immediately, inline), then press "Continue" to start the journey.
**Actions and interactions:**
- Language cells identical to the overlay cells (name + greeting + tick on the current one); selecting one immediately applies that language.
- "Continue" button lives in the bottom navigation bar and runs the same start flow as the attract tap (F-START-10).
- When the kiosk has only one configured brand (edge case), the nav bar is hidden and version + location id are shown instead.
**Expected behaviour and results:**
- With <2 supported languages the page is skipped after brand selection (BR-START-14).
- Loading overlay shown while languages/branding load.
- Navigating back from `/orderType` returns here (instead of resetting the session) when this template is active and the brand has >1 language (BR-START-19).
**Variants:** multi-branch template only.
**Related:** SCR-START-04, UJ-START-05, BR-START-14, FR-227

### F-START-07 - Order type selection (Eat In / Take Away)
**Status:** Confirmed
**Description and purpose:** Screen at `/orderType` asking how the guest wants to receive the order. Shown during journey start whenever a choice is required or the screen doubles as a combined "language + service" step.
**What the user can do:** Tap "Eat In" (`DINEIN`) or "Take Away"/"Take Out" (`TAKE_OUT`); on some templates use back/cancel and language/accessibility controls.
**Actions and interactions:**
- One large button per available order type with image/icon and label.
- Back/cancel: cocoa shows a back button in the nav bar (when Avolta or theming enabled); shakeshack shows a header close button; multi-branch/bk/itsu/costa show the shared QSR navigation bar. Back behaviour: multi-brand welcome template + >1 language → `/welcome`; otherwise the session is reset to the root screen (BR-START-19).
- Language selection available on cocoa (nav bar or footer) and changing language there reloads the menu in the new language.
- Accessibility mode toggle on cocoa/costa/bk/itsu via the accessibility button or nav bar.
- On cocoa a loyalty sign-in banner can appear (F-START-08) and serial-scanner input is listened to when Avolta is enabled.
**Expected behaviour and results:**
- Tapping an order type records it on the order, fires `service_selected`, filters the already-loaded menu to that order type, and advances (F-START-10).
- If the brand exposes only one order type and the other conditions don't apply, this screen is skipped entirely (BR-START-12).
- The order type list only ever contains `DINEIN` and `TAKE_OUT`; `DINEIN` always sorts first (BR-START-11).
**Conditions, restrictions and edge cases:**
- The screen is shown when the restaurant has >1 order type OR the brand has >1 language OR loyalty is enabled (BR-START-12). When skipped, the first order type (default `DINEIN`) is applied automatically.
- cocoa: when the guest is already signed in (logged-in overlay fires) and there is only ONE order type, the order type is applied automatically without a tap.
- cocoa/theming (`KIOSK_THEMING` feature): custom per-order-type images (`eatInImage`, `takeAwayImage` on the order-type page overrides) replace the icons; `orderTypeButtonsDirection` = `row`|`column` controls layout, defaulting to `column` when a custom image exists and no direction is set.
**Variants:**
- default (`orderTypePage`): logo header + order-type cells; labels "Eat In"/"Take Out".
- cocoa (`orderTypeCocoaPage`): title "What service would you like today?", icon or themed image cards, loyalty banner/back/language/accessibility per above; labels "Eat In"/"Take Away".
- costa (`orderTypeCostaPage`): title "Where will you be having your order?", logo, QSR nav bar; labels "Eat In"/"Take Away".
- itsu (`orderTypeItsuPage`): no title inside the selector; labels "Eat In"/"Take away"; QSR nav bar.
- bk (`orderTypeBkPage`): title "Order Here for Dine in or Take Away!"; decorative burger image hidden in accessibility mode; labels "Eat In"/"Take away".
- shakeshack (`orderTypeShackPage`): title "Would you like to dine in or take out?"; header close button; labels "Dine In"/"Take Out".
- multi-branch (`orderTypeMultiBrandPage`): logo + cells + QSR nav bar; default labels.
- v2/v3/boparan/buzzer/cinnamon/sco: no override found — same as default.
**Related:** SCR-START-05, FR-228..FR-235, UJ-START-02, UJ-START-06, BR-START-11..BR-START-13, BR-START-19

### F-START-08 - Loyalty prompt on the order type screen
**Status:** Partially confirmed (the banner contents and the sign-in flow itself belong to area A06; only its visibility rules are confirmed here)
**Description and purpose:** The cocoa order-type screen can show a loyalty/discount-provider sign-in banner so the guest identifies themselves before browsing.
**What the user can do:** Interact with the banner to sign in (details in area A06), or ignore it and pick an order type.
**Actions and interactions:**
- Legacy style: inline scan-only banner shown when loyalty is enabled AND (scanner available OR a reward barcode already exists).
- New multi-sign-in style: simple banner shown when `authConfig.loyaltySettings.supportsPreBasketSignin` AND loyalty enabled.
- Avolta: banner shown when the Avolta screen gate allows it; a serial scanner listener is also mounted on the page.
- Banner is NEVER shown for NST_YOYO loyalty or Accesso (Merlin) loyalty — those collect identity on the loyalty logging page instead.
**Expected behaviour and results:**
- If pre-basket sign-in is supported and the guest is not signed in, picking an order type routes to the loyalty logging page instead of the menu (BR-START-20).
- If the guest signs in while on the screen and only one order type exists, the order type is applied automatically and the journey proceeds (see F-START-07).
- A "logged in" overlay is shown for 2,000 ms on this screen only when there is more than one order type.
**Conditions, restrictions and edge cases:** See visibility rules above; everything about the sign-in mechanics is owned by A06.
**Variants:** cocoa only; no other template renders a loyalty prompt on the order type screen.
**Related:** F-START-07, FR-236..FR-238, BR-START-20, UJ-START-06

### F-START-09 - Welcome message dialog (NavPed / headphones)
**Status:** Confirmed
**Description and purpose:** Accessibility dialog shown when the guest plugs headphones into the NavPed (navigation pad). Explains the audio-navigation controls before the journey begins.
**What the user can do:** Read the instructions; press "Continue" to dismiss.
**Actions and interactions:**
- Triggered when a headphone-plugged key event arrives from the navigation ped (keyboard event), which also starts the screen reader.
- Single primary button "Continue" (`welcome.cocoa.welcomeDialogButtonTitle`) closes the dialog. No cancel/X.
- Unplugging headphones does not re-show it; plugging in again re-shows it.
**Expected behaviour and results:**
- Title: "Welcome to the text to speech kiosk experience". Body explains the volume button, the four diamond navigation keys, the centre select key with tactile ident, and the 3-second long-press help recap (default English text quoted in FR-240).
- Dialog is rendered via the `welcomeMessageDialog` template slot (cocoa implementation is the only one found).
**Conditions, restrictions and edge cases:** Only fires for NavPed key events; ordinary touch guests never see it.
**Variants:** cocoa only.
**Related:** SCR-START-07, FR-239, FR-240, UJ-START-07

### F-START-10 - Journey start
**Status:** Confirmed
**Description and purpose:** Everything the app does between the guest's first touch and the first ordering screen: session creation, analytics, menu load, routing.
**What the user can do:** Trigger it by tapping the attract screen, pressing "Continue" on the multi-brand welcome page, or (cocoa) changing language on the attract screen.
**Expected behaviour and results:** (numbered as FR-241)
1. Trading check: maintenance → Maintenance screen; at-capacity → At Capacity screen; all order types unavailable → Lane Closed (when configured to show it). Any failure aborts the start (BR-START-15).
2. Analytics session timer starts; a new empty order is created with the default order type and a fresh nonce; the analytics session id is set to that nonce.
3. A non-blocking `journeyStarted` call is sent to the local kiosk backend with location id and nonce; the response's `journeyStartedTimestamp` is stored unless one already exists (OP-START-01). Failures are logged and reported to kiosk-status telemetry but do not block the guest.
4. `journey_started` + `session_start` analytics events fire; `started_by` is `attract_screen` unless the language selector started the journey (`language_selector`).
5. The menu is loaded (blocking; failures surface the generic service-error handling, see area A01) and the entity list is reset.
6. `journeyStartSuccess` is reported to kiosk-status telemetry.
7. Routing: order-type screen shown if BR-START-12 applies; otherwise the order type is applied silently and the flow continues as F-START-07 describes — loyalty logging page when required, else menu (Scan-and-Go start on SCO-cocoa, order history when available, else menu home).
**Conditions, restrictions and edge cases:** Journey start while the kiosk is not trading rejects without touching analytics/order state.
**Variants:** Same flow on every template; only the visuals of the entry screens differ.
**Related:** UJ-START-01, FR-241..FR-247, OP-START-01, BR-START-12..BR-START-15, BR-START-20

## A03 MENU — Menu browsing and item customisation

### F-MENU-01 - Menu load and order-type filtering
**Status:** Confirmed
**Description and purpose:** The menu is fetched once at journey start and held in two filtered views — one for `DINEIN`, one for `TAKE_OUT` — so the guest only ever sees items orderable under the current order type.
**What the user can do:** Nothing directly; filtering happens invisibly.
**Actions and interactions:** None.
**Expected behaviour and results:**
- `GET /menu` on the local kiosk backend returns the full menu (entities, currency, item tags, `showCategoriesPrice` flag) in the active language.
- Each entity carries `serviceAvailability` flags (`dineInFlag`, `takeOutFlag`, both defaulting true when absent). Items/options not available for the current order type are removed; categories left empty are removed; option-group options are filtered the same way recursively.
- Entities are sorted by `displayOrder` at every level.
- Changing language reloads the menu and re-filters for the current order type.
**Conditions, restrictions and edge cases:** Filtering mutates nothing visible before the choice; the pre-filtered copies are kept alongside the full menu.
**Variants:** None.
**Related:** FR-301..FR-303, OP-MENU-01, ENT-MENU-01

### F-MENU-02 - Category browsing (root list and sub-categories)
**Status:** Confirmed
**Description and purpose:** Guests navigate the menu through category cells; tapping a category opens its children (sub-categories or items). The root screen is the top-level category list.
**What the user can do:** Tap a category cell; use back to return to the parent level; scroll the list.
**Actions and interactions:**
- Category cell: image + name; tap selects the entity and pushes it on the navigation breadcrumb.
- Back: pops one level to the parent category's children, or to the root list; clears any in-progress item draft.
- Lazy loading: long lists render in batches of 60 cells, more loaded on scroll.
- Entering a level re-animates cells in with a staggered slide-in (40 ms per cell, capped at 200 ms, first 25 cells only); a 200 ms delay precedes the reveal.
- Header shows the selected category name (or the generic browse title) plus a subtitle; a wait-time line appears under the header when the kitchen reports one.
**Expected behaviour and results:**
- Tapping a category containing only items shows the item/product view; containing any category shows another category level.
- Analytics: `select_item`/`view_item_list` style events fire on category/item selection (select_item with popular flag; screen view `home_page`).
**Conditions, restrictions and edge cases:**
- A level with a single item child can select that item directly (the item analytics event uses the child when exactly one exists).
- Categories with no items available for the current order type are removed entirely (F-MENU-01).
- `showCategoriesPrice` = false suppresses category pricing display where applicable.
**Variants:**
- default (`homePage`): floating logo + centred category list; header "Browse the menu" / "Don't hesitate to ask for help if you get stuck".
- cocoa (`homeCocoaPage` via cocoa Menu tree): root categories via the `mainCategoryComponent` template slot; title "Browse the menu"; bottom navigation bar with Review Order button, reset-order and accessibility controls; gift-card purchase banner when `giftCardPurchaseSettings` configured; loyalty (Avolta) banner where its screen gate allows; SCO scan banner when `scoModeEnabled`.
- costa (`homeCostaPage`): branded header + welcome selector at root + category levels + QSR nav bar; a top-categories rail scrolls the category list to the tapped category and keeps the active one in sync while scrolling.
- itsu: paged categories (see F-MENU-02-variants in screens).
- bk (`homeBkPage`): BK header titles ("OUR MENU"/"Need a hand?..."), V2 category container with a top-categories side bar showing the selected category state (tapping the selected category does nothing).
- v2 (`homeV2Page`): like default + V2 category container (same top-categories side bar pattern) + age-restricted dialog mounted on the page.
- shakeshack: left rail category navigation + per-category sections; "Tap a category to get started".
- boparan: same as default with own styling.
- sco (`homeSCOPage`): split view — basket/summary on the right, categories+products on the left (SCO mode); a home side bar exposes a numeric keypad for manual barcode entry ("Enter Barcode" placeholder) with its own keypad-error messaging; product cells show an "Add" button plus +/- stepper aria labels.
**Related:** SCR-MENU-01, SCR-MENU-02, UJ-MENU-01, FR-304..FR-312, BR-MENU-01..04

### F-MENU-03 - Item/product cells and display
**Status:** Confirmed
**Description and purpose:** Item cells inside a category show what the guest can order: name, image, price (or "from" price when customisation can add cost), calories, labels/badges and an add affordance.
**What the user can do:** Tap the cell to open the item details (or directly add on layouts with an add button); some cells show a quantity stepper inline (cocoa item options list).
**Actions and interactions:**
- Cell tap: items with no required customisation can add straight to the order; items with options open the customisation flow.
- Cocoa item-option cells support an inline quantity stepper; setting quantity 0 deselects the option.
- Broken/missing images render a generated initial-letter placeholder (cocoa) or nothing (default).
**Expected behaviour and results:**
- Price shown is the minimum total: base price plus the cheapest required selections (excludes `COMBO_MAIN`, whose price is already in the base). For groups with minimum == maximum > 0 (forced combos), the "minimum price" adds the sum of the N cheapest mandatory options; with `DEFAULT_SELECTION_PRICING_MODEL`, default selections are used instead of cheapest.
- `servicePriceOverride` per order type overrides the displayed price for that order type.
- "From" price (`showFromPrice`) indicates the displayed price is a starting price.
- Default-configured items can carry a "Popular" badge (cocoa marks the default option entity).
- Items expose `calories` (shown as "{n} kcal" where rendered), `description`, `shortName` (preferred over `name` where a short label is used), `itemLabels` codes (chips, F-MENU-05), `barcodes` (SCO), `ageRestriction`/`verificationAge` (notice flow), `taxes`.
**Conditions, restrictions and edge cases:**
- Items unavailable for the order type never reach the cell (F-MENU-01). No explicit "sold out" cell rendering found — unavailability is removal, not greying (see coverage unknowns).
- Lazy render batches of 60.
**Variants:** cocoa cell = name + optional image + price (+kcal, quantity stepper, Popular badge); default cell = image + name + separate "+" price button; shakeshack/bk/costa/itsu own cell styles; sco cell adds barcode context.
**Related:** SCR-MENU-03, FR-313..FR-320, BR-MENU-05..07, ENT-MENU-02

### F-MENU-04 - Item details and customisation entry
**Status:** Confirmed
**Description and purpose:** Selecting an item (or a multi-variant "item" that is really a group of child items) opens the product view where the guest picks a variant and/or quantity and starts customisation.
**What the user can do:** Pick a variant from the item options list (multi-child items), change quantity, press Add to Order / Continue, or customise.
**Actions and interactions:**
- Multi-child entity: a default child is pre-selected (`defaultEntity` field else first child); tapping a different child switches selection; quantity stepper per option.
- The main button reads "Add to Order {price}" when the selection needs no customisation, "Continue" when it has option groups, "Add to Order" disabled when nothing selected.
- Auto-advance: when the `ITEM_WITH_OPTIONS` auto-advance rule is enabled, picking an item that has options skips straight into the modifiers screen without pressing Continue.
- Age-restricted items without options fire the "You may need photo ID" confirmation before adding (see A04 for the full gate flow); restricted items with options defer the check to option confirmation.
**Expected behaviour and results:**
- Selecting creates/replaces the order-draft item with default options pre-applied: configured `defaultOption` (skipped when it has required nested modifiers — the guest must tap it) plus per-option `defaultQuantity` > 0 presets.
- Quantity changes rebuild the draft to N copies.
- Add to Order confirms the draft and fires the item-added confirmation (F-MENU-12).
**Conditions, restrictions and edge cases:** Single-child items skip the variant list and show the item + quantity stepper directly.
**Variants:** cocoa as described; default/legacy shows a product panel with +/- stepper and "Add To Order" button; itsu shows a slide-down item overlay; costa a product overlay; shakeshack an item container with Add/Customise buttons.
**Related:** SCR-MENU-04, UJ-MENU-02, FR-321..FR-328, BR-MENU-08..10

### F-MENU-05 - Item labels and tags
**Status:** Confirmed
**Description and purpose:** Two label systems: per-item dashboard `itemLabels` codes rendered as chips on the product view, and operator-configured `customizedItemTags` (badges) attached to items or categories and shown on designated pages.
**What the user can do:** Read badges/chips. Nothing interactive.
**Actions and interactions:** None; tags are passive overlays.
**Expected behaviour and results:**
- `itemLabels` codes render translated chips ("{code}" label via `itemLabel.<code>`, falling back to a built-in English name) inside an accessible "Item labels" section that announces the label names.
- `customizedItemTags` render as badges (`badgeName`, custom text/background colours, defaults red on white when colours empty).
- Tag visibility is page-scoped via `tagsPages` (`ITEM_MENU`, `ITEM_PAGE`, `BASKET`); absent `tagsPages` shows everywhere.
- Schedule gating: `scheduleEnabled` (start/end date) and `advancedScheduleEnabled` (weekly `openingHours` windows) control whether a tag is currently active.
- Each visible tag fires an `item_tag_impression` analytics event with `tag_id`, `tag_name`, `item_id`, `item_name`, `display_location`.
**Conditions, restrictions and edge cases:** Only `enabled` item-tag associations are indexed; category tags render on category cells via the category tag overlay.
**Variants:** cocoa item labels chips on product info; tags overlay is template-agnostic.
**Related:** FR-329..FR-332, ENT-MENU-06

### F-MENU-06 - Allergen and nutritional information
**Status:** Confirmed
**Description and purpose:** Calorie/allergen detail on items and disclaimers shown in the menu.
**What the user can do:** Read item calorie values; on shakeshack open allergen info (QR link or "speak to team" text); read the nutritional disclaimer banner when enabled.
**Actions and interactions:**
- Calorie display: `{n} kcal` on product cells/details and option choices where data exists.
- shakeshack AllergenInfo block: "Need Allergen Info?" + QR-code link or "speak to a team member" text.
- Nutritional disclaimer banner (location feature `KIOSK_NUTRITIONAL_DISCLAIMER`, feature id 173): shows "Nutrition & Allergen Information" + the 2,000-calorie daily-advice text at the bottom of the menu.
- itsu renders allergen text inside product info.
**Expected behaviour and results:** Informational only; does not gate ordering except the age-restriction notice (different feature).
**Conditions, restrictions and edge cases:** Banner only when the restaurant enables the feature.
**Variants:** shakeshack dedicated allergen section + QR; itsu inline allergen text; disclaimer banner any template when flag on.
**Related:** FR-333..FR-335, BR-MENU-11

### F-MENU-07 - Option groups (modifiers, required modifiers, upsells, surcharges)
**Status:** Confirmed
**Description and purpose:** The customisation stepper where the guest satisfies an item's option groups. Each group has a `role`, `minimum`/`maximum` selection counts, an optional `defaultOption`, per-option `maximumQuantity`/`defaultQuantity` and prices.
**What the user can do:** Toggle options on/off (single-select replaces, multi-select accumulates until max), change quantity on options that allow multiples (`maximumQuantity` > 1), open an option's nested groups ("Customise"), go Next/Continue/Back.
**Actions and interactions:**
- Single-select (maximum 1): tapping a different option replaces the previous.
- Multi-select (maximum > 1): options toggle; when the group's maximum is reached, unselected options become unselectable until something is removed; legacy dialog drops the oldest selection instead.
- Per-option quantity: when `maximumQuantity` > 1 the option shows a stepper (0..`maximumQuantity`, also capped by the group maximum).
- Supersede: an option flagged `supersede` deselects/blocks every other option in the group while it is selected; selecting another option while a supersede is active is blocked.
- Nested groups: an option with its own `optionGroups` opens a sub-option screen on select (required nested groups must be completed; in combo context, optional nested groups are edited only from the review screen).
- "Customise" button on a selected option reopens its nested groups.
- Continue button visibility: shown once the group minimum is satisfied; for groups where minimum < maximum or group optional, always shown. When minimum == maximum > 1, the required count of a default option can be auto-filled.
- Auto-advance: `OPTION_GROUP_MAX_SELECTION` rule auto-continues ~200 ms after the maximum is reached.
- Invisible groups: a `Standard` group with `minimum` = 1 and exactly 1 option (and no nested options) is never presented — its single option is applied silently; cocoa also hides `INGREDIENTS`, `INGREDIENT_MODIFIERS` and `COMBO_MAIN` roles from this stepper (they have their own screens).
- Dynamic price display on choices: for forced groups (min == max > 0), each option shows its price minus the group's cheapest-choice baseline; others show their own minimum price.
**Expected behaviour and results:**
- `MODIFIERS` with `minimum`=`maximum`=1 is treated as `REQUIRED-MODIFIER` (a mandatory single choice).
- Roles: `MODIFIERS`, `REQUIRED-MODIFIER` (forced pick), `UPSELLS`, `INGREDIENTS`, `INGREDIENT_MODIFIERS`, `SURCHARGE` (excluded from forced-combo dynamic pricing), `COMBO_MAIN` (combo's main item, edited via its own modal).
- Back saves the current selections and returns to the previous group; if a required sub-group was left empty the triggering option is unselected.
- Final group confirm runs the age check if the combined selection requires it, then confirms the item.
**Conditions, restrictions and edge cases:** Option-level `maximumQuantity` 0/1 means single toggle; group `maximum` 0 means unlimited.
**Variants:** cocoa stepper + choices list (selected options grouped by option with summed quantities; "Customise" button on a selected option reopens nested groups; toggle +/- cells) vs legacy modal dialog (group container + cells with checkbox styling); costa/boparan own option group renderings.
**Related:** SCR-MENU-05/06, FR-336..FR-352, BR-MENU-12..19, ENT-MENU-03/04

### F-MENU-08 - Ingredient add/remove customisation
**Status:** Confirmed
**Description and purpose:** A dedicated cocoa screen for personalising an item's ingredients (`INGREDIENTS` / `INGREDIENT_MODIFIERS` roles) and composite toggle options — "make it your own".
**What the user can do:** Add or remove ingredient options ("Add"/"Added" buttons), toggle composite options (e.g. "No Onion" negative choices), reset everything to defaults, save or cancel.
**Actions and interactions:**
- Header "Customise {item}" / subtitle "Make it your own"; image + item info.
- Ingredients listed per group; tap toggles Add/Added with spoken announcements ("{name} added"/"{name} unselected").
- Composite options (TOGGLE type) present positive/negative choices; the configured `defaultChoice` (POSITIVE/NEGATIVE/NONE) pre-selects; a "Removed" label marks negative picks.
- "Reset" restores default options (disabled until something changed; announces "Default options restored.").
- "Save Changes" commits; "Cancel" or backdrop tap discards.
**Expected behaviour and results:** Edits the draft item's options; tag impressions tracked once per tag per item.
**Conditions, restrictions and edge cases:** Two presentations: standalone ingredients screen (`ItemWithIngredientsCustomization`) and the composite customisation modal (`ItemCustomization`) reached via "Customise".
**Variants:** cocoa only. shakeshack has its own ingredient group editor; costa product overlay allows ingredient edits.
**Related:** SCR-MENU-07, FR-353..FR-357, BR-MENU-20

### F-MENU-09 - Combos (COMBO_MAIN and combo pricing)
**Status:** Confirmed
**Description and purpose:** Combo items contain a `COMBO_MAIN` option group (the selectable main item) plus option groups priced by the combo pricing model.
**What the user can do:** The main item is auto-selected to the menu default; the guest changes it only from the review screen ("Change main") via the "Select main Item" modal; add-ons priced dynamically.
**Actions and interactions:**
- `COMBO_MAIN` group is excluded from the normal stepper and from minimum-price math (its price is inside the base price).
- "Change main" opens a modal listing the main options; Confirm applies, Cancel/backdrop closes.
- Pricing model `MINIMUM_PRICING_MODEL` (default): forced groups (min==max>0) price options as option price minus the cheapest-required baseline — i.e. choosing something dearer than the cheapest shows the difference; `DEFAULT_SELECTION_PRICING_MODEL` prices relative to the configured default option instead, and the review screen can show negative price lines (-{price}) when a pick is cheaper than default.
**Expected behaviour and results:** Review screen lists main item + all selected modifiers with per-line computed prices; quantity applies to the whole combo.
**Conditions, restrictions and edge cases:** `getMainItemsCount` counts COMBO_MAIN options; `isComboMeal` when the group exists.
**Variants:** cocoa only (combo modal + review line pricing).
**Related:** SCR-MENU-08/09, FR-358..FR-362, BR-MENU-21/22, ENT-MENU-05

### F-MENU-10 - Quantity selection
**Status:** Confirmed
**Description and purpose:** Guests order multiples of the same item via steppers.
**What the user can do:** +/- buttons from 1 upward (min 1; no upper cap found in UI), option-level steppers capped by `maximumQuantity`.
**Actions and interactions:**
- Product screen stepper updates the draft to N items; button shows total for N.
- Cross-sell and item-option lists have their own steppers.
- Quantity 0 on a selectable option deselects it.
- Screen-reader announcements on each change ("{n} items" style text with total).
**Expected behaviour and results:** N identical order items (with the same options) are added; the add-to-order price multiplies.
**Conditions, restrictions and edge cases:** Decrement disabled at 1 on product screens.
**Variants:** Same across templates.
**Related:** FR-363..FR-365, BR-MENU-23

### F-MENU-11 - Cross-sell
**Status:** Confirmed
**Description and purpose:** After an item is added, a "Would you like anything else?" screen offers configured companion items before returning to the menu.
**What the user can do:** Tap suggested items to add them (with quantity stepper on cocoa), press "Add to Order" (cocoa, disabled until at least one selected) or "No Thanks"/"Done"/"Turn it up" (shakeshack) to continue.
**Actions and interactions:**
- Triggered after item confirmation when the added item(s) belong to a `crossSellGroup` whose linked entities resolve to menu items — unless cross-sell was disabled for the journey (e.g. after the guest dismisses it or flow rules).
- Items shown carry name, image, price, calories; tapping selects/deselects.
- Age-restricted cross-sell items fire the photo-ID confirmation before adding.
- `view_item_list` analytics fires with `cross_sell_items_list` / "Cross Sell" when presented.
- Cocoa: full screen "Would you like anything else?"; "Add to Order" (disabled state text explains a selection is needed) vs "No Thanks" which removes any selected cross-sell draft items.
- Legacy: option-group-style dialog with "Would you like anything else?" header; Done continues.
**Expected behaviour and results:** Selected cross-sell items are added to the order; the journey returns to the menu (or item-added overlay fires).
**Conditions, restrictions and edge cases:** Only the first matching cross-sell group is presented (code takes group[0]); cross-sell with ingredients triggers the ingredient edit flow when added via `addCrossSellWithIngredients`.
**Variants:** cocoa screen; shakeshack own cross-sell group ("Turn it up"/"Back to menu"); costa CrossSellGroup; legacy default dialog.
**Related:** SCR-MENU-10, FR-366..FR-370, BR-MENU-24/25, ENT-MENU-07

### F-MENU-12 - Item-added confirmation and review
**Status:** Confirmed
**Description and purpose:** A brief confirmation after adding an item, and (cocoa) a review screen to check/edit the item's selections before it lands in the basket.
**What the user can do:** Nothing on the auto-dismissing overlay (tap anywhere dismisses sooner); on the cocoa review screen adjust quantity, change the combo main, customise nested options, then Add to Order / Update Order.
**Actions and interactions:**
- Overlay: check icon + "Added To Order" (default/bk/v2/sco/costa variants) or the cocoa rich overlay showing item name, qty ("{n} items"), price total and kcal; auto-dismisses after `timeout` (500 ms legacy; cocoa default also short, configured per use; gift-card added overlay uses 2,000 ms).
- Cocoa review screen "Review your choices": lists the main option and every selected modifier with computed line prices, "Change main" for combos, "Customise" on options with nested groups, quantity stepper, Add to Order "{total}" (or "Update Order {total}" when editing).
- Before the review commits, quantity changes rebuild the draft at N items.
**Expected behaviour and results:** Order updated; `itemsUpdatedSuccessfully` drives the overlay; adding triggers order-totals recompute (`ITEM_ADDED`) and navigation back to the item's category level.
**Conditions, restrictions and edge cases:** Silent adds (quantity bump, cross-sell) skip the overlay.
**Variants:** cocoa overlay + review screen; costa overlay; shakeshack own overlay; legacy overlay.
**Related:** SCR-MENU-11/12, FR-371..FR-374, UJ-MENU-03

### F-MENU-13 - Back navigation within the menu
**Status:** Confirmed
**Description and purpose:** Back always returns one step: option screen -> product/category, sub-category -> parent, product -> category, category -> root list, and clears any unsaved draft customisation.
**What the user can do:** Tap back buttons in the navigation bars; nav-bar Home/reset returns to the root categories.
**Actions and interactions:** Back pops the breadcrumb one level; root-level back performs the session/reset navigation per area A02/A04 rules.
**Expected behaviour and results:** Parent level re-rendered; unsaved options lost; the entity breadcrumb records visited categories for analytics.
**Variants:** cocoa uses nav-bar back buttons; legacy uses the QSR nav bar.
**Related:** FR-375, BR-MENU-26, UJ-MENU-01

### F-MENU-14 - Product search
**Status:** Partially confirmed
**Description and purpose:** A product-search route exists (`/productSearch`, template value `productsPage`) used primarily by SCO mode where the menu is filtered to barcode items.
**What the user can do:** Search/scan for products (SCO flow; details in A05).
**Actions and interactions:** On SCO home, menu shows items with barcodes; standard QSR kiosks navigate to `/productSearch` via `searchProducts()` but the default template renders `notImplementedDefaultBehaviour` — the screen only exists where a template supplies it.
**Expected behaviour and results:** SCO: categories/items filtered to barcode-bearing entities.
**Variants:** sco only functional.
**Related:** FR-376, see area A05

## A04 BASKET — Order summary, checkout preparation and age verification

### F-BASKET-01 - Basket line display
**Status:** Confirmed
**Description and purpose:** The order summary `/orderSummary` lists every order line so the guest can review what they are buying before paying.
**What the user can do:** Read lines (name, selected options, quantity, price); remove a line; edit a line when the item has configurable options; change quantity (cocoa/costa stepper).
**Actions and interactions:**
- Each line shows item name, formatted price, selected options summary and quantity; identical lines (same item and same options) merge into one displayed row with the combined quantity, sorted by item name.
- Lines expose a Remove affordance and (only when the item has option groups) an Edit affordance that re-opens item customisation.
- Lines carrying an age restriction (`ageRestriction` > 0) show an "18+" badge when the badge feature applies (F-BASKET-09).
- Cocoa splits the basket into "Added items" and "Scanned items" sections; scanned restricted lines that were approved show "Item Authorised".
**Expected behaviour and results:**
- Remove asks for confirmation in every variant that confirms: default/bk/boparan a two-tap "Remove" that turns into a confirm state, itsu a "Remove Item?" dialog ("This will remove the item from your basket", Yes/No), cocoa a remove button; shakeshack removes directly without confirmation.
- Deleting a line triggers a totals recalculation; editing returns through the item flow and updates the line.
- Cocoa and costa lines offer a "+"/"-" quantity stepper.
**Conditions, restrictions and edge cases:** Quantity semantics: quantity may be absent on scanned lines and then counts as 1 everywhere it is aggregated.
**Variants:** default list + two-tap remove; cocoa rich cells (edit/remove buttons, stepper, age badge, scanned sections); costa stepper + editable label; bk/boparan default-style cells; shakeshack "bag" styling (Edit only with option groups, direct remove, ingredient summaries "Extra: {added}" / "Remove: {removed}", empty-bag text); itsu remove-confirm dialog; sco split + authorised state.
**Related:** SCR-BASKET-01, FR-401..FR-408

### F-BASKET-02 - Totals, fees and tax display + updating state
**Status:** Confirmed
**Description and purpose:** A totals block shows subtotal, tax, service charge, itemised fees, discounts, charity donation and total; it recalculates automatically whenever the basket changes.
**What the user can do:** Read the totals; cocoa shows "Updating Your Order / This won't take long" while a checkout-time recalculation runs.
**Actions and interactions:** None interactive; totals recompute on every add/update/delete/discount/tip/charity action.
**Expected behaviour and results:**
- Lines shown when relevant: "Sub Total", "Tax" (when tax-exclusive or configured to display), "Service Charge", individual fee lines, "Discounts", charity line (named after the charity when the fee is the round-up), "Total".
- The default block shows only when the total differs from the subtotal or tax is exclusive; cocoa also shows it when discounts/fees/charity exist or the subtotal changed.
- Cocoa fee handling: fees with `total` 0 or a blank name are hidden; when the visible fees sum covers the service charge the aggregate "Service Charge" line is suppressed; when they do not, both show; a fee named "round up" displays the charity name.
- Totals requests are queued so only one runs at a time; a request never fires with an empty basket (the POS rejects empty item lists) — a basket-empty handler runs instead.
- While a recalculation is in flight stale values are suppressed (loading state); cocoa shows the "Updating Your Order" overlay for the checkout-load recalculation and "PLEASE WAIT" on the pay button.
- The screen-reader announcement covers subtotal, tax, total and each visible fee.
**Conditions, restrictions and edge cases:**
- `orderTotal` fields consumed: `subtotal`, `tax`, `taxInclusive`, `serviceCharge`, `fees[]`, `discountTotal`, `charityAmount`, `donationInfo`, `total`.
- A separate payment-totals object (`orderTotal`, `remaining`, `totalPaid`, `cashRoundingDiscount`) belongs to the payment screens (A08).
**Variants:** cocoa itemised fees + updating overlay + charity block; default aggregate block; sco running total only.
**Related:** SCR-BASKET-01, FR-409..FR-416, ENT-BASKET-02, OP-BASKET-01

### F-BASKET-03 - Empty basket and go-to-pay rules
**Status:** Confirmed
**Description and purpose:** The pay action is gated: empty baskets and blocked orders cannot start payment; several guard screens fire first.
**What the user can do:** Press "Confirm & Pay"/checkout when enabled; read the disabled/empty messaging otherwise.
**Actions and interactions:**
- Cocoa pay button shows "Your order" + "Confirm & Pay"; disabled when the basket is empty ("Your order, is disabled. Please add some item on your basket before continuing."), when it is unavailable ("Confirm & Pay, is disabled") or while totals load ("PLEASE WAIT").
- Empty basket shows "Your basket is empty" (cocoa) / bag-empty text (shakeshack).
- Go-to-pay order (first matching gate wins):
  1. Charity donation prompt (A08) — payment defers until answered.
  2. BRL transaction limit: when menu currency is BRL and the order total exceeds 1,000,000 minor units (R$ 10,000.00 — exactly the limit is allowed), a blocking modal "Order total is too high" / "This order exceeds the maximum payment amount. Please remove some items or contact a member of staff." shows; payment never starts.
  3. Basket item-line limit: when the POS rejected the order for too many item lines, a blocking modal "Too many items in your order" / "You have reached the maximum number of items allowed for a single order. Please remove some items before continuing." shows.
  4. Scan-and-Go browse-menu modal (SCO + cocoa, once per flow): asks whether to browse the menu before checkout; checked before the age gate.
  5. Age-verification gate (F-BASKET-04).
- Only then does payment routing continue (A08).
**Expected behaviour and results:** Blocked journeys show an explanatory modal and stop; allowed journeys proceed.
**Conditions, restrictions and edge cases:** The item-line limit flag is cleared when a totals recalculation succeeds; it can also be set when order submission is rejected for the same reason (the payment error path keeps the limit state rather than the generic payment error). BRL limit applies only to BRL menus.
**Variants:** Same gates; button/empty texts differ per template.
**Related:** SCR-BASKET-01, FR-417..FR-422, BR-BASKET-06..10, OP-BASKET-01

### F-BASKET-04 - Clear/reset order with confirmation
**Status:** Confirmed
**Description and purpose:** A reset control cancels the whole order — after a confirmation — returning the guest to the start.
**What the user can do:** Press the reset control, choose "Cancel order" or "Go back".
**Actions and interactions:**
- Cocoa reset shows a confirmation: title "Cancel Order?", a confirmation message, buttons "Go back" (dismiss) and "Cancel order" (reset).
- Confirming cancels the journey (recorded as cancelled by the cancel-order button), clears order/session state and returns to `/welcome` (A01 session reset); the control's aria-label is "Back to Welcome screen".
**Expected behaviour and results:** Whole order discarded; kiosk returns to the start screen.
**Conditions, restrictions and edge cases:** "Go back" dismisses without clearing.
**Variants:** cocoa confirmation dialog; other templates reset via the navigation bar.
**Related:** SCR-BASKET-02, FR-423..FR-425, A01 F-KIOSK-04

### F-BASKET-05 - Age-verification gate
**Status:** Confirmed
**Description and purpose:** When the gate applies, checkout pauses on an "Age Verification" screen listing the restricted items and offering "Staff approval".
**What the user can do:** Review the restricted items, remove them, press "Staff approval" (opens staff PIN entry) or go Back.
**Actions and interactions:**
- Gate applies only when ALL of: Scan-and-Go mode is on (`scoModeEnabled`), the active brand explicitly opted in (`ageRestrictedApprovalAvailable` is `true` — the flag is tri-state and `undefined`/`null`/`false` all keep the gate off), the order contains age-restricted items, and at least one restricted item was scanned (not added through Browse Menu). Restricted items added only via Browse Menu keep the "Have your ID ready" journey without the gate; once the gate applies it covers every restricted basket item regardless of origin.
- When the flag is explicitly `false` (no one at the venue can approve), restricted items never reach the basket at scan time (A05).
- Title "Age Verification"; explanation "Some items in your order require age verification. A team member will check your ID."
- Restricted items render grouped: identical lines (same item, same unit price, same options) merge into one row showing the combined unit count (three scans of the same item show as one row of 3); each row shows the item image (initials placeholder on failure), name, "18+" badge and a metadata line (category name, unit price, "{n} kcal", and "Qty {n}" only when the row stands for more than one).
- "Remove" per row drops every line behind the row and recalculates totals while keeping the order nonce — a PIN already verified for this order survives (analytics `remove_restricted_item`).
- "Staff approval" opens the PIN screen (analytics `open_pin_entry`).
- Back counts as the sale not being approved: a `guest_left` outcome is reported and the guest returns to the order summary.
**Expected behaviour and results:** Restricted sales pause here until staff act or the items are removed.
**Variants:** cocoa only.
**Related:** SCR-BASKET-03, UJ-BASKET-03/04, FR-426..FR-430, ENT-BASKET-04

### F-BASKET-06 - Staff PIN entry
**Status:** Confirmed
**Description and purpose:** Staff identify themselves with a 4-digit PIN before the Challenge-25 approval.
**What the user can do (staff):** Type digits on the on-screen keypad, delete with the delete key, confirm explicitly, or go Back to the gate.
**Actions and interactions:**
- Screen: staff bar "Staff Verification", title "Enter your staff PIN", a 4-dot indicator and a keypad of digits 0–9 plus a delete key (no confirm key on the keypad).
- Verification is requested only by the explicit confirm action, never on the fourth digit — a wrong PIN costs one of 5 attempts, so staff see the four dots filled before spending one.
- Submitting posts the PIN to the verification endpoint with the location id and order nonce (`POST /users/auth/restricted-item-approval/pin/verify`).
- Outcomes:
  - Valid → the staff approval screen opens; the attempt counter resets.
  - Invalid → the PIN clears and "PIN not recognised. Try again." shows (one attempt consumed; the kiosk allows 5 incorrect PIN attempts per order — the backend is expected to lock at the same count).
  - Locked (or a lock transition in the response) → the flow locks for this order: title changes to "Team approval unavailable" and "Please complete your purchase at the till." shows; the keypad is hidden (analytics `age_verification_locked` with venue, kiosk, order id).
  - Endpoint not supported (404) → "Team approval unavailable" + "Team approval is currently unavailable. Please complete your purchase at the till." (the venue's backend cannot approve).
  - Other failures (network/malformed/server) → the flow returns to inactive and the page shows the same service-unavailable message.
- The page leaves itself to the order summary when the gate no longer applies and the flow is neither locked nor unavailable; a verified PIN goes straight to the staff approval screen.
**Expected behaviour and results:** A correct PIN proceeds; wrong PINs burn attempts and eventually lock.
**Conditions, restrictions and edge cases:** Attempt limit 5 matches the backend `RestrictedItemApprovalAttemptService.MAX_FAILED_ATTEMPTS`; entering the PIN is blocked while a verification is in flight.
**Variants:** cocoa only.
**Related:** SCR-BASKET-04, FR-427..FR-430, OP-BASKET-03

### F-BASKET-07 - Challenge-25 approval
**Status:** Confirmed
**Description and purpose:** After a verified PIN, staff see the restricted items and confirm the customer's age before approving or declining.
**What the user can do (staff):** Tick the confirmation, then Approve; or Decline; or Back.
**Actions and interactions:**
- Screen: staff bar "Age Verification", title "Approve items", subtitle "Check the customer's ID before confirming.", "{n} item(s) require approval" and the same grouped item rows as the gate (image, name, "18+" badge, metadata).
- A mandatory checkbox: "I confirm I have applied Challenge 25 and the customer is {N} or over" where N is the highest required age among the restricted items (an item restricted to 21+ drives the text, even though the badge always reads 18+).
- Approve is enabled only after the confirmation is ticked; while approval is busy all actions are inert.
- Approve marks the restricted items approved for this order (records the approved age = highest required age and the approved unit count), posts an "approved" outcome (`POST /users/auth/restricted-item-approval/approve`, `{outcome:"approved", restrictedItemCount}`), fires an age-verification approved analytics event (venue, kiosk) and reports the component status to status terminals.
- Decline removes every age-restricted line from the basket, posts a declined outcome `{outcome:"declined", reason:"staff_declined", restrictedItemCount}`, fires an age-verification not-approved analytics event (venue, kiosk) and shows the declined screen.
- Back consumes the pending verification and returns to a safe destination (the gate when it still applies, otherwise the order summary).
**Expected behaviour and results:** Approved → approved toast then payment resumes; declined → declined screen.
**Conditions, restrictions and edge cases:** Before either decision the pending context is re-validated (same order nonce, same location, same restricted-basket fingerprint); a stale context is discarded and the flow navigates away.
**Variants:** cocoa only.
**Related:** SCR-BASKET-05, FR-431..FR-435, UJ-BASKET-03/04, OP-BASKET-02

### F-BASKET-08 - Approval retention and discarding
**Status:** Confirmed
**Description and purpose:** An approval is bound to the order it was granted on — kept across recalculations, thrown away when the basket it approved changes.
**What the user can do:** Nothing directly; the system keeps or drops the approval.
**Actions and interactions:** None.
**Expected behaviour and results:**
- The approval context records order nonce, location and a fingerprint of the restricted basket (each restricted line's identity, quantity and required age).
- A new order nonce resets the whole verification state; an approval from a previous order never carries over.
- While a challenge is pending, a basket update that diverges from the fingerprint (restricted items added, removed or quantity-changed) or a location change discards the context.
- Continuing to payment re-validates nonce + location + fingerprint + the recorded approved age; a stale approval is discarded and the safe destination applies.
- Totals recalculations and item removals that do not change the restricted fingerprint (e.g. removing an unrestricted item) keep the approval.
**Variants:** cocoa only.
**Related:** FR-431..FR-435

### F-BASKET-09 - Age badge, approved toast and declined screen
**Status:** Confirmed
**Description and purpose:** The visual markers around the restricted flow: an "18+" badge on basket lines, an "Approved" toast after approval, and the declined screen.
**What the user can do:** Read them; staff can tap "Return kiosk to guest" on the declined screen.
**Actions and interactions:**
- Badge: lines show "18+" whenever the badge feature applies — Scan-and-Go mode on AND `ageRestrictedApprovalAvailable` `true`. The badge ALWAYS reads "18+" regardless of the item's actual restriction age (a 21+ item still shows "18+"); the same suffix is appended to the line's accessibility label.
- Approved toast: "{n} items" + "Approved" + "Age verified by staff" with the first item's image (or a barcode icon) and the badge; auto-closes after 2,000 ms, does not pause on hover/focus-loss; when it closes the payment journey resumes exactly once.
- Declined screen (only rendered when a decline actually happened): staff bar "Verification Declined", title "Items not approved", a message with the removed count (single/plural), and "Return kiosk to guest" which clears the decline and returns the guest to the basket without the items.
- A "You may need photo ID" notice also exists at item-add time — documented in A03, separate from this flow.
**Expected behaviour and results:** Staff and guest get unambiguous visual confirmation.
**Variants:** cocoa only.
**Related:** SCR-BASKET-05/06, FR-434..FR-436

### F-BASKET-10 - CPF/CNPJ tax-id capture (Brazilian receipts)
**Status:** Confirmed
**Description and purpose:** When the CPF/CNPJ feature is enabled, the order summary shows an optional row "CPF/CNPJ on receipt? (optional)" letting the guest enter or edit a CPF (11 digits) or CNPJ (14 digits).
**What the user can do:** Tap the row to open the "Enter CPF/CNPJ" modal; type a number; confirm or cancel.
**Actions and interactions:**
- The modal accepts alphanumeric input with a progressive mask: CPF `000.000.000-00` up to 11 digits; beyond that the CNPJ mask `00.000.000/0000-00` applies.
- Validation on confirm: CPF = 11 digits + check digits; CNPJ = 14 digits + check digits; invalid shows an inline error; empty clears the stored value.
- A confirmed value is stored on the invoice and displayed masked in the row; reopening pre-fills it.
- Analytics events fire for the action and are sanitised — the number itself is never logged.
**Expected behaviour and results:** The tax id rides on the order's invoice for the receipt (invoice internals in A08).
**Conditions, restrictions and edge cases:** Optional; only when the `cpfCnpj` feature is enabled.
**Variants:** cocoa only.
**Related:** SCR-BASKET-07, FR-437..FR-441, OP-BASKET-04

### F-BASKET-11 - Basket extras rows (coupons, rewards, discounts, tip, charity, gift cards)
**Status:** Confirmed (behaviour owned by A07/A08/A09 — the summary rows are documented here)
**Description and purpose:** The summary also renders applied coupons, rewards, restaurant discounts, senior discounts, tip, charity and gift-card purchase rows.
**What the user can do:** Remove an applied extra where allowed; open the discounts modal; donate to charity; buy a gift card.
**Actions and interactions:**
- Coupon row: remove confirmation "Remove Coupon?" / "Are you sure you want to remove your coupon from your basket?"; note "Only one coupon can be applied to an order".
- Reward row: same pattern — "Remove Reward?", "Only one reward can be applied to an order".
- Restaurant-discount row: "If you have a {name} you can apply it here." + "Add discount"; applied → "Discount code added" + "Remove current discount to add a different one."; remove confirmation "Remove discount?".
- Discounts modal ("See discounts"): "Your Discounts" / "View and manage your discounts", guest points "Balance: {n}", "Discount limit reached" + "To apply a different discount you must remove one from your order." when a second discount is not allowed, "Discount total", "Add Discount", "Close".
- Tip row: "Tip" + "Edit" (re-opens the tip step).
- Charity row: charity name/"Charity Donate" + amount choices + "Donate"; the inline donation block shows before checkout when Pennies data is available.
- Gift cards: a banner "Gift cards now available" / "Perfect for any occasion" / "Buy Now" (opens the purchase flow in A09); purchased gift cards list as "{amount} Gift Card" rows with Edit/Remove and "Remove Gift Card?" confirmation.
- A "Checking for vouchers" line shows while discount checks run.
- Scan-coupon button shows when coupon features are enabled and no coupon is applied.
**Expected behaviour and results:** Extras adjust totals like items; each mutation triggers a totals recalculation.
**Conditions, restrictions and edge cases:** Feature-gated by `punchhEnabled`/`couponEnabled`/`discountPosProviderEnabled`, charity config, tip config and `giftCardPurchaseSettings`.
**Variants:** cocoa renders the full extras tree; default renders discount rows + scan button + discount overlay.
**Related:** SCR-BASKET-01, FR-442..FR-446, A06/A07/A08/A09 for the underlying behaviours

### F-BASKET-12 - Add-time age-restriction notice (second pass)
**Status:** Confirmed
**Description and purpose:** A confirmation shown when a restricted item is added outside the approval gate.
**Actions and interactions:** "This is an age restricted item, so we may need to check your ID when you receive your order." appears on the add-time confirmation.
**Related:** F-BASKET-05

## A05 SCAN — Scan routing, Scan-and-Go and scan feedback surfaces

### F-SCAN-01 - Universal barcode routing
**Status:** Confirmed
**Description and purpose:** Every scanned barcode (HID-keyboard or serial scanner) runs through one routing logic that routes it by the current screen, so the same scan does different things depending on where the guest is.
**What the user can do:** Scan a barcode/QR anywhere the scanner is enabled.
**Actions and interactions:**
- A scan is ignored while another scan is still being processed.
- Routing order (first match wins):
  1. Gift-card screens (`ScanGiftCardPage`, `ScanGiftcardPurchasePage`) -> gift-card number scan (A09).
  2. App-payment screen (`AppPaymentPage`) -> submits the code as payment (A08).
  3. `/orderType` with Avolta enabled -> loyalty sign-in: a DQR membership card (`{prefix}{FirstName}|{LastName}<DQR ...`) goes to the scanned-code sign-in; any other QR goes to the scanned-phone sign-in (A06).
  4. SCO + `/home` or `/scanAndGo` -> tries to match the barcode to a menu item first (F-SCAN-02); if no item matches it falls through to loyalty/coupon.
  5. Loyalty screens (`LoyaltyLoggingPage`, `/orderType`) -> loyalty sign-in (skipped when already signed in; a DQR card on Avolta uses code sign-in; anything else goes to the generic code sign-in, A06).
  6. Coupon-allowed screens (`/home`, `/orderSummary`, `ScanCoupon`, `ProductSearch`, `EnterCouponManually`) -> coupon apply (A07).
  7. Any other screen -> the scan is ignored entirely.
- On coupon screens, when the Avolta sign-in/QR-scan discount state is active, a scan goes to the Avolta code sign-in instead of coupon apply.
**Expected behaviour and results:** Each scan lands on exactly one handler per the routing table; scans on unrelated screens are dropped.
**What a scan does on each screen:**

| Screen | Scan type recognised | Result | Owning area |
|:--|:--|:--|:--|
| `ScanGiftCardPage` / `ScanGiftcardPurchasePage` | Gift card number | Gift-card flow | A09 |
| `AppPaymentPage` | Payment code | Submits payment | A08 |
| `/orderType` (Avolta) | DQR membership card | Scanned-code loyalty sign-in | A06 |
| `/orderType` (Avolta) | Other QR | Scanned-phone loyalty sign-in | A06 |
| `/home` / `/scanAndGo` (SCO) | Menu barcode | Adds scanned item | A03/A04 |
| `/home` / `/scanAndGo` (SCO) | Non-menu barcode | Falls through to loyalty/coupon | A06/A07 |
| `LoyaltyLoggingPage` | Loyalty code / DQR | Loyalty sign-in | A06 |
| `/home`, `/orderSummary`, `ScanCoupon`, `ProductSearch`, `EnterCouponManually` | Coupon | Coupon apply | A07 |
| Any other screen | Any | Dropped | — |

**Variants:** Same across templates.
**Related:** SCR-SCAN-01, FR-501..FR-508, OP-SCAN-03

### F-SCAN-02 - Scan-and-Go item scan
**Status:** Confirmed
**Description and purpose:** In Scan-and-Go mode a scanned barcode is matched against menu items and added to the basket — the core SCO flow.
**What the user can do:** Scan an item's barcode anywhere SCO is active (`/home`, `/scanAndGo`).
**Actions and interactions:**
- The barcode is looked up in the ORIGINAL menu (not the filtered one) so barcode-only items are still found.
- No match -> the "not found" state is set (F-SCAN-04) and the scan is NOT consumed, so it falls through to loyalty/coupon routing.
- Match + restricted item + venue has no approver (`ageRestrictedApprovalAvailable` `false`) -> the item is refused: an `age_verification_item_blocked` analytics event fires and the restricted-refusal message shows (F-SCAN-05); no order item is created.
- Match + otherwise -> an order item is created (empty entity path, built straight from the entity), tagged as scan-originated (`committedScannedItemGuids`), added to the basket and the "item added" overlay shows; any earlier not-found/refusal is cleared.
- On `/scanAndGo` the item also lands in the scanned-items buffer and the scanned-items modal opens.
- Rapid/duplicate scans: only the processing guard throttles them — two scans of the same barcode add two separate lines (they merge visually in the basket grouping but remain distinct lines).
- Scanned lines can be removed one-by-one or in groups (the age-verification gate removes whole merged groups at once so totals recalculate once).
**Expected behaviour and results:** Items land in the basket marked as scanned so the "Added items" vs "Scanned items" split and the scanned-items modal stay consistent.
**Variants:** cocoa only (the refusal surfaces are cocoa-only; the SCO-legacy template does not consume scans).
**Related:** FR-509..FR-514, UJ-SCAN-01, OP-SCAN-01, A04 for basket/age rules

### F-SCAN-03 - Scan-and-Go screen and scanned-items modal
**Status:** Confirmed
**Description and purpose:** The SCO home screen plus the modal that lists everything scanned.
**What the user can do:** Scan items; open the scanned-items modal; remove scanned items; browse the menu; go to the basket.
**Actions and interactions:**
- `/scanAndGo` shows a scanning banner "Use scanner for faster checkout" + a self-checkout carousel behind it, and a "Browse Menu" entry; the default content shows a title + subtitle ("Start scanning your items" style from `scanAndGo.defaultContent*`).
- The scanned-items modal lists scanned items (title "Scanned Items" / subtitle "View and manage scanned items") with per-row image (initials placeholder on failure), name, "18+" badge when the badge feature applies, price and a "Remove" button (aria "Remove {name} from order"); a subtotal plus "Browse Menu" link and "Your Order" button at the bottom.
- When the last scanned item is removed the modal closes itself.
- Scans made on the page open the modal automatically; leaving the page and coming back re-opens it so scanned items never look forgotten.
- Inside the modal the not-found and restricted banners render in place of the page banners (only one surface shows at a time).
- Items committed to the basket keep showing in the modal (committed scanned items are re-read from the basket so removals made elsewhere stay consistent).
- While the modal is open, tapping the scanning banner must NOT re-open it.
**Expected behaviour and results:** A persistent record of what was scanned, mirrored with the basket.
**Variants:** cocoa only.
**Related:** SCR-SCAN-02..04, FR-515..FR-520

### F-SCAN-04 - Scan not-found feedback
**Status:** Confirmed
**Description and purpose:** A banner tells the guest when a scanned barcode matched nothing.
**What the user can do:** Read it; wait for it to dismiss; scan again.
**Actions and interactions:**
- The banner shows on the Scan-and-Go page and inside the scanned-items modal (only one surface at a time).
- It auto-dismisses after 10,000 ms, clearing the not-found state; a subsequent successful scan clears it earlier.
- Copy: `scanAndGo.notFoundTitle` + `scanAndGo.notFoundSubtitle` ("The barcode could not be recognised. Please try again or ask for help." style).
- A repeated failed scan while the banner shows simply keeps the banner (the timer restarts via the state refresh).
- On the legacy SCO template an unrecognised barcode shows a modal notification "Unrecognised Barcode" / "The system could not identify your barcode. Please try again or ask for help." / "Ok" instead.
**Expected behaviour and results:** A failed scan is visible but never stays on screen.
**Variants:** cocoa banner vs legacy modal notification.
**Related:** SCR-SCAN-05, FR-521..FR-524

### F-SCAN-05 - Age-restricted scan refusal
**Status:** Confirmed
**Description and purpose:** When the venue cannot approve restricted sales, a restricted scan is refused at scan time.
**What the user can do:** Read the refusal; buy the item at the till instead.
**Actions and interactions:**
- Refusal fires only for a scanned restricted item when `ageRestrictedApprovalAvailable` is `false` (tri-state — `undefined`/`null` keep the normal add path).
- Copy (shared between the inline banner and the toast overlay): "Item cannot be purchased here" / "This item is age-restricted and cannot be sold at the kiosk. Please purchase it at the till."
- Surfaces: an inline banner on the Scan-and-Go page/modal AND a toast on the menu — both auto-dismiss after 7,000 ms (longer than the usual 2 s toast because it carries an instruction).
- An `age_verification_item_blocked` analytics event fires (venue, kiosk, item id); a successful later scan clears the refusal.
- When the flag is `true` the item adds normally and the age-verification gate runs at checkout (A04); when `undefined`/`null` it also adds normally.
**Expected behaviour and results:** Restricted items never reach the basket at venues without an approver.
**Variants:** cocoa only.
**Related:** SCR-SCAN-06/07, FR-525..FR-528, A04 F-BASKET-05

### F-SCAN-06 - Scanner hardware paths and status
**Status:** Confirmed
**Description and purpose:** Two scanner paths feed the same routing logic; a background checker keeps availability current.
**What the user can do:** Nothing directly; scans work or are refused.
**Actions and interactions:**
- HID-keyboard scanner: key events are buffered in the Electron main process and flushed as one barcode over IPC.
  - Valid scan = printable characters typed within 80 ms of each other, at least 4 characters, completed by the terminator key (Enter) OR an auto-complete timer of 160 ms (2x the inter-char threshold) for scanners that send no terminator.
  - A gap over 80 ms mid-scan restarts the buffer; non-printable keys are ignored; keyUp and auto-repeat are ignored; a buffer under 4 characters is discarded.
  - Dead-key / keyboard-layout handling: physical key codes are mapped so layouts with dead keys still decode.
  - The listener enables only when `hidKeyboardScannerEnabled`; it marks the scanner available on enable and unavailable on disable;
- Serial scanner (Avolta): a polling listener forwards completed scans to the same routing logic (source = `SerialScan`); it listens only when `avoltaEnabled` + `scannerEnabled` + NOT `hidKeyboardScannerEnabled`; 3 consecutive failed poll requests mark the scanner unavailable, while a timeout (`ECONNABORTED`) does NOT count toward that.
- Scanner availability is re-checked on every navigation to `/welcome` or `/orderSummary` when `scannerEnabled` (skipped in maintenance and when the HID keyboard scanner itself is enabled); a timeout keeps the last status, other failures mark it unavailable.
- While a scan is being processed, idle checking is suppressed (A01) and further scans are dropped.
- The scanner component status is reported to status terminals (`SCANNER` monitored component).
**Expected behaviour and results:** Both paths land in the same per-screen routing; status stays current.
**Variants:** None.
**Related:** FR-529..FR-534, A01 FR-129/131

## A06 LOYALTY — Providers, sign-in, sign-out, order history

### F-LOYAL-01 - Loyalty providers and sign-in methods
**Status:** Confirmed
**Description and purpose:** Several loyalty providers plug into the same sign-in flow; the active provider and allowed methods come from the brand config.
**What the user can do:** Sign in before ordering so discounts/points attach to the order.
**Actions and interactions:**
- Providers (one active per venue brand): Punchh (`punchhEnabled`), Avolta (`avoltaEnabled`), Accesso (`isLoyaltyAccesso`, "annual pass"), NST Yoyo (`isLoyaltyNstYoyo`), Pepper, LoyaltyV2 — gated by `isLoyaltyEnabled` + the brand flag.
- Sign-in methods (per-provider config `supportedSigninMethods` {phone, email, userId} + scanner support):
  - **Barcode/QR scan** on the loyalty screen (`LoyaltyLoggingPage`), `/orderType` (Avolta pre-basket), and serial/HID scanners.
  - **Manual entry**: phone (with country dial code — Avolta), email or userId via the multi-method modal when more than one method is configured; a single-method provider skips the method picker.
  - **Scanned code / scanned phone** (Avolta DQR membership card vs plain phone QR).
  - **Face-ID (PopID)** when enabled — "Users, order here" button.
  - **Checkout-screen sign-in** at payment time.
- The multi-method screen title is "Link your loyalty account"; when exactly one manual method exists the picker is skipped.
**Expected behaviour and results:** A successful sign-in attaches the guest to the order (rewards/discounts become available, points accrue); the guest continues to the menu.
**Provider banner copy (cocoa):**
- Punchh/generic: "Scan your app below" (scanner) / tap-when-no-scanner; logged-in "You are logged in" / "Loyalty points will be added to your account".
- Accesso (annual pass): logged-out scanner "Scan your annual pass here" / no-scanner "Press here to enter annual pass manually" + subtitle "Scanner not in use, please sign in manually"; logged-in "Annual pass has been validated".
- NST Yoyo: logged-out "Scan your loyalty code here" + "Hold your loyalty code up to the scanner" / no-scanner "Loyalty scanning is currently unavailable"; logged-in "Your loyalty code has been scanned".
- LoyaltyV2: logged-out "Scan your QR code from loyalty app"; logged-in "More rewards available" or "Rewards program active" or "No rewards available", plus a "Your Balance:" points line and a "View and manage discounts" description that opens a popup "Add New Discount" / "Select your preferred loyalty method" offering "Redeem Code" ("Apply a discount code or senior ID"), "Log In" ("Scan or enter your code") and "Select Discounts"; redeem-code screen "Redeem your discounts" / "Enter code to add your discount or scan your ID for Senior Discount" + Apply.
- Pepper: same pattern as LoyaltyV2 ("Scan your QR code from loyalty app", "Your Balance:", "See and redeem discounts", "Enter a discount code" button).
- Avolta: see F-LOYAL-02.
**Variants:** Provider screens where a provider defines its own (Avolta full flow); otherwise the generic multi-method flow; legacy = scan-only banner + separate manual modal.
**Related:** SCR-LOYAL-01..06, FR-601..FR-612, ENT-LOYAL-01

### F-LOYAL-02 - Avolta (Club Avolta) full flow
**Status:** Confirmed
**Description and purpose:** The Club Avolta integration: QR sign-in, phone sign-in and account creation, all before or during ordering.
**What the user can do:** Sign in with a membership QR, enter a phone number, or create an account.
**Actions and interactions:**
- Screens: Signin ("No QR code?" / "Enter your mobile phone number below." / "Already a member? Open your Club Avolta app or wallet and hold your QR code in front of the scanner." / placeholder "Enter your phone number..." / "Continue" — enabled only for a valid phone in the chosen country); QRScan ("Scan your QR Code" / "Hold your QR code in front of the scanner to sign in and enjoy your member benefits"); Signup ("Create Your Avolta Account" / "Select your country of residence" / phone entry / Continue); Terms & Conditions (loading skeleton while fetched; accept required); CreatingAccount ("Almost There!" / "You're just a step away from enjoying your rewards!" / "We are setting up your account..."); Success.
- Phone handling: manual entry with a country dial-code picker; the number is validated per selected country and normalised for the signin/signup payload; the last entered number pre-fills the field.
- Scanned QR routing (A05): a DQR membership card (`{prefix}{FirstName}|{LastName}<DQR ...`) goes to scanned-code sign-in; a plain phone QR goes to scanned-phone sign-in (`POST /loyalty/signin` with `{phone}`).
- Pre-basket sign-in: when the guest signs in before any item exists, a fresh order is created so the sign-in can attach (Avolta-only — other providers require an order).
- Signup failure on an already-registered phone: `USER_ALREADY_EXISTS` (or HTTP 409) routes to the account-exists dialog (F-LOYAL-07).
- Banner: logged out "Great taste. Extra Perks. Save 5% on this order."; logged in "{tier} member" + "Journey on. Your next flavour awaits. Worldwide."
**Expected behaviour and results:** Sign-in attaches the member; sign-up creates the account then signs in.
**Variants:** cocoa only.
**Related:** SCR-LOYAL-03/04, FR-613..FR-620, OP-LOYAL-01/02

### F-LOYAL-03 - Generic multi-method sign-in (phone, email, userId)
**Status:** Confirmed
**Description and purpose:** Providers without their own screens use the shared multi-method flow.
**What the user can do:** Pick a method (where >1 configured) and enter the identifier.
**Actions and interactions:**
- Picker "Link your loyalty account" lists the configured methods; a single-method provider goes straight to entry.
- Entry screens prompt per method (phone / email / userId) and submit to the loyalty sign-in request.
- Scan is also accepted on the same screens when the scanner is supported.
- While a sign-in is in flight the Cancel control is disabled ("Cancel is disabled. Signin is in progress.") and the "Validating..." / "Logging in..." spinner shows ("This won't take long").
**Expected behaviour and results:** Sign-in resolves to a user or an error dialog.
**Variants:** cocoa multi-method vs legacy scan-only + manual modal.
**Related:** SCR-LOYAL-01/02, FR-601..FR-612

### F-LOYAL-04 - Face-ID (PopID) sign-in
**Status:** Confirmed
**Description and purpose:** Biometric sign-in where a PopID camera is fitted.
**What the user can do:** Tap "Users, order here" (aria "POPID Users, order here") to start the face scan.
**Actions and interactions:** Button shown on the loyalty screen when Face-ID sign-in is enabled; routes to the Face-ID flow; failure shows the Face-ID error dialog ("auth.faceid.error.title" + Try Again / continue-as-guest).
**Expected behaviour and results:** A recognised face signs the guest in.
**Variants:** cocoa only.
**Related:** SCR-LOYAL-05, FR-621..FR-623, OP-LOYAL-03

### F-LOYAL-05 - Logged-in surfaces and sign-out
**Status:** Confirmed
**Description and purpose:** Banners/overlays announce the active loyalty session; the guest can sign out.
**What the user can do:** Read the logged-in state; remove the member where offered.
**Actions and interactions:**
- Logged-in banner: "You are logged in" / "Loyalty programme is active on this order" (Punchh subtitle "Loyalty points will be added to your account"; Avolta "{tier} member").
- Login banner (logged out): scanner present "Scan your app below" / tap-when-no-scanner variants; Accesso "Scan your annual pass here" / "Press here to enter your annual pass manually".
- Success overlay "Logged In Successfully" flashes then dismisses.
- Sign-out removes the member (behaviour behind the discount screens — A07).
**Expected behaviour and results:** The guest always sees whether loyalty is attached.
**Variants:** Provider-specific banner copy.
**Related:** FR-624..FR-627

### F-LOYAL-06 - Sign-up and terms
**Status:** Confirmed
**Description and purpose:** Account creation where the provider supports it (Avolta).
**What the user can do:** Enter details, accept terms, create the account.
**Actions and interactions:** Terms are fetched (skeleton while loading) and must be accepted; a fetch failure shows "Failed to load Terms & Conditions" / "Sorry, an error occurred retrieving the terms and conditions." (Try Again/Cancel); signup failure shows "Register Error" / "Sorry, we could not create the account. Try again or download the app to register" (Try Again/Close, "More details" expandable); an already-registered phone routes to the account-exists dialog.
**Expected behaviour and results:** A new account signs the guest in.
**Variants:** cocoa Avolta only.
**Related:** SCR-LOYAL-04, FR-628..FR-631

### F-LOYAL-07 - Sign-in/sign-up error dialogs
**Status:** Confirmed
**Description and purpose:** Every loyalty failure lands on a dedicated dialog with provider-appropriate copy and a recoverable action.
**What the user can do:** Retry, switch to manual entry, expand error details, or close.
**Actions and interactions:**
- Sign-in error (title "Sign In Error", close "Close"): manual entry -> "Sorry, we could not sign you in. Please try again or ask our staff for help."; barcode -> "Sorry, we could not recognize the code. Try again or log in with phone number" with "Log In Manually" button (or "Try Again"); a "More details" section expands Error Description / Error Code / Location ID / Timestamp.
- Phone-account dialog: existing account -> "Register Error" + "An account already exists with this phone number. Please sign in to continue."; unknown account -> "Sign In Error" + "We couldn't find an account with this phone number. Please sign up to join Club Avolta."; button "OK".
- Sign-up failure: "Register Error" + "Sorry, we could not create the account. Try again or download the app to register" (Try Again/Close + more-details).
- Terms fetch failure: "Failed to load Terms & Conditions" (Try Again/Cancel).
- Face-ID failure: title + Try Again / continue-as-guest.
- Scanner guard: a sign-in attempted while a scan is being processed is dropped.
- A sign-in attempted with loyalty disabled or an empty code fails with "QR code type not supported for this location"; signing in when a reward is already applied fails with "Code already added".
- Every failure fires a loyalty sign-in analytics event (type, entry method, screen, success, message) (type, entry method, screen, success=false, message).
**Expected behaviour and results:** Failures are recoverable without losing the order.
**Variants:** cocoa dialogs; legacy scan errors reuse the generic scan-error surfaces.
**Related:** SCR-LOYAL-06, FR-632..FR-640

### F-LOYAL-08 - Order history and reorder
**Status:** Confirmed
**Description and purpose:** Signed-in guests can browse past orders and reorder one.
**What the user can do:** Open order history, pick an order, reorder it.
**Actions and interactions:**
- Page "Browse past orders" / "Select orders to make your ordering faster"; loading and empty states; error state "Past Orders Unavailable" / "Unable to load order history at this time."
- Each order row offers Reorder; while reordering a "Loading your order, please wait" announcement shows; failure shows the reorder dialog (Try Again / Close; analytics `reorder_error_try_again_button` / `reorder_error_close_button`).
**Expected behaviour and results:** A reordered basket is built from the past order.
**Variants:** cocoa only.
**Related:** SCR-LOYAL-07, FR-641..FR-644, OP-LOYAL-04

### F-LOYAL-09 - Additional sign-in surfaces (second pass)
**Status:** Confirmed
**Description and purpose:** Further provider texts confirmed in the second pass.
**Actions and interactions:**
- Avolta sign-up success: "Welcome to The Club!" / "Your membership has been applied, and you are now signed in."
- Avolta terms skeleton: "You're just a step away from enjoying your rewards!"
- Multi-method picker rows: "Select your preferred sign-in method" / "Sign in with Email" / "Sign in with Phone" / "Sign in with User ID".
- Manual sign-in entry fields announce their confirm state: "Confirm email, is disabled. Signin is in progress." / "Confirm email, is disabled. You need to enter at least one valid email address to enable it." / "Confirm email, {value0}" / "Confirm phone number, {value0}" / "Confirm code, is disabled. We are updating your basket."
- A two-factor authentication modal exists ("Two Factor Authentication") for provider flows that require it.
- A signing-in progress surface shows "Checking now" / "You can carry on with your order".
**Related:** F-LOYAL-03, F-LOYAL-07, FR-605..FR-610

## A07 DISCOUNTS — Coupons, rewards, restaurant and senior discounts

### F-DISC-01 - Coupon apply entry points
**Status:** Confirmed
**Description and purpose:** Several ways to attach a discount code: scan, manual entry, scan-coupon page, basket scan button, loyalty sign-in.
**What the user can do:** Scan a code on an accepting screen, tap "Press to enter a coupon code" (manual entry) or open the scan page.
**Actions and interactions:**
- Manual entry screen: "Enter your coupon code" + a code keypad; scan page "SCAN QR CODE" (or scanner-unavailable copy when the scanner is down); a coupon-type detector classifies the code (Comanda / Punchh / Loyalty / restaurant / senior / unknown).
- Basket scan-coupon button shows when coupon features are on and no coupon is applied.
- Manual-entry banner copy adapts to what is enabled: "Rewards, Loyalty, Senior Discount" / "Press to enter a reward or coupon code" / "Press to enter a reward code" / "Press to enter a coupon code".
- Sign-in banner copy adapts: scanner+manual "Scan your app to sign in" + "Or tap to enter your details"; manual-only "Tap here to sign in" + "And connect your loyalty account"; scan-only "Scan your app to sign in" + "And connect your loyalty account".
**Expected behaviour and results:** A valid code applies to the order (totals recompute); an added confirmation shows.
**Variants:** cocoa full flow; legacy scan-coupon page + scan-error page + enter-manually (v2/bk variants).
**Related:** SCR-DISC-01..03, FR-701..FR-710, OP-DISC-01..04

### F-DISC-02 - Coupon/discount apply pipeline
**Status:** Confirmed
**Description and purpose:** Every applied code goes through one pipeline that queues, classifies and applies it.
**What the user can do:** Apply a code.
**Actions and interactions:**
- Queue-wait (`AWAIT_QUEUE_BEFORE_DISCOUNT`, feature 159): when enabled, apply waits for the order queue to clear and blocks while a discount/scan is already being processed; a failed wait shows "Unable to apply discount. Please try again."; without it the apply runs immediately.
- Type routing: Comanda coupon -> use-coupon request; Punchh/Loyalty -> loyalty apply; restaurant -> restaurant-discount apply; senior -> senior-discount apply; unknown -> logged warning (no request).
- Applying a second code: when one discount is already applied, a "second code required" or "replacement" surface shows; a new coupon while one is applied shows "Only one coupon can be applied to an order" / "Code already added" (title "Code already added", body "Only one code may be applied to an order." / "To apply a different code please remove the current code from your order.").
- Replacement warning: swapping one discount for another shows "Replace your current discount?" (Continue/Cancel) — the exact body differs for the code types.
- Senior discount (scan or redeem-code screen): guarded by `seniorDiscountEnabled`; already-applied -> "Code already added"; on apply failure a `minimumAge` response surfaces as an age error ("Sorry, this discount is only available for citizens aged {n} or over"); other failures use the generic error; analytics an add-loyalty-info analytics event (type, entry method, screen, success, value, error) with success + value.
**Expected behaviour and results:** The right backend apply runs; totals recompute; a success overlay shows ("Coupon added to order" / "Reward added to order" / "Discount added to order" / Avolta "You have unlocked your Club Avolta discount.").
**Variants:** cocoa overlays vs legacy scan-error page.
**Related:** SCR-DISC-04/05, FR-711..FR-722, OP-DISC-01..04

### F-DISC-03 - Award selection (Punchh / LoyaltyV2 / Pepper / Paytronix)
**Status:** Confirmed
**Description and purpose:** Signed-in members with available awards pick which to apply.
**What the user can do:** Open the awards list, select awards, confirm.
**Actions and interactions:**
- Modal "Select Your Discount..." lists available awards as selectable rows; "Confirm Selection" applies; close dismisses.
- The modal shows automatically when the provider supports it AND awards exist — for Punchh with awards-selection enabled a totals call refreshes the available awards first (the modal still shows even if that call fails); the modal is suppressed when the discount limit is already reached.
- After applying, if more awards remain, "More rewards available" asks "There are still reward available for you to redeem. Would you like to continue?" (Add Discount / Close).
- LoyaltyV2/Pepper expose a "Select Discounts" / "Redeem Code" popup instead ("Add New Discount" / "Select your preferred loyalty method").
**Expected behaviour and results:** Chosen awards apply; totals recompute.
**Variants:** Punchh awards modal vs LoyaltyV2 popup vs senior+redeem.
**Related:** SCR-DISC-06, FR-723..FR-728

### F-DISC-04 - Discount removal / void
**Status:** Confirmed
**Description and purpose:** Applied discounts can be removed; the removal type matches the applied discount.
**What the user can do:** Remove a coupon/reward/discount/senior-discount line (A04 rows).
**Actions and interactions:**
- Removal routes by type: coupon -> coupon void; loyalty/reward -> loyalty void (per-discount); senior -> senior void; only one discount kind exists per order.
- Silent void (`voidDiscountsIfNeededSilently`) clears applied discounts without a confirmation — used during order submit/cancel paths.
- A failed void shows "Sorry, your discount could not be removed." (Close + more-details).
- Removing the last discount clears the discount-added state.
**Expected behaviour and results:** The discount leaves; totals recompute.
**Variants:** Same.
**Related:** FR-729..FR-733, OP-DISC-03

### F-DISC-05 - Discount limit and replacement banners
**Status:** Confirmed
**Description and purpose:** Banners announce when a second discount cannot be added.
**What the user can do:** Read them; remove a discount to make room.
**Actions and interactions:**
- "Discount limit reached" / "To apply a different code you must remove one from your order." (banner).
- "Unlock your discount with ID code" / "To use limited use coupon code enter the ID for your discount" (second-code-required banner — a limited-use coupon needs its ID entered as a second code).
- After one is applied: "Coupon added"/"Reward added" + "To apply a different code you must remove one from your order."
- LoyaltyV2 discount list: "Your Discounts" / "View and manage your discounts" + "Balance: {n}" + "Discount limit reached" + "Discount total" + "Add Discount" + "Close".
**Expected behaviour and results:** Guests see why a second code is blocked.
**Variants:** cocoa.
**Related:** FR-734..FR-738

### F-DISC-06 - Legacy scan-coupon pages and errors
**Status:** Confirmed
**Description and purpose:** The non-cocoa coupon flow: a scan page, a manual-entry page and a scan-error page.
**What the user can do:** Scan or type a code; recover from an invalid code.
**Actions and interactions:**
- Scan page "SCAN QR CODE" + subtitle (or scanner-unavailable copy) + a "enter manually" button.
- Manual-entry page "Enter your coupon code" + keypad + back.
- Scan-error page: retriable errors show "Try again" (rescan); non-retriable show "THIS QR CODE IS NOT VALID" + "OK" (back to order summary); details show the error message/code/location/timestamp.
- Cocoa invalid coupon dialog: "QR code not valid" / "This QR code can not be used at this location" (Close + more-details); a variant hides the description with only Close.
- Add-discount error: "Discount Error" / "A problem occurred while adding your discount" (Try Again/Close + more-details).
- Accesso invalid: "Details not valid" with no description.
**Expected behaviour and results:** Invalid codes never apply; the guest can retry or enter manually.
**Variants:** legacy pages (v2/bk variants) vs cocoa dialogs.
**Related:** SCR-DISC-02/04/05, FR-739..FR-744

### F-DISC-07 - Additional discount surfaces (second pass)
**Status:** Confirmed
**Description and purpose:** Further texts confirmed in the second pass.
**Actions and interactions:**
- Legacy awards modal variant: "Pick Your Discount" + "Balance: {n}" and a locked state "Remove your voucher first".
- Gift-card applied overlay: "Gift Card added to order".
- An age-related discount rejection shows "Discount not valid".
- Void-failure dialog title "Remove Error" + the shared error-detail labels ("Error Description:", "Location ID:").
- Manual-entry first code subtitle variants: "Enter code to add your discount" / "Enter code to add your discount or check-in with User ID" / "Enter code to add your discount, check-in with User ID or scan your ID for Senior Discount"; second code "Enter ID for discount code {first}".
- SMS receipt failure dialog: "Receipt Error" / "Sorry, your receipt could not be sent. Try different options or talk to our staff for help."
**Related:** F-DISC-03, F-DISC-06, FR-723..FR-744

## A08 PAYMENT — Method choice, authorisation, errors, tips, donation

### F-PAY-01 - Payment method chooser
**Status:** Confirmed
**Description and purpose:** The guest picks how to pay; the list adapts to the devices that are actually ready and the methods the venue enables.
**What the user can do:** Choose Cash, Card, Food Stamps (EBT), Crypto, a Gift Card type, Room Charge, App Payment or Face-ID; go back; cancel pending payments.
**Actions and interactions:**
- The method list is built from device readiness + enabled types: Cash shows only when `cashReaderReady`; Card only when `cardReaderReady`; Food Stamps only when card reader ready + `foodStampEnabled`; Crypto shows a "unavailable" notification when crypto can't run; Gift Card renders one button per `giftcardPaymentTypes` entry (each with its own gateway id); Room Charge, App Payment and Face-ID show when their features are enabled.
- Names: "Cash" / "Card" / "Food Stamps" / "Crypto" / "Gift Card" / "Room Charge" / "App Payment" / "Face ID" per `payment.cocoa.choosePayment*Name` keys; title "Choose payment".
- With existing partial payments (`payments.length > 0`) the page reverses them first ("Reversing payment" / "This won't take long") before continuing — a cash cancel failure is logged and non-fatal.
- Back navigates to the basket.
**Expected behaviour and results:** Only runnable methods are offered; picking one starts its flow (A09 for cash/crypto/gift card/room/app/Face-ID; card flow here).
**Variants:** cocoa full chooser; default/bk/costa/itsu/shakeshack single-method pay buttons when only card applies.
**Related:** SCR-PAY-01, FR-801..FR-808, ENT-PAY-01

### F-PAY-02 - Card/PED payment flow
**Status:** Confirmed
**Description and purpose:** The card payment runs through the active provider's PED terminal.
**What the user can do:** Insert/tap the card on the terminal; wait while it authorises.
**Actions and interactions:**
- The authorising screen shows while the transaction runs; processing screens show progress.
- Providers: Adyen, FreedomPay, Ocius and a generic PED path — the request carries `AuthPaymentRequest` (order, amount, gateway id/type).
- Payment status polls until a terminal state; cash-status polling waits at least 1,000 ms between calls (CASH_STATUS_POLLING_MIN_WAIT_TIME_IN_MS) and only on routes that support it.
- On success the flow continues to order placement (F-PAY-06) then the success page (A10).
**Expected behaviour and results:** An authorised payment posts; failures land on the error screen.
**Variants:** cocoa authorising page; bk/costa/itsu/shakeshack own error pages; SCO variant.
**Related:** SCR-PAY-02/03, FR-809..FR-816, OP-PAY-01/02

### F-PAY-03 - Payment error handling and retry
**Status:** Confirmed
**Description and purpose:** Payment failures land on an error screen with the reason and a retry/exit choice.
**What the user can do:** Retry the payment or go back/cancel.
**Actions and interactions:**
- The error screen shows a title + subtitle + buttons; retriable errors offer Try Again; fatal errors offer only back/OK.
- Error code `702` means a second code is required (limited-use coupon) — surfaced as the second-code-required flow, not a payment failure.
- Payment-expired dialog fires when the authorisation times out.
- Cancel-payment confirm ("cancel this payment?") guards accidental abandonment; cancel-partial-payments confirm guards reversing several payments.
**Expected behaviour and results:** Failures never silently lose money — partial payments are reversed before a new attempt.
**Variants:** cocoa, bk, costa, itsu, shakeshack error pages.
**Related:** SCR-PAY-04/05, FR-817..FR-824

### F-PAY-04 - Partial payments
**Status:** Confirmed
**Description and purpose:** The guest can split payment across methods; the remaining balance drives the next method.
**What the user can do:** Pay part (e.g. gift card) then choose another method for the remainder; cancel all partials.
**Actions and interactions:**
- The chooser shows the remaining amount; applied payments count toward the total.
- Re-entering the chooser with partials reverses them first ("Reversing payment").
- "Cancel partial payments" posts a cancel request and returns the full total to one payment.
- Order payment totals carry `remaining`, `totalPaid`, `cashRoundingDiscount`.
**Expected behaviour and results:** Splits stay consistent; cancelling restores the full amount.
**Variants:** cocoa.
**Related:** FR-825..FR-828, ENT-PAY-02

### F-PAY-05 - Tips
**Status:** Confirmed
**Description and purpose:** An optional tip step before payment on cocoa.
**What the user can do:** Pick a preset percentage, enter a custom amount, choose no tip, or continue.
**Actions and interactions:**
- Preset tip choices are ordered and selectable; a "custom" button opens an amount entry modal (apply/cancel).
- The tip jar icon fills per the chosen size (EMPTY/LOW/MEDIUM/HIGH/FULL).
- Tip total adds to the order; the order total without the tip is preserved to recompute on change.
- Continue proceeds to payment; the tip row on the basket offers "Edit" to reopen this step.
**Expected behaviour and results:** The chosen tip joins the order total and the totals recalc.
**Variants:** cocoa only.
**Related:** SCR-PAY-06, FR-829..FR-834

### F-PAY-06 - Charity donation and food-stamp banner
**Status:** Confirmed
**Description and purpose:** A donation prompt can run before payment; a food-stamp banner announces EBT.
**What the user can do:** Donate (modal) or skip; see the food-stamp note when EBT applies.
**Actions and interactions:**
- Donation: the prompt shows when the donation step is active and donation info exists (`KioskDonationView.MODAL` provider type); apply/skip resumes the pay path (it is the FIRST pay gate — A04).
- Donation providers + views come from `donationProvider` config; Pennies inline block is on the basket (A04), the modal runs at pay time.
- Food-stamp banner shows when the order is flagged food-stamp (`isFoodStampPayment`).
- Loyalty-discounts banner shows applied loyalty discounts at pay.
- Wait-time message ("Current wait time is about {n} minute(s)") shows on the cocoa payment variant when `config.waitTime` is set.
**Expected behaviour and results:** Optional donation and method-specific banners integrate without blocking card payment.
**Variants:** cocoa.
**Related:** FR-835..FR-840, ENT-PAY-03

### F-PAY-07 - Order placement after payment
**Status:** Confirmed
**Description and purpose:** After the last payment authorises, the order is submitted to the POS — exactly once.
**What the user can do:** Nothing; the submit runs automatically.
**Actions and interactions:**
- Order placement is single-flight (a second submit is ignored while one is in flight).
- The order-request is built from order details + payments + invoice data.
- Injection failure handling: a failed submit lands on the payment error path; a cash-paid order that fails injection keeps the payment state rather than pretending nothing was paid (the guest is not re-charged).
- Payment totals (`remaining`, `totalPaid`, `cashRoundingDiscount`) are cleared into the submitted order response (`updateOrderResponseAction`).
- On success the success page (A10) shows the order number.
**Expected behaviour and results:** Paid orders submit once and reach the POS or a clear error.
**Variants:** Same across templates.
**Related:** FR-841..FR-846, OP-PAY-03

## A09 ALTPAY — Cash, crypto, gift card, room charge, app payment, Face-ID

### F-ALTPAY-01 - Cash payment
**Status:** Confirmed
**Description and purpose:** Pay with the cash machine — insert, process, take change.
**What the user can do:** Insert notes/coins, watch the running total, cancel (with confirm), take change.
**Actions and interactions:**
- Insert screen: title "Insert cash" (`payment.cocoa.cash.insertCashTitle`) + subtitle + the amount due and running "Amount paid" (`amountPaid = inserted + prior total`); a cancel button (aria disabled while the machine starts accepting money — "starting to accept money" state).
- Cash-status polls (>=1,000 ms spacing, route-gated) track the machine and the inserted amount until the total is covered.
- Journey states drive the screens: waiting -> processing money -> collect change (or collect-change-to-cancel when cancelling); a fatal machine error surfaces ("Received a fatal error from cash machine").
- Change screen: "Take your change" / "Please take your change and we will process your order." + "Change Due"; when cancelling, "payment cancelled" title + "money due" variant instead.
- Cancelling posts a cancel-cash request; the machine ejects inserted money.
- Cash health/readiness comes from the cash-status refresher (A01 coordinates); a `cashRoundingDiscount` can appear in totals.
**Expected behaviour and results:** Paid cash orders proceed to placement; cancels return the money.
**Variants:** cocoa.
**Related:** SCR-ALTPAY-01/02, FR-901..FR-910, OP-ALT-01

### F-ALTPAY-02 - Crypto payment
**Status:** Confirmed
**Description and purpose:** Pay by scanning a crypto QR in the wallet app.
**What the user can do:** Scan the QR with their wallet, wait for confirmation, cancel.
**Actions and interactions:**
- The page shows a QR + "Scan the QR code to pay" and a terms note ("This Bitcoin transaction is governed by Steak n Shake's Terms and Conditions for such payments..." / "The Terms and Conditions can be viewed here.").
- Payment polls until confirmed or expired; a `timeoutSeconds` timer fires the payment-expired dialog — confirming abandons the journey (`crypto_payment_expired`), cancelling closes it.
- Cancel asks "Cancel Order?" / "Are you sure you want to cancel your order? This will remove all items from your basket." (Cancel Order / Go back).
- When crypto can't run, an unavailable notification shows on the chooser.
**Expected behaviour and results:** Confirmed crypto proceeds to placement; expiry/cancel leaves the order unpaid.
**Variants:** cocoa.
**Related:** SCR-ALTPAY-03/04, FR-911..FR-918, OP-ALT-02

### F-ALTPAY-03 - Gift card payment
**Status:** Confirmed
**Description and purpose:** Pay with a stored-value gift card — scan, manual entry, or PED — in full or partial.
**What the user can do:** Scan the card, enter number/code/PIN manually, pick an amount, or use the PED interaction screen.
**Actions and interactions:**
- The page shows the amount due, available balance and a ring progress of coverage; a data-expiry notice shows ("dataExpires").
- Balance covers the order -> "pay in full" applies the amount due; balance short -> "pay a partial amount" applies the whole balance and returns to the chooser for the remainder.
- A custom-amount modal lets the guest enter how much of the card to use (apply/cancel).
- "Change payment method" is offered when the balance is insufficient (logs the insufficient-balance reason).
- Manual entry supports number/code/PIN modals; the PED interaction page handles card-present modes.
- Errors: already-activated -> `GIFT_CARD_ALREADY_ACTIVATED` (`GifCardAlreadyAddedDialog`); other apply failures -> `GiftCardErrorDialog`.
- Gift-card purchase (separate): a banner on the basket offers denominations/amount selection and a scan-to-buy flow; purchased cards list as "{amount} Gift Card" basket lines (A04).
**Expected behaviour and results:** Applied value counts toward the total; the remainder goes to another method.
**Variants:** cocoa.
**Related:** SCR-ALTPAY-05..08, FR-919..FR-930, OP-ALT-03

### F-ALTPAY-04 - Room charge
**Status:** Confirmed
**Description and purpose:** Charge the order to a hotel room.
**What the user can do:** Pick the hotel, enter guest details, confirm the charge.
**Actions and interactions:**
- Hotel picker "Select Hotel" / "Please select the hotel you are staying" lists `availableHotels` (skeleton while loading); "Charge room" continues.
- Details form "Room Details" / "Please enter your details to charge this order to your hotel bill." validates against the property's room-charge payment types (first name / room number etc. — fields come from `roomChargePaymentTypes`).
- Checkout "Checkout" / "The order amount will be charged to your room" shows Name + Room Number + amount due + "Charge room" (spinner while charging).
- Errors: validation failure -> `RoomChargeConfirmErrorDialog`; the flow can hide guest-info fields where configured.
**Expected behaviour and results:** A validated charge pays the order.
**Variants:** cocoa.
**Related:** SCR-ALTPAY-09..11, FR-931..FR-938, OP-ALT-04

### F-ALTPAY-05 - App payment
**Status:** Confirmed
**Description and purpose:** Pay by presenting a code from a payment app.
**What the user can do:** Show the app's code to the scanner; the scanned code submits the payment.
**Actions and interactions:** Title + subtitle on the app-payment page; a scan on this route is routed to `submitAppPaymentCode` (A05) which authorises the amount.
**Expected behaviour and results:** An authorised code pays the order.
**Variants:** cocoa.
**Related:** SCR-ALTPAY-12, FR-939..FR-942, OP-ALT-05

### F-ALTPAY-06 - Face-ID payment
**Status:** Confirmed
**Description and purpose:** Pay by face — camera validation plus a 2FA PIN.
**What the user can do:** Look into the camera; enter the 2FA PIN when asked; cancel (with confirm).
**Actions and interactions:**
- Camera readiness: the face camera initialises via a websocket; the guest sees "Pay with" + "Please look into the camera while we validate your ID".
- 2FA PIN: when the provider asks, a PIN entry submits `submitFaceIdTwoFactorAuthentication(pin)` (the PIN length is logged); a bad PIN shows "Enter a valid code." and the guest retries (attempts bounded by the provider session).
- "Processing Face ID payment" / "This won't take long" shows while authorising.
- Cancel asks via `CancelFaceIdPaymentConfirmDialog`.
- Failures surface on the payment error path (A08).
**Expected behaviour and results:** A validated face + PIN pays the order.
**Variants:** cocoa.
**Related:** SCR-ALTPAY-13/14, FR-943..FR-948, OP-ALT-06, test/integration/faceid-payment-*

### F-ALTPAY-07 - Payment-cancel dialogs (second pass)
**Status:** Confirmed
**Description and purpose:** Exact cancel-confirmation copy for cash/crypto/Face-ID and partials.
**Actions and interactions:**
- Crypto / Face-ID cancel: "Cancel Payment?" / "Are you sure you want to cancel this payment and return to payment method selection?" + "No, do not cancel" / "Cancel Payment".
- Generic payment cancel: "Cancel Payment?" / "Are you sure you want to cancel payment?" + "Yes, cancel payment" / "No, do not cancel".
- Partial payments cancel: "Changed your mind?".
- Gift-card errors include "Card removed too early", "Communication error", "Terminal session expired"; already-added: "Card Already in Use" / "This gift card has already been activated. Use a different card to proceed." + error details.
- Room-charge failures: "Room details not valid" / "Sorry, we've been unable to check those room details, please use another payment method or try again." or "Sorry, we've been unable to activate our room charge feature, please pay another way".
**Related:** F-ALTPAY-02, F-ALTPAY-03, F-ALTPAY-04, F-ALTPAY-06

## A10 POST — Success page, notifications, receipts, wait-time

### F-POST-01 - Payment success page
**Status:** Confirmed
**Description and purpose:** The "order placed" screen — shows the order number and how to collect.
**What the user can do:** Read the confirmation; press Done (or "Pick a store" on multi-brand).
**Actions and interactions:**
- Title + subtitle + "Order number" + the number; Done returns to the start; multi-brand adds "Pick a store" and a "Want to make another order?" footer.
- Loyalty footers: signed-in Punchh -> "You have earned points on this order"; failed -> "Claim your loyalty points by scanning the barcode on your receipt".
- Accessibility announcement: "Thanks for your order" + title + subtitle + number + footers.
- Order-number display rule (`posCheckNumberDisplayLength` config): unset or shorter number -> the whole number shows; set and the digits-only number is longer -> only the last N digits show.
- Auto-return: the standard inactivity reset returns to welcome (A01); the success timer is the same idle mechanism.
**Expected behaviour and results:** The guest sees confirmation + how to collect; the kiosk resets.
**Variants:** cocoa `PaymentSuccess` (+ email-disabled variant), `PaymentSuccessPageV2`, buzzer/shakeshack/bk/costa/itsu success pages, SCO.
**Related:** SCR-POST-01/02, FR-1001..FR-1010, OP-POST-04

### F-POST-02 - Order notification methods
**Status:** Confirmed
**Description and purpose:** How the order reaches the guest: buzzer, table number, tent card, phone, name.
**What the user can do:** Pick a notification method and enter its identifier.
**Actions and interactions:**
- Buzzer: "Grab a buzzer and enter the number below" / "Please come to the collection point when the buzzer goes off." + number entry.
- Tent card: "Grab a tent card and enter the number below" / "Find a free table and we will bring your order over." + number entry.
- Table number: "Enter your table number below" + number entry.
- Phone notification: phone-number entry (validated) for an SMS alert.
- Guest name: optional/required name capture — mandatory when feature `KIOSK_GUEST_NAME_MANDATORY` (162) is on; the name shows on the success page and goes on the order.
- Fulfillment (puck) alerts exist for venues with a puck system.
**Expected behaviour and results:** The identifier is stored on the order for collection.
**Variants:** cocoa Notification pages; default/v2 `OrderBuzzerNumber`/`OrderCustomerName`; shakeshack `OrderNotification`.
**Related:** SCR-POST-03..06, FR-1011..FR-1018, OP-POST-01

### F-POST-03 - Receipts
**Status:** Confirmed
**Description and purpose:** Print, email, SMS or QR/photo receipt after the order.
**What the user can do:** Print a receipt, send an email/SMS receipt, or skip.
**Actions and interactions:**
- Print-receipt page offers the choice; a print failure shows "Still need a receipt? Please ask our staff at the counter." (title + subtitle) and the journey continues.
- Email modal: "emailReceiptTitle" + "This email will not be used for marketing purposes" + Cancel/Send Receipt; invalid emails keep Send disabled; sent -> "receiptSentTitle" + "receiptSentSubtitle".
- SMS receipt and QR/photo receipt exist per `kioskReceiptOptions` config; an SMS failure shows `SmsErrorDialog`.
- Which options appear (print/email/sms/QR) comes from `kioskReceiptOptions`.
**Expected behaviour and results:** A receipt reaches the guest via a working channel or a clear failure message.
**Variants:** cocoa/default, shakeshack `EmailReceipt`, costa `EmailReceiptCosta`.
**Related:** SCR-POST-07..09, FR-1019..FR-1026, OP-POST-02/03

### F-POST-04 - Wait-time + waiting screen
**Status:** Confirmed
**Description and purpose:** Post-order info: the estimated wait and a holding screen while the order is processed.
**What the user can do:** Read the wait-time.
**Actions and interactions:**
- Wait-time message ("Current wait time is about {n} minute(s)") renders where configured (A03) on post-order surfaces.
- `WaitingScreen` holds while the order is submitted/processed before the success page.
- The order response `waitTime` value drives the displayed estimate.
**Expected behaviour and results:** The guest sees how long to expect the order.
**Variants:** cocoa.
**Related:** FR-1027..FR-1030

### F-POST-05 - Auto-return to start
**Status:** Confirmed
**Description and purpose:** The kiosk resets to the start screen after the order.
**What the user can do:** Press Done or wait.
**Actions and interactions:**
- Done (or "Pick a store") navigates to the start immediately.
- The inactivity timer auto-resets to welcome with the same per-screen values as A01; the reset clears the order + notifications + loyalty state (A01 session reset).
**Expected behaviour and results:** The kiosk returns to a clean start for the next guest.
**Variants:** Same across templates.
**Related:** FR-1031..FR-1034, A01

## A11 PRES — Theming, accessibility, keyboards, formatting, analytics

### F-PRES-01 - Theming and branding
**Status:** Confirmed
**Description and purpose:** Server-driven theme (colours, fonts, images, per-page overrides) applied when feature `KIOSK_THEMING` (170) is on, plus brand logos.
**What the user can do:** Nothing directly — the theme styles every surface.
**Actions and interactions:**
- `ThemeProvider` + `BrandingContainer` apply theme tokens (tokenMap) and CSS; `PageThemeWrapper`/`PageThemeContext`/`itemBackground`/`resolvePageImage`/`resolveOrderTypeButtonsDirection` apply per-page and order-type overrides.
- Server CSS can be fetched/applied; logos render (`Logo`, `FloatingLogo`, `HomeFloatingLogoManager`) and fall back.
- Icon font, animated surfaces, ring progress, spinners and `LoadingFullScreen` are shared presentation.
**Expected behaviour and results:** A branded, consistent look without a code change per venue.
**Variants:** Per-brand theme + logos.
**Related:** FR-1101..FR-1110, OP-PRES-01

### F-PRES-02 - Accessibility mode and keyboard navigation
**Status:** Confirmed
**Description and purpose:** A guest-facing accessibility mode: larger contrast UI, screen-reader announcements, and focus/keyboard navigation.
**What the user can do:** Toggle accessibility mode (nav bar button); move focus with the NavPed/keyboard; hear announcements.
**Actions and interactions:**
- `accessibilityModeEnabled` state changes the UI (accessibility classes on every interactive element: `selectable-accessibility-focusin` + `selectable-accessibility-element`).
- `AccessibilityButton` (cocoa + v2 + bk/itsu/costa accessibility screens) toggles it.
- `AccessibilityFocusTrap` traps focus inside modals; `AccessibleNavigation` + `Announcements` + `ScreenReaderAnnouncement` drive NavPed focus order, section focus and spoken announcements.
- `DirectionManager` sets `dir` on `<html>` from the language (rtl-detect); RTL languages flip layout.
**Expected behaviour and results:** The kiosk stays fully operable without touch, with focus order + announcements + RTL.
**Variants:** cocoa default; v2 accessibility button; bk/itsu/costa screens.
**Related:** FR-1111..FR-1122

### F-PRES-03 - On-screen keyboards and keypads
**Status:** Confirmed
**Description and purpose:** Text/number entry surfaces: full keyboards, tabbed keyboards, numeric keypads.
**What the user can do:** Type with the on-screen keyboard or keypad.
**Actions and interactions:**
- `KeyboardComponent` + `SimpleKeyboardLayouts` with per-language layouts (arabic, chinese, english_gb, french, german, japanese, korean, russian, spanish); a `maxLength` caps input; `inputPattern` restricts characters; a currency-symbol map.
- `TabbedKeyboard` (cocoa) offers tabs; `NumberKeypad`/`NumberKeypadInput` (+ shakeshack buzzer keypad) for numeric.
- Inputs can carry `inputPattern`, `maxLength` and custom key sets.
**Expected behaviour and results:** Every text/number field gets a working keyboard in the guest's language.
**Variants:** cocoa tabbed; brand layouts.
**Related:** FR-1123..FR-1130

### F-PRES-04 - Formatting, language and display helpers
**Status:** Confirmed
**Description and purpose:** Money, text and layout helpers + the language list.
**What the user can do:** Read correctly formatted amounts/text in their language.
**Actions and interactions:**
- `Money` formats amounts via `ts.formatCurrency` (locale currency); `textFormatting` + `TabIndexDialogHelper` helpers.
- 33 locale files ship (en, en-us, en-gb, pt-br, pt-pt, es, es-la, es-us, fr, fr-ca, de, it, nl, no-no, sv-se, da-dk, dk-dk, fi, pl-pl, ru, cz, tr-tr, ar-qa, hi, id-id, ja, ja-jp, ko-kr, ms, ca-es, zh via chinese layout); the language list comes from the location config (A02).
- Shared display primitives: `Modal`, `Container`, `Button` (cocoa + default), `Dialog`, `SlidingModal`, `Title`, `ProgressSpinner`, `LoadingFullScreen`, `CocoaScrollBar`.
**Expected behaviour and results:** Consistent, correctly formatted, localised UI.
**Variants:** Per-template surfaces.
**Related:** FR-1131..FR-1138

### F-PRES-05 - Analytics and screen tracking
**Status:** Confirmed
**Description and purpose:** Every interaction fires GA4 events + screen-view tracking via `AnalyticsPageManager`/`AnalyticsManager`/`UserAuthAnalytics`/`SentryConfiguration`.
**What the user can do:** Nothing directly.
**Actions and interactions:** The full event catalogue is in FR-1139 (per-interaction events are also documented in each area's FRs).
**Expected behaviour and results:** Every interaction and screen view is measurable.
**Variants:** Same.
**Related:** FR-1139

### F-PRES-06 - Accessibility toggle texts and shared primitives (second pass)
**Status:** Confirmed
**Description and purpose:** Exact accessibility-button and shared-primitive texts captured in the second pass.
**Actions and interactions:**
- Accessibility button aria: "Tap to turn on accessibility mode" / "Tap to turn off accessibility mode".
- `LoadingFullScreen` shows "Loading, Please wait".
- Number keypad aria: "Cancel, is disabled.", "Confirm code, is disabled. We are validating your number.", "Confirm code, is disabled. You need to enter at least one number to enable it.", "Confirm code, {value0}".
- Number-keypad input announces "This field shows the code entered below. Navigate back here to have your code read out." and "You've entered code {value0}, navigate below to change or accept this number."
- Sign-in entry keyboards: "Close keyboard", "Country Selection", "Enter Phone Number", "Select Dial Code", "Enter User ID"; the country list offers "Search country" and shows "No countries found".
**Related:** F-PRES-02, F-PRES-03, FR-1111..FR-1130

## A12 SCO — Self-checkout screens, clerk validation, template catalogue

### F-SCO-01 - Self-checkout journey screens
**Status:** Confirmed
**Description and purpose:** The dedicated SCO (attendant-assisted self-checkout) template tree — every screen a guest/staff uses in SCO mode.
**What the user can do:** Shop, pay, request help, or (staff) log in and manage the order.
**Actions and interactions:**
- **SCO home**: the help button in the header; product browsing via `ProductsSelector`/`Products`/`ProductsCell`; `MenuSettings`.
- **SCO product page**: product details for scan/manual entry.
- **SCO basket/order summary**: `OrderSummary` for the order.
- **SCO payment + authorising + success + print receipt**: SCO variants of the payment journey.
- **Help**: `HelpButton` opens help; `HelpRequestedPage` shows "Help is on the way" / "Please wait." + a cancel-help action; `CancelHelpButton` cancels the request.
- **Staff login**: `StaffLoginPage` — "Staff Login" + subtitle + a keypad; the PIN is validated against `kioskConfig.pinCode` (matching value unlocks; a wrong code shows a wrong-login-code message); `CancelHelpButton` on the page.
- **Staff product summary**: staff actions "Reset Session", "Approve Item", "Delete Item", "Print last receipt", "Done".
- **SCO scanner routing**: scans route per A05 (item-first on `/home`/`/scanAndGo`, then loyalty/coupon); the legacy `ScannerManager` handles SCO scans (unrecognised barcode -> modal, A05).
- **Clerk validation**: a `/clerk` service endpoint validates clerk actions (staff PIN / approve / delete / receipt) per the venue.
**Expected behaviour and results:** A guest flow plus a staff override flow for approvals.
**Variants:** The whole SCO tree is itself a `mode` variant.
**Related:** SCR-SCO-01..08, FR-1201..FR-1214, OP-SCO-01

### F-SCO-02 - Template catalogue (which brand overrides which slot)
**Status:** Confirmed
**Description and purpose:** The screen template catalogue slot map records which template value each brand supplies for every screen slot — this is the catalogue a rebuild must reproduce.
**What the user can do:** Nothing directly.
**Actions and interactions:** See the catalogue table in `data-and-integrations.md` (slot | default | alternatives | brand | owning area). Values observed include welcome, order-type, home, nav-bar, order-summary, payment, authorizing, payment-success (incl. cocoa email-disabled), payment-error, loyalty-logging, tip, buzzer/table/tent notification, multi-brand, lane-closed, maintenance, at-capacity, coupon pages, idle/alert overlay, allergen page, email-receipt, phone-notification, products, staff screens.
**Expected behaviour and results:** A rebuild can map every template slot to its brand implementations.
**Variants:** bk, boparan, buzzer, cinnamon, cocoa, costa, itsu, shakeshack, v2, v3 + default.
**Related:** FR-1215..FR-1220, data-and-integrations.md table

### F-SCO-03 - Further template texts (second pass)
**Status:** Confirmed
**Description and purpose:** Additional texts captured in the second pass.
**Actions and interactions:**
- Cinnamon navigation bar reset prompt: "Start your order again?".
- Boparan menu option-group hint: "Scroll down for more extras".
**Related:** F-SCO-02
