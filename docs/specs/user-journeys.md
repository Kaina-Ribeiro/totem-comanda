# User Journeys

Every meaningful user flow, from the first touch to the end result. The end-to-end journeys (`UJ-E2E-..`)
come first and chain the area journeys together; the area journeys follow, grouped by functional area.
Status legend, identifiers and actors are explained at the top of `features.md`.

## A00 End-to-end journeys (across areas)

These journeys chain the area journeys into complete visits. Each step names the area journey or screen that
holds the detail. Optional steps appear only when the configuration described in the linked area applies.

### UJ-E2E-01 - Order and pay by card on a single-brand kiosk
**Actor:** guest
**User goal:** Order food and pay by card without help.
**Starting point:** The attract screen (SCR-START-01) on a kiosk that is trading.
**Prerequisites:** Configuration loaded (UJ-KIOSK-01); the kiosk is not closed, in maintenance or at capacity; a card terminal is ready.
**Steps:**
1. Guest touches the attract screen -> the kiosk checks it can trade and starts a journey (UJ-START-01).
2. Optional: guest changes language (UJ-START-03).
3. Kiosk shows order type selection when a choice is needed (SCR-START-05); guest picks Eat In or Take Away. Skipped when only one order type exists and no language or loyalty choice applies (UJ-START-02).
4. Kiosk opens the menu (SCR-MENU-01); guest browses categories and opens an item (UJ-MENU-01).
5. Guest customises the item and adds it (UJ-MENU-02); a cross-sell may be offered (UJ-MENU-03); the item-added confirmation appears (SCR-MENU-11).
6. Steps 4-5 repeat for more items.
7. Guest opens the basket (SCR-BASKET-01), reviews and edits lines (UJ-BASKET-01). Totals refresh after every change.
8. Optional: guest applies a coupon or discount (UJ-DISC-01, UJ-DISC-02).
9. Guest presses Confirm & Pay -> the pre-payment gates run in order: (Scan-and-Go only) browse-menu prompt, guest-name prompt when a name is required, tip step (UJ-PAY-03), donation prompt, then the hard blocks - transaction-limit check, basket line-limit check, (Scan-and-Go only) age-verification gate (F-BASKET-03).
10. Kiosk routes to payment: the method chooser when more than one method is enabled (SCR-PAY-01), otherwise straight to the only method. Guest pays by card (UJ-PAY-01): authorising screen (SCR-PAY-02) while the terminal takes the card.
11. When nothing remains to pay, the kiosk sends the order to the POS (F-PAY-07) and shows the waiting screen (SCR-POST-02).
12. Optional: order notification capture - buzzer, table number, tent card or phone (UJ-POST-02). (The guest's name, when required, was already captured at the pay gates in step 9.)
13. Kiosk shows payment success with the order number (SCR-POST-01) and receipt options (UJ-POST-03).
14. Guest presses Done, or the inactivity timer expires -> the session resets to the attract screen (F-POST-05, F-KIOSK-04). The success screen has no timer of its own; it relies on the standard inactivity reset.
**Screens involved:** SCR-START-01, SCR-START-05, SCR-MENU-01..SCR-MENU-11, SCR-BASKET-01, SCR-PAY-01, SCR-PAY-02, SCR-POST-01..SCR-POST-09
**Alternative paths:**
- Order total is zero: no payment step; the order is sent to the POS directly (F-PAY-07).
- Guest pays with another method (UJ-PAY-02, UJ-ALTPAY-01..UJ-ALTPAY-05) or splits the bill (UJ-E2E-05).
- Guest cancels the whole order from the basket (UJ-BASKET-02).
**Error scenarios:**
- Card declined or terminal error -> payment error screen with retry where allowed (F-PAY-03).
- Order cannot be sent to the POS -> order-placement error handling (F-PAY-07).
- Guest stops interacting -> idle warning, then reset (UJ-KIOSK-03).
**Expected final result:** The order is paid, sent to the POS, the guest has an order number and optionally a receipt, and the kiosk is back on the attract screen.
**Related:** F-START-01, F-START-07, F-MENU-02, F-MENU-07, F-BASKET-01, F-BASKET-03, F-PAY-01, F-PAY-02, F-PAY-07, F-POST-01, F-POST-03

### UJ-E2E-02 - Order on a multi-brand kiosk
**Actor:** guest
**User goal:** Choose one of several brands served by the kiosk and order from it.
**Starting point:** The multi-brand selection screen (SCR-START-03), possibly covered by the attract carousel.
**Prerequisites:** The kiosk configuration lists more than one brand; at least one brand is open.
**Steps:**
1. Guest touches the carousel to reveal the brand grid (UJ-START-04).
2. Guest taps an open brand -> that brand's template, theme and default language load.
3. Kiosk shows that brand's welcome screen, or the multi-brand language page (UJ-START-05), or starts the journey directly when the brand has fewer than two languages.
4. The visit continues as UJ-E2E-01 from step 3, using the chosen brand's menu, payment methods and texts.
5. At the end, the session reset returns the kiosk to the brand selection screen and the kiosk default language.
**Screens involved:** SCR-START-03, SCR-START-04, SCR-START-01, then as UJ-E2E-01
**Alternative paths:** Closed brands cannot be selected (F-START-05).
**Error scenarios:** Branding fails to load -> the kiosk retries automatically while showing the loader (F-START-05).
**Expected final result:** An order placed with the chosen brand; the kiosk returns to the brand grid.
**Related:** F-START-05, F-START-06, F-KIOSK-04

### UJ-E2E-03 - Signed-in loyalty member uses rewards
**Actor:** guest (loyalty member)
**User goal:** Identify as a member, use rewards or a past order, and earn points.
**Starting point:** The order type screen with a loyalty prompt (UJ-START-06) or the loyalty sign-in screen (SCR-LOYAL-01).
**Prerequisites:** A loyalty provider is enabled for the brand.
**Steps:**
1. Guest signs in by scanning a code (UJ-LOYAL-01), manually (UJ-LOYAL-02), with the provider's own flow (UJ-LOYAL-03) or by face (F-LOYAL-04).
2. Kiosk routes on: to order history when the member has past orders (SCR-LOYAL-07), otherwise to the menu.
3. Optional: guest reorders a past order (UJ-LOYAL-04).
4. Guest picks awards or rewards where offered (UJ-DISC-03).
5. Guest continues to basket and pays as in UJ-E2E-01 steps 7-15. Logged-in banners show the member state throughout (F-LOYAL-05).
**Screens involved:** SCR-START-05, SCR-LOYAL-01..SCR-LOYAL-07, SCR-DISC-03, SCR-DISC-06, then as UJ-E2E-01
**Alternative paths:** Guest continues without signing in (F-LOYAL-01); guest signs up first (F-LOYAL-06).
**Error scenarios:** Sign-in or sign-up failure dialogs (F-LOYAL-07); reorder failure (F-LOYAL-08); reward cannot be applied (SCR-DISC-04).
**Expected final result:** A paid order linked to the member, with rewards applied.
**Related:** F-LOYAL-01..F-LOYAL-08, F-DISC-03

### UJ-E2E-04 - Scan-and-Go order with an age-restricted item
**Actor:** guest, then staff member
**User goal:** Scan products, get staff approval for a restricted item, and pay.
**Starting point:** The Scan-and-Go screen (SCR-SCAN-02), reached after onboarding on a cocoa kiosk with Scan-and-Go mode on.
**Prerequisites:** Scan-and-Go mode is on; a scanner is connected; the brand allows staff approval of restricted items.
**Steps:**
1. Guest scans items (UJ-SCAN-01); each scan shows the item-added overlay or a not-found / restricted banner (SCR-SCAN-04..SCR-SCAN-07).
2. Optional: guest browses the menu to add unscanned items (SCR-SCAN-08).
3. Guest presses Confirm & Pay -> the age-verification gate opens because a scanned item is restricted (SCR-BASKET-03).
4. A staff member enters their PIN (SCR-BASKET-04) and approves after applying Challenge 25 (SCR-BASKET-05) (UJ-BASKET-03).
5. The approval toast shows and payment resumes as in UJ-E2E-01 step 10.
**Screens involved:** SCR-SCAN-02..SCR-SCAN-08, SCR-BASKET-03..SCR-BASKET-06, then as UJ-E2E-01
**Alternative paths:** Staff declines -> restricted items are removed and the guest continues with the rest (UJ-BASKET-04); guest removes the restricted items at the gate; the brand has no approver -> restricted items are refused at scan time (F-SCAN-05).
**Error scenarios:** PIN not recognised, approval locked or unavailable (F-BASKET-06).
**Expected final result:** A paid order; restricted items are included only with staff approval.
**Related:** F-SCAN-02, F-SCAN-05, F-BASKET-05..F-BASKET-09

### UJ-E2E-05 - Split the bill across payment methods
**Actor:** guest
**User goal:** Pay part of the order with one method (for example a gift card) and the rest with another.
**Starting point:** The payment method chooser (SCR-PAY-01).
**Prerequisites:** More than one payment method is enabled and the first method allows partial payment.
**Steps:**
1. Guest pays part of the total, for example with a gift card whose balance is lower than the total (UJ-ALTPAY-03).
2. Kiosk returns to the method chooser showing the remaining balance (F-PAY-04).
3. Guest pays the remaining balance with another method.
4. When nothing remains, the order is placed and the visit ends as UJ-E2E-01 steps 12-15.
**Screens involved:** SCR-PAY-01, SCR-ALTPAY-05..SCR-ALTPAY-08, SCR-PAY-02, SCR-POST-01
**Alternative paths:** Guest backs out after a partial payment -> the cancel-partial-payments confirmation (F-PAY-04).
**Error scenarios:** Second payment fails -> payment error handling; taken payments are kept until cancelled (F-PAY-03, F-PAY-04).
**Expected final result:** The order is fully paid by two or more payments.
**Related:** F-PAY-01, F-PAY-04, F-ALTPAY-03

### UJ-E2E-06 - Guest walks away or the kiosk stops trading
**Actor:** guest, system
**User goal:** None (the guest left) - the kiosk must recover by itself.
**Starting point:** Any screen during a journey.
**Prerequisites:** Inactivity timer configured; or a configuration change closes the kiosk.
**Steps:**
1. Guest stops interacting -> the "Are you still there?" warning appears (SCR-KIOSK-05).
2. No answer before the warning expires -> the journey is reported as abandoned and the session resets to the start screen (UJ-KIOSK-03, F-KIOSK-04).
3. While the kiosk sits on a start or unavailable screen, the configuration is re-checked; when the kiosk can no longer trade, it shows Lane Closed, Maintenance or At Capacity (UJ-KIOSK-02); when trading resumes it returns to the start screen.
**Screens involved:** SCR-KIOSK-05, SCR-KIOSK-02..SCR-KIOSK-04, SCR-START-01
**Alternative paths:** Guest presses Continue on the warning and carries on.
**Error scenarios:** None visible to the guest.
**Expected final result:** The kiosk is ready for the next guest with no leftover order.
**Related:** F-KIOSK-02, F-KIOSK-03, F-KIOSK-04, F-KIOSK-08

### UJ-E2E-07 - Self-checkout with staff assistance
**Actor:** guest, staff member
**User goal:** Check out on a self-checkout (SCO) kiosk and get help when needed.
**Starting point:** The SCO home screen (SCR-SCO-01).
**Prerequisites:** The kiosk runs the SCO template.
**Steps:**
1. Guest scans or selects products (UJ-SCO-01).
2. Optional: guest requests help (UJ-SCO-03); a staff member signs in and assists (UJ-SCO-02).
3. Guest pays and receives the receipt (SCR-SCO-07).
**Screens involved:** SCR-SCO-01..SCR-SCO-08
**Alternative paths:** See UJ-SCO-01..UJ-SCO-03.
**Error scenarios:** See UJ-SCO-01..UJ-SCO-03.
**Expected final result:** A paid SCO order, with staff help where requested.
**Related:** F-SCO-01

### UJ-E2E-08 - Order using accessibility mode
**Actor:** guest who needs accessible navigation
**User goal:** Complete an order using the accessibility layout, physical navigation keys and audio guidance.
**Starting point:** The attract screen, with the accessibility button or a headphone connection.
**Prerequisites:** The kiosk has an accessibility button or a navigation pad.
**Steps:**
1. Guest turns on accessibility mode or plugs in headphones -> the welcome message dialog explains the controls (UJ-START-07).
2. Guest moves focus between controls and selects them with the navigation keys; screen content is announced (UJ-PRES-01).
3. The visit continues as UJ-E2E-01 with the accessible layout on every screen.
4. On session reset, accessibility mode is turned off for the next guest.
**Screens involved:** SCR-START-07, SCR-PRES-02, then as UJ-E2E-01
**Alternative paths:** Guest turns accessibility mode off mid-journey.
**Error scenarios:** None specific.
**Expected final result:** An order completed with the accessible layout, the navigation keys and spoken guidance.
**Related:** F-START-09, F-PRES-02

## A01 KIOSK — Start-up, configuration, availability, session and device health

### UJ-KIOSK-01 - Kiosk boots to ready
**Actor:** operator/technician (guest indirectly)
**User goal:** Kiosk becomes usable.
**Starting point:** App launch, `/` loading screen (SCR-KIOSK-01).
**Prerequisites:** Device on, app installed.
**Steps:**
1. App shows "Preparing your experience" loading screen -> configuration loads from the local kiosk backend.
2. Config arrives -> branding, template, theme, CSS and default language load (loader may reappear).
3. Kiosk has 1 brand -> `/welcome`; more than 1 -> `/MultiBrandPage` (see A02).
**Screens involved:** SCR-KIOSK-01, SCR-KIOSK-06, then A02 start screens.
**Alternative paths:** Guest changes language on the loading screen (cocoa selector present).
**Error scenarios:**
- Config or branding load fails -> automatic retry every 5 s; guest keeps seeing the loader (or a notification where raised).
- Menu cache not ready -> health error shown + retry every 5 s.
- No default language configured -> maintenance-mode error screen.
**Expected final result:** Attract or brand-selection screen shown.
**Related:** F-KIOSK-01, FR-101..FR-105, BR-KIOSK-01..03

### UJ-KIOSK-02 - Kiosk cannot trade
**Actor:** guest
**User goal:** Order — but the kiosk is unavailable.
**Starting point:** Any unavailable state (closed hours, maintenance, at capacity).
**Prerequisites:** Availability flags in config.
**Steps:**
1. Guest arrives (or taps the attract screen) -> trading check runs.
2. System shows the matching screen: Lane Closed (SCR-KIOSK-02), Maintenance (SCR-KIOSK-03) or At Capacity (SCR-KIOSK-04).
3. (cocoa, behind-attract visibility) -> screen returns to the attract screen after 10 s.
**Screens involved:** SCR-KIOSK-02..04.
**Alternative paths:** Staff opens admin panel via hidden gesture (UJ-KIOSK-04).
**Error scenarios:** None — these ARE the error states.
**Expected final result:** Guest sees why they cannot order; no journey starts.
**Related:** F-KIOSK-02, F-KIOSK-08, FR-106..FR-112,132..135

### UJ-KIOSK-03 - Guest goes idle mid-journey
**Actor:** guest
**User goal:** N/A — system protects the session.
**Starting point:** Any in-journey screen where idle checking is enabled.
**Prerequisites:** `idleTimerIntervalMilliseconds` > 0.
**Steps:**
1. No interaction for the configured idle period (default 30 s) -> "Are you still there?" notification (SCR-KIOSK-05).
2a. Guest taps "Continue" -> warning closes, counters reset, `idle_timeout` (`needs_more_time`).
2b. Guest taps "Cancel my order" -> session resets to the start screen, `idle_timeout` (`abandon`) + journey-abandoned (`idle_timeout_confirm`).
2c. No answer within the same timeout -> session resets, `idle_timeout` (`timeout`) + journey-abandoned (`idle_timeout`); abandon-journey request with `IDLE_TIMEOUT` is posted.
**Screens involved:** SCR-KIOSK-05 -> SCR-START-01 / SCR-START-03 (A02).
**Alternative paths:** Guest interacts before warning -> counters silently reset.
**Error scenarios:** Another notification showing -> warning deferred.
**Expected final result:** Either the guest continues, or the kiosk is back at the start screen with the journey cleared.
**Related:** F-KIOSK-03, F-KIOSK-04, FR-113..FR-121, OP-KIOSK-01/02

### UJ-KIOSK-04 - Staff opens the admin panel
**Actor:** staff member
**User goal:** Access admin functions on a cocoa kiosk.
**Starting point:** `/welcome` or `/orderType` (admin button areas).
**Prerequisites:** None.
**Steps:**
1. Staff taps the admin area 5 times within 4 s -> a cash-machine health check runs.
2a. Health OK or check failed -> admin panel opens.
2b. Health reports an `errorImageUrl` -> ATP error dialog (SCR-KIOSK-07) shows the image; staff chooses open anyway or close.
**Screens involved:** SCR-KIOSK-07, admin panel (A12/staff scope).
**Alternative paths:** Tapping slower than 5-in-4s does nothing (count resets).
**Error scenarios:** Health check request failure -> panel opens anyway.
**Expected final result:** Admin panel open.
**Related:** F-KIOSK-06, FR-125..FR-127, OP-KIOSK-03

## A02 START — Attract screen, brand selection, language selection, order type

### UJ-START-01 - Start an order from the attract screen (single brand)
**Actor:** guest
**User goal:** Begin a new order.
**Starting point:** Welcome/attract screen (`/welcome`, SCR-START-01) on a kiosk that is open and trading.
**Prerequisites:** Kiosk configured, menu cached, interaction enabled.
**Steps:**
1. Guest taps the attract screen (or presses a key on the templates that listen for keys) -> trading check passes, a new empty order is created, journey analytics fire, the menu is (re)loaded (SCR-START-01).
2. System decides whether order-type selection is needed (BR-START-12) -> shows `/orderType` (SCR-START-05) or skips it.
3. Guest taps "Eat In" or "Take Away" -> order type stored, `service_selected` fires, menu filtered to that order type (SCR-START-05).
4. System routes onward -> menu home (or loyalty logging page / order history / scan-and-go per BR-START-20, owned by other areas).
**Screens involved:** SCR-START-01, SCR-START-05, SCR-START-02 (optional)
**Alternative paths:**
- Guest changes language first (UJ-START-03), then taps.
- Cocoa only: guest picks a language on the attract screen and the journey starts automatically ~2 s later with `started_by = language_selector`.
- Multi-brand kiosk: journey begins at UJ-START-04 instead.
**Error scenarios:**
- Kiosk not trading: tap routes to Lane Closed / Maintenance / At Capacity (area A01 screens); the guest cannot start.
- Interaction disabled (config/branding loading): tap does nothing; a full-screen loader may be visible.
- Menu load failure: generic service-error handling/notification (area A01); guest does not reach order type.
**Expected final result:** New order created with selected (or default) order type; guest is on the first menu/loyalty screen; `journey_started`, `session_start` and `service_selected` events sent.
**Related:** F-START-01, F-START-07, F-START-10, FR-241..FR-247

### UJ-START-02 - Start an order when no choice is needed
**Actor:** guest
**User goal:** Begin a new order on a kiosk with one order type, one language and no loyalty.
**Starting point:** `/welcome`.
**Prerequisites:** Brand exposes exactly one order type, one supported language, loyalty disabled.
**Steps:**
1. Guest taps the attract screen -> journey start runs (step 1 of UJ-START-01).
2. System finds no reason to show `/orderType` -> applies the first (only) order type, fires `service_selected`, filters the menu, and routes straight to the menu (or Scan-and-Go/order history destinations per BR-START-20).
**Screens involved:** SCR-START-01
**Alternative paths:** Pre-basket loyalty sign-in supported -> loyalty logging page instead of menu.
**Error scenarios:** Same as UJ-START-01.
**Expected final result:** Guest lands on the menu without seeing an order-type prompt; `service_selected` still fires with the default order type.
**Related:** F-START-07, F-START-10, BR-START-12, BR-START-13, FR-242

### UJ-START-03 - Change the display language
**Actor:** guest
**User goal:** Use the kiosk in a different language.
**Starting point:** `/welcome` (or `/orderType` on cocoa).
**Prerequisites:** Brand offers >1 supported language.
**Steps:**
1. Guest taps the language button -> language overlay opens over the current screen (SCR-START-02).
2. Guest taps a language cell -> overlay closes, full-screen loader shows while the language pack loads, UI switches to the new language (SCR-START-02).
3. (cocoa only) "Language updated" confirmation dialog appears -> auto-closes ~2 s after loading finishes (SCR-START-06); on `/welcome` the journey then starts automatically; on `/orderType` the menu is reloaded in the new language.
**Screens involved:** SCR-START-01, SCR-START-02, SCR-START-06, SCR-START-05
**Alternative paths:**
- Guest taps the X or the dimmed background -> overlay closes, nothing changes.
- Guest picks the already-active language -> overlay closes, no reload, no analytics.
- Legacy overlay: guest can also toggle accessibility mode inside the overlay.
**Error scenarios:**
- Language pack fails to load -> error notification with "Start Over" button; pressing it retries the same change. `change_language_error` fires.
**Expected final result:** UI text, `lang`/`dir` document attributes and (after menu reload) menu content shown in the chosen language; `language_selected` fires. On single-brand kiosks the choice silently reverts to default after 30 s idle on `/welcome` (F-START-04).
**Related:** F-START-03, F-START-04, FR-210..FR-218

### UJ-START-04 - Choose a brand (multi-brand kiosk)
**Actor:** guest
**User goal:** Order from one of several brands on the same kiosk.
**Starting point:** `/MultiBrandPage` (SCR-START-03) — the root screen when >1 brand is configured.
**Prerequisites:** Kiosk configured with 2+ brand configs.
**Steps:**
1. Attract carousel covers the screen when active media exists -> guest taps it -> carousel hides for 60 s revealing the brand grid (SCR-START-03).
2. Guest taps an open, ready brand -> that brand's template, theme and default language load (full-screen loader meanwhile).
3. System navigates to `/welcome` -> the selected brand's welcome screen appears (or the journey starts immediately under BR-START-14).
**Screens involved:** SCR-START-03, SCR-START-01 / SCR-START-04
**Alternative paths:**
- Tap the nav-bar back/cancel button -> carousel re-shows immediately.
- Brand closed or not ready -> cell shows "Sorry, we're closed" / is disabled; guest can only pick another brand.
- No carousel configured or none currently in its time window -> brand grid is visible immediately.
**Error scenarios:**
- Branding load fails -> retried automatically every 5 s; loader stays up.
- All brands closed -> the kiosk shows Lane Closed (BR-START-10, area A01 screen).
**Expected final result:** Selected brand becomes the active brand (location id, language, theme); the guest continues at that brand's welcome screen.
**Related:** F-START-05, FR-219..FR-226, BR-START-07..BR-START-10

### UJ-START-05 - Multi-brand welcome: pick language and continue
**Actor:** guest
**User goal:** Choose a language for this brand, then start ordering.
**Starting point:** `/welcome` rendered as the multi-brand welcome page (SCR-START-04), reached after UJ-START-04 when the brand has >1 language.
**Prerequisites:** Selected brand offers >1 supported language.
**Steps:**
1. Page shows inline language cells headed "Prefer another language?" -> guest taps a language -> UI switches immediately (same load flow as UJ-START-03 step 2).
2. Guest taps "Continue" in the bottom bar -> journey start runs exactly like UJ-START-01 step 1.
3. System shows `/orderType` (this template's conditions almost always apply) -> guest picks an order type.
**Screens involved:** SCR-START-04, SCR-START-05
**Alternative paths:**
- Brand has <2 languages -> this page never appears; journey starts directly after brand selection (BR-START-14).
- From `/orderType`, back returns to this page (not a session reset) when the brand has >1 language (BR-START-19).
**Error scenarios:** Same as UJ-START-01/03.
**Expected final result:** Journey starts in the chosen language.
**Related:** F-START-06, FR-227, BR-START-14, BR-START-19

### UJ-START-06 - Identify with loyalty while choosing order type (cocoa)
**Actor:** guest
**User goal:** Sign in to loyalty before browsing, or skip it and order.
**Starting point:** `/orderType` on a cocoa kiosk where a loyalty banner is shown (F-START-08).
**Prerequisites:** Loyalty enabled; banner visibility rules met.
**Steps:**
1. Guest sees order-type buttons plus a loyalty sign-in banner -> guest may sign in via the banner (flow owned by A06) or ignore it.
2. Guest picks an order type -> if pre-basket sign-in is supported and the guest is still anonymous, the loyalty logging page opens instead of the menu (BR-START-20).
3. Signed-in guest + only one order type -> the single order type is applied automatically (no tap needed) and a "logged in" overlay shows for 2 s.
**Screens involved:** SCR-START-05 (+ A06 loyalty screens)
**Alternative paths:** Guest continues as guest where the loyalty flow permits (A06).
**Error scenarios:** Loyalty provider errors are owned by A06.
**Expected final result:** Order type recorded; guest reaches the menu signed in or as guest.
**Related:** F-START-07, F-START-08, FR-236..FR-238

### UJ-START-07 - Start with audio navigation (NavPed)
**Actor:** guest using the navigation ped and headphones
**User goal:** Operate the kiosk by audio prompts.
**Starting point:** Any screen; typically `/welcome`.
**Prerequisites:** NavPed hardware connected.
**Steps:**
1. Guest plugs in headphones -> screen reader starts, the welcome message dialog opens (SCR-START-07).
2. Guest reads/hears the instructions -> presses "Continue" -> dialog closes; guest navigates with the diamond keys and presses the centre select key on the attract area to start.
**Screens involved:** SCR-START-07, SCR-START-01
**Alternative paths:** Unplugging stops the audio mode (dialog only appears on plug events).
**Error scenarios:** None specific to this area.
**Expected final result:** Guest knows the controls and starts the journey via the focusable attract area (aria-label "Tap here to get started").
**Related:** F-START-09, FR-239, FR-240

## A03 MENU — Menu browsing and item customisation

### UJ-MENU-01 - Browse categories and open an item
**Actor:** guest
**User goal:** Find an item in the menu.
**Starting point:** Menu home `/home` after journey start (SCR-MENU-01).
**Prerequisites:** Menu loaded and filtered for the order type.
**Steps:**
1. Guest sees top-level categories (name + image) -> taps a category -> its children show (SCR-MENU-01/02); `select_item`/category-selection analytics fire.
2. If children include sub-categories, guest drills down further; back returns one level.
3. Guest taps an item -> item detail / variant selection screen (SCR-MENU-04).
**Screens involved:** SCR-MENU-01, SCR-MENU-02, SCR-MENU-04
**Alternative paths:**
- Category with a single item child may select that item directly.
- SCO kiosks: split basket+menu view; guests scan instead (A05).
**Error scenarios:**
- Image fails -> placeholder (initial-letter tile on cocoa) instead of broken image.
- Item/category unavailable for this order type -> it never appears.
**Expected final result:** Guest is on the item screen ready to customise or add.
**Related:** F-MENU-02, F-MENU-03, F-MENU-13, FR-304..FR-312,375

### UJ-MENU-02 - Customise an item and add to order
**Actor:** guest
**User goal:** Configure options/ingredients and add the item.
**Starting point:** Item screen (SCR-MENU-04) after UJ-MENU-01.
**Prerequisites:** Item has option groups.
**Steps:**
1. Guest presses "Continue" (or auto-advances) -> first required option group screen (SCR-MENU-05).
2. Guest picks options respecting min/max; defaults may be pre-selected; "Customise" on a choice opens its nested groups (SCR-MENU-06).
3. Last group satisfied -> "Done"/"Continue" -> ingredient screen (SCR-MENU-07) when the item has ingredients, then review screen (SCR-MENU-08) listing selections + "Change main"/quantity/"Customise".
4. Guest presses "Add to Order {total}" -> item-added confirmation (SCR-MENU-12) -> returns to menu; order totals recompute.
**Screens involved:** SCR-MENU-04..08, SCR-MENU-11, SCR-MENU-12
**Alternative paths:**
- No options: "Add to Order {total}" adds immediately.
- Age-restricted item without options: photo-ID notice dialog first, then add.
- Supersede option picked: all other options in its group are deselected/blocked.
**Error scenarios:**
- Required nested group left empty via Back -> the triggering option is unselected.
- Age notice cancelled -> nothing added.
**Expected final result:** Item (+ options) in the order; "Added To Order" overlay shown.
**Related:** F-MENU-04, F-MENU-07..10, F-MENU-12, FR-321..FR-365,371..374

### UJ-MENU-03 - Accept or decline a cross-sell
**Actor:** guest
**User goal:** Finish adding an item; optionally add suggested items.
**Starting point:** Just added an item that belongs to a cross-sell group.
**Prerequisites:** Cross-sell group resolves to menu items; cross-sell not disabled.
**Steps:**
1. Cross-sell screen "Would you like anything else?" (SCR-MENU-10) -> `view_item_list` fires.
2a. Guest taps suggested items + "Add to Order" -> items added, back to menu.
2b. Guest taps "No Thanks"/Done -> nothing added, back to menu.
**Screens involved:** SCR-MENU-10, SCR-MENU-12
**Alternative paths:** Age-restricted suggestion -> photo-ID notice first; cross-sell with ingredients -> ingredient edit flow.
**Error scenarios:** Restricted-item notice cancelled -> item not added.
**Expected final result:** Order has original item plus any accepted suggestions.
**Related:** F-MENU-11, FR-366..FR-370

### UJ-MENU-04 - Change main item of a combo
**Actor:** guest
**User goal:** Swap the combo's main item.
**Starting point:** Review screen (SCR-MENU-08) for a combo item.
**Prerequisites:** Item has a `COMBO_MAIN` group.
**Steps:**
1. Guest taps "Change main" -> "Select main Item" modal (SCR-MENU-09).
2. Guest picks a different main -> Confirm -> review updates prices per the combo pricing model; Cancel closes.
**Screens involved:** SCR-MENU-08, SCR-MENU-09
**Alternative paths:** Keep default main (pre-selected).
**Error scenarios:** None specific.
**Expected final result:** Combo ordered with chosen main.
**Related:** F-MENU-09, FR-358..FR-362

## A04 BASKET — Order summary, checkout preparation and age verification

### UJ-BASKET-01 - Review and edit the basket
**Actor:** guest
**User goal:** Check lines and totals; fix anything before paying.
**Starting point:** `/orderSummary` opened via Review Order / basket button.
**Prerequisites:** Items added in A03.
**Steps:**
1. Guest reads lines (name, options, quantity, price) and totals -> "Updating Your Order" overlay may flash while totals recompute.
2a. Remove a line -> confirm (two-tap, itsu dialog or cocoa remove) -> line deleted, totals recompute.
2b. Edit a line (items with option groups only) -> item flow (A03) -> save -> line updated.
2c. Cocoa/costa: step a quantity up/down on the line -> totals recompute.
3. Optional: remove an applied coupon/reward/discount row -> recalculation.
**Screens involved:** SCR-BASKET-01, SCR-BASKET-02
**Alternative paths:** Empty basket -> "Your basket is empty"; extras (tip/charity/gift cards) per config.
**Error scenarios:** Totals call with an empty basket is skipped; a totals failure shows a blocking error — cocoa item-add failures roll the item back with "Unable to add this item to your basket. If this issue persists, please contact a member of the team to place your order." + "Ok"; other failures show "Unable to contact point-of-sale system, please contact a member of staff to place your order." + "Start Over".
**Expected final result:** Guest confirms basket and proceeds to pay.
**Related:** F-BASKET-01..03, F-BASKET-11

### UJ-BASKET-02 - Cancel the whole order
**Actor:** guest
**User goal:** Abandon everything and start again.
**Starting point:** `/orderSummary` or menu nav bar.
**Steps:**
1. Guest taps reset -> "Cancel Order?" confirmation ("Go back"/"Cancel order").
2. "Cancel order" -> journey cancel -> session reset -> `/welcome`.
**Screens involved:** SCR-BASKET-02
**Alternative paths:** "Go back" dismisses; idle timeout cancels without confirmation (A01).
**Expected final result:** Kiosk back at start with a clean order.
**Related:** F-BASKET-04, FR-423..FR-425

### UJ-BASKET-03 - Pay with age-restricted items (approved)
**Actor:** guest + staff
**User goal:** Buy an order containing restricted items after staff approval.
**Starting point:** Pay action with a scanned restricted item in the basket (gate applies: SCO mode + `ageRestrictedApprovalAvailable` `true`).
**Steps:**
1. Gate screen "Age Verification" lists restricted items -> "Staff approval".
2. Staff enters a 4-digit PIN on the keypad -> confirm -> verified -> Challenge-25 screen.
3. Staff ticks "I confirm I have applied Challenge 25 and the customer is {max age} or over" -> Approve.
4. Restricted items are marked approved for this order -> "{n} items / Approved / Age verified by staff" toast (2 s) -> payment resumes.
**Screens involved:** SCR-BASKET-03..06
**Alternative paths:** Guest removes the restricted items at the gate -> pay proceeds without them; Back at the gate -> `guest_left` outcome, back to the summary.
**Error scenarios:** Wrong PIN -> "PIN not recognised. Try again." (5 attempts then locked); locked -> "Team approval unavailable" + "Please complete your purchase at the till."; verification endpoint not supported or down -> "Team approval is currently unavailable. Please complete your purchase at the till."
**Expected final result:** Payment proceeds with approval bound to the order nonce.
**Related:** F-BASKET-05..09, FR-426..FR-436

### UJ-BASKET-04 - Pay with age-restricted items (declined)
**Actor:** guest + staff
**User goal:** Handle refusal cleanly.
**Starting point:** Challenge-25 approval screen.
**Steps:**
1. Staff declines -> every age-restricted line is removed from the basket and a declined outcome is reported.
2. Declined screen "Items not approved" (count shown) -> staff taps "Return kiosk to guest" -> guest returns to a basket without the restricted items.
**Screens involved:** SCR-BASKET-05, SCR-BASKET-06
**Alternative paths:** Guest leaves at the gate -> `guest_left` report, same outcome.
**Expected final result:** Sale of restricted items refused; order continues without them.
**Related:** F-BASKET-05..09, FR-432..FR-436

### UJ-BASKET-05 - Enter CPF/CNPJ for the receipt
**Actor:** guest (Brazil)
**User goal:** Add a tax id to the receipt.
**Starting point:** Order summary with the CPF/CNPJ row ("CPF/CNPJ on receipt? (optional)").
**Steps:**
1. Tap row -> "Enter CPF/CNPJ" modal.
2. Type number (progressive mask switches CPF->CNPJ past 11 digits) -> confirm.
3. Valid -> stored on the invoice and shown masked; invalid -> inline error.
**Screens involved:** SCR-BASKET-07
**Alternative paths:** Skip (optional); reopen to edit.
**Expected final result:** Receipt carries the tax id.
**Related:** F-BASKET-10, FR-437..FR-441

## A05 SCAN — Scan routing, Scan-and-Go and scan feedback surfaces

### UJ-SCAN-01 - Scan an item in Scan-and-Go
**Actor:** guest
**User goal:** Add an item by scanning its barcode.
**Starting point:** `/scanAndGo` or `/home` in SCO mode.
**Prerequisites:** `scoModeEnabled`; scanner enabled.
**Steps:**
1. Guest scans a barcode -> routed to the item matcher first.
2a. Match -> item added to the basket (scan-tagged), the scanned-items modal opens on `/scanAndGo`, item-added overlay shows.
2b. No match -> falls through to loyalty/coupon; if nothing claims it, the not-found banner shows (10 s).
2c. Restricted + no approver (`ageRestrictedApprovalAvailable` `false`) -> refusal "Item cannot be purchased here" (7 s); nothing is added.
**Screens involved:** SCR-SCAN-02, SCR-SCAN-03
**Alternative paths:** Browse menu instead; scanned items removable from the modal or the basket.
**Error scenarios:** Unrecognised barcode -> banner (cocoa) / "Unrecognised Barcode" modal (legacy).
**Expected final result:** Scanned items in the basket, mirrored in the modal.
**Related:** F-SCAN-02/03/04/05

### UJ-SCAN-02 - Scan elsewhere (coupon, loyalty, gift card, app payment)
**Actor:** guest
**User goal:** Use the scanner for what the current screen accepts.
**Starting point:** Any screen.
**Steps:**
1. Scan lands on the handler for that screen: gift-card screens -> gift card; `AppPaymentPage` -> payment code; `/orderType`+Avolta -> loyalty sign-in; loyalty screens -> loyalty sign-in; coupon screens -> coupon apply; SCO screens -> item first, else loyalty/coupon.
2. On a non-accepting screen the scan is dropped silently.
**Screens involved:** Screen-dependent.
**Alternative paths:** None — routing decides.
**Expected final result:** Scan consumed by the matching feature area (A06/A07/A08/A09).
**Related:** F-SCAN-01

## A06 LOYALTY — Providers, sign-in, sign-out, order history

### UJ-LOYAL-01 - Sign in by scanning a code
**Actor:** guest
**User goal:** Attach their loyalty account by scanning a card/QR.
**Starting point:** Loyalty screen, `/orderType` (Avolta), or any scan-accepting screen.
**Steps:**
1. Guest scans -> routed per F-SCAN-01 to the provider's sign-in.
2a. Valid -> "Logged In Successfully" overlay + logged-in banner -> menu continues.
2b. Invalid -> sign-in error dialog (Try Again / Log In Manually / Close).
**Screens involved:** SCR-LOYAL-01, SCR-LOYAL-06
**Alternative paths:** Avolta DQR -> code sign-in; plain phone QR -> phone sign-in.
**Expected final result:** Member attached; points/discounts available.
**Related:** F-LOYAL-01/02/05/07

### UJ-LOYAL-02 - Sign in manually
**Actor:** guest
**User goal:** Sign in by phone/email/userId.
**Starting point:** Loyalty banner -> manual flow (or provider screen).
**Steps:**
1. Pick method (skipped when only one) -> enter identifier -> submit.
2. "Validating..." spinner -> success overlay or error dialog.
**Screens involved:** SCR-LOYAL-02, SCR-LOYAL-03
**Expected final result:** Signed in or recoverable error.
**Related:** F-LOYAL-01/03/07

### UJ-LOYAL-03 - Avolta sign-in or sign-up
**Actor:** guest
**User goal:** Use Club Avolta (QR, phone, or create an account).
**Starting point:** Avolta banner or `/orderType` scan.
**Steps:**
1. QR: "Scan your QR Code" -> scanned code signs in.
2. Phone: "No QR code?" -> enter number + country -> Continue.
3. No account -> Signup ("Create Your Avolta Account") -> country -> phone -> Terms accept -> CreatingAccount -> Success.
**Screens involved:** SCR-LOYAL-03/04, SCR-LOYAL-06
**Error scenarios:** Existing phone on signup -> account-exists dialog; unknown phone on signin -> sign-up dialog; terms fetch failure -> Try Again/Cancel.
**Expected final result:** Member attached or account created.
**Related:** F-LOYAL-02/06/07

### UJ-LOYAL-04 - Reorder a past order
**Actor:** guest (signed in)
**User goal:** Reorder from history.
**Starting point:** "Browse past orders" page.
**Steps:**
1. Pick an order -> Reorder -> "Loading your order, please wait".
2a. Success -> basket built from the order.
2b. Failure -> reorder dialog (Try Again / Close).
**Screens involved:** SCR-LOYAL-07
**Expected final result:** Basket populated or recoverable error.
**Related:** F-LOYAL-08

## A07 DISCOUNTS — Coupons, rewards, restaurant and senior discounts

### UJ-DISC-01 - Apply a coupon code
**Actor:** guest
**User goal:** Attach a discount code.
**Starting point:** Basket scan button / manual-entry banner / scan page.
**Steps:**
1. Scan or type the code -> classified (Comanda/Punchh/Loyalty/restaurant/senior/unknown).
2. Applied -> success overlay ("Coupon added to order" / "Reward added to order" / "Discount added to order" / Avolta "You have unlocked your Club Avolta discount.") -> totals recompute.
**Screens involved:** SCR-DISC-01..05
**Alternative paths:** Second code -> limit banner or replacement warning.
**Error scenarios:** Invalid -> error page/dialog; senior below age -> age error.
**Expected final result:** Discount applied or recoverable error.
**Related:** F-DISC-01/02, FR-701..FR-722

### UJ-DISC-02 - Apply a senior discount
**Actor:** guest
**User goal:** Apply senior-ID discount.
**Starting point:** Redeem-code screen / senior scan.
**Steps:**
1. Scan/enter senior ID -> apply.
2a. Valid -> applied.
2b. Below `minimumAge` -> "Sorry, this discount is only available for citizens aged {n} or over".
**Screens involved:** SCR-DISC-04/05
**Expected final result:** Senior discount applied or age error.
**Related:** F-DISC-02

### UJ-DISC-03 - Pick awards after sign-in
**Actor:** guest (signed in)
**User goal:** Choose loyalty awards.
**Starting point:** Post-sign-in with available awards.
**Steps:**
1. "Select Your Discount..." modal lists awards -> select -> "Confirm Selection".
2. More remaining -> "More rewards available" (Add Discount/Close).
**Screens involved:** SCR-DISC-06
**Expected final result:** Chosen awards applied.
**Related:** F-DISC-03

### UJ-DISC-04 - Remove a discount
**Actor:** guest
**User goal:** Remove an applied discount.
**Starting point:** Basket discount line / discounts modal.
**Steps:**
1. Remove -> confirm -> void by type -> totals recompute.
**Error scenarios:** Void failure -> "Sorry, your discount could not be removed."
**Expected final result:** Discount removed.
**Related:** F-DISC-04

## A08 PAYMENT — Method choice, authorisation, errors, tips, donation

### UJ-PAY-01 - Pay by card
**Actor:** guest
**User goal:** Pay the order total by card.
**Starting point:** The basket "Confirm & Pay" action (SCR-BASKET-01).
**Steps:**
1. Guest presses Confirm & Pay -> the pre-payment gates run in order: (SCO only) browse-menu prompt, guest-name prompt when required, tip step, donation prompt, then the hard blocks — transaction-limit check, basket line-limit check, (SCO only) age-verification gate (F-BASKET-03).
2. Guest picks a preset tip or enters a custom amount and presses Continue, or skips the step entirely (SCR-PAY-06).
3. If the donation step applies, the donation modal asks for an amount; guest picks an amount or skips -> the pay path resumes (SCR-PAY-07).
4. When more than one method is enabled, the method chooser lists the runnable methods; guest picks Card (SCR-PAY-01). With a single method the kiosk goes straight to it.
5. The authorising screen shows while the terminal takes the card (SCR-PAY-02); status polls to a terminal state.
6. Authorised -> the kiosk sends the order to the POS (single-flight) -> success page (A10).
**Screens involved:** SCR-BASKET-01, SCR-PAY-06, SCR-PAY-07, SCR-PAY-01, SCR-PAY-02, SCR-POST-02, SCR-POST-01
**Alternative paths:**
- Split payment: guest applies a gift card first, then returns to the chooser for the remainder (UJ-PAY-02, UJ-E2E-05).
- Order total is zero: no payment step; the order goes straight to the POS.
**Error scenarios:**
- Card declined or terminal failure -> the payment error screen offers Try Again (retriable) or back/OK (fatal) (SCR-PAY-04).
- Authorise times out -> the payment-expired dialog (SCR-PAY-05).
- Order fails to reach the POS -> the error path keeps the payment state so the guest is not re-charged (F-PAY-07).
**Expected final result:** A paid order sent to the POS; the guest continues to the success surfaces.
**Related:** F-PAY-01..F-PAY-07

### UJ-PAY-02 - Pay with an alternative method
**Actor:** guest
**User goal:** Pay by cash, crypto, gift card, room charge, app payment or Face-ID.
**Starting point:** The method chooser (SCR-PAY-01).
**Steps:**
1. Guest picks the method -> its flow runs (cash insert, crypto QR, gift-card apply, room-charge details, app code, Face-ID — A09).
2. Authorised -> the kiosk sends the order to the POS -> success (UJ-PAY-01 step 6).
**Screens involved:** SCR-PAY-01, the method's screens (A09), SCR-POST-01
**Alternative paths:** Partial coverage (gift card short) returns to the chooser for the remainder.
**Error scenarios:** Method-specific errors per A09 (cash machine error, crypto expiry, gift-card invalid, room-charge validation, Face-ID PIN failure).
**Expected final result:** A paid order sent to the POS.
**Related:** F-PAY-01, F-PAY-02, F-PAY-07, A09

### UJ-PAY-03 - Add a tip
**Actor:** guest
**User goal:** Add a tip before paying.
**Starting point:** The tip step (reached from Confirm & Pay when tips are on) or the basket tip row's Edit.
**Steps:**
1. Guest picks a preset percentage -> it selects and the jar icon fills to match (SCR-PAY-06).
2. Or guest taps custom -> the custom-amount modal opens -> enters an amount -> Apply sets it (Cancel closes without a tip).
3. Guest presses Continue -> the tip joins the order total (totals recalculate) -> payment continues.
**Screens involved:** SCR-PAY-06
**Alternative paths:** Guest chooses no tip and continues -> the order has no tip.
**Error scenarios:** None specific.
**Expected final result:** The chosen tip is part of the order total at payment.
**Related:** F-PAY-05

### UJ-PAY-04 - Donate at pay time
**Actor:** guest
**User goal:** Round up or donate before paying.
**Starting point:** The donation prompt (modal provider) at the pay gates.
**Steps:**
1. The donation modal shows a charity prompt -> guest picks an amount or skips -> the pay path resumes (SCR-PAY-07).
2. Applied -> the donation joins the order total and is part of the payment.
**Screens involved:** SCR-PAY-07
**Alternative paths:** Skip -> pay continues without a donation; the Pennies inline block is an alternative surface on the basket (A04).
**Error scenarios:** None specific.
**Expected final result:** Donation applied or skipped; the pay journey continues.
**Related:** F-PAY-06

## A09 ALTPAY — Cash, crypto, gift card, room charge, app payment, Face-ID

### UJ-ALTPAY-01 - Pay with cash
**Actor:** guest
**User goal:** Pay with notes/coins and take change.
**Starting point:** Method chooser -> Cash.
**Steps:**
1. Insert cash; the amount paid counts up until the total is covered.
2. Machine processes -> "Take your change" -> order placed.
**Screens involved:** SCR-ALTPAY-01/02
**Alternative paths:** Cancel -> money returned + "payment cancelled" change screen.
**Error scenarios:** Fatal machine error -> error path; machine unavailable -> method hidden.
**Expected final result:** Paid + placed order or money returned.
**Related:** F-ALTPAY-01

### UJ-ALTPAY-02 - Pay with crypto
**Actor:** guest
**User goal:** Pay with a wallet QR.
**Starting point:** Method chooser -> Crypto.
**Steps:**
1. Scan the QR in the wallet app -> payment polls.
2a. Confirmed -> placed.
2b. Expired -> expired dialog -> confirm abandons (`crypto_payment_expired`), cancel closes.
**Screens involved:** SCR-ALTPAY-03/04
**Alternative paths:** Cancel Order confirm.
**Expected final result:** Paid or abandoned.
**Related:** F-ALTPAY-02

### UJ-ALTPAY-03 - Pay with a gift card
**Actor:** guest
**User goal:** Spend a gift card, in full or partial.
**Starting point:** Method chooser -> Gift Card.
**Steps:**
1. Scan / manual entry / PED -> balance shows.
2a. Balance covers -> pay in full -> placed.
2b. Balance short -> pay a partial amount -> back to chooser for the rest.
**Screens involved:** SCR-ALTPAY-05..08
**Error scenarios:** Already-activated -> GifCardAlreadyAdded; other -> GiftCardError.
**Expected final result:** Card value applied; remainder via another method.
**Related:** F-ALTPAY-03

### UJ-ALTPAY-04 - Charge to a room
**Actor:** guest (hotel)
**User goal:** Bill the order to a room.
**Starting point:** Method chooser -> Room Charge.
**Steps:**
1. Select hotel -> enter details -> validate.
2. Confirm on checkout ("The order amount will be charged to your room") -> Charge room -> placed.
**Screens involved:** SCR-ALTPAY-09..11
**Error scenarios:** Validation failure -> RoomChargeConfirmError.
**Expected final result:** Order billed.
**Related:** F-ALTPAY-04

### UJ-ALTPAY-05 - Pay by face
**Actor:** guest
**User goal:** Pay with Face-ID.
**Starting point:** Method chooser -> Face ID.
**Steps:**
1. Look into the camera -> provider may ask a 2FA PIN -> enter it.
2a. Valid -> "Processing Face ID payment" -> placed.
2b. Bad PIN -> "Enter a valid code." -> retry.
**Screens involved:** SCR-ALTPAY-13/14
**Alternative paths:** Cancel confirm.
**Expected final result:** Paid or cancelled.
**Related:** F-ALTPAY-06

## A10 POST — Success page, notifications, receipts, wait-time

### UJ-POST-01 - Collect the order
**Actor:** guest
**User goal:** Confirm the order and know how to collect it.
**Starting point:** The last payment authorising (UJ-PAY-01 step 6).
**Steps:**
1. The waiting screen holds while the order is sent to the POS (SCR-POST-02).
2. The success page shows the order number (shortened to its last digits when configured) plus Done — or "Pick a store" on a multi-brand kiosk (SCR-POST-01); loyalty footers show for signed-in members.
3. Guest presses Done -> the session resets to the start screen; or the guest stops interacting -> the inactivity timer resets it.
**Screens involved:** SCR-POST-02, SCR-POST-01, SCR-START-01
**Alternative paths:** Multi-brand: "Pick a store" returns to brand selection.
**Error scenarios:** Print failure -> "Still need a receipt? Please ask our staff at the counter." and the journey continues.
**Expected final result:** The guest saw the order number; the kiosk is back on the attract screen with a clean session.
**Related:** F-POST-01, F-POST-05

### UJ-POST-02 - Set order notification
**Actor:** guest
**User goal:** Choose how the order finds them (buzzer, tent card, table, phone, name).
**Starting point:** The notification step in the post-order flow (method per venue config).
**Steps:**
1. Guest picks a method -> its capture page shows: buzzer ("Grab a buzzer and enter the number below"), tent card ("Grab a tent card and enter the number below"), table ("Enter your table number below"), phone (SMS), or guest name (SCR-POST-03..06).
2. Guest enters the identifier -> it validates -> it is stored on the order.
3. The journey continues to the success page.
**Screens involved:** SCR-POST-03..06
**Alternative paths:** Guest name captured earlier at the pay gates when mandatory (feature 162); puck fulfilment where the venue runs it.
**Error scenarios:** Invalid number/phone/name -> Continue stays disabled or an error shows; SMS failure -> `SmsErrorDialog`.
**Expected final result:** The notification identifier is stored on the order.
**Related:** F-POST-02

### UJ-POST-03 - Get a receipt
**Actor:** guest
**User goal:** Take a receipt.
**Starting point:** The receipt step after the order (per `kioskReceiptOptions`).
**Steps:**
1. Guest picks a channel -> Print prints it (SCR-POST-07); Email opens the email modal (SCR-POST-08); SMS sends it (SCR-POST-09); QR/photo shows the code.
2. Email: guest types an address -> Send enables only when valid -> sent -> "receipt sent" state.
3. Done -> the session resets to the start screen.
**Screens involved:** SCR-POST-07..09
**Alternative paths:** Guest skips -> straight to Done.
**Error scenarios:** Print failure -> "Still need a receipt? Please ask our staff at the counter."; invalid email -> Send disabled; SMS failure -> `SmsErrorDialog`.
**Expected final result:** A receipt delivered or a clear failure message.
**Related:** F-POST-03

## A11 PRES — Theming, accessibility, keyboards, formatting, analytics

### UJ-PRES-01 - Browse the kiosk in accessibility mode
**Actor:** guest
**User goal:** Complete an order without touch, using focus navigation and spoken guidance.
**Starting point:** Any screen, with the accessibility button or a navigation pad.
**Steps:**
1. Guest presses the accessibility button on the nav bar -> `accessibilityModeEnabled` flips on -> every surface switches to the accessible layout (larger targets, accessibility classes) (SCR-PRES-02).
2. Guest moves focus with the navigation keys -> `AccessibleNavigation` moves through sections then elements in order (`selectable-accessibility-*`); a modal traps focus until it closes.
3. Each screen and change is announced through `ScreenReaderAnnouncement`/`Announcements`.
4. The journey continues as a normal order with the accessible layout on every screen.
**Screens involved:** Every screen (a11y overlays each); SCR-PRES-02 for the toggle.
**Alternative paths:** Guest toggles the mode off mid-journey -> the standard layout returns.
**Error scenarios:** None specific.
**Expected final result:** A full order completed via focus navigation and announcements; the mode resets off at session end.
**Related:** F-PRES-02

### UJ-PRES-02 - Enter text in your language
**Actor:** guest
**User goal:** Type in their language/keyboard.
**Starting point:** Any text field (e.g. name entry, email, manual code).
**Steps:**
1. Guest taps the field -> the on-screen keyboard opens in the right language layout (9 layouts ship) or a numeric keypad for number fields (SCR-PRES-03).
2. Guest types -> `maxLength`/`inputPattern` constrain entry; invalid keys don't enter.
3. Guest confirms -> the value applies; Cancel closes without it.
**Screens involved:** SCR-PRES-03 over the calling screen.
**Alternative paths:** Cocoa uses the tabbed keyboard; Avolta uses a dedicated alphabetic keyboard.
**Error scenarios:** Over-length/invalid characters are rejected at the key.
**Expected final result:** Text entered correctly in the guest's language.
**Related:** F-PRES-03

### UJ-PRES-03 - Read a branded, localised UI
**Actor:** guest
**User goal:** See brand styling and correct localised formatting.
**Starting point:** Every screen.
**Steps:**
1. The kiosk loads -> the server theme (when feature 170 on) or brand defaults apply tokens, page overrides and logos (SCR-PRES-01).
2. The active language drives translations, keyboard layout and `dir` (RTL languages flip).
3. Money formats via `ts.formatCurrency`; text/layout helpers keep surfaces consistent.
**Screens involved:** Every screen.
**Alternative paths:** Theme load fails -> brand defaults render.
**Error scenarios:** Missing translation -> fallback text shows.
**Expected final result:** A consistent, branded, correctly localised UI.
**Related:** F-PRES-01, F-PRES-04

## A12 SCO — Self-checkout screens, clerk validation, template catalogue

### UJ-SCO-01 - Guest self-checkout
**Actor:** guest
**User goal:** Scan/add items and pay on an SCO kiosk.
**Starting point:** The SCO home screen (SCR-SCO-01).
**Steps:**
1. Guest scans an item or browses products -> the item adds; an unrecognised barcode shows a modal (A05).
2. Guest reviews the order on the SCO order summary (SCR-SCO-03).
3. Guest pays -> SCO payment -> authorising -> success -> print receipt (SCR-SCO-07).
**Screens involved:** SCR-SCO-01..SCR-SCO-07
**Alternative paths:** Guest requests help mid-journey (UJ-SCO-03); a staff member signs in and assists (UJ-SCO-02).
**Error scenarios:** Unrecognised barcode -> modal; payment failure -> payment error path (A08).
**Expected final result:** A paid SCO order with a receipt.
**Related:** F-SCO-01

### UJ-SCO-02 - Staff helps a guest
**Actor:** staff member
**User goal:** Unlock staff actions and act on the order.
**Starting point:** The SCO staff-login screen (help requested or direct).
**Steps:**
1. Staff opens Staff Login -> "Staff Login" + keypad shows (SCR-SCO-05).
2. Staff enters the PIN -> it validates against `kioskConfig.pinCode` (via `/clerk`) -> staff product summary opens (SCR-SCO-06).
3. Staff picks an action -> Reset Session / Approve Item / Delete Item / Print last receipt / Done runs -> the journey resumes.
**Screens involved:** SCR-SCO-05, SCR-SCO-06
**Alternative paths:** Cancel help returns without signing in.
**Error scenarios:** Wrong PIN -> wrong-login-code message, retry allowed.
**Expected final result:** The order is actioned by staff.
**Related:** F-SCO-01

### UJ-SCO-03 - Guest requests help
**Actor:** guest
**User goal:** Call a staff member.
**Starting point:** The help button on SCO home (SCR-SCO-01).
**Steps:**
1. Guest taps Help -> the help-requested screen shows "Help is on the way" / "Please wait." (SCR-SCO-04).
2. Staff arrive (UJ-SCO-02) or the guest taps Cancel Help -> the request cancels -> back to the journey.
**Screens involved:** SCR-SCO-04
**Alternative paths:** Cancel help mid-wait.
**Error scenarios:** None specific.
**Expected final result:** Staff alerted or the request cancelled.
**Related:** F-SCO-01
