# Functional Requirements

Implementation-independent, testable requirements. Each requirement names the feature it belongs to, the
conditions under which it applies, the trigger, the expected behaviour in order, and acceptance criteria
written as Given / When / Then. Analytics events that an interaction must send are part of its acceptance
criteria. Requirements are numbered in blocks of 100 per functional area (see `features.md`); gaps in the
numbering are intentional.

## A01 KIOSK — Start-up, configuration, availability, session and device health

### FR-101 - Loading screen while configuring
**Feature:** F-KIOSK-01    **Status:** Confirmed
**Description:** Root route shows the loading screen with title "Preparing your experience" and the start-up subtitle until configuration is ready.
**Preconditions:** App launched or full config reload.
**Trigger:** App start / config reload.
**Expected behaviour:** 1. Show animated image + both texts. 2. Hide content while a notification displays. 3. Show language selector.
**Expected outcome:** Guest never sees a blank screen.
**Acceptance criteria:**
- Given config loading, when `/` renders, then both texts show. Screen view: `loading_page`.

### FR-102 - Post-config routing
**Feature:** F-KIOSK-01    **Status:** Confirmed
**Description:** After configuration, route to `/welcome` (1 brand) or `/MultiBrandPage` (>1 brand).
**Preconditions:** Config loaded. **Trigger:** Config success.
**Expected behaviour:** 1. Count configured brands. 2. Route accordingly.
**Expected outcome:** Correct landing screen.
**Acceptance criteria:**
- Given 2+ brands, when config completes, then `/MultiBrandPage` shows.

### FR-103 - Config/branding retry loop
**Feature:** F-KIOSK-01    **Status:** Confirmed
**Description:** Failed configuration or branding load retries automatically every 5 s.
**Preconditions:** Load attempted. **Trigger:** Load failure.
**Expected behaviour:** 1. Log error. 2. Retry after 5 s until success.
**Expected outcome:** Self-healing start-up.
**Acceptance criteria:**
- Given a transient failure, when 5 s passes, then the load runs again; loader stays meanwhile.

### FR-104 - Cache-not-ready health error
**Feature:** F-KIOSK-01    **Status:** Confirmed
**Description:** When the local cache is not ready, a health error is surfaced and configuration retries every 5 s showing the default loader.
**Preconditions:** Config partially loaded. **Trigger:** Cache-not-ready error.
**Expected behaviour:** 1. Show health error. 2. Retry load every 5 s.
**Expected outcome:** Recovery without manual intervention.
**Acceptance criteria:**
- Given cache not ready, when the check fails, then an error is raised and a retry happens after 5 s.

### FR-105 - Missing default language is fatal
**Feature:** F-KIOSK-01    **Status:** Confirmed
**Description:** If neither the active brand nor the kiosk defines a default language, start-up fails into the maintenance-mode error path.
**Preconditions:** Brand selected/loading. **Trigger:** Default-language setup finds no language.
**Expected behaviour:** 1. Raise maintenance-mode error.
**Expected outcome:** Maintenance screen (SCR-KIOSK-03).
**Acceptance criteria:**
- Given no `language.default` and no `defaultLanguage`, when setup runs, then the kiosk shows the unavailable/maintenance error path.

### FR-106 - Maintenance mode entry
**Feature:** F-KIOSK-08    **Status:** Confirmed
**Description:** When the kiosk config reports maintenance mode, the app clears state, sets the maintenance flag and shows the maintenance screen.
**Preconditions:** Config loaded. **Trigger:** Trading check or config flag.
**Expected behaviour:** 1. Clear session state. 2. Set maintenance flag. 3. Route `/maintenanceMode`.
**Expected outcome:** Guest sees "KIOSK CURRENTLY UNAVAILABLE".
**Acceptance criteria:**
- Given maintenance mode, when the guest taps attract, then `/maintenanceMode` shows; no order is created.

### FR-107 - Maintenance mode exit
**Feature:** F-KIOSK-08    **Status:** Confirmed
**Description:** Deactivating maintenance clears the flag and all config and reloads to `/`.
**Preconditions:** Maintenance screen shown. **Trigger:** Mode deactivated (admin/staff/config refresh).
**Expected behaviour:** 1. Clear flag + config. 2. Route `/` (full reload).
**Expected outcome:** Normal start-up resumes.
**Acceptance criteria:**
- Given maintenance active, when it is cleared, then the app returns to the loading flow.

### FR-108 - At-capacity entry
**Feature:** F-KIOSK-08    **Status:** Confirmed
**Description:** At-capacity flag routes to the at-capacity screen; guest cannot order.
**Preconditions:** Config loaded. **Trigger:** Trading check.
**Expected behaviour:** 1. Clear state. 2. Route `/atCapacityMode`.
**Expected outcome:** Capacity message shown.
**Acceptance criteria:**
- Given at-capacity, when the guest taps attract, then the at-capacity screen shows.

### FR-109 - Closed-kiosk derivation
**Feature:** F-KIOSK-08    **Status:** Confirmed
**Description:** `isDineInAvailable`/`isTakeOutAvailable` false removes those order types per brand; brands with no order types left are marked closed; all brands closed => Lane Closed (when shown).
**Preconditions:** Config loaded. **Trigger:** Closed-kiosk check (trading check).
**Expected behaviour:** 1. Strip unavailable order types. 2. Mark empty brands closed. 3. All closed -> `/laneClosed` if lane-closed visibility allows.
**Expected outcome:** Guests cannot start on a fully closed kiosk.
**Acceptance criteria:**
- Given all brands closed, when the trading check runs, then `/laneClosed` shows (subject to visibility).

### FR-110 - Lane-closed visibility settings
**Feature:** F-KIOSK-02    **Status:** Confirmed
**Description:** Closed-messaging availability (`ALWAYS_SHOW` default, `SHOW_BEHIND_ATTRACT_SCREENS`, `NEVER_SHOW`) controls whether closed messaging is a blocking screen or a transient overlay.
**Preconditions:** Closed state. **Trigger:** Screen render/trading check.
**Expected behaviour:** 1. `NEVER_SHOW` -> no closed screen (cocoa welcome also hides its action buttons). 2. `SHOW_BEHIND_ATTRACT_SCREENS` (cocoa) -> closed/maintenance/at-capacity content shows but auto-returns to `/welcome` after 10 s. 3. `ALWAYS_SHOW` -> blocking screen.
**Expected outcome:** Visibility follows configuration.
**Acceptance criteria:**
- Given behind-attract visibility on cocoa, when the closed screen shows, then after 10 s the guest is back at `/welcome`.

### FR-111 - Unavailable screens have no guest controls
**Feature:** F-KIOSK-02    **Status:** Confirmed
**Description:** Lane Closed, Maintenance and At Capacity show only logo + title + subtitle; no buttons.
**Preconditions:** On an unavailable screen. **Trigger:** Render.
**Expected behaviour:** 1. Render texts per variant. 2. No interactive elements.
**Expected outcome:** Read-only state.
**Acceptance criteria:**
- Given the maintenance screen, then no tappable control exists besides hidden staff gestures.

### FR-112 - Configured closed message overrides defaults
**Feature:** F-KIOSK-02    **Status:** Confirmed
**Description:** Cocoa Lane Closed uses `closedMessage.title`/`description` from the brand's carousel settings; falls back to "Closed".
**Preconditions:** Cocoa lane-closed screen. **Trigger:** Render.
**Expected behaviour:** 1. Use configured title when present; else default "Closed". 2. Show description when configured.
**Expected outcome:** Brand-custom closed message.
**Acceptance criteria:**
- Given a configured closed message, when lane closed shows, then the custom title/description render.

### FR-113 - Idle timer enablement
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** Idle checking runs only when `idleTimerIntervalMilliseconds` > 0; effective timeout is the configured value (default 30,000 ms), minimum 1 s.
**Preconditions:** Config loaded. **Trigger:** Every second of inactivity.
**Expected behaviour:** 1. Tick counter each second without click/mousemove/keypress/keydown. 2. At timeout -> warning (FR-114).
**Expected outcome:** Inactivity detected.
**Acceptance criteria:**
- Given `idleTimerIntervalMilliseconds` 60000, when the guest idles 60 s, then the warning appears.

### FR-114 - Idle warning content
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** The warning is a notification titled "Are you still there?" with "Cancel my order" (destructive) and "Continue".
**Preconditions:** Idle timeout reached; no notification already visible.
**Trigger:** Idle counter expiry.
**Expected behaviour:** 1. Show notification. 2. Suppress if another notification is already up (retry next tick).
**Expected outcome:** Guest can continue or cancel.
**Acceptance criteria:**
- Given idle expiry while a notification is visible, then the warning does not stack over it.

### FR-115 - Continue resets
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** "Continue" hides the warning and restarts idle counting.
**Preconditions:** Warning visible. **Trigger:** "Continue" tap.
**Expected behaviour:** 1. Hide notification. 2. `idle_timeout` analytics, selection `needs_more_time`, current screen param.
**Expected outcome:** Journey continues.
**Acceptance criteria:**
- Given the warning, when the guest taps Continue, then it closes and `idle_timeout`/`needs_more_time` fires.

### FR-116 - Cancel abandons journey
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** "Cancel my order" abandons the journey immediately.
**Preconditions:** Warning visible. **Trigger:** "Cancel my order" tap.
**Expected behaviour:** 1. Session reset (FR-121). 2. `idle_timeout` (`abandon`) + journey-abandoned (`idle_timeout_confirm`) analytics. 3. Abandon-journey request `IDLE_TIMEOUT`.
**Expected outcome:** Kiosk returns to start screen.
**Acceptance criteria:**
- Given the warning, when the guest cancels, then the order is cleared and the start screen shows.

### FR-117 - Warning auto-expiry abandons
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** If unanswered, the warning itself expires after the same idle timeout and abandons the journey.
**Preconditions:** Warning visible, no response. **Trigger:** Notification timeout.
**Expected behaviour:** 1. Session reset. 2. `idle_timeout` (`timeout`) + journey-abandoned (`idle_timeout`). 3. Abandon request `IDLE_TIMEOUT`.
**Expected outcome:** Same end state as cancel.
**Acceptance criteria:**
- Given no response within the timeout, then the kiosk resets automatically.

### FR-118 - Idle-disabled screens
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** Idle checking is disabled on: authorizing payment, cash payment/change, crypto, Face-ID, app payment, processing cash, gift-card PED, help-requested, lane closed, maintenance, at-capacity, payment, payment success, print receipt, root loading, the current root screen, during config load and during scan processing.
**Preconditions:** Any navigation. **Trigger:** Screen change / flags.
**Expected behaviour:** 1. Counter frozen/reset on those screens.
**Expected outcome:** No abandonment on payment/system screens or the idle screen itself.
**Acceptance criteria:**
- Given the guest is on the payment screen, when the idle period passes, then no warning appears.

### FR-119 - Input resets the idle counter
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** Any click, mouse move or key press resets the counter to zero.
**Preconditions:** Idle checking enabled. **Trigger:** Input event.
**Expected behaviour:** 1. Counter = 0.
**Expected outcome:** Active guests never see the warning.
**Acceptance criteria:**
- Given 25 s idle then a tap, when the timer ticks, then the warning waits another full period.

### FR-120 - Journey-abandoned analytics and request
**Feature:** F-KIOSK-03    **Status:** Confirmed
**Description:** Abandonment fires `journey_abandoned` with `abandoned_by` (`idle_timeout`|`idle_timeout_confirm`) and current screen, and posts an abandon request with reason `IDLE_TIMEOUT` (manual order cancel uses `CANCELLED_BY_GUEST`).
**Preconditions:** Abandonment triggered. **Trigger:** Idle confirm/timeout or manual cancel.
**Expected behaviour:** 1. Reset to start screen. 2. Fire analytics. 3. POST abandon request with order nonce, location, venue, reason.
**Expected outcome:** Backend + analytics see the abandonment.
**Acceptance criteria:**
- Given an idle timeout abandonment, then both the analytics event and the request carry the timeout reason.

### FR-121 - Session reset clears journey state
**Feature:** F-KIOSK-04    **Status:** Confirmed
**Description:** Reset fires `journey_end` (`automatic` on timeout, `next_order_button` on manual), posts the session-reset request, routes to the root screen, clears order/session/email/notification/NavPed state, and clears brand config on multi-brand.
**Preconditions:** Reset triggered. **Trigger:** Timeout, cancel, next-order, back-to-root.
**Expected behaviour:** 1. `journey_end`. 2. Session-reset POST. 3. Route root screen. 4. Clear state (+brand config if multi-brand).
**Expected outcome:** Clean kiosk for the next guest.
**Acceptance criteria:**
- Given an order in progress, when reset runs, then no basket/payment/customer state survives.

### FR-122 - Single modal notification at a time
**Feature:** F-KIOSK-05    **Status:** Confirmed
**Description:** Only one modal notification is visible; other flows (idle warning) check this before showing.
**Preconditions:** Notification framework active. **Trigger:** Show request.
**Expected behaviour:** 1. New notification replaces/queues per caller. 2. Callers check visibility first.
**Expected outcome:** No stacked modals.
**Acceptance criteria:**
- Given a notification showing, when the idle check fires, then the warning waits.

### FR-123 - Notification structure
**Feature:** F-KIOSK-05    **Status:** Confirmed
**Description:** Notifications carry a title, zero or more action buttons (default/destructive styling), and an optional timeout that runs a chosen action.
**Preconditions:** Caller supplies content. **Trigger:** Show request.
**Expected behaviour:** 1. Render title + buttons. 2. Optional `timeout` ms -> `timeoutAction`.
**Expected outcome:** Blocking modal or auto-dismissing alert.
**Acceptance criteria:**
- Given a notification with a 30 s timeout, when it elapses, then its timeout action runs.

### FR-124 - Retry pattern ("Start Over")
**Feature:** F-KIOSK-05    **Status:** Confirmed
**Description:** Retryable failures show an error notification whose "Start Over" button re-runs the failed operation (e.g. language change, config load).
**Preconditions:** A retryable operation failed. **Trigger:** Failure.
**Expected behaviour:** 1. Show notification + button. 2. Button hides notification and retries.
**Expected outcome:** User-driven recovery.
**Acceptance criteria:**
- Given a failed language change, when "Start Over" is tapped, then the change is retried.

### FR-125 - Hidden admin gesture
**Feature:** F-KIOSK-06    **Status:** Confirmed
**Description:** 5 taps on the admin area within 4,000 ms opens the admin panel; the count resets after 4 s or on completion.
**Preconditions:** Cocoa `/welcome` or `/orderType`. **Trigger:** Rapid taps.
**Expected behaviour:** 1. Count taps. 2. At 5 within 4 s -> admin-open flow.
**Expected outcome:** Panel opens for staff; gesture invisible to guests.
**Acceptance criteria:**
- Given 4 taps then a 5 s pause then 1 tap, then the panel does NOT open.

### FR-126 - Cash health check before admin open
**Feature:** F-KIOSK-06    **Status:** Confirmed
**Description:** Before opening the panel, a cash health request runs; `errorImageUrl` in the response shows an ATP error dialog first.
**Preconditions:** Gesture completed. **Trigger:** Admin-open action.
**Expected behaviour:** 1. Fetch cash health. 2. Error image -> dialog. 3. No error or request failure -> open panel.
**Expected outcome:** Panel opens unless ATP reports a blocking image.
**Acceptance criteria:**
- Given a health response with `errorImageUrl`, when the gesture completes, then the dialog shows instead of the panel.

### FR-127 - ATP error dialog actions
**Feature:** F-KIOSK-06    **Status:** Confirmed
**Description:** The ATP error dialog shows the returned image and lets staff open the panel anyway or close it.
**Preconditions:** Dialog shown. **Trigger:** Open-anyway or close tap.
**Expected behaviour:** 1. Close -> dismiss, stay on screen. 2. Open -> dismiss + open panel.
**Expected outcome:** Staff can bypass or abort.
**Acceptance criteria:**
- Given the dialog, when open-anyway is tapped, then the admin panel opens.

### FR-128 - Printer status check per screen
**Feature:** F-KIOSK-07    **Status:** Confirmed
**Description:** With `printerEnabled` and not in maintenance, a printer status call runs each time the route CHANGES TO the welcome screen; the result updates printer availability. The printer-error notification is eligible to show while the guest is on the menu, order summary, order type, product search, loading or welcome screens. Retry constants `MaxRetryNumber` = 3 and `DelayIntervalMilliseconds` = 3,000 exist on the checker (the retry loop itself is not wired in the traced path — one call per navigation).
**Preconditions:** `printerEnabled` true; not in maintenance. **Trigger:** Navigation onto `/welcome`.
**Expected behaviour:** 1. Run status call. 2. Update printer status. 3. Error surfaced via notification on the listed screens.
**Expected outcome:** Printer problems surface via status/notifications.
**Acceptance criteria:**
- Given printer down, when the guest lands on welcome, then printer status reflects unavailable and the error can show on the listed screens.

### FR-129 - Scanner/cash/orientation checkers
**Feature:** F-KIOSK-07    **Status:** Confirmed
**Description:** Path-triggered and one-shot checkers keep device state current:
- Scanner: when `scannerEnabled` and not in maintenance, a scanner status call runs each time the route changes to `/welcome` or `/orderSummary`; a request timeout leaves the status unchanged, any other failure marks the scanner unavailable. The check is skipped when the HID keyboard scanner is enabled.
- Cash: once per app start, when `cashEnabled` and `cashReaderReady` is false, a cash-status refresh request is sent.
- Orientation: development builds only — an orientation listener restarts the app on orientation change; production kiosks cannot change orientation.
**Preconditions:** Mounted globally; flags as above. **Trigger:** Route change / first mount / orientation change (dev).
**Expected behaviour:** 1. Update availability state per rules.
**Expected outcome:** Downstream features see current device state (scan-dependent UI adapts).
**Acceptance criteria:**
- Given `scannerEnabled` and a failed status call (non-timeout), when the guest lands on welcome, then scanner is marked unavailable.
- Given `cashEnabled` with `cashReaderReady` false, when the app starts, then exactly one cash-status refresh is issued.

### FR-130 - Kiosk status reporting
**Feature:** F-KIOSK-07    **Status:** Confirmed
**Description:** The app reports kiosk status and key actions to the local backend: `POST /health/kiosk-app/status` carries a `KioskStatus` (`APPLICATION_STARTING`, `APPLICATION_START_FAILED`, `TRADING`, `UNAVAILABLE` with reason `MAINTENANCE`/`AT_CAPACITY`/`STORE_CLOSED`/`UNKNOWN` and category `APPLICATION_STATUS` or `DISPLAYING_SCREEN`); `POST /health/kiosk-app/track-key-action` carries a `KioskAction` (`START_JOURNEY_SUCCESS`, `START_JOURNEY_FAILED`, `APPLICATION_START_FAILED` with reason `FAILED_START_JOURNEY`/`FAILED_LOAD_MENU`/`FAILED_DOWNLOAD_TEMPLATE_SCRIPT_FILES`). Every report is also written to the local metrics log. Status is set to `TRADING` on successful config refresh and `UNAVAILABLE` on config failure; each failed request is logged and silently swallowed.
**Preconditions:** Config loaded. **Trigger:** Status/action change.
**Expected behaviour:** 1. Send the record. 2. Local log entry.
**Expected outcome:** Operators see kiosk health (no guest UI).
**Acceptance criteria:**
- Given a config refresh throws a maintenance error, then an `UNAVAILABLE`/`MAINTENANCE` status is posted.

### FR-131 - Terminal reporter (status terminals)
**Feature:** F-KIOSK-07    **Status:** Confirmed
**Description:** Component statuses (`monitoredComponent` + `requiresAttention` + message — e.g. `HELP_BUTTON` pressed/released, screen shown) are reported to configured status terminals: UDP-discovery terminals are found via UDP ports (default 9,837), strict-IP terminals via TCP (default 9,838), both sent through the desktop shell's status-terminal bridge. A failed report re-triggers terminal discovery. An incoming status for a different component is dropped while another component already requires attention.
**Preconditions:** `statusTerminals` configured; mounted. **Trigger:** Component-status change.
**Expected behaviour:** 1. Discover terminals per config (`UDP_DISCOVERY`/`STRICT` modes). 2. Report each component status.
**Expected outcome:** Operator devices (e.g. status boards) show kiosk attention state.
**Acceptance criteria:**
- Given the help button is pressed, then a `HELP_BUTTON` requires-attention status reaches the terminals.

### FR-132 - Trading check at journey start
**Feature:** F-KIOSK-08    **Status:** Confirmed
**Description:** Journey start runs the trading check first: maintenance -> maintenance screen; at-capacity -> at-capacity screen; closed kiosk -> lane closed (if shown). Any failure aborts the start.
**Preconditions:** Attract visible. **Trigger:** Guest tap.
**Expected behaviour:** 1. Check flags in order. 2. Redirect or proceed.
**Expected outcome:** No order on a non-trading kiosk.
**Acceptance criteria:**
- Given maintenance mode, when the guest taps, then the maintenance screen shows and start rejects.

### FR-133 - Lane open/close transitions
**Feature:** F-KIOSK-08    **Status:** Confirmed
**Description:** A lane-close signal (POS lane state pushed through configuration, or an operator closing the lane) clears the session and routes to `/LaneClosed` (case-sensitive); a lane-open signal routes to `/welcome` on the single-brand path.
**Preconditions:** Lane state delivered via configuration/POS. **Trigger:** Lane state change.
**Expected behaviour:** 1. Close -> clear + `/LaneClosed`. 2. Open -> `/welcome`.
**Expected outcome:** Guest-facing state follows the lane.
**Acceptance criteria:**
- Given a close signal, when it arrives, then the lane-closed screen shows.

### FR-134 - Config-load error notification path
**Feature:** F-KIOSK-01    **Status:** Confirmed
**Description:** Language/branding setup failure shows a loading-configuration error with a retry action.
**Preconditions:** Branding load running. **Trigger:** Setup failure.
**Expected behaviour:** 1. Show error + retry option. 2. Retry re-runs setup.
**Expected outcome:** Recoverable config errors.
**Acceptance criteria:**
- Given a language setup failure, when the error shows, then retry restarts the setup.

### FR-135 - Background behaviours run on every screen
**Feature:** F-KIOSK-07    **Status:** Confirmed
**Description:** Language auto-reset, multi-brand language switching, the idle/inactivity manager, the device-status checkers and the stacked-notifications surface run continuously on every screen, not just specific pages.
**Preconditions:** App running. **Trigger:** Always active.
**Expected behaviour:** 1. These behaviours are live regardless of the current screen.
**Expected outcome:** Consistent global behaviour across the journey.
**Acceptance criteria:**
- Given any screen, then the idle timer and language reset are live.

### FR-136 - ATP hosting surface
**Feature:** F-KIOSK-09    **Status:** Confirmed
**Description:** ATP mode is enabled by the presence of `C:\comanda\config\kiosk-app-atp-config.json`. In ATP/production the window is frameless, non-resizable and non-maximizable. After load the app initializes the board service: `initialize()` returns board capabilities, then `applicationDidStart(windowHandle)` registers the app and `startHeartBeatScheduler()` begins the board heartbeat; an init failure is logged ("ATP failed to initialize"). The embedded wrapper HTTP server exposes `POST`/`GET /{ATP_BOARD_CALLBACK_PATH}/willappear` and `/willappear`, which bring the kiosk window to the front. `SIGTERM` closes the wrapper cleanly. The ATP error dialog on admin-panel open is covered by FR-127.
**Preconditions:** ATP config file present. **Trigger:** App launch / board callback.
**Expected behaviour:** 1. Board init + heartbeat. 2. willappear callbacks show the window.
**Expected outcome:** App runs hosted under the ATP board.
**Acceptance criteria:**
- Given a willappear callback, when it arrives, then the kiosk window is shown.

### FR-137 - Periodic kiosk-config re-check
**Feature:** F-KIOSK-08    **Status:** Confirmed
**Description:** A background manager re-fetches the kiosk configuration every 45,000 ms, but only while the template is loaded and the guest is on a gate screen (the root screen, Lane Closed, Maintenance or At Capacity). During the fetch interaction is disabled; a fetch lasting more than 1,000 ms shows the loading state. The new config is applied only while still on a gate screen; applying throws into the matching unavailable screen when the kiosk stops trading, or returns to the root page when it becomes available mid-closed-state. A fetch error is logged and retried on the next tick.
**Preconditions:** Template loaded. **Trigger:** 45 s interval tick.
**Expected behaviour:** 1. Poll config. 2. Gate-screen check. 3. Apply or defer. 4. Error -> log, retry next tick.
**Expected outcome:** Kiosk flips between trading and closed states without restart; a guest on a closed screen is returned to the start screen when trading resumes.
**Acceptance criteria:**
- Given the guest sits on Lane Closed, when the next 45 s poll returns a trading kiosk, then the app navigates back to the root screen.
- Given the guest is mid-journey on `/home`, when a poll returns maintenance, then nothing changes until the guest returns to a gate screen (deferred apply).

## A02 START — Attract screen, brand selection, language selection, order type

### FR-201 - Attract screen renders after configuration
**Feature:** F-START-01    **Status:** Confirmed
**Description:** When a single-brand kiosk finishes loading configuration, it navigates to `/welcome` and shows the attract screen; when a multi-brand kiosk finishes, it navigates to `/MultiBrandPage` instead.
**Preconditions:** Kiosk configuration loaded successfully.
**Trigger:** Configuration load completes (app start, session reset, or brand selection).
**Expected behaviour:**
1. more than one brand configured -> route `/MultiBrandPage`; otherwise route `/welcome`.
2. On `/welcome` show the template-resolved welcome variant (SCR-START-01).
3. Analytics screen view `welcome_page` / `multi_brand_page` is sent for the shown screen.
**Expected outcome:** Guest sees the attract screen (or brand picker) ready for input.
**Acceptance criteria:**
- Given a kiosk with 1 brand, when config finishes loading, then `/welcome` is displayed.
- Given a kiosk with 2+ brands, when config finishes loading, then `/MultiBrandPage` is displayed.

### FR-202 - Tap on attract screen starts the journey
**Feature:** F-START-01    **Status:** Confirmed
**Description:** A tap (or key press on variants that handle key presses) anywhere on the attract area starts the ordering journey.
**Preconditions:** `/welcome` displayed, the kiosk accepting input true.
**Trigger:** Click/tap or key press on the attract area (or on the explicit start button where one exists — "Tap here to get started" / "Start your order").
**Expected behaviour:**
1. Trading check runs first (FR-203); on pass, journey start runs (FR-241).
2. Event propagation is stopped so the tap cannot trigger parent handlers.
**Expected outcome:** Journey starts exactly once per gesture.
**Acceptance criteria:**
- Given the attract screen is shown and interaction is enabled, when the guest taps it, then the journey-start sequence runs.
- Given the kiosk accepting input is false, when the guest taps, then nothing happens.

### FR-203 - Non-trading kiosk blocks journey start
**Feature:** F-START-10    **Status:** Confirmed
**Description:** The start action first checks whether the kiosk can trade and redirects instead of starting when it cannot.
**Preconditions:** Any state of the kiosk.
**Trigger:** Journey start invoked (attract tap, Continue button, cocoa language-start, carousel tap on multi-brand page for the trading-gated variant).
**Expected behaviour:**
1. Maintenance mode -> navigate to the maintenance screen; start rejected.
2. At-capacity mode -> navigate to the at-capacity screen; start rejected.
3. All order types unavailable across brands (closed kiosk, BR-START-10) -> navigate to Lane Closed when configured to show it; start rejected.
4. Otherwise -> proceed.
**Expected outcome:** Guest can never start an order on a non-trading kiosk.
**Acceptance criteria:**
- Given the kiosk is in maintenance mode, when the guest taps the attract screen, then the maintenance screen is shown and no order is created.
- Given every brand is closed, when the guest taps, then the Lane Closed screen is shown (when its visibility rules allow).

### FR-204 - Version and location identifiers are displayed
**Feature:** F-START-01    **Status:** Confirmed
**Description:** The attract and multi-brand screens render the app version and the active location id (or kiosk id on the multi-brand page) as small text.
**Preconditions:** Screen rendered.
**Trigger:** Screen renders.
**Expected behaviour:**
1. Version string shown on all welcome variants and the multi-brand page.
2. Active `locationId` shown on welcome variants; kiosk id on the multi-brand page.
3. On the multi-brand page both are hidden while the attract carousel covers the screen; on the multi-brand welcome page both are shown only when the nav bar is hidden (<2 brands).
**Acceptance criteria:**
- Given `/welcome`, then version and location id are visible on screen.

### FR-205 - Loading overlays during start-area transitions
**Feature:** F-START-01    **Status:** Confirmed
**Description:** A full-screen loading overlay covers the screen while configuration, branding or language packs load.
**Preconditions:** A load is in progress.
**Trigger:** A config, branding or language load starts.
**Expected behaviour:**
1. Shown while configuration loading (and loading/languages loading/branding load on the variants that check them).
2. Hidden when loading completes.
**Acceptance criteria:**
- Given branding reload is in progress after selecting a brand, then a full-screen loader covers the brand grid.

### FR-206 - Carousel media rotation
**Feature:** F-START-02    **Status:** Confirmed
**Description:** Background media rotates automatically behind the attract screen and multi-brand selector.
**Preconditions:** Carousel media configured.
**Trigger:** Screen with a carousel renders or a slide finishes.
**Expected behaviour:**
1. Media entries without `url` are dropped; remaining entries are filtered to those active at the current local time (BR-START-05).
2. Each slide shows for its configured `duration` ms, default 7,000 ms.
3. Videos (`.mp4`/`.webm`/`.ogg` by `id` query param or URL) autoplay muted, loop, and the slide lasts the video duration (fallback 7,000 ms).
4. Media that fails to load is skipped; if all fail, no background is rendered.
5. With <2 media no rotation timer runs; the first slide shows without transition animation.
6. Media with `altText` is focusable and announced by accessibility navigation; without `altText` it is skipped by focus.
**Acceptance criteria:**
- Given 3 active images with no durations, when the screen shows, then each displays ~7 s in order and loops.
- Given an image fails to load, when its turn comes, then it is skipped.
- Given all media fail, when the screen renders, then children (tap area, language button) still render with no background.

### FR-207 - Carousel time-window and fallback image
**Feature:** F-START-02    **Status:** Confirmed
**Description:** Only media inside their configured `timeStart`–`timeEnd` window plays; with none active a default background image is used.
**Preconditions:** Carousel media configured.
**Trigger:** The media list is computed.
**Expected behaviour:**
1. Window check uses the device's current local time as a 24-hour string; `timeStart > timeEnd` means the window spans midnight.
2. Media lacking either bound is always active.
3. Zero active media -> cocoa picks the default background image matching the screen ratio (`9_16`, `16_9`, `3_2`); carousel/costa variants use `branding.backgroundImage`; if none exists, no background.
**Acceptance criteria:**
- Given a media with `timeStart` "22:00" and `timeEnd` "06:00", when current time is 23:00, then it is active; at 12:00 it is not.
- Given no media is active and a default background image exists, then the default image is shown as a single static slide.

### FR-208 - Attract tap on multi-brand carousel gated by trading
**Feature:** F-START-05    **Status:** Confirmed
**Description:** On the default multi-brand page, tapping the attract carousel hides it for 60 s — but only when the kiosk is trading; the itsu variant hides it unconditionally.
**Preconditions:** `multiBranding.carousel` has active media.
**Trigger:** Guest taps the carousel overlay.
**Expected behaviour:**
1. Default variant: trading check runs (FR-203 rules; may navigate to Lane Closed/maintenance instead); if trading, carousel hides and a 60 s timer re-shows it; leaving the screen cancels the timer.
2. The nav-bar back/cancel button re-shows the carousel immediately and cancels the timer.
3. itsu variant: tap hides carousel for 60 s with no trading check; "x cancel" re-shows it.
**Acceptance criteria:**
- Given the multi-brand page with an active carousel, when the guest taps it (kiosk trading), then the brand grid is revealed and the carousel returns after 60 s without input.
- Given the kiosk is closed, when the guest taps the default-variant carousel, then it does not hide (closed-state navigation may occur instead).

### FR-209 - Closed brand cells on multi-brand selector
**Feature:** F-START-05    **Status:** Confirmed
**Description:** Each brand cell reflects the brand's open/ready state.
**Preconditions:** Multi-brand selector rendered.
**Trigger:** Screen renders or guest taps a cell.
**Expected behaviour:**
1. Cell button disabled when the brand is neither open nor ready.
2. Closed brands show an info icon and "Sorry, we're closed" (`multibrand.storeClosed`).
3. Selecting requires the brand to be open AND ready AND the kiosk accepting input true — otherwise nothing happens.
4. Grid layout classes switch at <4 / 4–6 / ≥7 brands and enlarge in accessibility mode.
**Acceptance criteria:**
- Given a closed brand, when the guest taps its cell, then nothing happens and the closed message is shown.
- Given an open ready brand, when the guest taps it, then that brand's configuration loads and `/welcome` (or journey start, BR-START-14) follows.

### FR-210 - Language button visibility
**Feature:** F-START-03    **Status:** Confirmed
**Description:** The language selector is shown only when the active brand offers more than one supported language.
**Preconditions:** Screen hosting the language selector renders.
**Trigger:** Screen renders.
**Expected behaviour:**
1. Button (and overlay entry point) hidden when supported languages ≤ 1.
2. cocoa order-type nav-bar usage can force the button visible regardless of count (a force-visible option).
**Acceptance criteria:**
- Given a brand with 1 language, when `/welcome` renders, then no language button is present.

### FR-211 - Language overlay contents and ordering
**Feature:** F-START-03    **Status:** Confirmed
**Description:** The overlay lists every supported language with the default language first.
**Preconditions:** Language overlay open.
**Trigger:** Overlay renders.
**Expected behaviour:**
1. Cells are sorted alphabetically by language name, with the configured default language pinned to the top (BR-START-02).
2. Each cell shows the language name and the greeting for that code (`languageSelector.hello.<code>` on plain variants).
3. The currently active language is marked selected (tick/highlight).
**Acceptance criteria:**
- Given default "en-gb" and languages [fr, en-gb, de], when the overlay opens, then order is en-gb, de, fr and en-gb is marked.

### FR-212 - Selecting a language switches the UI
**Feature:** F-START-03    **Status:** Confirmed
**Description:** Choosing a different language loads its localization pack and applies it app-wide.
**Preconditions:** None.
**Trigger:** As described.
**Expected behaviour:**
1. Overlay closes immediately; a loading overlay shows while the pack loads (and languages-loading state is flagged).
2. On success the language code and localization are stored; the page `lang` attribute and `dir` (`rtl`/`ltr`) are updated (via the multi-brand switcher and equivalent handling).
3. `language_selected` analytics event fires with `language_selected`, `previous_language` and the screen name that preceded the language overlay.
4. Re-selecting the active language is a no-op (early exit before any request).
5. Loaded packs are cached in memory for the session.
**Expected outcome:** All subsequent screens and texts render in the new language.
**Acceptance criteria:**
- Given the guest picks a different language, when the pack loads, then all UI text switches and `language_selected` fires once.
- Given the guest picks the current language, then no reload occurs and no event fires.

### FR-213 - Language change failure shows retry
**Feature:** F-START-03    **Status:** Confirmed
**Description:** If the language pack cannot be loaded, an error notification with a "Start Over" button appears; pressing it retries the same change. `change_language_error` analytics fires with the attempted language, previous language and the error.
**Acceptance criteria:**
- Given the language request fails, when the notification appears, then pressing "Start Over" retries loading that language.

### FR-214 - Overlay close paths
**Feature:** F-START-03    **Status:** Confirmed
**Description:** Tapping the dimmed background, the X button (plain overlay), or a language cell closes the overlay; keyboard focus is trapped inside while open (plain overlay).
**Acceptance criteria:**
- Given the overlay is open, when the guest taps outside the dialog, then it closes with no change.

### FR-215 - Cocoa language-changed confirmation
**Feature:** F-START-03    **Status:** Confirmed
**Description:** On the cocoa template, picking a new language shows a confirmation dialog ("{greeting}" + check icon + "Language updated") that auto-dismisses ~2 s after loading finishes.
**Preconditions:** None.
**Trigger:** As described.
**Expected behaviour:**
1. Dialog appears only when the selected language differs from the current one.
2. While the pack loads, a spinner is shown inside the dialog; the 2 s countdown starts when loading completes.
3. On dismiss: with a caller callback and auto-hide disabled, the callback runs with `languageChanged: true`; on `/welcome` that starts the journey and marks `started_by = language_selector`; on `/orderType` it reloads the menu. Otherwise the dialog simply hides.
**Acceptance criteria:**
- Given cocoa `/welcome` and a different language chosen, when the pack finishes loading, then the dialog shows ~2 s and the journey starts.
- Given the same language chosen, when the cell is tapped, then the overlay closes and no dialog/callback fires.

### FR-216 - Single-brand 30 s language reset on the attract screen
**Feature:** F-START-04    **Status:** Confirmed
**Description:** On single-brand kiosks, a language chosen on `/welcome` reverts to the default after 30 s.
**Preconditions:** Single-brand kiosk; guest changed language on `/welcome`.
**Trigger:** 30 s elapse after the language change.
**Expected behaviour:**
1. The first language observed is remembered as the default.
2. When the active language differs from the default and the reset manager is enabled (on `/welcome`, single-brand), a 30 s timer starts; on expiry the language silently resets.
3. Off `/welcome` or on multi-brand kiosks the timer is disabled; when re-enabled with a non-default language active, the reset happens immediately.
4. Reset failures are logged only (no notification, no analytics).
**Acceptance criteria:**
- Given the guest switched to French on `/welcome` and does nothing, after 30 s the UI is back in the default language.

### FR-217 - Multi-brand page forces kiosk default language
**Feature:** F-START-04    **Status:** Confirmed
**Description:** Whenever the app is on `/MultiBrandPage` (and not loading branding), the language is forced to the kiosk-level `defaultLanguage`; the active language and `dir` (`rtl`/`ltr`) are written to the document element.
**Acceptance criteria:**
- Given a brand whose default is French was selected then the session reset to `/MultiBrandPage` (kiosk default English), then the UI is in English on the selector.

### FR-218 - Accessibility toggle in language overlay (legacy)
**Feature:** F-START-03    **Status:** Confirmed
**Description:** The legacy language overlay includes an accessibility-mode toggle button; toggling fires `accessibility_mode` analytics and switches the mode.
**Acceptance criteria:**
- Given the legacy overlay open, when the guest taps the accessibility button, then accessibility mode flips and `accessibility_mode` fires with the new state and current screen name.

### FR-219 - Brand selection loads the brand
**Feature:** F-START-05    **Status:** Confirmed
**Description:** Selecting an open, ready brand loads its template, theme, CSS, default language and sets it active, then navigates per BR-START-14.
**Preconditions:** None.
**Trigger:** As described.
**Expected behaviour:**
1. Analytics location id and log location id are set to the brand's `locationId`; the kiosk `channelId` is applied when present.
2. Brand default language is set up (falls back to kiosk `defaultLanguage` when the brand has none; neither present -> maintenance-mode error).
3. On success route `/welcome` — or run journey start directly when the welcome template is the multi-brand language page and the brand has <2 languages.
4. On failure the whole branding load retries every 5 s; language-setup failure shows the loading-configuration error with a retry action.
**Acceptance criteria:**
- Given two brands, when the guest taps brand B, then B becomes the active brand and `/welcome` shows B's welcome screen.

### FR-220 - Multi-brand page is the reset destination
**Feature:** F-START-05    **Status:** Confirmed
**Description:** Ending or resetting a session on a multi-brand kiosk returns to `/MultiBrandPage` and clears the active brand configuration (plus order/session state and email/notification forms).
**Acceptance criteria:**
- Given a finished or reset journey on a multi-brand kiosk, then the app is on `/MultiBrandPage` with no active brand selected.

### FR-221 - Multi-brand carousel activation
**Feature:** F-START-05    **Status:** Confirmed
**Description:** The multi-brand attract overlay appears only when `multiBranding.carousel` has media currently inside its time window (same rules as F-START-02).
**Acceptance criteria:**
- Given multi-brand carousel media all outside their windows, when `/MultiBrandPage` renders, then the brand grid is immediately visible.

### FR-222 - Order type list content and order
**Feature:** F-START-07    **Status:** Confirmed
**Description:** Only `DINEIN` and `TAKE_OUT` may appear as order types, `DINEIN` always listed first.
**Preconditions:** Brand restaurant config loaded.
**Trigger:** The order-type list is computed.
**Expected behaviour:**
1. The restaurant's configured `orderTypes` are filtered to exactly `DINEIN`/`TAKE_OUT` and sorted `DINEIN` before `TAKE_OUT`.
2. One button is rendered per remaining type; labels per template (SCR-START-05).
**Acceptance criteria:**
- Given `orderTypes` ["TAKE_OUT","DINEIN","DELIVERY"], then exactly two buttons render, "Eat In" first, and DELIVERY never appears.

### FR-223 - Order type screen shown conditionally
**Feature:** F-START-07    **Status:** Confirmed
**Description:** `/orderType` is shown during journey start only when the restaurant offers >1 filtered order type OR the brand offers >1 language OR loyalty is enabled. Otherwise the first order type is applied silently and the flow continues.
**Acceptance criteria:**
- Given 1 order type, 1 language, loyalty off, when the journey starts, then `/orderType` is never shown and `service_selected` still fires with the default type.
- Given loyalty enabled with 1 order type and 1 language, when the journey starts, then `/orderType` IS shown (it doubles as the loyalty prompt screen).

### FR-224 - Selecting an order type
**Feature:** F-START-07    **Status:** Confirmed
**Description:** Tapping an order-type button stores it on the order, filters the menu, and advances.
**Preconditions:** None.
**Trigger:** As described.
**Expected behaviour:**
1. `service_selected` analytics fires with `service_type` = chosen type.
2. The order's `orderType` is updated (creating the order from config if absent, using default when no type passed).
3. The previously loaded menu is filtered to the chosen order type and entities are reloaded.
4. Routing: guest not signed in AND pre-basket sign-in supported -> loyalty logging page; else menu destination per BR-START-20.
**Acceptance criteria:**
- Given the guest taps "Take Away", then the order's order type is `TAKE_OUT`, `service_selected` carries `TAKE_OUT`, and the menu shows only take-away content.

### FR-225 - Default order type
**Feature:** F-START-07    **Status:** Confirmed
**Description:** When no order type is chosen explicitly (screen skipped or auto-advance), the order uses the first filtered order type; if the list is empty the default is `DINEIN`.
**Acceptance criteria:**
- Given order types [TAKE_OUT] only, when the journey starts, then the order's type is `TAKE_OUT`.

### FR-226 - Back from the order type screen
**Feature:** F-START-07    **Status:** Confirmed
**Description:** Back behaviour depends on the welcome template and language count.
**Preconditions:** On `/orderType`.
**Trigger:** Guest presses back/cancel/close.
**Expected behaviour:**
1. Welcome template is the multi-brand language page AND brand has >1 language -> navigate to `/welcome` (keeps session).
2. Otherwise -> session reset (the session reset): journey-end analytics, session reset call, navigation to root screen (`/MultiBrandPage` on multi-brand, `/welcome` otherwise), brand config cleared on multi-brand.
**Acceptance criteria:**
- Given a multi-branch kiosk with 2 languages on `/orderType`, when the guest goes back, then the multi-brand language page shows.
- Given a single-brand cocoa kiosk on `/orderType`, when the guest goes back, then the session resets to `/welcome`.

### FR-227 - Multi-brand welcome page skipped for single-language brands
**Feature:** F-START-06    **Status:** Confirmed
**Description:** When the welcome template is the multi-brand language page and the selected brand has <2 supported languages, the welcome screen is bypassed and the journey starts immediately after branding loads.
**Acceptance criteria:**
- Given a multi-branch kiosk and a 1-language brand, when the guest selects that brand, then `/welcome` is never shown and journey start runs.

### FR-228 - Cocoa order-type screen extras
**Feature:** F-START-07    **Status:** Confirmed
**Description:** The cocoa order-type screen composes header banner image, title, order-type buttons, loyalty banner (F-START-08), admin panel button, serial scanner listener (Avolta only), and a footer or nav bar with back/language/accessibility controls.
**Preconditions:** Cocoa template; on `/orderType`.
**Trigger:** Screen renders or language changed.
**Expected behaviour:**
1. Title "What service would you like today?".
2. Navigation bar (back + accessibility + force-shown language selector) is used when Avolta is enabled OR `KIOSK_THEMING` is active; otherwise a footer with language button (>1 language) + accessibility button.
3. Changing language on this screen reloads the menu in the new language.
**Acceptance criteria:**
- Given a theming-enabled cocoa kiosk, when `/orderType` shows, then a nav bar with back, accessibility and language controls is present.

### FR-229 - Themed order type buttons (KIOSK_THEMING)
**Feature:** F-START-07    **Status:** Confirmed
**Description:** Under the `KIOSK_THEMING` feature, custom images (`eatInImage`, `takeAwayImage`) replace the default icons and `orderTypeButtonsDirection` (`row`|`column`) controls layout.
**Preconditions:** `KIOSK_THEMING` feature enabled.
**Trigger:** Order-type buttons render.
**Expected behaviour:**
1. Explicit `orderTypeButtonsDirection` wins; absent it, a custom image present => `column`; else default `row`.
2. Custom image alt text falls back to the button label when no translated alt exists.
3. Without the feature, icons and default (row) layout are always used.
**Acceptance criteria:**
- Given theming on with `takeAwayImage` set and no direction, then buttons stack vertically and the take-away card shows the image.

### FR-230 - Auto-select single order type after sign-in (cocoa)
**Feature:** F-START-07    **Status:** Confirmed
**Description:** On cocoa, when the logged-in confirmation becomes visible and only one order type exists, the order type is applied automatically without a tap.
**Acceptance criteria:**
- Given a cocoa kiosk with only DINEIN and the guest just signed in on `/orderType`, then the flow proceeds without the guest tapping Eat In.

### FR-231 - Loyalty banner visibility on order type screen
**Feature:** F-START-08    **Status:** Confirmed
**Description:** The cocoa order-type screen shows a loyalty sign-in banner under provider-specific rules.
**Preconditions:** Cocoa template; on `/orderType`.
**Trigger:** Screen renders.
**Expected behaviour:**
1. NST_YOYO loyalty -> never shown.
2. Accesso (Merlin) loyalty -> never shown.
3. Avolta brand -> shown iff the Avolta screen gate allows; serial scanner listener mounted.
4. Multi-sign-in style enabled -> shown iff `supportsPreBasketSignin` AND loyalty enabled.
5. Legacy style -> shown iff loyalty enabled AND (scanner available OR a reward barcode already on the order); rendered inline in scan-only mode.
**Acceptance criteria:**
- Given an Accesso loyalty kiosk, when `/orderType` shows, then no loyalty banner is rendered.
- Given a legacy Punchh kiosk with a working scanner and loyalty on, when `/orderType` shows, then the inline scan banner is rendered.

### FR-232 - Pre-basket sign-in routing
**Feature:** F-START-08    **Status:** Confirmed
**Description:** After an order type is chosen, an unsigned guest is routed to the loyalty logging page when the brand supports pre-basket sign-in (`authConfig.loyaltySettings.supportsPreBasketSignin`); signed-in guests (or unsupported configs) go to the menu destination.
**Acceptance criteria:**
- Given pre-basket sign-in supported and no signed-in user, when the guest taps an order type, then the loyalty logging page opens instead of the menu.

### FR-233 - Logged-in overlay on order type screen
**Feature:** F-START-08    **Status:** Confirmed
**Description:** On cocoa, the "logged in" confirmation overlay (2,000 ms) is mounted only when more than one order type exists (with one type the screen auto-advances per FR-230 instead).
**Acceptance criteria:**
- Given two order types and a completed sign-in, then a 2 s logged-in overlay shows before the guest picks.

### FR-234 - Analytics: journey start events
**Feature:** F-START-10    **Status:** Confirmed
**Description:** Journey start fires `journey_started` (with `journey_start_time` and `started_by` = `attract_screen`|`language_selector`) and `session_start` (with `session_id`/`user_id` = journey start timestamp).
**Preconditions:** Journey start running.
**Trigger:** Journey start runs.
**Expected behaviour:**
1. `started_by` defaults to `attract_screen` when nothing set it.
2. Picking a language on cocoa `/welcome` sets it to `language_selector`.
3. Session timer (`session_time`) starts at journey start.
**Acceptance criteria:**
- Given an attract tap, then `journey_started` fires once with `started_by = attract_screen` before the menu appears.

### FR-235 - Analytics: screen views
**Feature:** F-START-01    **Status:** Confirmed
**Description:** Screen-view analytics use these names: `welcome_page` (`/welcome`), `multi_brand_page` (`/MultiBrandPage`), `eat_in_or_out_page` (`/orderType`), `language_selection_page` (while the language overlay is open).
**Acceptance criteria:**
- Given navigation to `/orderType`, then a screen view with name `eat_in_or_out_page` is recorded.

### FR-236 - Journey start backend notification
**Feature:** F-START-10    **Status:** Confirmed
**Description:** A non-blocking `journeyStarted` request (location id + order nonce) is sent to the local kiosk backend at journey start; its `journeyStartedTimestamp` is stored unless the order already has one; failures are logged and reported to telemetry without blocking the guest.
**Acceptance criteria:**
- Given the backend is unreachable, when the guest taps the attract screen, then the journey still proceeds to the menu (start-journey failure is non-blocking).

### FR-237 - Brand availability derived from order types
**Feature:** F-START-05    **Status:** Confirmed
**Description:** Before the trading check, `isDineInAvailable`/`isTakeOutAvailable` false removes that order type from each brand; a brand left with zero order types is marked `isOpen = false`; all brands closed => closed kiosk.
**Acceptance criteria:**
- Given a brand with `isTakeOutAvailable` false and orderTypes [TAKE_OUT], then that brand renders closed on the selector.

### FR-238 - Active-location recovery on welcome
**Feature:** F-START-01    **Status:** Confirmed
**Description:** On mounting/updating the welcome screen (default + costa variants), if the active location id is missing the app returns to the root route; if it does not match any configured brand, the first configured brand is loaded automatically.
**Acceptance criteria:**
- Given `/welcome` with an active location id not in the configured brands, then the first brand's configuration is loaded.

### FR-239 - Welcome dialog appears on headphone plug
**Feature:** F-START-09    **Status:** Confirmed
**Description:** A NavPed headphone-plugged key event starts the screen reader, records headphone state, and shows the welcome message dialog (SCR-START-07); unplug or plug events control its visibility via the same flag.
**Acceptance criteria:**
- Given headphones are plugged in on any screen, then the audio-navigation welcome dialog is presented.

### FR-240 - Welcome dialog content and dismissal
**Feature:** F-START-09    **Status:** Confirmed
**Description:** The dialog shows the title "Welcome to the text to speech kiosk experience", the instructional body text (default English quoted in SCR-START-07 / business rules), and a single "Continue" button that dismisses it.
**Acceptance criteria:**
- Given the dialog is open, when the guest presses Continue, then it closes and the underlying screen is usable.

### FR-241 - Journey start sequence
**Feature:** F-START-10    **Status:** Confirmed
**Description:** Ordered steps executed by the start action (see F-START-10).
**Preconditions:** None.
**Trigger:** As described.
**Expected behaviour:**
1. Trading check (FR-203) — abort on failure.
2. Session timer starts; new empty order created (fresh nonce, default order type) and stored.
3. `journeyStarted` backend call dispatched (non-blocking, FR-236); analytics session id = order nonce.
4. Journey-start timestamp recorded; `journey_started` + `session_start` fire (FR-234).
5. Menu loaded (blocking); entities reset and loaded.
6. `journeyStartSuccess` kiosk-status telemetry recorded.
7. Order-type decision (FR-223): show `/orderType` or apply default type silently (FR-224 steps 1–4).
**Acceptance criteria:**
- Given a trading kiosk, when start runs, then steps 1–7 execute in order and the guest lands on `/orderType` or the menu destination.

### FR-242 - Order creation at journey start
**Feature:** F-START-10    **Status:** Confirmed
**Description:** An empty order is created at tap time (not at order-type choice) so it exists for loyalty searches and order-type-screen flows; it carries the default order type and a new nonce.
**Acceptance criteria:**
- Given the attract tap, then an order with a fresh nonce and the default order type exists before `/orderType` renders.

### FR-243 - Multi-branch order type page composition
**Feature:** F-START-07    **Status:** Confirmed
**Description:** The multi-branch order-type page shows brand logo, the default order-type cells and the shared QSR bottom navigation bar.
**Acceptance criteria:**
- Given a multi-branch kiosk on `/orderType`, then logo, order type buttons and the QSR nav bar are all visible.

## A03 MENU — Menu browsing and item customisation

### FR-301 - Menu fetched per brand and language
**Feature:** F-MENU-01    **Status:** Confirmed
**Description:** Menu comes from `GET /menu` on the local backend with the active brand's auth and the active language; response carries entities, currency, `showCategoriesPrice` and `customizedItemTags`.
**Preconditions:** Brand config + language set. **Trigger:** Journey start / language change.
**Expected behaviour:** 1. Request with auth + language headers. 2. Adapt payload. 3. Store full menu + per-order-type views.
**Expected outcome:** Menu available for browsing.
**Acceptance criteria:**
- Given a language change, when the menu reloads, then it is refetched in the new language and re-filtered.

### FR-302 - Order-type availability filtering
**Feature:** F-MENU-01    **Status:** Confirmed
**Description:** Entities and options unavailable under `serviceAvailability` (`dineInFlag`/`takeOutFlag`, default true) are removed for the chosen order type; emptied categories are removed; option groups are filtered recursively.
**Preconditions:** Order type chosen. **Trigger:** Menu filter at journey/order-type selection.
**Expected behaviour:** 1. Drop `serviceAvailability`-mismatched items and options. 2. Drop empty categories.
**Expected outcome:** Only orderable content shows.
**Acceptance criteria:**
- Given an item with `takeOutFlag` false, when TAKE_OUT is chosen, then the item never appears.

### FR-303 - Entity ordering
**Feature:** F-MENU-01    **Status:** Confirmed
**Description:** Categories, items, option groups and options render in `displayOrder` ascending.
**Preconditions:** Menu loaded. **Trigger:** Render.
**Expected behaviour:** 1. Sort by `displayOrder`.
**Acceptance criteria:**
- Given shuffled payload order, when rendered, then display order is respected.

### FR-304 - Category cells open levels
**Feature:** F-MENU-02    **Status:** Confirmed
**Description:** Tapping a category pushes it onto the breadcrumb and renders its children — another category level or the item view.
**Preconditions:** Category list shown. **Trigger:** Cell tap.
**Expected behaviour:** 1. Select entity; analytics (`select_item` for items / category-selection events). 2. If a single-item container, the child is the selected item for analytics.
**Expected outcome:** Next level shown.
**Acceptance criteria:**
- Given a category with items, when tapped, then the item/product level shows and selection analytics fire.

### FR-305 - Lazy rendering batches
**Feature:** F-MENU-02    **Status:** Confirmed
**Description:** Category/item lists render in batches of 60, extending on scroll.
**Preconditions:** >60 entities. **Trigger:** Scroll/lazy load.
**Expected behaviour:** 1. Show first 60. 2. Append next 60 on demand.
**Acceptance criteria:**
- Given 130 categories, when scrolled, then all render in batches.

### FR-306 - Entrance animation
**Feature:** F-MENU-02    **Status:** Confirmed
**Description:** On level change, cells clear, wait 200 ms, then slide in staggered 40 ms each (max 200 ms delay, first 25 cells only).
**Preconditions:** Level changes. **Trigger:** New entity list.
**Expected outcome:** Staggered reveal.
**Acceptance criteria:**
- Given a new level, when it renders, then the first ~25 cells animate in sequence.

### FR-307 - Back one level
**Feature:** F-MENU-13    **Status:** Confirmed
**Description:** Back pops the breadcrumb to the parent level or root list and clears the current item draft.
**Preconditions:** In a level > root or an item draft. **Trigger:** Back.
**Expected behaviour:** 1. Pop level. 2. Clear draft.
**Expected outcome:** Parent shown; unsaved choices lost.
**Acceptance criteria:**
- Given an open item draft, when Back pressed, then the draft is discarded and the parent level shows.

### FR-308 - Header content
**Feature:** F-MENU-02    **Status:** Confirmed
**Description:** Header shows selected category name (or generic title "Browse the menu"/"Product Search" when at root or search), subtitle text, and the wait-time line when set.
**Preconditions:** Screen rendered. **Trigger:** Render.
**Expected behaviour:** 1. Title = entity name or default text. 2. Wait-time message when configured.
**Acceptance criteria:**
- Given a kitchen wait time, when the menu shows, then the wait message appears under the header.

### FR-309 - Cocoa nav-bar controls on menu screens
**Feature:** F-MENU-02    **Status:** Confirmed
**Description:** Cocoa menu shows bottom navigation: Review Order, reset order, accessibility; plus gift-card purchase banner when configured, loyalty banner per screen gate, SCO scan banner when `scoModeEnabled`.
**Preconditions:** Cocoa template. **Trigger:** Render.
**Expected outcome:** Controls visible per config.
**Acceptance criteria:**
- Given `giftCardPurchaseSettings` configured and not on the item screen, then the purchase banner shows.

### FR-310 - Item cells show minimum price
**Feature:** F-MENU-03    **Status:** Confirmed
**Description:** Cell price = base price + cheapest required selections (forced groups), excluding COMBO_MAIN; "from" pricing when `showFromPrice`; `servicePriceOverride` per order type applied.
**Preconditions:** Item rendered. **Trigger:** Render.
**Expected outcome:** Price is the lowest real cost.
**Acceptance criteria:**
- Given an item with a required 1-of-3 group (5/7/9), when the cell renders, then it shows base+5 (or "from" that).

### FR-311 - Image failure placeholder
**Feature:** F-MENU-03    **Status:** Confirmed
**Description:** Failed/missing images render a placeholder — cocoa generates a tile from the item name's initial.
**Preconditions:** Image URL fails. **Trigger:** Load error.
**Expected outcome:** No broken-image UI.
**Acceptance criteria:**
- Given a 404 image, when it fails, then the placeholder shows.

### FR-312 - Category removal when empty
**Feature:** F-MENU-01    **Status:** Confirmed
**Description:** A category left with zero available children after order-type filtering is removed entirely.
**Acceptance criteria:**
- Given a category whose items are all dine-in only, when TAKE_OUT is selected, then the category does not render.

### FR-313 - Item add without options
**Feature:** F-MENU-04    **Status:** Confirmed
**Description:** An item with no visible required options adds straight to the order (confirming the draft and firing the added overlay).
**Preconditions:** Item `requiresOptions` false. **Trigger:** Add tap.
**Expected behaviour:** 1. Add draft. 2. Confirm -> overlay.
**Expected outcome:** Item in order.
**Acceptance criteria:**
- Given a simple item, when tapped, then it lands in the order and the added overlay shows.

### FR-314 - Default variant pre-selection
**Feature:** F-MENU-04    **Status:** Confirmed
**Description:** Multi-child items pre-select `defaultEntity` or the first child.
**Preconditions:** Multi-child item open. **Trigger:** Screen render.
**Acceptance criteria:**
- Given a configured default child, when the screen opens, then it is selected.

### FR-315 - Button reflects next step
**Feature:** F-MENU-04    **Status:** Confirmed
**Description:** Main button: "Add to Order {total}" (no options), "Continue" (options exist), disabled "Add to Order" with explanatory aria text when no variant selected.
**Acceptance criteria:**
- Given an item with option groups, when selected, then the button reads "Continue".

### FR-316 - Default option pre-selection rules
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** Group `defaultOption` is pre-selected unless it carries nested modifiers; options with `defaultQuantity` > 0 are pre-selected at that quantity when the group uses default quantities; combo main is auto-selected to the menu default.
**Acceptance criteria:**
- Given a default option with a required nested group, when the group opens, then it is NOT pre-selected.

### FR-317 - Auto-advance to options
**Feature:** F-MENU-04    **Status:** Confirmed
**Description:** With the `ITEM_WITH_OPTIONS` auto-advance rule enabled, selecting an item that has options goes straight into the options screen without pressing Continue.
**Acceptance criteria:**
- Given the rule on, when an option-bearing item is picked, then the modifiers screen opens directly.

### FR-318 - Minimum price composition
**Feature:** F-MENU-03    **Status:** Confirmed
**Description:** `getMinimumPrice` = base + sum over forced groups (min==max>0) of the cheapest N required picks (or default-option baseline under `DEFAULT_SELECTION_PRICING_MODEL`); `SURCHARGE` groups excluded from forced-combo pricing; `COMBO_MAIN` excluded (price inside base).
**Acceptance criteria:**
- Given a forced 2-of-4 group (1/3/5/7), then it contributes 1+3 to the minimum price.

### FR-319 - Service price override
**Feature:** F-MENU-03    **Status:** Confirmed
**Description:** `servicePriceOverride` supplies a per-order-type price replacing the base price everywhere it is shown.
**Acceptance criteria:**
- Given a take-out override, when TAKE_OUT, then the overridden price displays.

### FR-320 - Item fields surfaced in UI
**Feature:** F-MENU-03    **Status:** Confirmed
**Description:** Cells/details may show: name/`shortName`, description, image, `calories`, `itemLabels` chips, Popular badge, price/from-price, barcodes (SCO), `ageRestriction`/`verificationAge` (notice), `taxes`.
**Acceptance criteria:**
- Given `calories` "500", then "{500} kcal" renders where the template shows calories.

### FR-321 - Item-label chips
**Feature:** F-MENU-05    **Status:** Confirmed
**Description:** `itemLabels` codes render as chips on the cocoa product info, translated via `itemLabel.<code>` with English fallback names; the section announces the label names.
**Acceptance criteria:**
- Given labels ["glt"], when product info renders, then a chip with the translated label shows.

### FR-322 - Customized item tags
**Feature:** F-MENU-05    **Status:** Confirmed
**Description:** `customizedItemTags` render badges (custom colours; defaults red bg/white text when colours empty) on items/categories, filtered to `tagsPages` (`ITEM_MENU`/`ITEM_PAGE`/`BASKET`; absent = everywhere) and schedules (`scheduleEnabled` dates, `advancedScheduleEnabled` weekly hours).
**Acceptance criteria:**
- Given a tag with `tagsPages` ["ITEM_PAGE"], when on the menu grid, then the badge does NOT render.
- Given a tag shown, then `item_tag_impression` fires once per item with tag id/name/location.

### FR-323 - Calorie and allergen display
**Feature:** F-MENU-06    **Status:** Confirmed
**Description:** Calories show as "{n} kcal" on cells/options where present; shakeshack renders an AllergenInfo block ("Need Allergen Info?") with a QR link or speak-to-team text; itsu shows allergen text inline.
**Acceptance criteria:**
- Given shakeshack with allergen URL configured, when the item screen shows, then the QR allergen block renders.

### FR-324 - Nutritional disclaimer banner
**Feature:** F-MENU-06    **Status:** Confirmed
**Description:** When the restaurant enables the disclaimer feature, a banner shows "Nutrition & Allergen Information" plus the 2,000-calorie advice text at the menu level.
**Acceptance criteria:**
- Given the feature off, when the menu renders, then no banner appears.

### FR-325 - Age-restriction notice before add
**Feature:** F-MENU-04    **Status:** Confirmed
**Description:** Adding an age-restricted item (`verificationAge`/`ageRestriction` > 0) without required options shows "You may need photo ID" with Cancel/Confirm; Confirm proceeds. For items with options, the check runs at option-confirmation instead. Once confirmed for the order, it is not re-asked.
**Acceptance criteria:**
- Given a restricted simple item and Cancel pressed, then nothing is added.

### FR-326 - Quantity stepper
**Feature:** F-MENU-10    **Status:** Confirmed
**Description:** Product quantity starts at 1 (decrement disabled at 1); increasing rebuilds the draft at N items; button totals multiply; spoken announcements fire on change.
**Acceptance criteria:**
- Given quantity 3 on a £4 item, then the button shows the £12 total.

### FR-327 - Option-level quantity
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** Options with `maximumQuantity` > 1 get a stepper (0..`maximumQuantity`, also bound by the group maximum); quantity 0 deselects.
**Acceptance criteria:**
- Given `maximumQuantity` 3, then up to 3 of that option can be selected.

### FR-328 - Single vs multi-select behaviour
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** `maximum` = 1: new selection replaces old. `maximum` > 1: options toggle; reaching the max disables further selection (cocoa) or drops the oldest (legacy). `maximum` 0/absent: unlimited.
**Acceptance criteria:**
- Given max 2 with 2 selected, when a third is tapped on cocoa, then it cannot be selected until one is removed.

### FR-329 - Supersede options
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** A `supersede` option, when selected, deselects and blocks all other options in its group; while one is selected other choices are disabled.
**Acceptance criteria:**
- Given a supersede selected, when another option is tapped, then it is blocked.

### FR-330 - Continue gating by minimum
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** Continue/Next is enabled only when the group's `minimum` selections are made (or the group is optional, or a supersede option is selected); label shows the running total.
**Acceptance criteria:**
- Given minimum 2 and 1 selected, then Continue is disabled.

### FR-331 - Forced-combo dynamic pricing
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** For groups where `minimum` == `maximum` > 0, each option displays its price minus the group's cheapest-required baseline (or default-option baseline under `DEFAULT_SELECTION_PRICING_MODEL`, which can produce negative "+/-" deltas).
**Acceptance criteria:**
- Given a 1-of-2 forced group priced 0 and 2, then the £2 option shows "+ £2".

### FR-332 - Invisible groups
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** A Standard group with `minimum` = 1, exactly 1 option and no nested options is never presented; its option is applied automatically. Cocoa additionally hides `INGREDIENTS`, `INGREDIENT_MODIFIERS`, `COMBO_MAIN` groups from the stepper.
**Acceptance criteria:**
- Given such a group, when the item is added, then no screen appears for it yet its option is on the item.

### FR-333 - Nested option groups
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** Selecting an option that owns `optionGroups` opens the nested-group screen (required nested must be completed; in combo context, optional nested is edited only from the review screen). "Customise" on a selected option reopens it. Back out of a required empty nested group unselects the parent option.
**Acceptance criteria:**
- Given an option with a required nested group, when backed out unselected, then the parent option is deselected.

### FR-334 - Required modifier derivation
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** `MODIFIERS` with `minimum` = `maximum` = 1 behaves as `REQUIRED-MODIFIER` — a mandatory single choice.
**Acceptance criteria:**
- Given min=max=1, then exactly one option must be picked to continue.

### FR-335 - Option group roles honoured
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** Roles `MODIFIERS`, `REQUIRED-MODIFIER`, `UPSELLS`, `INGREDIENTS`, `INGREDIENT_MODIFIERS`, `SURCHARGE`, `COMBO_MAIN` each route to their dedicated handling; `SURCHARGE` is excluded from forced-combo dynamic pricing.
**Acceptance criteria:**
- Given a SURCHARGE group, then it does not join cheapest-choice price math.

### FR-336 - Auto-advance on max selection
**Feature:** F-MENU-07    **Status:** Confirmed
**Description:** With the `OPTION_GROUP_MAX_SELECTION` auto-advance rule on, reaching the group's maximum auto-continues after ~200 ms.
**Acceptance criteria:**
- Given the rule on and max reached, then the next group shows without tapping Continue.

### FR-337 - Ingredient add/remove screen
**Feature:** F-MENU-08    **Status:** Confirmed
**Description:** "Customise {item}" / "Make it your own" lists ingredient groups with Add/Added toggles and price, composite options with positive/negative toggles ("Removed" labels), Reset (disabled until changed), Cancel and Save Changes.
**Acceptance criteria:**
- Given an ingredient tapped, then its button switches to "Added" and the change is announced ("{name} added").

### FR-338 - Composite toggle options
**Feature:** F-MENU-08    **Status:** Confirmed
**Description:** Composite `TOGGLE` options present positive/negative choices; `defaultChoice` (`POSITIVE`/`NEGATIVE`/none) pre-selects; negative picks are marked "Removed".
**Acceptance criteria:**
- Given a negative default, when the screen opens, then the negative option is pre-selected.

### FR-339 - Reset to defaults
**Feature:** F-MENU-08    **Status:** Confirmed
**Description:** Reset restores the item's default options and announces "Default options restored."; disabled while nothing is modified.
**Acceptance criteria:**
- Given modifications, when Reset pressed, then defaults return.

### FR-340 - Review screen contents
**Feature:** F-MENU-09/12    **Status:** Confirmed
**Description:** "Review your choices" lists the item + every selected option with quantity badges and computed line prices (negative deltas under `DEFAULT_SELECTION_PRICING_MODEL`), plus "Change main" (combos), "Customise" (nested), quantity stepper and "Add to Order {total}"/"Update Order {total}".
**Acceptance criteria:**
- Given an editing flow, then the button reads "Update Order {total}".

### FR-341 - Combo main is auto-selected and editable via modal
**Feature:** F-MENU-09    **Status:** Confirmed
**Description:** `COMBO_MAIN` picks the configured default automatically; "Change main" opens the "Select main Item" modal with Confirm/Cancel.
**Acceptance criteria:**
- Given a combo, when "Change main" is confirmed with a different pick, then the review line and price update.

### FR-342 - Combo pricing models
**Feature:** F-MENU-09    **Status:** Confirmed
**Description:** `MINIMUM_PRICING_MODEL` bases forced-group pricing on cheapest selections; `DEFAULT_SELECTION_PRICING_MODEL` bases it on the configured default option and can render negative line prices.
**Acceptance criteria:**
- Under default-selection pricing, a cheaper-than-default pick shows "- £x" on the review line.

### FR-343 - Cross-sell presentation rule
**Feature:** F-MENU-11    **Status:** Confirmed
**Description:** After confirming an item, the cross-sell screen shows only when the draft items map to a `crossSellGroup` with resolvable items, no group is already presented, and cross-sell is not disabled; only the first matching group is shown.
**Acceptance criteria:**
- Given an added item with a cross-sell group of 3 items, when it resolves, then "Would you like anything else?" shows and `view_item_list` fires with "Cross Sell".

### FR-344 - Cross-sell actions
**Feature:** F-MENU-11    **Status:** Confirmed
**Description:** Tapping a suggestion selects it (qty stepper on cocoa); "Add to Order" (cocoa, disabled until >=1 selected) adds them; "No Thanks"/Done dismisses; age-restricted suggestions route through the photo-ID notice.
**Acceptance criteria:**
- Given nothing selected on cocoa, then "Add to Order" is disabled.

### FR-345 - Item-added overlay timing
**Feature:** F-MENU-12    **Status:** Confirmed
**Description:** The added overlay auto-dismisses after its configured timeout (500 ms default style; gift-card variant 2,000 ms); a tap dismisses immediately; cocoa shows item name/qty/total/kcal.
**Acceptance criteria:**
- Given an add, when the overlay appears, then it clears itself after the timeout.

### FR-346 - Add triggers totals update
**Feature:** F-MENU-12    **Status:** Confirmed
**Description:** Confirming an item runs order-totals recompute (`ITEM_ADDED`) and navigates back to the item's category level.
**Acceptance criteria:**
- Given an add, when it confirms, then totals refresh and the menu level returns.

### FR-347 - Search route is template-gated
**Feature:** F-MENU-14    **Status:** Partially confirmed
**Description:** `/productSearch` exists but the default template renders `notImplementedDefaultBehaviour`; functional search exists in SCO mode (barcode-filtered menu, A05).
**Acceptance criteria:**
- Given a non-SCO kiosk without a products template, then the search screen is not available.

### FR-348 - Order draft quantity helpers
**Feature:** F-MENU-10    **Status:** Confirmed
**Description:** Quantity increments duplicate the order item; changes rebuild the draft; getCurrentItemQuantity counts identical items.
**Acceptance criteria:**
- Given + on a 2-qty item, then a third identical line appears.

### FR-349 - Edit item flow
**Feature:** F-MENU-12    **Status:** Confirmed
**Description:** Editing an existing order item (presentedItemToEdit) routes confirmations to update rather than add; review button reads "Update Order".
**Acceptance criteria:**
- Given an item in the basket being edited, when saved, then the line updates in place.

### FR-350 - Accessibility of menu interactions
**Feature:** F-MENU-02/07    **Status:** Confirmed
**Description:** Interactive elements carry accessibility focus classes; selection/quantity changes announce results; category titles announce "{name} selected"; the NavPed can drive focus; accessibility mode enlarges layouts.
**Acceptance criteria:**
- Given NavPed navigation, when a category is focused, then its "{name} selected" announcement is emitted.

## A04 BASKET — Order summary, checkout preparation and age verification

### FR-401 - Order lines render
**Feature:** F-BASKET-01    **Status:** Confirmed
**Description:** Each order line shows item name, formatted price, selected options summary and quantity; identical lines (same item and same options) merge into one displayed row with the combined quantity, sorted by item name.
**Preconditions:** Order has items. **Trigger:** Summary render.
**Expected behaviour:** 1. Group identical lines. 2. Render sorted rows.
**Acceptance criteria:**
- Given two identical lines, when the basket shows, then one row with combined quantity displays.

### FR-402 - Line accessibility labels
**Feature:** F-BASKET-01    **Status:** Confirmed
**Description:** Lines expose composed labels "Item {n}. {name} {price}. {options}" plus Update/Remove labelled actions; a restricted line also gets an "18+" suffix when the badge feature applies.
**Preconditions:** Line rendered. **Trigger:** Screen-reader focus.
**Expected behaviour:** 1. Announce index, name, price, options, restriction.
**Acceptance criteria:**
- Given a restricted line on a badge-enabled kiosk, then the label ends with "18+."

### FR-403 - Remove a line with confirmation
**Feature:** F-BASKET-01    **Status:** Confirmed
**Description:** Remove shows a confirm state (default/bk/boparan two-tap "Remove" -> confirm, itsu "Remove Item?" / "This will remove the item from your basket" Yes/No, cocoa remove button); shakeshack removes directly. Confirming deletes the line and triggers a totals recalculation.
**Preconditions:** Line rendered. **Trigger:** Remove + confirm.
**Expected behaviour:** 1. Confirm. 2. Delete. 3. Recalculate.
**Acceptance criteria:**
- Given a line, when Remove is confirmed, then the line disappears and totals recompute.

### FR-404 - Edit a line
**Feature:** F-BASKET-01    **Status:** Confirmed
**Description:** Update/Edit is offered only when the item has option groups; it reopens the item customisation flow (A03) and saving updates the line and recalculates totals.
**Preconditions:** Item has option groups. **Trigger:** Edit.
**Expected behaviour:** 1. Reopen flow. 2. Save. 3. Recalculate.
**Acceptance criteria:**
- Given a line without options, then no Edit control shows.

### FR-405 - Line quantity stepper (cocoa/costa)
**Feature:** F-BASKET-01    **Status:** Confirmed
**Description:** +/- stepper on cocoa and costa lines changes quantity; changes trigger a totals recalculation.
**Preconditions:** Variant with stepper. **Trigger:** +/- tap.
**Expected behaviour:** 1. Change quantity. 2. Recalculate.
**Acceptance criteria:**
- Given qty 2 and + tapped, then qty becomes 3 and totals update.

### FR-406 - Age badge on restricted lines
**Feature:** F-BASKET-01/09    **Status:** Confirmed
**Description:** Lines with `ageRestriction` > 0 render an "18+" badge ONLY when SCO mode is on and `ageRestrictedApprovalAvailable` is `true`; the badge always reads "18+" regardless of the item's real age.
**Preconditions:** Feature applies. **Trigger:** Line render.
**Expected behaviour:** 1. Show badge + a11y suffix.
**Acceptance criteria:**
- Given a 21+ item, then the badge still reads "18+".

### FR-407 - Scanned vs added sections
**Feature:** F-BASKET-01    **Status:** Confirmed
**Description:** SCO baskets split "Added items" and "Scanned items"; approved restricted scanned lines show "Item Authorised".
**Preconditions:** `scoModeEnabled`. **Trigger:** Summary render.
**Expected behaviour:** 1. Render two sections. 2. Mark authorised lines.
**Acceptance criteria:**
- Given an approved scanned restricted item, then its line shows "Item Authorised".

### FR-408 - Grouped identical lines
**Feature:** F-BASKET-01    **Status:** Confirmed
**Description:** Identical lines (same item id + same option groups and quantities) merge for display with summed quantity; rows sort by item name (stable).
**Preconditions:** Basket render. **Trigger:** Grouping pass.
**Expected behaviour:** 1. Merge. 2. Sort by name.
**Acceptance criteria:**
- Given two identical lines, then one row shows quantity 2.

### FR-409 - Totals fields rendered
**Feature:** F-BASKET-02    **Status:** Confirmed
**Description:** The totals block shows Sub Total, Tax (when exclusive or configured), Service Charge, itemised fee lines, Discounts, charity amount and Total; each line has an accessibility label.
**Preconditions:** Totals data. **Trigger:** Render.
**Expected behaviour:** 1. Render relevant lines with labels.
**Acceptance criteria:**
- Given tax-exclusive totals, then a Tax line appears.

### FR-410 - Totals block visibility
**Feature:** F-BASKET-02    **Status:** Confirmed
**Description:** Default shows the block only when total != subtotal or tax is exclusive; cocoa also shows it when discounts/fees/charity exist or the subtotal changed.
**Preconditions:** Totals data. **Trigger:** Render.
**Expected behaviour:** 1. Apply visibility rules.
**Acceptance criteria:**
- Given total == subtotal with inclusive tax and no discounts/fees on default, then no totals block shows.

### FR-411 - Itemised fees
**Feature:** F-BASKET-02    **Status:** Confirmed
**Description:** `orderTotal.fees` entries render as named lines only when `total` > 0 and name non-blank; when their sum >= `serviceCharge` the aggregate "Service Charge" line is hidden; otherwise both show. A fee named "round up" displays the charity name.
**Preconditions:** Fees present. **Trigger:** Render.
**Expected behaviour:** 1. Filter. 2. Render. 3. Possibly suppress aggregate.
**Acceptance criteria:**
- Given fees summing to the service charge, then the Service Charge line is suppressed.

### FR-412 - Totals recompute triggers
**Feature:** F-BASKET-02    **Status:** Confirmed
**Description:** Totals recalculate on every basket/discount/tip/charity mutation (item add/update/delete, discount apply/delete, checkout load, ingredients update, charity apply, tip add).
**Preconditions:** Any mutation. **Trigger:** Mutation.
**Expected behaviour:** 1. Queue the call. 2. Recalculate.
**Acceptance criteria:**
- Given a discount applied, then a recalculation runs.

### FR-413 - Totals request queue
**Feature:** F-BASKET-02    **Status:** Confirmed
**Description:** Totals requests queue so only one runs at a time; a request never fires with an empty basket (a basket-empty handler runs instead); while in flight stale values are suppressed and cocoa shows "Updating Your Order" for the checkout-load recalculation.
**Preconditions:** Mutation. **Trigger:** Queue tick.
**Expected behaviour:** 1. Queue. 2. Skip when empty. 3. Show loading.
**Acceptance criteria:**
- Given the last item is deleted while a request is pending, then the pending request is skipped and the basket-empty handler runs.

### FR-414 - "PLEASE WAIT" during recompute
**Feature:** F-BASKET-03    **Status:** Confirmed
**Description:** The pay button shows "PLEASE WAIT" while totals are loading and is disabled.
**Preconditions:** Totals call in flight. **Trigger:** Render.
**Expected behaviour:** 1. Disable + label.
**Acceptance criteria:**
- Given a totals call in flight, then the button is disabled with "PLEASE WAIT".

### FR-415 - Totals accessibility announcement
**Feature:** F-BASKET-02    **Status:** Confirmed
**Description:** Cocoa announces "Sub Total {x}. Tax {y}. Total: {z}" plus each visible fee in the totals aria label.
**Preconditions:** Totals rendered. **Trigger:** Screen-reader focus.
**Expected behaviour:** 1. Compose and announce.
**Acceptance criteria:**
- Given two fees, then both are appended to the announcement.

### FR-416 - Stale-value suppression
**Feature:** F-BASKET-02    **Status:** Confirmed
**Description:** While prices load, discount/fee values are suppressed so stale totals never show.
**Preconditions:** Recalculation in flight. **Trigger:** Render.
**Expected behaviour:** 1. Suppress values.
**Acceptance criteria:**
- Given a recompute in flight, then no stale values display.

### FR-417 - Empty basket state
**Feature:** F-BASKET-03    **Status:** Confirmed
**Description:** An empty basket shows "Your basket is empty" (cocoa) and disables pay; totals calls are skipped.
**Preconditions:** Empty basket. **Trigger:** Render.
**Expected behaviour:** 1. Empty state. 2. Disabled pay.
**Acceptance criteria:**
- Given an empty basket, then the empty state renders and pay is disabled.

### FR-418 - Pay button text and disabled states
**Feature:** F-BASKET-03    **Status:** Confirmed
**Description:** "Confirm & Pay" runs the pay flow; disabled with explanatory aria ("Your order, is disabled. Please add some item on your basket before continuing." empty / "Confirm & Pay, is disabled" / "PLEASE WAIT" loading).
**Preconditions:** Any basket state. **Trigger:** Render.
**Expected behaviour:** 1. Enable/disable with aria.
**Acceptance criteria:**
- Given an empty basket, then the button is disabled with the empty aria.

### FR-419 - Donation prompt precedes payment
**Feature:** F-BASKET-03    **Status:** Confirmed (behaviour owned by A08)
**Description:** When a donation prompt applies, pay defers — the donation modal opens and payment resumes on answer.
**Preconditions:** Donation prompt configured. **Trigger:** Pay.
**Expected behaviour:** 1. Open modal. 2. Resume on answer.
**Acceptance criteria:**
- Given the prompt configured, when Pay is pressed, then the modal shows first.

### FR-420 - BRL transaction limit block
**Feature:** F-BASKET-03    **Status:** Confirmed
**Description:** When menu currency is BRL and `orderTotal` > 1,000,000 minor units (R$ 10,000.00 exactly allowed), a blocking modal "Order total is too high" / "This order exceeds the maximum payment amount. Please remove some items or contact a member of staff." shows and payment never starts — checked before any other gate.
**Preconditions:** BRL currency. **Trigger:** Pay.
**Expected behaviour:** 1. Check. 2. Block with modal.
**Acceptance criteria:**
- Given BRL total over the limit, when Pay is pressed, then the limit modal shows and no payment begins.

### FR-421 - Basket item-line limit block
**Feature:** F-BASKET-03    **Status:** Confirmed
**Description:** When the POS rejects the order for too many item lines (error code `BASKET_ITEM_LIMIT_EXCEEDED` matched from any error shape), a blocking modal "Too many items in your order" / "You have reached the maximum number of items allowed for a single order. Please remove some items before continuing." shows and pay is disabled; the flag clears on a successful totals recalculation; on a cocoa item-add rejection the added item is rolled back.
**Preconditions:** Flag set. **Trigger:** Pay / totals rejection / order-submit rejection.
**Expected behaviour:** 1. Flag. 2. Block pay + modal. 3. Clear on recalc.
**Acceptance criteria:**
- Given the flag set, when Pay is pressed, then the limit modal shows instead of payment.
- Given a cocoa item-add rejection, then the item is rolled back.

### FR-422 - SCO browse-menu modal
**Feature:** F-BASKET-03    **Status:** Confirmed
**Description:** On SCO + cocoa with the cross-sell-menu popup enabled, a browse-menu modal asks once per flow whether to browse before checkout — checked before the age gate.
**Preconditions:** SCO + popup. **Trigger:** Pay.
**Expected behaviour:** 1. Show once per flow.
**Acceptance criteria:**
- Given SCO with the popup on, when Pay is pressed first time, then the modal shows.

### FR-423 - Reset-order confirmation
**Feature:** F-BASKET-04    **Status:** Confirmed
**Description:** Reset shows "Cancel Order?" with "Go back"/"Cancel order"; cancelling runs the journey cancel -> session reset -> `/welcome`.
**Preconditions:** Any basket state. **Trigger:** Reset control.
**Expected behaviour:** 1. Confirm. 2. Reset.
**Acceptance criteria:**
- Given "Cancel order" tapped, then the order clears and the kiosk returns to start.

### FR-424 - Go-back dismisses
**Feature:** F-BASKET-04    **Status:** Confirmed
**Description:** "Go back" closes the dialog without clearing.
**Preconditions:** Dialog shown. **Trigger:** Go back.
**Expected behaviour:** 1. Dismiss only.
**Acceptance criteria:**
- Given "Go back", then the basket is unchanged.

### FR-425 - Reset aria label
**Feature:** F-BASKET-04    **Status:** Confirmed
**Description:** The reset control exposes "Back to Welcome screen" aria-label.
**Preconditions:** Control rendered. **Trigger:** Screen-reader focus.
**Expected behaviour:** 1. Announce label.
**Acceptance criteria:**
- Given focus, then the announced label matches.

### FR-426 - Age gate applicability
**Feature:** F-BASKET-05    **Status:** Confirmed
**Description:** The gate shows only when ALL of: `scoModeEnabled` `true`; active brand `ageRestrictedApprovalAvailable` `true` (tri-state — `undefined`/`null`/`false` all keep it off); the order needs age verification; at least one restricted item was scanned. Browse-menu-only restricted items keep the "Have your ID ready" journey. When `ageRestrictedApprovalAvailable` is `false`, restricted items never reach the basket at scan time (A05).
**Preconditions:** Restricted items + applicable config. **Trigger:** Pay.
**Expected behaviour:** 1. Evaluate. 2. Redirect to gate or proceed.
**Acceptance criteria:**
- Given SCO + flag `true` + a scanned restricted item, when Pay is pressed, then the gate shows.
- Given only Browse-Menu restricted items, then the gate does NOT show.

### FR-427 - Gate content and actions
**Feature:** F-BASKET-05    **Status:** Confirmed
**Description:** Title "Age Verification"; explanation "Some items in your order require age verification. A team member will check your ID."; grouped rows (image/name/18+ badge/metadata/Qty) with per-row "Remove" (drops every line in the group, keeps the order nonce); "Staff approval" -> PIN entry (`open_pin_entry`); Back -> `guest_left` outcome + order summary.
**Preconditions:** Gate applies. **Trigger:** Actions.
**Expected behaviour:** 1. Render. 2. Route per action.
**Acceptance criteria:**
- Given a group row, when Remove is tapped, then all lines in the group leave the basket.
- Given Back, when tapped, then a `guest_left` outcome is reported.

### FR-428 - Staff PIN entry and outcomes
**Feature:** F-BASKET-06    **Status:** Confirmed
**Description:** 4-digit PIN + 4-dot indicator; keypad = digits + delete only; confirm submits `POST /users/auth/restricted-item-approval/pin/verify` `{locationId, orderNonce, pin}`; valid -> Challenge-25 (attempts reset); invalid -> PIN clears + "PIN not recognised. Try again."; locked/lockTransition -> "Team approval unavailable" + "Please complete your purchase at the till." (`age_verification_locked` event); 404 -> "Team approval unavailable" + "Team approval is currently unavailable. Please complete your purchase at the till."; other errors -> service-unavailable message; 5 attempts per order.
**Preconditions:** Gate -> staff approval. **Trigger:** Confirm.
**Expected behaviour:** 1. Submit. 2. Route per response.
**Acceptance criteria:**
- Given a wrong PIN, when submitted, then the PIN clears and the invalid message shows.
- Given a locked response, then the locked copy shows and the keypad hides.
- Given a 404, then the unavailable copy shows.

### FR-429 - PIN entry page guards
**Feature:** F-BASKET-06    **Status:** Confirmed
**Description:** The page redirects to the order summary when the gate no longer applies and the flow is neither locked nor unavailable; a verified PIN goes straight to Challenge-25; entering is blocked while verifying; Back returns to the gate (`return_to_gate` analytics).
**Preconditions:** Page shown. **Trigger:** State change / actions.
**Expected behaviour:** 1. Route per state.
**Acceptance criteria:**
- Given the gate stops applying mid-flow, then the page returns to the summary.

### FR-430 - Remove items at the gate
**Feature:** F-BASKET-05    **Status:** Confirmed
**Description:** Each restricted group shows "Remove"; removing deletes every line in the group and recalculates while keeping the order nonce — a verified PIN survives (`remove_restricted_item` analytics).
**Preconditions:** Gate shown. **Trigger:** Remove.
**Expected behaviour:** 1. Delete lines. 2. Recalculate.
**Acceptance criteria:**
- Given a group of 3 units, when Remove is tapped, then all 3 leave the basket.

### FR-431 - Approval bound to order nonce
**Feature:** F-BASKET-08    **Status:** Confirmed
**Description:** The approval context records order nonce + location + restricted-basket fingerprint (line identity + quantity + required age). A new order nonce resets the verification state; while a challenge is pending, a fingerprint divergence or location change discards the context; continuing to pay re-validates nonce+location+fingerprint+approved age and discards a stale approval.
**Preconditions:** Approval granted. **Trigger:** Basket/location/nonce change or continue.
**Expected behaviour:** 1. Validate. 2. Keep or discard.
**Acceptance criteria:**
- Given an approval, when totals recompute (same nonce, same fingerprint), then no re-verification is asked.
- Given a new order nonce, then the verification state resets.

### FR-432 - Challenge-25 screen content
**Feature:** F-BASKET-07    **Status:** Confirmed
**Description:** Staff bar "Age Verification"; title "Approve items"; subtitle "Check the customer's ID before confirming."; "{n} item(s) require approval"; same grouped rows as the gate; mandatory checkbox "I confirm I have applied Challenge 25 and the customer is {max required age} or over".
**Preconditions:** Verified PIN. **Trigger:** Page render.
**Expected behaviour:** 1. Render items + confirmation.
**Acceptance criteria:**
- Given a 21+ and a 18+ item, then the confirmation reads 21.

### FR-433 - Approve path
**Feature:** F-BASKET-07    **Status:** Confirmed
**Description:** Approve (enabled only after the checkbox) records the approved age = highest required age and the approved unit count, marks the items approved for this order, posts `{outcome:"approved", restrictedItemCount}` to `/users/auth/restricted-item-approval/approve`, fires an age-verification approved analytics event (venue, kiosk), reports the component status to status terminals, shows the approved toast and then resumes payment.
**Preconditions:** Confirmed checkbox. **Trigger:** Approve.
**Expected behaviour:** 1. Approve. 2. Report. 3. Toast. 4. Continue to pay.
**Acceptance criteria:**
- Given approval, then an "approved" outcome posts and payment resumes after the toast.

### FR-434 - Decline path removes items
**Feature:** F-BASKET-07/09    **Status:** Confirmed
**Description:** Declining removes every age-restricted line, posts `{outcome:"declined", reason:"staff_declined", restrictedItemCount}`, fires an age-verification not-approved analytics event (venue, kiosk) and shows the declined screen.
**Preconditions:** Challenge pending. **Trigger:** Decline.
**Expected behaviour:** 1. Remove lines. 2. Report. 3. Declined screen.
**Acceptance criteria:**
- Given decline, then the items are gone and the declined screen shows.

### FR-435 - Approved toast
**Feature:** F-BASKET-09    **Status:** Confirmed
**Description:** "{n} items" + "Approved" + "Age verified by staff" with the first item's image (or a barcode icon) and the badge; auto-closes after 2,000 ms (no pause on hover/focus-loss); when it closes payment resumes exactly once.
**Preconditions:** Approval. **Trigger:** Toast.
**Expected behaviour:** 1. Show. 2. Auto-close. 3. Resume.
**Acceptance criteria:**
- Given approval, then the toast shows for 2 s and payment continues.

### FR-436 - Declined screen + leave semantics
**Feature:** F-BASKET-09    **Status:** Confirmed
**Description:** Declined screen renders only when a decline happened: staff bar "Verification Declined" + "Items not approved" + count message + "Return kiosk to guest" which clears the decline and returns to the basket; leaving the gate via Back reports `guest_left` (same outcome as staff declining).
**Preconditions:** Decline / gate. **Trigger:** Render / Back.
**Expected behaviour:** 1. Render + return action. 2. Report `guest_left`.
**Acceptance criteria:**
- Given a direct visit without a decline, then the screen renders nothing.
- Given Back at the gate, then `guest_left` is reported.

### FR-437 - CPF/CNPJ row
**Feature:** F-BASKET-10    **Status:** Confirmed
**Description:** When `cpfCnpj` is enabled, a row shows "CPF/CNPJ on receipt? (optional)" plus the masked stored value or an add/edit affordance.
**Preconditions:** Feature on. **Trigger:** Render.
**Expected behaviour:** 1. Render row.
**Acceptance criteria:**
- Given the feature on, then the row renders on the summary.

### FR-438 - Progressive mask
**Feature:** F-BASKET-10    **Status:** Confirmed
**Description:** Input masks progressively: CPF `000.000.000-00` up to 11 digits; beyond that CNPJ `00.000.000/0000-00` (14 digits). Input accepts alphanumerics.
**Preconditions:** Modal open. **Trigger:** Typing.
**Expected behaviour:** 1. Mask per length.
**Acceptance criteria:**
- Given 12 digits typed, then the CNPJ mask applies.

### FR-439 - Validation on confirm
**Feature:** F-BASKET-10    **Status:** Confirmed
**Description:** Confirm validates: CPF = 11 digits + check digits; CNPJ = 14 digits + check digits; invalid shows an inline error; empty clears the stored value.
**Preconditions:** Value entered. **Trigger:** Confirm.
**Expected behaviour:** 1. Validate. 2. Store or error.
**Acceptance criteria:**
- Given an invalid CPF, when confirmed, then the error shows and nothing stores.

### FR-440 - Stored value displayed masked
**Feature:** F-BASKET-10    **Status:** Confirmed
**Description:** A stored CPF/CNPJ displays masked in the row and pre-fills the modal on reopen.
**Preconditions:** Value stored. **Trigger:** Render/reopen.
**Expected behaviour:** 1. Show masked. 2. Pre-fill.
**Acceptance criteria:**
- Given a stored CPF, then the row shows the masked value.

### FR-441 - CPF/CNPJ analytics sanitized
**Feature:** F-BASKET-10    **Status:** Confirmed
**Description:** Analytics events for the CPF/CNPJ action strip the number itself.
**Preconditions:** Event fired. **Trigger:** Action.
**Expected behaviour:** 1. Sanitize.
**Acceptance criteria:**
- Given a confirm, then the event carries no document number.

### FR-442 - Discount/coupon/reward lines and removal
**Feature:** F-BASKET-11    **Status:** Confirmed (behaviour owned by A07)
**Description:** Applied extras render as lines with remove-confirm: coupon "Remove Coupon?" + "Only one coupon can be applied to an order"; reward "Remove Reward?" + "Only one reward can be applied to an order"; restaurant discount "Remove discount?". Removal triggers a totals recalculation.
**Preconditions:** Extra applied. **Trigger:** Remove.
**Expected behaviour:** 1. Confirm. 2. Remove. 3. Recalculate.
**Acceptance criteria:**
- Given a removed discount, then totals recompute without it.

### FR-443 - Scan-coupon entry point
**Feature:** F-BASKET-11    **Status:** Confirmed (owned by A07)
**Description:** The scan-coupon button shows when `punchhEnabled`/`couponEnabled`/`discountPosProviderEnabled` is on and no coupon applied.
**Preconditions:** Feature on + none applied. **Trigger:** Render.
**Expected behaviour:** 1. Show/hide.
**Acceptance criteria:**
- Given a coupon already applied, then the button hides.

### FR-444 - Discounts modal
**Feature:** F-BASKET-11    **Status:** Confirmed (owned by A07)
**Description:** "Your Discounts" / "View and manage your discounts" with guest points "Balance: {n}", "Discount limit reached" + "To apply a different discount you must remove one from your order." when a second discount is not allowed, "Discount total", "Add Discount", "Close".
**Preconditions:** Discounts available. **Trigger:** See discounts.
**Expected behaviour:** 1. List. 2. Apply/remove.
**Acceptance criteria:**
- Given a limit reached, then the limit copy shows.

### FR-445 - Charity and gift-card rows
**Feature:** F-BASKET-11    **Status:** Confirmed (owned by A08/A09)
**Description:** Charity block ("Charity Donate" + amounts + "Donate"); gift-card banner "Gift cards now available" / "Perfect for any occasion" / "Buy Now"; purchased gift cards list as "{amount} Gift Card" with Edit/Remove and "Remove Gift Card?".
**Preconditions:** Features on. **Trigger:** Render/actions.
**Expected behaviour:** 1. Render. 2. Route to flows.
**Acceptance criteria:**
- Given a purchased gift card, then the row shows with Edit/Remove.

### FR-446 - "Checking for vouchers" state
**Feature:** F-BASKET-11    **Status:** Confirmed
**Description:** Cocoa shows a "Checking for vouchers" line while discount checks run.
**Preconditions:** Check in flight. **Trigger:** Render.
**Expected behaviour:** 1. Show line.
**Acceptance criteria:**
- Given a check in flight, then the line shows.

## A05 SCAN — Scan routing, Scan-and-Go and scan feedback surfaces

### FR-501 - Single routing logic
**Feature:** F-SCAN-01    **Status:** Confirmed
**Description:** HID-keyboard and serial scans funnel into one per-screen routing logic; a scan is dropped while another is processing.
**Preconditions:** Scanner enabled. **Trigger:** Barcode event.
**Acceptance criteria:**
- Given a scan during processing, then it is ignored.

### FR-502 - Gift-card routes
**Feature:** F-SCAN-01    **Status:** Confirmed
**Description:** On `ScanGiftCardPage`/`ScanGiftcardPurchasePage` the code goes to the gift-card flow (A09).
**Acceptance criteria:** Given a gift-card screen, when a scan fires, then the gift-card handler runs.

### FR-503 - App-payment route
**Feature:** F-SCAN-01    **Status:** Confirmed
**Description:** On `AppPaymentPage` the code is submitted as payment (A08).
**Acceptance criteria:** Given the app-payment screen, when a scan fires, then the payment code submits.

### FR-504 - Avolta routes on /orderType
**Feature:** F-SCAN-01    **Status:** Confirmed
**Description:** On `/orderType` with `avoltaEnabled`: a DQR membership card (`...|<DQR ` pattern) goes to scanned-code sign-in; any other QR goes to scanned-phone sign-in (A06).
**Acceptance criteria:** Given Avolta on `/orderType` and a DQR card, when scanned, then code sign-in runs; otherwise phone sign-in.

### FR-505 - SCO item-first routing
**Feature:** F-SCAN-01/02    **Status:** Confirmed
**Description:** With `scoModeEnabled` on `/home` or `/scanAndGo`, a barcode is matched against the ORIGINAL menu first; a non-match falls through to loyalty/coupon routing.
**Acceptance criteria:** Given SCO + a menu barcode, then the item adds; given a non-menu barcode, then loyalty/coupon gets it.

### FR-506 - Loyalty routes
**Feature:** F-SCAN-01    **Status:** Confirmed
**Description:** On `LoyaltyLoggingPage`/`/orderType` a scan signs the guest in (skipped when already signed in); Avolta DQR -> code sign-in; else generic code sign-in (A06).
**Acceptance criteria:** Given a loyalty screen and no sign-in, then a scan triggers sign-in; given an existing sign-in, then it is ignored.

### FR-507 - Coupon routes
**Feature:** F-SCAN-01    **Status:** Confirmed
**Description:** On `/home`, `/orderSummary`, `ScanCoupon`, `ProductSearch`, `EnterCouponManually` a scan applies a coupon (A07) — unless an Avolta sign-in state is active, then it goes to Avolta code sign-in.
**Acceptance criteria:** Given a coupon screen, when a scan fires, then coupon apply runs.

### FR-508 - Drop on other screens
**Feature:** F-SCAN-01    **Status:** Confirmed
**Description:** On any screen not listed, the scan is silently ignored.
**Acceptance criteria:** Given a payment screen, when a scan fires, then nothing happens.

### FR-509 - Item scan adds to basket
**Feature:** F-SCAN-02    **Status:** Confirmed
**Description:** A matched barcode creates an order item built straight from the entity (empty entity path), tagged as scan-originated, added to the basket; the item-added overlay shows; earlier refusal/not-found clears.
**Acceptance criteria:** Given a match, then the item lands in the basket as scanned.

### FR-510 - Scanned-items buffer
**Feature:** F-SCAN-02/03    **Status:** Confirmed
**Description:** On `/scanAndGo` the item also lands in the scanned-items buffer and the modal opens; committed scans keep their scanned identity (re-read from the basket).
**Acceptance criteria:** Given a scan on `/scanAndGo`, then the modal opens with the item.

### FR-511 - Refusal at scan time
**Feature:** F-SCAN-05    **Status:** Confirmed
**Description:** A restricted scan with `ageRestrictedApprovalAvailable` `false` creates no order item; an `age_verification_item_blocked` event fires; the refusal surfaces show.
**Acceptance criteria:** Given the flag false and a restricted scan, then nothing is added and the refusal shows.

### FR-512 - Not-found state
**Feature:** F-SCAN-04    **Status:** Confirmed
**Description:** An unmatched barcode sets the not-found state (banner); the scan itself is not consumed so loyalty/coupon can still claim it.
**Acceptance criteria:** Given a non-menu barcode on SCO, then not-found shows only after other handlers decline it.

### FR-513 - Successful scan clears refusal
**Feature:** F-SCAN-02    **Status:** Confirmed
**Description:** A successful scan clears any outstanding not-found or restricted-refusal state.
**Acceptance criteria:** Given a refusal outstanding and a valid scan, then the refusal hides.

### FR-514 - Grouped removal
**Feature:** F-SCAN-02    **Status:** Confirmed
**Description:** Scanned items can be removed individually or as a merged group (the age-verification gate drops every line behind a row at once so totals recalculate once).
**Acceptance criteria:** Given a group row removed at the gate, then all its lines leave and totals recalc once.

### FR-515 - Scanned-items modal content
**Feature:** F-SCAN-03    **Status:** Confirmed
**Description:** "Scanned Items" / "View and manage scanned items"; rows (image/initials, name, "18+" badge when enabled, price, "Remove" aria "Remove {name} from order"); subtotal; "Browse Menu"; "Your Order".
**Acceptance criteria:** Given scanned items, then the modal lists them.

### FR-516 - Modal reopen on return
**Feature:** F-SCAN-03    **Status:** Confirmed
**Description:** Leaving `/scanAndGo` and returning re-opens the modal when scanned items exist — the scan never looks forgotten.
**Acceptance criteria:** Given items scanned then back from basket, then the modal re-opens.

### FR-517 - Self-close on empty
**Feature:** F-SCAN-03    **Status:** Confirmed
**Description:** Removing the last scanned item closes the modal.
**Acceptance criteria:** Given one item removed, then the modal closes.

### FR-518 - One banner surface
**Feature:** F-SCAN-03/04/05    **Status:** Confirmed
**Description:** Not-found and restricted banners render either on the page or inside the modal — never both; while the modal is open, tapping the scanning banner does NOT re-open it.
**Acceptance criteria:** Given the modal open and a refusal, then the banner shows inside the modal only.

### FR-519 - Scanning banner + carousel
**Feature:** F-SCAN-03    **Status:** Confirmed
**Description:** "Use scanner for faster checkout" banner + self-checkout carousel behind it + "Browse Menu" link; the default content shows a title+subtitle while nothing is scanned.
**Acceptance criteria:** Given `/scanAndGo`, then banner + carousel + browse link render.

### FR-520 - Scan-tagging consistency
**Feature:** F-SCAN-03    **Status:** Confirmed
**Description:** Committed scanned items are re-read from the basket so removals made elsewhere stay consistent in the modal.
**Acceptance criteria:** Given an item removed from the basket, then it also leaves the modal.

### FR-521 - Not-found banner timing
**Feature:** F-SCAN-04    **Status:** Confirmed
**Description:** The not-found banner auto-dismisses after 10,000 ms and clears the state; a successful scan clears it earlier; a repeated failed scan keeps it up.
**Acceptance criteria:** Given a failed scan, then the banner shows for 10 s.

### FR-522 - Not-found copy
**Feature:** F-SCAN-04    **Status:** Confirmed
**Description:** Title/subtitle from `scanAndGo.notFoundTitle`/`notFoundSubtitle` ("The barcode could not be recognised. Please try again or ask for help.").
**Acceptance criteria:** Given a failed scan, then that copy renders.

### FR-523 - Legacy unrecognised-barcode modal
**Feature:** F-SCAN-04    **Status:** Confirmed
**Description:** On the legacy SCO template an unrecognised barcode shows a modal "Unrecognised Barcode" / "The system could not identify your barcode. Please try again or ask for help." / "Ok".
**Acceptance criteria:** Given legacy SCO + unrecognised scan, then the modal shows.

### FR-524 - Banner placement
**Feature:** F-SCAN-04/05    **Status:** Confirmed
**Description:** Banners show on `/scanAndGo` and inside the modal — one surface at a time.
**Acceptance criteria:** Given both, then only one renders.

### FR-525 - Restricted refusal copy
**Feature:** F-SCAN-05    **Status:** Confirmed
**Description:** "Item cannot be purchased here" / "This item is age-restricted and cannot be sold at the kiosk. Please purchase it at the till." — shared by the inline banner and the toast.
**Acceptance criteria:** Given a refusal, then that copy renders on both surfaces.

### FR-526 - Restricted refusal timing
**Feature:** F-SCAN-05    **Status:** Confirmed
**Description:** Both refusal surfaces auto-dismiss after 7,000 ms (longer than the usual 2 s toast because it carries an instruction).
**Acceptance criteria:** Given a refusal, then it stays ~7 s.

### FR-527 - Refusal analytics
**Feature:** F-SCAN-05    **Status:** Confirmed
**Description:** `age_verification_item_blocked` fires with venue, kiosk and item id.
**Acceptance criteria:** Given a refusal, then the event fires once.

### FR-528 - Approval-flag semantics
**Feature:** F-SCAN-05    **Status:** Confirmed
**Description:** `false` = refuse at scan; `true` = add and gate at checkout (A04); `undefined`/`null` = add normally.
**Acceptance criteria:** Given flag true and a restricted scan, then the item adds and the gate applies at pay.

### FR-529 - HID keyboard scan rules
**Feature:** F-SCAN-06    **Status:** Confirmed
**Description:** Valid scan = printable chars within 80 ms of each other, at least 4 characters, completed by Enter OR a 160 ms auto-complete timer; a gap >80 ms restarts the buffer; non-printable keys, keyUp and auto-repeat ignored; under-length buffers discarded; dead-key layouts handled
**Acceptance criteria:** Given chars typed within 80 ms + Enter, then one barcode routing results; given a 4-char buffer left 160 ms, then it completes; given a 3-char buffer, then it is discarded.

### FR-530 - Serial path
**Feature:** F-SCAN-06    **Status:** Confirmed
**Description:** Avolta serial polling forwards completed barcodes with source `SerialScan`, only when `avoltaEnabled` + `scannerEnabled` + NOT `hidKeyboardScannerEnabled`; 3 consecutive failed requests mark the scanner unavailable; a timeout (`ECONNABORTED`) does not count.
**Acceptance criteria:** Given 3 failed polls, then the scanner is marked unavailable; given a timeout only, then it is not.

### FR-531 - Scanner status checking
**Feature:** F-SCAN-06    **Status:** Confirmed
**Description:** Status re-checks on navigation to `/welcome`/`/orderSummary` when `scannerEnabled`, skipped in maintenance and when the HID keyboard scanner is enabled; timeout keeps status, other failures mark unavailable.
**Acceptance criteria:** Given a failed status call (non-timeout) on welcome, then scan-dependent UI marks it unavailable.

### FR-532 - Processing suppression
**Feature:** F-SCAN-06    **Status:** Confirmed
**Description:** While a scan is being processed, idle checking is suppressed and further scans are dropped.
**Acceptance criteria:** Given a scan in flight, then a second scan is ignored.

### FR-533 - Scanner component status
**Feature:** F-SCAN-06    **Status:** Confirmed
**Description:** The `SCANNER` monitored component reports status to status terminals (A01).
**Acceptance criteria:** Given a scanner event, then the component status updates.

### FR-534 - Browse-menu modal (SCO pay gate)
**Feature:** F-SCAN-03    **Status:** Confirmed
**Description:** On pay with SCO + the cross-sell popup enabled, "Want to add anything from the menu?" / "Browse our full menu before you check out" + "Browse Menu" / "No thanks, continue" shows once per flow — checked before the age gate (A04 FR-422); the overlay tap continues.
**Acceptance criteria:** Given SCO + popup, when Pay is pressed first time, then the modal shows.

## A06 LOYALTY — Providers, sign-in, sign-out, order history

### FR-601 - Provider selection
**Feature:** F-LOYAL-01    **Status:** Confirmed
**Description:** One provider per venue brand (Punchh/Avolta/Accesso/NST Yoyo/Pepper/LoyaltyV2) gated by `isLoyaltyEnabled` + the brand flag; methods come from `supportedSigninMethods`.
**Acceptance criteria:**
- Given a brand with Avolta, then Avolta flows render; with Punchh, then barcode sign-in + points copy.

### FR-602 - Scan sign-in routing
**Feature:** F-LOYAL-01    **Status:** Confirmed
**Description:** Scans on loyalty screens sign the guest in; skipped while another scan is processing or the guest is already signed in.
**Acceptance criteria:**
- Given a loyalty screen + a scan, then sign-in runs; given a signed-in guest, then it is ignored.

### FR-603 - Empty/disabled code guard
**Feature:** F-LOYAL-01/07    **Status:** Confirmed
**Description:** A sign-in with loyalty disabled or an empty code fails with "QR code type not supported for this location" + a loyalty sign-in analytics event (type, entry method, screen, success, message) success=false.
**Acceptance criteria:**
- Given loyalty off and a scan, then the unsupported error shows.

### FR-604 - Already-rewarded guard
**Feature:** F-LOYAL-01/07    **Status:** Confirmed
**Description:** Signing in when a reward is already applied fails with "Code already added".
**Acceptance criteria:**
- Given a reward applied, then a further sign-in attempt shows the code-already-added error.

### FR-605 - Multi-method picker
**Feature:** F-LOYAL-03    **Status:** Confirmed
**Description:** "Link your loyalty account" lists configured methods; a single-method provider skips the picker.
**Acceptance criteria:**
- Given phone+email methods, then the picker shows; given one method, then entry shows directly.

### FR-606 - Manual entry submission
**Feature:** F-LOYAL-03    **Status:** Confirmed
**Description:** Method input submits to the loyalty sign-in request; Avolta phone requires a valid number for the chosen country before Continue enables.
**Acceptance criteria:**
- Given an invalid phone, then Continue stays disabled.

### FR-607 - In-flight guard
**Feature:** F-LOYAL-03    **Status:** Confirmed
**Description:** While signing in, Cancel disables ("Cancel is disabled. Signin is in progress.") and the validating spinner shows.
**Acceptance criteria:**
- Given a sign-in in flight, then Cancel is inert.

### FR-608 - Sign-in success
**Feature:** F-LOYAL-05    **Status:** Confirmed
**Description:** Success shows "Logged In Successfully" overlay then the logged-in banner; the journey continues to the menu.
**Acceptance criteria:**
- Given a valid sign-in, then the overlay flashes and the banner persists.

### FR-609 - Sign-out
**Feature:** F-LOYAL-05    **Status:** Confirmed
**Description:** Removing the member clears loyalty from the order (behaviour on the discount screens — A07).
**Acceptance criteria:**
- Given sign-out, then the logged-in surfaces clear.

### FR-610 - Logging spinner copy
**Feature:** F-LOYAL-03    **Status:** Confirmed
**Description:** "Validating..." or "Logging in..." + "This won't take long" while a request runs.
**Acceptance criteria:**
- Given a sign-in in flight, then the spinner copy renders.

### FR-611 - Banner copy variants
**Feature:** F-LOYAL-05    **Status:** Confirmed
**Description:** Logged-out scanner "Scan your app below" / no-scanner tap variants; Accesso "Scan your annual pass here" / "Press here to enter your annual pass manually"; logged-in "You are logged in" + provider subtitle.
**Acceptance criteria:**
- Given Accesso logged-out, then the annual-pass copy shows.

### FR-612 - Avolta banner
**Feature:** F-LOYAL-02    **Status:** Confirmed
**Description:** Logged-out "Great taste. Extra Perks. Save 5% on this order."; logged-in "{tier} member" + "Journey on. Your next flavour awaits. Worldwide."
**Acceptance criteria:**
- Given a logged-in Avolta member, then the tier banner shows.

### FR-613 - Avolta QR sign-in
**Feature:** F-LOYAL-02    **Status:** Confirmed
**Description:** "Scan your QR Code" / "Hold your QR code in front of the scanner to sign in and enjoy your member benefits"; DQR cards route to scanned-code sign-in; plain phone QR routes to scanned-phone sign-in.
**Acceptance criteria:**
- Given a DQR card scan, then code sign-in runs; given a phone QR, then phone sign-in.

### FR-614 - Avolta phone sign-in
**Feature:** F-LOYAL-02    **Status:** Confirmed
**Description:** "No QR code?" / "Enter your mobile phone number below." + phone entry + country dial-code picker; Continue gated on validity; last entered number pre-fills.
**Acceptance criteria:**
- Given a valid phone + country, then Continue signs in.

### FR-615 - Avolta phone validation
**Feature:** F-LOYAL-02    **Status:** Confirmed
**Description:** The number is validated per the selected country and normalised for the signin/signup payload; an unnormalisable number aborts with a logged error.
**Acceptance criteria:**
- Given an invalid number, then Continue is disabled and no request fires.

### FR-616 - Pre-basket Avolta sign-in
**Feature:** F-LOYAL-02    **Status:** Confirmed
**Description:** With no order yet, an Avolta sign-in creates a fresh order so the member can attach; other providers require an existing order.
**Acceptance criteria:**
- Given Avolta + empty basket + sign-in, then an order is created and the member attaches.

### FR-617 - Existing-account routing
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** `USER_ALREADY_EXISTS` / HTTP 409 on signup routes to the account-exists dialog ("Register Error" + "An account already exists with this phone number. Please sign in to continue.").
**Acceptance criteria:**
- Given an existing phone on signup, then the account-exists dialog shows.

### FR-618 - Unknown-account routing
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** An unknown phone on signin routes to the sign-up dialog ("Sign In Error" + "We couldn't find an account with this phone number. Please sign up to join Club Avolta." + "OK").
**Acceptance criteria:**
- Given an unknown phone on signin, then the sign-up prompt shows.

### FR-619 - Avolta signup steps
**Feature:** F-LOYAL-02/06    **Status:** Confirmed
**Description:** "Create Your Avolta Account" -> country -> phone -> Terms accept -> CreatingAccount ("Almost There!" / "We are setting up your account...") -> Success.
**Acceptance criteria:**
- Given a completed form + accepted terms, then the account creates and signs in.

### FR-620 - Scanned-code vs scanned-phone routing
**Feature:** F-LOYAL-02    **Status:** Confirmed
**Description:** A DQR membership card (`...|<DQR ` pattern) -> scanned-code sign-in; a plain phone QR -> `POST /loyalty/signin` `{phone}`.
**Acceptance criteria:**
- Given a DQR code, then code sign-in; given a phone QR, then phone sign-in.

### FR-621 - Face-ID entry
**Feature:** F-LOYAL-04    **Status:** Confirmed
**Description:** "Users, order here" (aria "POPID Users, order here") shows when Face-ID is enabled and routes to the face scan.
**Acceptance criteria:**
- Given Face-ID enabled, then the button renders.

### FR-622 - Face-ID error
**Feature:** F-LOYAL-04/07    **Status:** Confirmed
**Description:** Failure shows the Face-ID error dialog (title + Try Again / continue-as-guest).
**Acceptance criteria:**
- Given a failed scan, then the dialog shows.

### FR-623 - Face-ID success
**Feature:** F-LOYAL-04    **Status:** Confirmed
**Description:** A recognised face signs the guest in through the same success path.
**Acceptance criteria:**
- Given a recognised face, then the guest signs in.

### FR-624 - Logged-in banner
**Feature:** F-LOYAL-05    **Status:** Confirmed
**Description:** "You are logged in" + provider subtitle ("Loyalty programme is active on this order"; Punchh "Loyalty points will be added to your account"; Avolta tier).
**Acceptance criteria:**
- Given a signed-in guest, then the banner persists.

### FR-625 - Success overlay
**Feature:** F-LOYAL-05    **Status:** Confirmed
**Description:** "Logged In Successfully" flashes then dismisses.
**Acceptance criteria:**
- Given a sign-in, then the overlay shows briefly.

### FR-626 - Terms fetch
**Feature:** F-LOYAL-06    **Status:** Confirmed
**Description:** Terms load with a skeleton; failure shows "Failed to load Terms & Conditions" / "Sorry, an error occurred retrieving the terms and conditions." (Try Again/Cancel).
**Acceptance criteria:**
- Given a fetch failure, then the error shows with retry.

### FR-627 - Terms acceptance gate
**Feature:** F-LOYAL-06    **Status:** Confirmed
**Description:** Signup cannot proceed until terms are accepted.
**Acceptance criteria:**
- Given unaccepted terms, then Continue stays disabled.

### FR-628 - Sign-up error dialog
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** "Register Error" + "Sorry, we could not create the account. Try again or download the app to register" + "Try Again" / "Close" + "More details".
**Acceptance criteria:**
- Given a signup failure, then the dialog shows.

### FR-629 - Sign-in error dialog
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** "Sign In Error" + manual ("Sorry, we could not sign you in. Please try again or ask our staff for help.") or barcode ("Sorry, we could not recognize the code. Try again or log in with phone number") copy + "Try Again"/"Log In Manually"/"Close" + "More details".
**Acceptance criteria:**
- Given a barcode failure, then "Log In Manually" offers the fallback.

### FR-630 - Error-details expansion
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** "More details" expands Error Description / Error Code / Location ID / Timestamp.
**Acceptance criteria:**
- Given a failure, then details expand on demand.

### FR-631 - Scanner guard on sign-in
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** A sign-in attempted while a scan is being processed is dropped with a log warning.
**Acceptance criteria:**
- Given a scan in flight, then the sign-in attempt is ignored.

### FR-632 - Loyalty-signin analytics
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** a loyalty sign-in analytics event (type, entry method, screen, success, message) fires on every attempt (type, entry method, screen, success, error message).
**Acceptance criteria:**
- Given a failed sign-in, then the event carries success=false + message.

### FR-633 - Code-already-added analytics
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** The code-already-applied failure fires the same event with the message.
**Acceptance criteria:**
- Given an already-applied reward, then the event fires.

### FR-634 - Phone-account dialog variants
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** Existing -> "Register Error"/"An account already exists..."; unknown -> "Sign In Error"/"We couldn't find an account..."; button "OK".
**Acceptance criteria:**
- Given each case, then the matching copy shows.

### FR-635 - Reorder list
**Feature:** F-LOYAL-08    **Status:** Confirmed
**Description:** "Browse past orders" / "Select orders to make your ordering faster" + order rows with Reorder; loading and empty states.
**Acceptance criteria:**
- Given signed-in history, then orders list.

### FR-636 - Reorder action
**Feature:** F-LOYAL-08    **Status:** Confirmed
**Description:** Reorder rebuilds the basket from the order; "Loading your order, please wait" announces.
**Acceptance criteria:**
- Given a reorder, then the basket populates.

### FR-637 - Reorder error
**Feature:** F-LOYAL-08    **Status:** Confirmed
**Description:** Failure shows the reorder dialog (Try Again / Close; analytics `reorder_error_try_again_button` / `reorder_error_close_button`).
**Acceptance criteria:**
- Given a reorder failure, then the dialog shows and analytics fire.

### FR-638 - Order-history fetch error
**Feature:** F-LOYAL-08    **Status:** Confirmed
**Description:** Fetch failure shows "Past Orders Unavailable" / "Unable to load order history at this time."
**Acceptance criteria:**
- Given a fetch failure, then the error state shows.

### FR-639 - Sign-in analytics context
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** Events carry the current screen and entry method.
**Acceptance criteria:**
- Given an event, then screen + method are recorded.

### FR-640 - Provider-specific error copy
**Feature:** F-LOYAL-07    **Status:** Confirmed
**Description:** Barcode failures on non-Avolta providers use the loyalty-specific "log in manually" copy.
**Acceptance criteria:**
- Given a Punchh barcode failure, then the loyalty copy shows.

### FR-641 - Order-history empty state
**Feature:** F-LOYAL-08    **Status:** Confirmed
**Description:** No orders shows the empty state.
**Acceptance criteria:**
- Given no history, then the empty state renders.

### FR-642 - Loyalty-enabled gate
**Feature:** F-LOYAL-01    **Status:** Confirmed
**Description:** `isLoyaltyEnabled` (provider flag + location features) gates all loyalty surfaces.
**Acceptance criteria:**
- Given loyalty off, then no loyalty UI renders.

### FR-643 - Face-ID feature gate
**Feature:** F-LOYAL-04    **Status:** Confirmed
**Description:** `faceIdSigninEnabled` gates the PopID button.
**Acceptance criteria:**
- Given disabled, then no button.

### FR-644 - Order-history loading
**Feature:** F-LOYAL-08    **Status:** Confirmed
**Description:** While history loads, the skeleton shows.
**Acceptance criteria:**
- Given a fetch in flight, then skeleton renders.

## A07 DISCOUNTS — Coupons, rewards, restaurant and senior discounts

### FR-701 - Manual entry screen
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** "Enter your coupon code" + code keypad + back; submits to the apply pipeline.
**Acceptance criteria:** Given a typed code, when submitted, then apply runs.

### FR-702 - Scan page
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** "SCAN QR CODE" + subtitle (or scanner-unavailable copy) + "enter manually" button.
**Acceptance criteria:** Given the scan page, then scan or manual entry applies.

### FR-703 - Basket scan-coupon button
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** Shows when coupon features on and no coupon applied.
**Acceptance criteria:** Given a coupon already applied, then the button hides.

### FR-704 - Code-type classification
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** The code is classified (Comanda/Punchh/Loyalty/restaurant/senior/unknown) before routing.
**Acceptance criteria:** Given a senior code, then senior apply runs.

### FR-705 - Sign-in banner copy
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** Scanner+manual "Scan your app to sign in"/"Or tap to enter your details"; manual-only "Tap here to sign in"/"And connect your loyalty account"; scan-only "Scan your app to sign in"/"And connect your loyalty account".
**Acceptance criteria:** Given scanner+manual, then scan title + tap subtitle.

### FR-706 - Manual-entry banner copy
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** Adapts to enabled features: "Rewards, Loyalty, Senior Discount" / "Press to enter a reward or coupon code" / "Press to enter a reward code" / "Press to enter a coupon code".
**Acceptance criteria:** Given loyalty+coupon+senior, then "Rewards, Loyalty, Senior Discount".

### FR-707 - Coupon screens accept scans
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** `/home`, `/orderSummary`, `ScanCoupon`, `ProductSearch`, `EnterCouponManually` route scans to apply (A05).
**Acceptance criteria:** Given a coupon screen + scan, then apply runs.

### FR-708 - Sign-in attempt analytics
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** a loyalty sign-in attempt analytics event (type, entry method, screen) fires on code sign-in (type, entry method, screen).
**Acceptance criteria:** Given a code sign-in, then the event fires.

### FR-709 - Scan-only banner
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** When only the scanner is available, the banner shows scan copy with no manual fallback.
**Acceptance criteria:** Given scan-only, then no manual subtitle.

### FR-710 - Apply while processing guard
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** With queue-wait on, apply is dropped while a discount or scan is being processed.
**Acceptance criteria:** Given a discount in flight, then a second apply is ignored.

### FR-711 - AWAIT_QUEUE_BEFORE_DISCOUNT (159)
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** When feature 159 is on, apply waits for the order queue to clear first; a failed wait shows "Unable to apply discount. Please try again."; off = immediate.
**Acceptance criteria:** Given the feature on + busy queue, then apply waits; on failure the error shows.

### FR-712 - Type routing
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** Comanda -> use-coupon; Punchh/Loyalty -> loyalty apply; restaurant -> restaurant-discount apply; senior -> senior-discount apply; unknown -> no request.
**Acceptance criteria:** Given a restaurant code, then restaurant apply runs.

### FR-713 - Success overlay per type
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** "Coupon added to order" / "Reward added to order" / "Discount added to order" / Avolta "You have unlocked your Club Avolta discount." + "{tier} Tier" label.
**Acceptance criteria:** Given a coupon applied, then the coupon overlay shows.

### FR-714 - Second-code-required banner
**Feature:** F-DISC-02/05    **Status:** Confirmed
**Description:** A limited-use coupon needing its ID shows "Unlock your discount with ID code" / "To use limited use coupon code enter the ID for your discount".
**Acceptance criteria:** Given a limited-use first code, then the second-code banner shows.

### FR-715 - Code-already-added dialog
**Feature:** F-DISC-02/06    **Status:** Confirmed
**Description:** Applying a second code shows "Code already added" / "Only one code may be applied to an order." / "To apply a different code please remove the current code from your order."
**Acceptance criteria:** Given a code applied + a new code, then the dialog shows.

### FR-716 - Replacement warning
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** Swapping a discount shows "Replace your current discount?" (Continue/Cancel); cancelling keeps the current discount.
**Acceptance criteria:** Given Continue, then the old discount is voided and the new applies.

### FR-717 - Senior discount apply
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** Senior code posts to the senior-discount apply endpoint; already-applied -> "Code already added"; `minimumAge` in the error -> "Sorry, this discount is only available for citizens aged {n} or over"; other -> generic.
**Acceptance criteria:** Given a below-age senior, then the age error shows.

### FR-718 - Senior analytics
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** an add-loyalty-info analytics event (type, entry method, screen, success, value, error) (senior type, entry method, screen, success, value).
**Acceptance criteria:** Given a senior apply, then the event fires.

### FR-719 - Restaurant-discount modal
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** Code input + Apply (disabled until a code entered, aria "Apply, is disabled. You need to enter the discount code to enable it.") + Cancel + "PLEASE WAIT" during apply.
**Acceptance criteria:** Given a typed code, then Apply enables.

### FR-720 - Discount totals recompute
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** Every successful apply/void triggers a totals recalculation (A04).
**Acceptance criteria:** Given an apply, then totals recompute.

### FR-721 - Coupon entry-method tracking
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** Entry method (scan/manual/unknown) rides the request and analytics.
**Acceptance criteria:** Given a manual entry, then the method records.

### FR-722 - Unknown-type warning
**Feature:** F-DISC-02    **Status:** Confirmed
**Description:** An unclassifiable code logs a warning and fires no request.
**Acceptance criteria:** Given an unknown code, then nothing applies.

### FR-723 - Awards modal auto-show
**Feature:** F-DISC-03    **Status:** Confirmed
**Description:** Shows when the provider supports it + awards exist; suppressed when the discount limit is reached.
**Acceptance criteria:** Given Punchh awards available, then the modal shows; given the limit reached, then it doesn't.

### FR-724 - Punchh awards totals refresh
**Feature:** F-DISC-03    **Status:** Confirmed
**Description:** Punchh with awards-selection enabled refreshes totals (and thus available awards) before showing; the modal still shows on a failed refresh.
**Acceptance criteria:** Given a totals failure, then the modal still shows.

### FR-725 - Award selection + confirm
**Feature:** F-DISC-03    **Status:** Confirmed
**Description:** "Select Your Discount..." + rows + "Confirm Selection" applies.
**Acceptance criteria:** Given a selection confirmed, then the award applies.

### FR-726 - More-rewards follow-up
**Feature:** F-DISC-03    **Status:** Confirmed
**Description:** With awards remaining after apply, "More rewards available" / "There are still reward available for you to redeem. Would you like to continue?" (Add Discount/Close).
**Acceptance criteria:** Given remaining awards, then the follow-up shows.

### FR-727 - LoyaltyV2 discount popup
**Feature:** F-DISC-03    **Status:** Confirmed
**Description:** "Add New Discount" / "Select your preferred loyalty method" -> "Redeem Code"/"Log In"/"Select Discounts"; balance line "Your Balance: {n}".
**Acceptance criteria:** Given LoyaltyV2 signed in, then the popup shows.

### FR-728 - Discounts list modal
**Feature:** F-DISC-03/05    **Status:** Confirmed
**Description:** "Your Discounts" / "View and manage your discounts" + "Balance: {n}" + "Discount limit reached" + "Discount total" + "Add Discount" + "Close".
**Acceptance criteria:** Given applied discounts, then the list shows.

### FR-729 - Void by type
**Feature:** F-DISC-04    **Status:** Confirmed
**Description:** Removal routes per type: coupon void / loyalty void / senior void; only one kind per order.
**Acceptance criteria:** Given a coupon removed, then coupon void runs.

### FR-730 - Silent void
**Feature:** F-DISC-04    **Status:** Confirmed
**Description:** Silent void clears discounts without confirmation during submit/cancel.
**Acceptance criteria:** Given submit with discounts, then they are voided silently.

### FR-731 - Void failure
**Feature:** F-DISC-04    **Status:** Confirmed
**Description:** "Sorry, your discount could not be removed." (Close + more-details).
**Acceptance criteria:** Given a failed void, then the dialog shows.

### FR-732 - Last-discount cleanup
**Feature:** F-DISC-04    **Status:** Confirmed
**Description:** Removing the last discount clears the discount-added state.
**Acceptance criteria:** Given the last removed, then no applied state remains.

### FR-733 - Applied-line removal (basket rows)
**Feature:** F-DISC-04    **Status:** Confirmed (owned by A04 display)
**Description:** Removing a coupon/reward/discount row confirms then voids and recomputes.
**Acceptance criteria:** Given a row removed, then void + recompute run.

### FR-734 - Limit banner
**Feature:** F-DISC-05    **Status:** Confirmed
**Description:** "Discount limit reached" / "To apply a different code you must remove one from your order."
**Acceptance criteria:** Given the limit, then the banner shows.

### FR-735 - Added banner + remove-to-apply note
**Feature:** F-DISC-05    **Status:** Confirmed
**Description:** "Coupon added"/"Reward added" + "To apply a different code you must remove one from your order."
**Acceptance criteria:** Given an apply, then the banner shows.

### FR-736 - Limit detection
**Feature:** F-DISC-05    **Status:** Confirmed
**Description:** The limit state comes from the order (maximum-discount rule).
**Acceptance criteria:** Given max applied, then apply prompts are suppressed.

### FR-737 - Coupon-added overlay focus
**Feature:** F-DISC-05    **Status:** Confirmed
**Description:** The success overlay focuses its title on show (a11y).
**Acceptance criteria:** Given an overlay, then focus lands on the title.

### FR-738 - Scan-coupon headless entry
**Feature:** F-DISC-01    **Status:** Confirmed
**Description:** A scan-only coupon entry surface exists where a full scan page isn't used.
**Acceptance criteria:** Given a headless scan context, then a scan applies.

### FR-739 - Invalid-coupon dialog
**Feature:** F-DISC-06    **Status:** Confirmed
**Description:** "QR code not valid" / "This QR code can not be used at this location" (Close + more-details; hidden-description variant).
**Acceptance criteria:** Given an invalid code, then the dialog shows.

### FR-740 - Add-discount error dialog
**Feature:** F-DISC-06    **Status:** Confirmed
**Description:** "Discount Error" / "A problem occurred while adding your discount" (Try Again/Close + more-details).
**Acceptance criteria:** Given an apply failure, then the dialog shows.

### FR-741 - Legacy scan-error page
**Feature:** F-DISC-06    **Status:** Confirmed
**Description:** Retriable -> "Try again" (rescan); non-retriable -> "THIS QR CODE IS NOT VALID" + "OK" (order summary); details show error/code/location/timestamp.
**Acceptance criteria:** Given a non-retriable error, then OK returns to the summary.

### FR-742 - Accesso invalid copy
**Feature:** F-DISC-06    **Status:** Confirmed
**Description:** "Details not valid" with no description.
**Acceptance criteria:** Given an Accesso invalid, then the title-only dialog shows.

### FR-743 - More-details expansion
**Feature:** F-DISC-06    **Status:** Confirmed
**Description:** "More details" expands Error Description / Error Code / Location ID / Timestamp on the dialogs.
**Acceptance criteria:** Given a failure, then details expand on demand.

### FR-744 - itsu discount overlay
**Feature:** F-DISC-06    **Status:** Confirmed
**Description:** itsu renders its own Discount* overlay variants of the scan/manual/error flow.
**Acceptance criteria:** Given itsu, then the branded overlay shows.

## A08 PAYMENT — Method choice, authorisation, errors, tips, donation

### FR-801 - Method list built from readiness + features
**Feature:** F-PAY-01    **Status:** Confirmed
**Description:** The chooser lists only runnable methods: Cash needs `cashReaderReady`; Card `cardReaderReady`; Food Stamps card-ready + `foodStampEnabled`; Gift Card one button per `giftcardPaymentTypes` entry; Room Charge / App Payment / Face-ID per feature; Crypto shows an unavailable notification when it can't run.
**Acceptance criteria:**
- Given cashReaderReady false, then no Cash button; given 2 gift-card types, then 2 buttons.

### FR-802 - Method names
**Feature:** F-PAY-01    **Status:** Confirmed
**Description:** Buttons read "Cash"/"Card"/"Food Stamps"/"Crypto"/"Gift Card"/"Room Charge"/"App Payment"/"Face ID"; title "Choose payment".
**Acceptance criteria:** Given the chooser, then these names render.

### FR-803 - Single vs multiple methods
**Feature:** F-PAY-01    **Status:** Confirmed
**Description:** With only one runnable method the guest goes straight to that flow; with several, the chooser lists them all.
**Acceptance criteria:** Given card-only, then the card flow starts without the chooser.

### FR-804 - Back to basket
**Feature:** F-PAY-01    **Status:** Confirmed
**Description:** Back returns to the order summary.
**Acceptance criteria:** Given Back, then the basket shows.

### FR-805 - Partials reversed on re-entry
**Feature:** F-PAY-01/04    **Status:** Confirmed
**Description:** With payments.length > 0, entering the chooser reverses them first ("Reversing payment" / "This won't take long"); a failed cash cancel is logged and non-fatal.
**Acceptance criteria:** Given partials, then "Reversing payment" shows before the list.

### FR-806 - Crypto unavailable notice
**Feature:** F-PAY-01    **Status:** Confirmed
**Description:** A crypto-unavailable notification shows on the chooser when crypto can't run.
**Acceptance criteria:** Given crypto down, then the notice shows.

### FR-807 - Food-stamp option
**Feature:** F-PAY-01    **Status:** Confirmed
**Description:** Food Stamps shows only when card reader ready + foodStampEnabled.
**Acceptance criteria:** Given card ready + foodStamp on, then the EBT button shows.

### FR-808 - Method analytics
**Feature:** F-PAY-01    **Status:** Confirmed
**Description:** Picking a method fires its analytics event (e.g. `crypto_payment_button`).
**Acceptance criteria:** Given a pick, then the event fires.

### FR-809 - Authorising screen
**Feature:** F-PAY-02    **Status:** Confirmed
**Description:** The authorising screen shows while the transaction runs; processing screens show progress.
**Acceptance criteria:** Given an authorise in flight, then the screen holds.

### FR-810 - Provider request shape
**Feature:** F-PAY-02    **Status:** Confirmed
**Description:** The auth request carries order, amount, gateway id/type (Adyen/FreedomPay/Ocius/generic).
**Acceptance criteria:** Given a provider, then the matching request posts.

### FR-811 - Payment status polling
**Feature:** F-PAY-02    **Status:** Confirmed
**Description:** Status polls to a terminal state; cash-status polling waits at least 1,000 ms between calls and only on routes that support it.
**Acceptance criteria:** Given a poll cycle, then at least 1 s separates calls.

### FR-812 - Success continuation
**Feature:** F-PAY-02    **Status:** Confirmed
**Description:** On authorise the flow proceeds to order placement then the success page.
**Acceptance criteria:** Given authorised, then placement runs.

### FR-813 - Payment totals fields
**Feature:** F-PAY-02/04    **Status:** Confirmed
**Description:** `remaining`, `totalPaid`, `cashRoundingDiscount` drive the remaining-balance display and splits.
**Acceptance criteria:** Given a partial, then the remainder shows.

### FR-814 - Cash journey states
**Feature:** F-PAY-02    **Status:** Confirmed
**Description:** Cash polling tracks journey states (waiting, processing money, cancelling, collect-change) driving the cash screens (A09).
**Acceptance criteria:** Given processing money, then the change screen can show.

### FR-815 - Cancel cash payment
**Feature:** F-PAY-02/04    **Status:** Confirmed
**Description:** Cancelling posts a cancel-cash request; failure logs "Failed to cancel cash payment transaction".
**Acceptance criteria:** Given a cancel, then the request fires.

### FR-816 - Face-ID/crypto start flags
**Feature:** F-PAY-02    **Status:** Confirmed
**Description:** Start-in-progress flags guard crypto/Face-ID/cash starts.
**Acceptance criteria:** Given a start in flight, then a second is blocked.

### FR-817 - Payment error screen
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** Title + subtitle + Try Again (retriable) or back/OK (fatal).
**Acceptance criteria:** Given a retriable failure, then Try Again re-runs the payment.

### FR-818 - Error code 702
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** `702` = second code required (limited-use coupon) — routes to the second-code flow, not a payment failure.
**Acceptance criteria:** Given a 702, then the second-code flow shows.

### FR-819 - Payment-expired dialog
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** Authorise timeout shows the expired dialog.
**Acceptance criteria:** Given a timeout, then the dialog shows.

### FR-820 - Cancel-payment confirm
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** Cancelling a running payment asks for confirmation first.
**Acceptance criteria:** Given cancel tapped, then the confirm shows.

### FR-821 - Cancel-partial-payments confirm
**Feature:** F-PAY-03/04    **Status:** Confirmed
**Description:** Reversing several payments asks for confirmation.
**Acceptance criteria:** Given partials + cancel, then the confirm shows.

### FR-822 - ATP error dialog
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** ATP-mode failures surface on the ATP error dialog when payment-related.
**Acceptance criteria:** Given an ATP payment failure, then the dialog shows.

### FR-823 - Failure analytics
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** Payment failures fire error analytics with code + screen.
**Acceptance criteria:** Given a failure, then the event fires.

### FR-824 - Error-page variants
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** bk/costa/itsu/shakeshack render their own error pages with the same retry/back contract.
**Acceptance criteria:** Given itsu, then the branded error page shows.

### FR-825 - Partial payments list
**Feature:** F-PAY-04    **Status:** Confirmed
**Description:** Applied payments count toward the total; the remaining drives the next method.
**Acceptance criteria:** Given a gift card applied, then the remainder shows.

### FR-826 - Cancel partial payments
**Feature:** F-PAY-04    **Status:** Confirmed
**Description:** A cancel-partials request reverses all applied payments and restores the full total.
**Acceptance criteria:** Given a cancel, then the full amount returns to one payment.

### FR-827 - Remaining-balance display
**Feature:** F-PAY-04    **Status:** Confirmed
**Description:** The chooser shows the remaining amount after partials.
**Acceptance criteria:** Given a partial, then the remainder displays.

### FR-828 - Single-kind partial constraint
**Feature:** F-PAY-04    **Status:** Confirmed
**Description:** A gift-card payment counts only non-gift-card PED payments separately from gift-card ones when summing splits.
**Acceptance criteria:** Given a card + gift-card split, then both count correctly.

### FR-829 - Tip preset choices
**Feature:** F-PAY-05    **Status:** Confirmed
**Description:** Ordered preset tip choices are selectable; the jar icon fills per size (EMPTY/LOW/MEDIUM/HIGH/FULL).
**Acceptance criteria:** Given a preset, then it selects and the jar fills.

### FR-830 - Custom tip modal
**Feature:** F-PAY-05    **Status:** Confirmed
**Description:** The custom button opens an amount modal (apply/cancel); applying sets a custom tip.
**Acceptance criteria:** Given a custom amount applied, then the tip sets.

### FR-831 - No-tip option
**Feature:** F-PAY-05    **Status:** Confirmed
**Description:** The guest can proceed with no tip.
**Acceptance criteria:** Given no selection + continue, then the order has no tip.

### FR-832 - Tip joins the total
**Feature:** F-PAY-05    **Status:** Confirmed
**Description:** The chosen tip adds to the order and triggers a totals recalc (the order total without the tip is preserved to recompute).
**Acceptance criteria:** Given a tip, then totals recompute with it.

### FR-833 - Tip continue
**Feature:** F-PAY-05    **Status:** Confirmed
**Description:** Continue proceeds to payment.
**Acceptance criteria:** Given continue, then payment starts.

### FR-834 - Tip edit from basket
**Feature:** F-PAY-05    **Status:** Confirmed
**Description:** The basket tip row's Edit reopens the tip step (A04).
**Acceptance criteria:** Given Edit on the tip row, then the tip step shows.

### FR-835 - Donation prompt at pay
**Feature:** F-PAY-06    **Status:** Confirmed
**Description:** The donation modal shows when the step is active + donation info exists (`KioskDonationView.MODAL`); apply/skip resumes the pay path.
**Acceptance criteria:** Given the modal provider, then the modal runs before payment.

### FR-836 - Donation providers
**Feature:** F-PAY-06    **Status:** Confirmed
**Description:** `donationProvider` config chooses modal vs inline (Pennies inline on the basket — A04).
**Acceptance criteria:** Given inline, then the basket block shows instead.

### FR-837 - Food-stamp banner
**Feature:** F-PAY-06    **Status:** Confirmed
**Description:** Shows when `isFoodStampPayment` flags the order.
**Acceptance criteria:** Given EBT order, then the banner shows.

### FR-838 - Loyalty-discounts banner
**Feature:** F-PAY-06    **Status:** Confirmed
**Description:** Applied loyalty discounts display at pay.
**Acceptance criteria:** Given a discount applied, then the banner shows.

### FR-839 - Wait-time message
**Feature:** F-PAY-06    **Status:** Confirmed
**Description:** "Current wait time is about {n} minute(s)" shows on the cocoa payment variant when `config.waitTime` is set (1 = singular).
**Acceptance criteria:** Given waitTime 5, then the message shows.

### FR-840 - Donation analytics
**Feature:** F-PAY-06    **Status:** Confirmed
**Description:** Donation view/apply fires its analytics events.
**Acceptance criteria:** Given the modal, then the view event fires.

### FR-841 - Single-flight order submit
**Feature:** F-PAY-07    **Status:** Confirmed
**Description:** A second submit is ignored while one is in flight.
**Acceptance criteria:** Given a submit in flight, then a second is dropped.

### FR-842 - Order request build
**Feature:** F-PAY-07    **Status:** Confirmed
**Description:** The submit posts order details + payments + invoice data.
**Acceptance criteria:** Given a paid order, then the request carries them.

### FR-843 - Injection failure
**Feature:** F-PAY-07    **Status:** Confirmed
**Description:** A failed submit lands on the error path; a cash-paid order that fails injection keeps the payment state (no re-charge).
**Acceptance criteria:** Given a cash-paid injection failure, then the payment is not re-requested.

### FR-844 - Order response stored
**Feature:** F-PAY-07    **Status:** Confirmed
**Description:** The order response stores for the success page (order number, waitTime).
**Acceptance criteria:** Given a placed order, then the response is kept.

### FR-845 - Payment totals cleared on submit
**Feature:** F-PAY-07    **Status:** Confirmed
**Description:** Payment totals are folded into the submitted order response.
**Acceptance criteria:** Given a submit, then the payment totals reflect it.

### FR-846 - Basket-item-limit on submit
**Feature:** F-PAY-07    **Status:** Confirmed
**Description:** A submit rejected for too many lines sets the line-limit flag (A04), not the generic payment error.
**Acceptance criteria:** Given a line-limit rejection, then the limit state shows.

### FR-847 - Payment error-code mapping
**Feature:** F-PAY-03    **Status:** Confirmed
**Description:** A v2 response `errorCode` maps to fixed title/subtitle on the error screen: `PE01` "Payment cancelled"/"Do you want to try paying again?"; `PE02` "Card removed too early"; `PE03` "Payment was declined"; `PE05` food-stamp type change; `PE06`/`PE04` "Payment not completed"/"Please see a team member at the register. They will verify your payment and complete your order."; `PE07` insufficient funds; `PE08` "Communication error"; `PE09` "Terminal session expired"; `LEGACY`/`PE00`/unknown "Payment Failed".
**Preconditions:** A payment fails. **Trigger:** Authorise returns an error.
**Acceptance criteria:**
- Given `PE02`, then "Card removed too early" shows with retry.
- Given `PE04`/`PE06`/`PE09`, then the error is fatal (no Try Again).
- Given an unknown code, then "Payment Failed" shows with retry.

### FR-848 - Order-injection (POS) failure copy
**Feature:** F-PAY-07    **Status:** Confirmed
**Description:** A POS order-placement failure shows "Thanks for your payment, but we weren't able to complete your order!" / "You have not been charged. Please contact staff for assistance." (default) or "We were unable to complete your order" / "You have not been charged. Please contact a member of our team for assistance." (cocoa); no retry.
**Preconditions:** Payment taken. **Trigger:** Order injection fails.
**Acceptance criteria:** Given an injection failure, then the charged-state copy shows without retry.

## A09 ALTPAY — Cash, crypto, gift card, room charge, app payment, Face-ID

### FR-901 - Cash insert screen
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** "Insert cash" + subtitle + amount due + running "Amount paid" (inserted + prior total); cancel button disabled (aria) while the machine starts accepting money.
**Acceptance criteria:**
- Given cash inserted, then the paid amount counts up.

### FR-902 - Cash status polling
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** Machine status polls at least 1,000 ms apart, only on supporting routes, tracking inserted amount until the total is covered.
**Acceptance criteria:** Given polls, then >=1 s separates calls.

### FR-903 - Cash journey states
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** waiting -> processing money -> collect change (or collect-change-to-cancel when cancelling); a fatal machine error surfaces.
**Acceptance criteria:** Given processing, then the change screen can show.

### FR-904 - Change screen
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** "Take your change" / "Please take your change and we will process your order." + "Change Due"; cancelling shows "payment cancelled" + money-due variant.
**Acceptance criteria:** Given change due, then the change screen shows.

### FR-905 - Cancel cash payment
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** Cancel posts a cancel-cash request; the machine returns the money.
**Acceptance criteria:** Given cancel, then the request fires and money returns.

### FR-906 - Cash machine error
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** A fatal machine error ("Received a fatal error from cash machine.") lands on the error path.
**Acceptance criteria:** Given a fatal error, then the error surfaces.

### FR-907 - Cash readiness
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** Cash health/readiness comes from the cash-status refresher; an unhealthy machine hides the method (A08).
**Acceptance criteria:** Given cash down, then no cash option.

### FR-908 - Cash rounding discount
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** A `cashRoundingDiscount` can appear in the totals for cash.
**Acceptance criteria:** Given cash rounding, then the totals reflect it.

### FR-909 - Partial cash with other methods
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** Cash paid joins prior payments; the remainder continues via another method.
**Acceptance criteria:** Given a gift card + cash, then both count.

### FR-910 - End-cash transaction
**Feature:** F-ALTPAY-01    **Status:** Confirmed
**Description:** Completing cash posts an end-cash request before placement.
**Acceptance criteria:** Given covered total, then end-cash runs.

### FR-911 - Crypto QR + copy
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** QR + "Scan the QR code to pay" + terms note ("This Bitcoin transaction is governed by Steak n Shake's Terms and Conditions for such payments..." / "The Terms and Conditions can be viewed here.").
**Acceptance criteria:** Given the page, then the QR + terms show.

### FR-912 - Crypto polling
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** Payment polls until confirmed or expired; a `timeoutSeconds` timer fires the expiry.
**Acceptance criteria:** Given polling, then confirm/expire resolves.

### FR-913 - Crypto expired dialog
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** Expired -> dialog; confirm abandons the journey (`crypto_payment_expired`), cancel closes.
**Acceptance criteria:** Given expiry, then confirm abandons.

### FR-914 - Crypto cancel-order confirm
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** "Cancel Order?" / "Are you sure you want to cancel your order? This will remove all items from your basket." + "Cancel Order"/"Go back".
**Acceptance criteria:** Given cancel, then the confirm shows.

### FR-915 - Crypto unavailable notice
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** When crypto can't run, an unavailable notification shows on the chooser.
**Acceptance criteria:** Given crypto down, then the notice shows.

### FR-916 - Crypto start guard
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** A start-in-progress flag blocks duplicate starts.
**Acceptance criteria:** Given a start in flight, then a second is blocked.

### FR-917 - Crypto confirm -> placement
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** Confirmed payment proceeds to order placement.
**Acceptance criteria:** Given confirmed, then placement runs.

### FR-918 - Crypto analytics
**Feature:** F-ALTPAY-02    **Status:** Confirmed
**Description:** Crypto start/confirm/cancel fire analytics.
**Acceptance criteria:** Given a crypto event, then it records.

### FR-919 - Gift-card balances + coverage
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** Amount due + available balance + ring progress; balance covers -> "pay in full"; short -> "pay a partial amount" applies the whole balance.
**Acceptance criteria:** Given full coverage, then pay-in-full applies the due.

### FR-920 - Change payment method on insufficient
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** Insufficient balance offers "Change payment method" back to the chooser.
**Acceptance criteria:** Given a short balance, then the option shows.

### FR-921 - Custom amount
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** A custom-amount modal lets the guest choose how much of the card to spend (apply/cancel).
**Acceptance criteria:** Given a custom amount, then that amount applies.

### FR-922 - Manual entry modes
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** Number/code/PIN modals support manual entry.
**Acceptance criteria:** Given manual entry, then the right modal shows.

### FR-923 - PED interaction modes
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** The PED interaction page handles card-present modes per the gift-card type.
**Acceptance criteria:** Given a card-present type, then the PED screen shows.

### FR-924 - Scan gift card
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** A scan on the gift-card route goes to the gift-card number handler (A05).
**Acceptance criteria:** Given a card scan, then the handler runs.

### FR-925 - Already-activated dialog
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** `GIFT_CARD_ALREADY_ACTIVATED` shows `GifCardAlreadyAddedDialog`.
**Acceptance criteria:** Given an applied card re-scanned, then the dialog shows.

### FR-926 - Gift-card error dialog
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** Other apply failures show `GiftCardErrorDialog`.
**Acceptance criteria:** Given an apply failure, then the dialog shows.

### FR-927 - Partial gift-card + remainder
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** A partial apply returns to the chooser for the remainder (A08).
**Acceptance criteria:** Given a partial, then the remainder continues.

### FR-928 - Gift-card purchase flow
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** A basket banner offers denominations/amount selection and a scan-to-buy; purchased cards list as "{amount} Gift Card" lines.
**Acceptance criteria:** Given a purchase, then a card line appears.

### FR-929 - Data-expiry notice
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** A data-expiry line shows on the gift-card page (`dataExpires`).
**Acceptance criteria:** Given the page, then the notice shows.

### FR-930 - Gift-card apply analytics
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** Apply/purchase/fire events record method + value.
**Acceptance criteria:** Given an apply, then the event fires.

### FR-931 - Hotel picker
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** "Select Hotel" / "Please select the hotel you are staying" + list (skeleton while loading) + "Charge room".
**Acceptance criteria:** Given hotels, then the list shows.

### FR-932 - Details form
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** "Room Details" / "Please enter your details to charge this order to your hotel bill." + fields per `roomChargePaymentTypes`.
**Acceptance criteria:** Given the types, then the matching fields show.

### FR-933 - Details validation
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** Details validate against the property; valid -> checkout; invalid -> error.
**Acceptance criteria:** Given valid details, then checkout shows.

### FR-934 - Checkout confirm
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** "Checkout" / "The order amount will be charged to your room" + Name + Room Number + amount + "Charge room" (spinner while charging).
**Acceptance criteria:** Given confirm, then the charge runs.

### FR-935 - Hide guest info
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** Configured fields can be hidden from the details form.
**Acceptance criteria:** Given a hidden field, then it doesn't render.

### FR-936 - Room-charge error dialog
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** Validation/charge failure shows `RoomChargeConfirmErrorDialog`.
**Acceptance criteria:** Given a failure, then the dialog shows.

### FR-937 - Room-charge auth request
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** The charge posts a `roomChargeAuthPaymentRequest`.
**Acceptance criteria:** Given charge, then the request fires.

### FR-938 - Room-charge analytics
**Feature:** F-ALTPAY-04    **Status:** Confirmed
**Description:** Hotel pick / details submit / charge fire events.
**Acceptance criteria:** Given a step, then the event fires.

### FR-939 - App-payment page
**Feature:** F-ALTPAY-05    **Status:** Confirmed
**Description:** Title + subtitle; the page waits for a code.
**Acceptance criteria:** Given the page, then the prompt shows.

### FR-940 - Code submit
**Feature:** F-ALTPAY-05    **Status:** Confirmed
**Description:** A scanned code on this route submits `submitAppPaymentCode` (A05).
**Acceptance criteria:** Given a scan, then the code submits.

### FR-941 - App-payment authorise
**Feature:** F-ALTPAY-05    **Status:** Confirmed
**Description:** A valid code authorises the amount.
**Acceptance criteria:** Given a valid code, then the payment authorises.

### FR-942 - App-payment analytics
**Feature:** F-ALTPAY-05    **Status:** Confirmed
**Description:** Submit/failure events record.
**Acceptance criteria:** Given a submit, then the event fires.

### FR-943 - Face-ID camera readiness
**Feature:** F-ALTPAY-06    **Status:** Confirmed
**Description:** The camera initialises via websocket; "Pay with" + "Please look into the camera while we validate your ID".
**Acceptance criteria:** Given the page, then the camera prompt shows.

### FR-944 - 2FA PIN
**Feature:** F-ALTPAY-06    **Status:** Confirmed
**Description:** The provider may ask a PIN; `submitFaceIdTwoFactorAuthentication(pin)` submits; the PIN length is logged; attempts bounded by the provider session.
**Acceptance criteria:** Given a PIN prompt, then entry submits.

### FR-945 - Invalid PIN
**Feature:** F-ALTPAY-06    **Status:** Confirmed
**Description:** A bad PIN shows "Enter a valid code." and the guest retries.
**Acceptance criteria:** Given a bad PIN, then the error shows.

### FR-946 - Processing screen
**Feature:** F-ALTPAY-06    **Status:** Confirmed
**Description:** "Processing Face ID payment" / "This won't take long" while authorising.
**Acceptance criteria:** Given authorise, then the screen shows.

### FR-947 - Face-ID cancel confirm
**Feature:** F-ALTPAY-06    **Status:** Confirmed
**Description:** `CancelFaceIdPaymentConfirmDialog` guards cancel.
**Acceptance criteria:** Given cancel, then the confirm shows.

### FR-948 - Face-ID failure
**Feature:** F-ALTPAY-06    **Status:** Confirmed
**Description:** Failures land on the payment error path (A08).
**Acceptance criteria:** Given a failure, then the error screen shows.

### FR-949 - Gift-card PED error codes
**Feature:** F-ALTPAY-03    **Status:** Confirmed
**Description:** PED-lookup `errorCode` maps to: `PE01` "Payment cancelled"; `PE02` "Card removed too early" + try-again subtitle; `PE08` "Communication error" + subtitle; `PE09` "Terminal session expired" + subtitle; other PED "Gift card read failed" + "...unable to read your gift card. Please try again or choose another payment method."; expired "Your gift card expired"; empty "Your gift card is empty"; already-added "Card Already in Use".
**Preconditions:** A gift-card payment fails. **Trigger:** PED/lookup error.
**Acceptance criteria:** Given `PE09`, then the terminal-expired text shows; given an expired card, then "Your gift card expired" shows.

### FR-950 - Face-ID 2FA attempt cap
**Feature:** F-ALTPAY-05    **Status:** Confirmed
**Description:** The Face-ID two-factor PIN allows 3 attempts (provider session cap — see `test/integration/faceid-payment-2factor-fail-three-times`); on the third failure the flow shows the failure state and offers another method.
**Acceptance criteria:** Given 3 wrong PINs, then the payment fails to the failure surface.

## A10 POST — Success page, notifications, receipts, wait-time

### FR-1001 - Success page content
**Feature:** F-POST-01    **Status:** Confirmed
**Description:** Title + subtitle + "Order number" + number + Done.
**Acceptance criteria:**
- Given a placed order, then the number shows.

### FR-1002 - Done / pick a store
**Feature:** F-POST-01    **Status:** Confirmed
**Description:** Done returns to start; multi-brand shows "Pick a store" + "Want to make another order?".
**Acceptance criteria:** Given multi-brand, then the pick-store button shows.

### FR-1003 - Loyalty footers
**Feature:** F-POST-01    **Status:** Confirmed
**Description:** Signed-in Punchh -> "You have earned points on this order"; failed -> "Claim your loyalty points by scanning the barcode on your receipt".
**Acceptance criteria:** Given a check-in, then the earned line shows.

### FR-1004 - Order-number display rule
**Feature:** F-POST-01    **Status:** Confirmed
**Description:** `posCheckNumberDisplayLength` unset or number shorter -> full; set and digits-only longer -> last N digits.
**Acceptance criteria:** Given length 4 + "12345678", then "5678" shows.

### FR-1005 - Success accessibility announcement
**Feature:** F-POST-01    **Status:** Confirmed
**Description:** "Thanks for your order" + title + subtitle + number + footers announce on show.
**Acceptance criteria:** Given the page, then the announcement fires.

### FR-1006 - Auto-return
**Feature:** F-POST-01/05    **Status:** Confirmed
**Description:** The standard inactivity timer returns to welcome and clears the session (A01).
**Acceptance criteria:** Given no interaction, then the reset fires.

### FR-1007 - Success page variants
**Feature:** F-POST-01    **Status:** Confirmed
**Description:** cocoa (incl. email-disabled), V2, buzzer, shakeshack, bk, costa, itsu, SCO render their own success surfaces with the same Done contract.
**Acceptance criteria:** Given itsu, then the branded page shows.

### FR-1008 - Wait-time on success
**Feature:** F-POST-01/04    **Status:** Confirmed
**Description:** "Current wait time is about {n} minute(s)" shows where configured, from the order response `waitTime`.
**Acceptance criteria:** Given waitTime 10, then the line shows.

### FR-1009 - Guest name on success
**Feature:** F-POST-01/02    **Status:** Confirmed
**Description:** A captured guest name shows on the success page.
**Acceptance criteria:** Given a name, then it renders.

### FR-1010 - Order number source
**Feature:** F-POST-01    **Status:** Confirmed
**Description:** The number comes from the placed-order response (`posCheckNumber`).
**Acceptance criteria:** Given a response, then its number shows.

### FR-1011 - Buzzer capture
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** "Grab a buzzer and enter the number below" / "Please come to the collection point when the buzzer goes off." + number entry stored on the order.
**Acceptance criteria:** Given a buzzer number, then it saves.

### FR-1012 - Tent-card capture
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** "Grab a tent card and enter the number below" / "Find a free table and we will bring your order over." + number entry.
**Acceptance criteria:** Given a tent number, then it saves.

### FR-1013 - Table-number capture
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** "Enter your table number below" + number entry.
**Acceptance criteria:** Given a table number, then it saves.

### FR-1014 - Phone notification
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** Phone entry validated for SMS alerts; invalid keeps Continue disabled; failure -> `SmsErrorDialog`.
**Acceptance criteria:** Given a valid phone, then the SMS submits.

### FR-1015 - Guest-name capture
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** Name entry validated; mandatory when `KIOSK_GUEST_NAME_MANDATORY` (162) on.
**Acceptance criteria:** Given the feature on + empty name, then Continue is blocked.

### FR-1016 - Notification stored on the order
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** The identifier (buzzer/tent/table/phone/name) persists to the order notification.
**Acceptance criteria:** Given an entry, then the order carries it.

### FR-1017 - Fulfilment (puck) alerts
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** Puck fulfilment alerts exist where the venue runs a puck system.
**Acceptance criteria:** Given a puck venue, then the alert fires.

### FR-1018 - Notification analytics
**Feature:** F-POST-02    **Status:** Confirmed
**Description:** Method pick + entry fire analytics.
**Acceptance criteria:** Given a pick, then the event fires.

### FR-1019 - Print receipt page
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** Print choice per `kioskReceiptOptions`.
**Acceptance criteria:** Given print enabled, then the option shows.

### FR-1020 - Print failure
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** "Still need a receipt? Please ask our staff at the counter." (title + subtitle); journey continues.
**Acceptance criteria:** Given a print failure, then the message shows.

### FR-1021 - Email modal
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** "emailReceiptTitle" + "This email will not be used for marketing purposes" + Cancel/Send Receipt; invalid email keeps Send disabled.
**Acceptance criteria:** Given an invalid email, then Send is disabled.

### FR-1022 - Email sent state
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** "receiptSentTitle" + "receiptSentSubtitle" after send.
**Acceptance criteria:** Given a send, then the sent state shows.

### FR-1023 - SMS receipt
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** SMS receipt per `kioskReceiptOptions`; failure -> `SmsErrorDialog`.
**Acceptance criteria:** Given an SMS failure, then the dialog shows.

### FR-1024 - QR/photo receipt
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** QR/photo receipt per `kioskReceiptOptions`.
**Acceptance criteria:** Given QR enabled, then the option shows.

### FR-1025 - Receipt options config
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** `kioskReceiptOptions` chooses which channels appear.
**Acceptance criteria:** Given email only, then only email shows.

### FR-1026 - Receipt analytics
**Feature:** F-POST-03    **Status:** Confirmed
**Description:** Channel pick + send/print events record.
**Acceptance criteria:** Given a send, then the event fires.

### FR-1027 - Waiting screen
**Feature:** F-POST-04    **Status:** Confirmed
**Description:** Holds while the order submits, then auto-advances to success.
**Acceptance criteria:** Given a submit, then the waiting screen shows until it resolves.

### FR-1028 - Wait-time source
**Feature:** F-POST-04    **Status:** Confirmed
**Description:** The order response `waitTime` drives the displayed estimate.
**Acceptance criteria:** Given waitTime, then it shows.

### FR-1029 - Email-disabled variant
**Feature:** F-POST-04/03    **Status:** Confirmed
**Description:** A cocoa success variant without the email-receipt surface exists where email is off.
**Acceptance criteria:** Given email off, then no email surface.

### FR-1030 - Order submit on success path
**Feature:** F-POST-04    **Status:** Confirmed
**Description:** The success page shows only after the order submits (single-flight, A08).
**Acceptance criteria:** Given a submit, then success follows.

### FR-1031 - Done resets
**Feature:** F-POST-05    **Status:** Confirmed
**Description:** Done navigates to the start and clears order + notifications + loyalty.
**Acceptance criteria:** Given Done, then a clean start shows.

### FR-1032 - Pick a store
**Feature:** F-POST-05    **Status:** Confirmed
**Description:** Multi-brand "Pick a store" returns to brand selection.
**Acceptance criteria:** Given multi-brand, then brand selection shows.

### FR-1033 - Notification reset
**Feature:** F-POST-05    **Status:** Confirmed
**Description:** Notification state clears on reset.
**Acceptance criteria:** Given a reset, then notifications clear.

### FR-1034 - Loyalty reset
**Feature:** F-POST-05    **Status:** Confirmed
**Description:** Loyalty/discount state clears on reset.
**Acceptance criteria:** Given a reset, then signed-out state.

## A11 PRES — Theming, accessibility, keyboards, formatting, analytics

### Theming

### FR-1101 - Server theme
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** With `KIOSK_THEMING` (170) on, theme tokens come from the server and style every surface; without it, brand defaults apply.
**Acceptance criteria:** Given theming on, then the server theme applies.

### FR-1102 - Theme tokens
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** `tokenMap` maps theme keys to CSS variables (colours, fonts, spacing).
**Acceptance criteria:** Given tokens, then the variables apply.

### FR-1103 - Per-page overrides
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** `PageThemeWrapper`/`PageThemeContext`/`itemBackground`/`resolvePageImage`/`resolveOrderTypeButtonsDirection` apply per-page + order-type overrides.
**Acceptance criteria:** Given a page override, then it wins over the base theme.

### FR-1104 - Server CSS
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** Additional CSS can be fetched and applied (`cssServices`).
**Acceptance criteria:** Given server CSS, then it applies.

### FR-1105 - Logos
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** `Logo`, `FloatingLogo`, `HomeFloatingLogoManager` render brand logos with fallback.
**Acceptance criteria:** Given a logo, then it renders.

### FR-1106 - Shared presentation primitives
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** IconFont, Animated, RingProgress, ProgressSpinner, LoadingFullScreen, CocoaScrollBar shared across surfaces.
**Acceptance criteria:** Given a surface, then it uses these.

### FR-1107 - Theme actions
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** Theme + logo actions load and store the theme.
**Acceptance criteria:** Given a theme, then it loads and stores.

### FR-1108 - Theming gate
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** Feature `KIOSK_THEMING` (170) gates the server theme.
**Acceptance criteria:** Given the feature off, then defaults apply.

### FR-1109 - Fallback theme
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** Without a server theme the brand default theme applies.
**Acceptance criteria:** Given no theme, then defaults apply.

### FR-1110 - Theme analytics/errors
**Feature:** F-PRES-01    **Status:** Confirmed
**Description:** Theme load failures are handled without breaking the UI.
**Acceptance criteria:** Given a theme failure, then defaults still render.

### Accessibility

### FR-1111 - Accessibility mode toggle
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** `AccessibilityButton` toggles `accessibilityModeEnabled`; the UI switches layout/classes.
**Acceptance criteria:** Given a toggle, then the mode flips.

### FR-1112 - Accessibility classes
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** Every interactive element carries `selectable-accessibility-focusin` + `selectable-accessibility-element` classes.
**Acceptance criteria:** Given an element, then the classes exist.

### FR-1113 - Focus trap
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** `AccessibilityFocusTrap` keeps focus inside modals while open.
**Acceptance criteria:** Given a modal, then focus stays inside.

### FR-1114 - NavPed navigation
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** `AccessibleNavigation` moves focus through sections/elements (`focusFirstElement`, `focusFirstSection`, `selectable-accessibility-*`).
**Acceptance criteria:** Given navigation input, then focus moves in order.

### FR-1115 - Screen-reader announcements
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** `ScreenReaderAnnouncement` + `Announcements` speak page + change messages.
**Acceptance criteria:** Given a change, then the announcement fires.

### FR-1116 - RTL direction
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** `DirectionManager` sets `dir` on `<html>` from the language via rtl-detect.
**Acceptance criteria:** Given an RTL language, then `dir="rtl"`.

### FR-1117 - Accessibility screens per brand
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** bk/itsu/costa have their own accessibility screens + v2 `AccessibilityButton`.
**Acceptance criteria:** Given bk, then its a11y screen shows.

### FR-1118 - Language list
**Feature:** F-PRES-02/04    **Status:** Confirmed
**Description:** The location config language list drives the picker (A02) and the keyboard direction.
**Acceptance criteria:** Given languages, then the picker lists them.

### FR-1119 - Focus on modal open
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** Modals move focus to their primary element on open.
**Acceptance criteria:** Given a modal, then focus lands inside.

### FR-1120 - a11y layout variant
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** Accessibility mode switches to the accessible layout/classes (larger targets, higher contrast).
**Acceptance criteria:** Given a11y on, then the layout changes.

### FR-1121 - Accessibility analytics
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** `sendAccessibilityModeEvent` fires on toggle.
**Acceptance criteria:** Given a toggle, then the event fires.

### FR-1122 - Direction on language change
**Feature:** F-PRES-02    **Status:** Confirmed
**Description:** `dir` updates when the language changes.
**Acceptance criteria:** Given a language change, then `dir` updates.

### Keyboards

### FR-1123 - Per-language keyboard layouts
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** Layouts ship for arabic, chinese, english_gb, french, german, japanese, korean, russian, spanish + numeric.
**Acceptance criteria:** Given a language, then its layout shows.

### FR-1124 - Tabbed keyboard (cocoa)
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** `TabbedKeyboard` offers tabs for character groups.
**Acceptance criteria:** Given cocoa, then the tabs render.

### FR-1125 - Numeric keypads
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** `NumberKeypad`/`NumberKeypadInput` + shakeshack buzzer keypad for numeric entry.
**Acceptance criteria:** Given a number field, then the keypad shows.

### FR-1126 - Input limits
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** `maxLength` caps input; `inputPattern` restricts characters.
**Acceptance criteria:** Given a pattern, then invalid keys don't enter.

### FR-1127 - Currency-symbol map
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** `currencySymbolMap` maps locales to currency symbols on keyboards.
**Acceptance criteria:** Given a locale, then the right symbol shows.

### FR-1128 - Avolta alphabetic keyboard
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** A dedicated alphabetic keyboard variant exists (`isAvoltaAlphabeticKeyboard`).
**Acceptance criteria:** Given Avolta, then it shows.

### FR-1129 - Keyboard on focus
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** Tapping a text field opens the matching keyboard.
**Acceptance criteria:** Given a field, then the keyboard opens.

### FR-1130 - Keyboard submit/cancel
**Feature:** F-PRES-03    **Status:** Confirmed
**Description:** Keyboards offer confirm/cancel actions wired to the field.
**Acceptance criteria:** Given confirm, then the value applies.

### Formatting

### FR-1131 - Money formatting
**Feature:** F-PRES-04    **Status:** Confirmed
**Description:** `Money` formats amounts via `ts.formatCurrency` (locale currency).
**Acceptance criteria:** Given an amount, then it formats per locale.

### FR-1132 - Text formatting helpers
**Feature:** F-PRES-04    **Status:** Confirmed
**Description:** `textFormatting` + `TabIndexDialogHelper` shared helpers.
**Acceptance criteria:** Given a use, then they apply.

### FR-1133 - Language list
**Feature:** F-PRES-04    **Status:** Confirmed
**Description:** 33 locale files ship; the language list comes from the location config (A02).
**Acceptance criteria:** Given a language, then its translations apply.

### FR-1134 - Localization resolution
**Feature:** F-PRES-04    **Status:** Confirmed
**Description:** `localization` + `localizationServices` resolve translations with fallback.
**Acceptance criteria:** Given a missing key, then fallback shows.

### FR-1135 - Screen ratios
**Feature:** F-PRES-04    **Status:** Confirmed
**Description:** `screenRatios` model layout variants per screen size.
**Acceptance criteria:** Given a size, then the layout adapts.

### FR-1136 - Shared primitives
**Feature:** F-PRES-04    **Status:** Confirmed
**Description:** Modal/Container/Button/Dialog/SlidingModal/Title are shared primitives.
**Acceptance criteria:** Given a surface, then it uses them.

### FR-1137 - RTL text handling
**Feature:** F-PRES-04    **Status:** Confirmed
**Description:** RTL languages flip text layout via `dir`.
**Acceptance criteria:** Given RTL, then text flows right-to-left.

### FR-1138 - Sentry
**Feature:** F-PRES-04/05    **Status:** Confirmed
**Description:** `SentryConfiguration` captures errors.
**Acceptance criteria:** Given an error, then it reports.

### Analytics catalogue (FR-1139)

Every interaction fires a GA4 event via `AnalyticsManager`/`AnalyticsPageManager` (screen-view tracking automatic per page). Events observed in code:

| Event | When fired | Parameters |
|:--|:--|:--|
| `sendAccessibilityModeEvent` | Accessibility mode toggled | mode on/off |
| `sendAddLoyaltyInfoEvent` | Loyalty/discount info added | type, method, screen, success, value, error |
| `sendAddPaymentFailedEvent` | Payment add failed | method, screen, error |
| `sendAddPaymentInfoEvent` | Payment info added | method, screen |
| `sendAddTipEvent` | Tip added | amount, screen |
| `sendAddToCartAnalyticsEvent` | Item added to basket | item, screen |
| `sendAddToCartEvent` | Item added to basket | item, screen |
| `sendAgeVerificationApprovedEvent` | Age approval granted | venue, kiosk |
| `sendAgeVerificationGateShownEvent` | Age gate shown | venue, kiosk |
| `sendAgeVerificationItemBlockedEvent` | Restricted item refused | venue, kiosk, item |
| `sendAgeVerificationLockedEvent` | Age PIN locked | venue, kiosk |
| `sendAgeVerificationNotApprovedEvent` | Age approval declined | venue, kiosk |
| `sendBeginCheckoutEvent` | Checkout begins | screen, total |
| `sendCategorySelectionAnalyticsEvent` | Category picked | category, screen |
| `sendChangeLanguageErrorEvent` | Language change failed | language, error |
| `sendCharityDonatedEvent` | Donation applied | amount, screen |
| `sendCpfCnpjActionEvent` | CPF/CNPJ action | action, screen (sanitised) |
| `sendDecreaseItemQuantityEvent` | Item qty decreased | item, screen |
| `sendEnterGuestNameEvent` | Guest name entered | screen |
| `sendEnterNumberEvent` | Number entered (buzzer/table/etc) | screen |
| `sendGenerateReceiptEvent` | Receipt generated | channel, screen |
| `sendIdleTimeoutEvent` | Idle timeout | screen |
| `sendImpressionEvent` | Impression shown | item/screen |
| `sendIncreaseItemQuantityEvent` | Item qty increased | item, screen |
| `sendInteractionEvent` | Generic interaction | element, screen |
| `sendItemTagImpressionEvent` | Item-tag impression | tag, screen |
| `sendJourneyAbandonedEvent` | Journey abandoned | screen, reason |
| `sendJourneyEndEvent` | Journey ended | screen |
| `sendJourneyStartEvent` | Journey started | screen |
| `sendLanguageSelectedEvent` | Language picked | language, screen |
| `sendLoadTermsConditionsAttemptEvent` | Terms load attempted | screen |
| `sendLoadTermsConditionsEvent` | Terms loaded/failed | screen, success |
| `sendLoyaltySigninAttemptEvent` | Loyalty sign-in attempted | type, method, screen |
| `sendLoyaltySigninEvent` | Loyalty sign-in result | type, method, screen, success, error |
| `sendLoyaltySignupAttemptEvent` | Loyalty signup attempted | type, method, screen |
| `sendLoyaltySignupEvent` | Loyalty signup result | type, method, screen, success, error |
| `sendOnboardingCompletedEvent` | Onboarding done | screen |
| `sendPurchaseEvent` | Order placed | order, total |
| `sendPurchaseFailedEvent` | Order place failed | screen, error |
| `sendRemoveFromCartEvent` | Item removed | item, screen |
| `sendRemoveLoyaltyInfoEvent` | Loyalty/discount removed | type, screen |
| `sendRemoveTipEvent` | Tip removed | screen |
| `sendReorderFailureEvent` | Reorder failed | screen, error |
| `sendReorderStartedEvent` | Reorder started | screen |
| `sendReorderSuccessEvent` | Reorder succeeded | screen |
| `sendSelectCategoryEvent` | Category selected | category, screen |
| `sendSelectContentEvent` | Content selected | content, screen |
| `sendSelectItemAnalyticsEvent` | Item selected | item, screen |
| `sendSelectItemEvent` | Item selected | item, screen |
| `sendSelectModifierAnalyticsEvent` | Modifier selected | modifier, screen |
| `sendSelectSubCategoryEvent` | Sub-category selected | sub-category, screen |
| `sendServiceSelectedEvent` | Order-type/service picked | service, screen |
| `sendStateChangeEvent` | Kiosk state change | state |
| `sendUpdateFromCartEvent` | Basket updated | item, screen |
| `sendViewCartEvent` | Basket viewed | screen |
| `sendViewCharityDonationComponentEvent` | Donation component viewed | screen |
| `sendViewItemEvent` | Item viewed | item, screen |
| `sendViewItemListEvent` | Item list viewed | screen |

`AnalyticsPageManager` + `UserAuthAnalytics` fire screen-view events on every page transition (route name -> analytics screen name); `SentryConfiguration` captures errors. The `analyticsSettings` model holds analytics config.

## A12 SCO — Self-checkout screens, clerk validation, template catalogue

### FR-1201 - SCO home
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** SCO landing with `HelpButton`, `HomeSideBar`, product browsing (`ProductsSelector`/`Products`/`ProductsCell`) and `MenuSettings`.
**Acceptance criteria:**
- Given SCO, then the home renders with help + browse.

### FR-1202 - SCO product page
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** Product details + add.
**Acceptance criteria:** Given a product, then details show.

### FR-1203 - SCO order summary
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** `OrderSummary` reviews the order and starts pay.
**Acceptance criteria:** Given items, then the summary shows.

### FR-1204 - SCO payment journey
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** `PaymentPage`/`AuthorizingPaymentPage`/`PaymentSuccessPage`/`PrintReceiptPage` SCO variants of the payment flow.
**Acceptance criteria:** Given pay, then the SCO flow runs.

### FR-1205 - Help button
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** `HelpButton` requests staff help.
**Acceptance criteria:** Given tapped, then help is requested.

### FR-1206 - Help requested
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** "Help is on the way" / "Please wait." shows while waiting.
**Acceptance criteria:** Given a request, then the message shows.

### FR-1207 - Cancel help
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** `CancelHelpButton` cancels the request and returns.
**Acceptance criteria:** Given cancel, then the request ends.

### FR-1208 - Help analytics
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** Help request/cancel fire analytics.
**Acceptance criteria:** Given a request, then the event fires.

### FR-1209 - Staff login screen
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** "Staff Login" + subtitle + keypad + `CancelHelpButton`.
**Acceptance criteria:** Given the page, then the keypad shows.

### FR-1210 - Clerk PIN validation
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** The entered PIN matches `kioskConfig.pinCode` (validated via the `/clerk` service); a wrong code shows a wrong-login-code message.
**Acceptance criteria:** Given a valid PIN, then staff actions unlock; given a wrong PIN, then the error shows.

### FR-1211 - Staff login accessibility
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** The keypad has an accessibility title.
**Acceptance criteria:** Given a11y, then the aria title shows.

### FR-1212 - Staff login error
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** A wrong PIN shows the wrong-login-code message.
**Acceptance criteria:** Given a wrong PIN, then the message shows.

### FR-1213 - Staff product summary actions
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** "Reset Session" / "Approve Item" / "Delete Item" / "Print last receipt" / "Done".
**Acceptance criteria:** Given staff logged in, then the actions render and each runs.

### FR-1214 - Clerk service
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** `/clerk` endpoint validates clerk actions per the venue.
**Acceptance criteria:** Given an action, then the request fires.

### FR-1215 - SCO scan routing
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** Scans route per A05 (item-first, then loyalty/coupon); legacy `ScannerManager` shows the unrecognised-barcode modal.
**Acceptance criteria:** Given a scan, then it routes.

### FR-1216 - Template slot map
**Feature:** F-SCO-02    **Status:** Confirmed
**Description:** the screen template catalogue maps every slot to a loaded on demand brand implementation.
**Acceptance criteria:** Given a slot, then the right implementation loads.

### FR-1217 - Template alternatives per brand
**Feature:** F-SCO-02    **Status:** Confirmed
**Description:** Each brand supplies its own slot values (see catalogue).
**Acceptance criteria:** Given a brand, then its overrides apply.

### FR-1218 - cinnamon + v3 trees
**Feature:** F-SCO-02    **Status:** Confirmed
**Description:** the cinnamon and v3 template trees exist, each supplying a navigation-bar surface.
**Acceptance criteria:** Given those trees, then their screens load.

### FR-1219 - cocoa email-disabled success slot
**Feature:** F-SCO-02    **Status:** Confirmed
**Description:** `paymentSuccessEmailDisabledCocoaPage` is a distinct cocoa slot value.
**Acceptance criteria:** Given that template value, then the email-disabled success shows.

### FR-1220 - Mode routing
**Feature:** F-SCO-01    **Status:** Confirmed
**Description:** `scoModeEnabled` + the template route the SCO screens instead of the default flow.
**Acceptance criteria:** Given SCO mode, then the SCO tree renders.
