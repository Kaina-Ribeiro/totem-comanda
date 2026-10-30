# Screens and Navigation

Every page, modal, dialog, overlay, toast and banner the application shows, with its elements, the actions
available, where each action leads, when each element is visible, and its loading, empty, error and success
states. A screen identified by a route path (for example `/orderSummary`) is a full page; anything else is
shown over or inside another screen. Where several renderings exist for one screen, the default comes first
and the brand differences are listed under **Variants**. Status legend and identifiers: see `features.md`.

## A01 KIOSK — Start-up, configuration, availability, session and device health

### SCR-KIOSK-01 - Loading screen
**Route / placement:** `/` (root route)
**Template values:** Single rendering (with cocoa-style language selector)
**Purpose:** Shown while configuration loads on start-up and full reloads.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Loading image + title | Animated graphic + "Preparing your experience" | Always (hidden while a notification is up) |
| Subtitle | "The kiosk is starting up and will be ready soon. If you'd like to order now, please try another kiosk or ask a team member for assistance." | Always |
| Language selector | Change language | Always (when >1 language) |

**Navigation:** Automatic exit to `/welcome` or `/MultiBrandPage` when configuration finishes.
**Conditional visibility:** Content hidden while a notification is displayed.
**States:** loading (default); retry loop invisible to guest except error notifications.
**Variants:** None.
**Related:** F-KIOSK-01, FR-101..FR-105

### SCR-KIOSK-02 - Lane Closed screen
**Route / placement:** `/laneClosed` (analytics `lane_closed_page`)
**Template values:** `laneClosedPage` -> laneClosedPage / laneClosedCocoaPage / laneClosedCostaPage / shakeshack laneClosedPage
**Purpose:** Tells the guest the kiosk/location is closed.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title | "CLOSED" (default/costa), "Closed" (cocoa) or configured `closedMessage.title` | Always |
| Subtitle/description | Configured `closedMessage.description` when present | Cocoa, when configured |
| Logo | Brand logo (shakeshack: dedicated closed logo) | Always |

**Navigation:** Entered from the trading check / config when all order types are unavailable; lane re-open returns to `/welcome`. Cocoa behind-attract mode auto-returns to `/welcome` after 10 s.
**Conditional visibility:** Only shown when the lane-closed visibility rule allows; `NEVER_SHOW`/`SHOW_BEHIND_ATTRACT_SCREENS` change presentation.
**States:** static; no buttons.
**Variants:** default, cocoa, costa, shakeshack (logo+message).
**Related:** F-KIOSK-02, F-KIOSK-08, BR-KIOSK-04..09

### SCR-KIOSK-03 - Maintenance Mode screen
**Route / placement:** `/maintenanceMode` (analytics `maintenance_mode_page`)
**Template values:** `maintenanceModePage` -> maintenanceModePage / cocoaMaintenanceModePage / costaMaintenanceModePage
**Purpose:** Kiosk deliberately taken out of service (or fatal config error).
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title | "KIOSK CURRENTLY UNAVAILABLE" (costa: "Kiosk Currentely unavailable"; cocoa: its own title) | Always |
| Subtitle | Apology/inconvenience text (costa: "We apologize for the incovenience") | Always |
| Logo | Brand logo (default variant) | Default variant |

**Navigation:** Entered on maintenance flag or fatal config error; exit only when mode deactivated -> reload to `/`.
**States:** static.
**Variants:** default, cocoa, costa.
**Related:** F-KIOSK-02, F-KIOSK-08

### SCR-KIOSK-04 - At Capacity screen
**Route / placement:** `/atCapacityMode` (analytics `kiosk_at_capacity_page`)
**Template values:** `atCapacityModePage` -> notImplementedDefaultBehaviour fallback / cocoaAtCapacityModePage / costaAtCapacityModePage
**Purpose:** Kitchen temporarily at capacity.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title | "Sorry," + "our kitchen is currently at capacity" (costa/cocoa equivalent single line) | Always |
| Subtitle | "We will resume taking orders shortly." | Always |

**Navigation:** Entered from the trading check; exit when capacity flag clears.
**States:** static.
**Variants:** default, cocoa, costa.
**Related:** F-KIOSK-02, F-KIOSK-08

### SCR-KIOSK-05 - Idle warning notification
**Route / placement:** modal notification over any in-journey screen
**Template values:** Single rendering (notification framework)
**Purpose:** Warn the guest before the session is abandoned.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title | "Are you still there?" | Always |
| "Cancel my order" button | Destructive; abandons journey now | Always |
| "Continue" button | Dismisses warning, resets counters | Always |
| Auto timeout | Abandons journey after the same idle period | Always |

**Navigation:** Abandon -> root screen (`/welcome` or `/MultiBrandPage`).
**Conditional visibility:** Suppressed while another notification is visible; disabled on the screens listed in F-KIOSK-03.
**States:** shown / hidden / timed-out.
**Variants:** shakeshack IdleOverlay (partially confirmed).
**Related:** F-KIOSK-03, FR-113..FR-120

### SCR-KIOSK-06 - Notification / banner system
**Route / placement:** modal overlay or banner over any screen; cocoa stacked notifications
**Template values:** `notification`/`stackedNotifications` slots; `stackedNotificationsCocoa`
**Purpose:** Show errors, warnings, retries and transient confirmations.
**Elements and actions:** title text; zero+ action buttons (default/destructive); optional auto-timeout action; banner variant non-blocking.
**Navigation:** Stays on current screen; buttons may retry or navigate.
**Conditional visibility:** One modal at a time.
**States:** shown/hidden/timed-out.
**Variants:** default Notification, BannerNotification; cocoa Notification + NotificationContainer + StackedNotifications; costa Notification; itsu Notification.
**Related:** F-KIOSK-05, FR-122..FR-124

### SCR-KIOSK-07 - Admin panel entry + ATP error dialog
**Route / placement:** invisible/quiet button on cocoa `/welcome` (button) and `/orderType` (banner); ATP error dialog over current screen
**Template values:** `adminPanelButton` -> adminPanelCocoaButton
**Purpose:** Staff-only route into the admin panel.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Admin tap area | Counts taps: 5 within 4 s opens the panel | Cocoa welcome/order-type |
| ATP error dialog | Shows the `errorImageUrl` image; open-anyway + close actions | When cash health reports an error image |

**Navigation:** Admin panel (staff scope); dialog closes back to current screen.
**States:** counting / dialog open.
**Variants:** cocoa only.
**Related:** F-KIOSK-06, UJ-KIOSK-04

## A02 START — Attract screen, brand selection, language selection, order type

### SCR-START-01 - Welcome / attract screen
**Route / placement:** `/welcome` (analytics screen name `welcome_page`)
**Template values:** `welcomePage` -> welcomePage / welcomePlainPage / welcomeCarouselPage / welcomeCocoaPage / welcomeCostaPage / welcomeItsuPage / welcomeMultiBrandPage (last one is SCR-START-04)
**Purpose:** Idle attract screen; first guest touchpoint of a single-brand kiosk.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Tap area / start button | Starts the ordering journey (F-START-10). Default variant: a button labelled "Tap here to get started". Plain/carousel/cocoa variants: whole screen is the tap target, no visible button. Costa: button "Start your order". itsu: "touch to order!" | Always (disabled no-op while the kiosk accepting input is false) |
| Brand logo | Active brand logo | Always except carousel/cocoa/itsu when at least one background media is shown (logo hidden) |
| Background carousel | Rotating images/videos per F-START-02 | carousel, cocoa, costa, multi-branch variants only |
| Language button | Current language name (+ icon on plain variants); opens SCR-START-02 | >1 supported language (cocoa order-type nav can force-show) |
| Accessibility button | Toggles accessibility mode | cocoa (BLACK mode button) and costa variants; legacy language overlay also has one |
| Admin panel button | Staff admin entry point (banner/button variant) | cocoa only |
| Version text | App version | Always (edge of screen) |
| Location id text | Active location id | Always (edge of screen) |
| Loading overlay | Full-screen spinner | While config/branding/language loads |

**Navigation:** Arrived at automatically after configuration loads (single brand) or after brand selection (multi-brand). Tap -> `/orderType` or onward per BR-START-12/20.
**Conditional visibility:** Language button needs >1 language; cocoa action buttons (language + accessibility) hidden when the location is closed AND closed-messaging visibility is `NEVER_SHOW`; the multi-brand language page is skipped entirely for brands with <2 languages (BR-START-14).
**States:** loading (full-screen overlay over the whole page); interaction disabled (taps ignored); closed (cocoa hides action buttons, tap still evaluated against trading check on press — closed kiosk shows Lane Closed, see area A01).
**Variants:** default `welcomePage` (logo + start button); `welcomePlainPage` (fullscreen tap target, language button); `welcomeCarouselPage` (carousel + fullscreen tap target); `welcomeCocoaPage` (carousel, invisible tap area, language + accessibility + admin buttons); `welcomeCostaPage` (carousel + "Start your order" button + Costa language + accessibility); `welcomeItsuPage` (static image background, "touch to order!", "make it yours" strapline); `welcomeMultiBrandPage` is a different screen — SCR-START-04.
**Related:** F-START-01, F-START-02, F-START-10, FR-201..FR-209

### SCR-START-02 - Language selection overlay
**Route / placement:** modal overlay over `/welcome` and `/orderType` (and other screens that host the language button; only start-area usages documented here)
**Template values:** None (shared overlay with two renderings: legacy grid and plain list)
**Purpose:** Let the guest pick another supported language.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Header | Title: legacy overlay "Language Selection"; plain overlay "Select a language" (cocoa/costa) or "Language Selection" (itsu/default plain) | Always |
| Language cells | One per supported language: language name, optional flag/style class, per-language greeting text (`languageSelector.hello.<code>`); current language ticked | Always; sorted alphabetically with default language first (BR-START-02) |
| Close button (X) | Closes overlay without changes; aria-label "Close language selection dialogue" | Plain overlay only |
| Background tap | Closes overlay without changes | Always |
| Accessibility toggle | Toggles accessibility mode | Legacy (non-plain) overlay only |
| Loading overlay | Full-screen spinner | While a language pack loads |
| Focus trap | Keyboard focus stays inside dialog; header focused on open | Plain overlay |

**Navigation:** Opened by the language button; any close path returns to the hosting screen.
**Conditional visibility:** Never rendered when the brand has 0–1 languages (button hidden, overlay unreachable).
**States:** visible/hidden; loading (spinner while pack downloads); error -> notification with "Start Over" retry button (not inside the overlay itself).
**Variants:** legacy grid overlay (default `welcomePage`, `welcomePlainPage`; cells ~280 px grid, accessibility toggle, no X button — closed by background tap); plain list overlay (carousel/cocoa/costa/itsu welcome + cocoa/costa order type; X button, greeting text, scroll shadow).
**Related:** F-START-03, FR-210..FR-216

### SCR-START-03 - Multi-brand selection screen
**Route / placement:** `/MultiBrandPage` (analytics screen name `multi_brand_page`); this is the root/landing screen when the kiosk has >1 brand
**Template values:** `multiBrandPage` -> multiBrandPage / multiBrandItsuPage
**Purpose:** Let the guest pick which brand to order from.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Brand cells | Logo per configured location; tap selects brand if open + ready; closed brands show info icon + "Sorry, we're closed" and are dimmed; button disabled when brand is neither open nor ready | Always |
| Header | "What are you craving today?" (`multibrand.headerTitle`) | Always (default variant) |
| Attract carousel overlay | Multi-brand carousel media covering the selector; tap hides it 60 s (only if kiosk trading); auto-returns after 60 s | When `multiBranding.carousel` has currently-active media |
| Back/cancel button | Re-shows the carousel immediately (itsu "x cancel"; default back button in nav bar) | Always |
| Accessibility toggle | Toggles accessibility mode; portrait-oriented layouts show it in the bottom bar | itsu variant; default variant enlarges grid in accessibility mode |
| Version + kiosk id | Small text at screen edge | When carousel not covering screen |
| Loading overlay | Full-screen spinner | While brand config or branding loads |

**Navigation:** Landing after kiosk config when more than one brand configured; selecting a brand loads its branding then goes to `/welcome` (or starts the journey directly under BR-START-14). Session reset (the session reset) also returns here and clears brand config.
**Conditional visibility:** Carousel only when active media exists; version/kiosk id hidden while carousel covers.
**States:** loading (spinner); brand not ready / closed (dimmed + closed message); all brands closed -> Lane Closed (area A01); interaction disabled (taps ignored).
**Variants:** default (`multiBrandPage` value; trading check before hiding carousel); itsu (`multiBrandItsuPage`; no trading check on carousel tap, dedicated bottom bar with accessibility toggle + "x cancel").
**Related:** F-START-05, FR-219..FR-226

### SCR-START-04 - Multi-brand welcome (language) page
**Route / placement:** `/welcome` on multi-branch-template kiosks when the language-page variant is configured
**Template values:** `welcomePage` -> welcomeMultiBrandPage
**Purpose:** Language picker shown instead of an attract screen on multi-brand kiosks.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Header | Language icon + "Prefer another language?" | Always |
| Language cells | Same cells as SCR-START-02 (name, greeting, tick on current); tap applies language immediately | Always |
| Continue button | "Continue" — starts the journey (same as attract tap) | In bottom nav bar (hidden when <2 brands configured) |
| Brand logo | Active brand logo | Always |
| Version + location id | Small text | Only when nav bar hidden (<2 brands) |
| Loading overlay | Full-screen spinner | While languages/branding load |

**Navigation:** Reached after brand selection when brand has >1 language; "Continue" -> journey start (`/orderType` next). Back from `/orderType` returns here when brand has >1 language (BR-START-19).
**Conditional visibility:** Whole page skipped (journey auto-starts) when selected brand has <2 languages.
**States:** loading; accessibility mode (layout adjusts, auto-margin disabled).
**Variants:** multi-branch template only.
**Related:** F-START-06, FR-227

### SCR-START-05 - Order type selection screen
**Route / placement:** `/orderType` (analytics screen name `eat_in_or_out_page`)
**Template values:** `orderTypePage` -> orderTypePage / orderTypeCocoaPage / orderTypeCostaPage / orderTypeItsuPage / orderTypeBkPage / orderTypeShackPage / orderTypeMultiBrandPage
**Purpose:** Ask Eat In (`DINEIN`) or Take Away (`TAKE_OUT`).
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Order type buttons | One button per offered order type: image/icon + label (see Variants for titles/labels). Tap records order type and advances | Always; only `DINEIN`/`TAKE_OUT`, `DINEIN` first (BR-START-11) |
| Title | Prompt text (per variant) | cocoa, costa, bk, shakeshack |
| Back / close button | cocoa: back button in nav bar (Avolta or theming on). shakeshack: header close. Others: QSR nav bar back/cancel | Per variant; behaviour BR-START-19 |
| Language selector | Same overlay as SCR-START-02; after change the menu reloads in the new language | cocoa footer (>1 lang) or nav bar (force-shown when nav bar used) |
| Accessibility button/toggle | Toggles accessibility mode | cocoa, costa (accessibility screen), bk/itsu nav bar |
| Loyalty sign-in banner | Sign-in prompt per F-START-08 | cocoa only, conditions in F-START-08 |
| Logged-in overlay | Confirmation overlay for 2,000 ms after sign-in | cocoa, only when >1 order type |
| Logo | Brand logo | default, costa, multi-branch variants |

**Navigation:** Arrived from journey start when BR-START-12 applies; order-type tap -> menu (or loyalty logging / order history / scan-and-go per BR-START-20). Back -> `/welcome` (multi-brand template with >1 language) or session reset to root screen.
**Conditional visibility:** Whole screen skipped when restaurant has ≤1 order type AND ≤1 language AND loyalty disabled; cocoa auto-applies the single order type when the guest becomes signed in and only one order type exists.
**States:** loyalty banner visible/hidden per F-START-08; column vs row button layout under `KIOSK_THEMING` (custom images replace icons; direction `row`|`column`, column by default when an image exists).
**Variants:** cocoa "What service would you like today?" / "Eat In" / "Take Away"; costa "Where will you be having your order?" / "Eat In" / "Take Away"; itsu "Eat In" / "Take away"; bk "Order Here for Dine in or Take Away!" / "Eat In" / "Take away" (+ burger image, hidden in accessibility mode); shakeshack "Would you like to dine in or take out?" / "Dine In" / "Take Out"; default & multi-branch "Eat In" / "Take Out", no title.
**Related:** F-START-07, F-START-08, FR-228..FR-238

### SCR-START-06 - Language changed confirmation dialog
**Route / placement:** dialog over the hosting screen (cocoa template only)
**Template values:** None (cocoa-only dialog, no template slot)
**Purpose:** Confirms the UI switched language so the change is announced before the journey continues.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Greeting | `languageSelector.hello.<new code>` in the new language ("Hello" fallback) | After language pack loaded |
| Confirmation line | Check icon + "Language updated" | After language pack loaded |
| Loading spinner | Full-screen loader inside the dialog | While the language pack loads |
| (accessibility) | aria-label "Language changed to {language}" | Always |

**Navigation:** No buttons. Auto-closes ~2 s after the language finishes loading; the close either hides the dialog or runs the caller's callback (on `/welcome` that callback starts the journey with `started_by = language_selector`; on `/orderType` it reloads the menu).
**States:** loading / confirmed.
**Variants:** cocoa only.
**Related:** F-START-03, BR-START-16, FR-215

### SCR-START-07 - Welcome message dialog (audio navigation)
**Route / placement:** dialog over current screen (cocoa template only)
**Template values:** `welcomeMessageDialog` -> welcomeMessageDialogCocoa
**Purpose:** Teaches NavPed audio-navigation controls when headphones are plugged in.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title | "Welcome to the text to speech kiosk experience" | Always |
| Body | Instructions for the volume button, four diamond navigation keys, centre select key with raised tactile ident, 3-second long-press help recap | Always |
| Continue button | "Continue" — closes the dialog | Always |

**Navigation:** Appears on headphone-plug key event; Continue dismisses back to the current screen.
**States:** shown/hidden only.
**Variants:** cocoa only.
**Related:** F-START-09, FR-239, FR-240

## A03 MENU — Menu browsing and item customisation

### SCR-MENU-01 - Menu home (categories)
**Route / placement:** `/home` (analytics `home_page`)
**Template values:** `homePage` -> homePage / homeCocoaPage / homeCostaPage / homeItsuPage / homeBkPage / homeBoparanPage / homeShackPage / homeV2Page / homeSCOPage
**Purpose:** Root menu screen listing top-level categories.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Category cells | Image + name; tap opens level | Always; batches of 60 |
| Title/subtitle | "Browse the menu" / "Don't hesitate to ask for help if you get stuck" (brand variants differ) | Always |
| Wait-time line | Kitchen wait estimate under header | When wait time configured |
| Floating/logo area | Brand logo | Most templates |
| Review Order button | Opens the basket | Cocoa nav bar |
| Reset order button | Cancels the order draft | Cocoa nav bar |
| Accessibility button | Toggles accessibility mode | Cocoa/itsu/costa |
| Gift-card purchase banner | Entry to gift-card purchase | Cocoa, when `giftCardPurchaseSettings` set |
| Loyalty (Avolta) banner | Loyalty sign-in banner | Cocoa/costa, when screen gate allows |
| SCO scan banner | "Use scanner for faster checkout" | `scoModeEnabled` |
| Nutritional disclaimer banner | Calorie/allergen disclaimer text | Feature flag on |

**Navigation:** Category tap -> SCR-MENU-02 or SCR-MENU-04; nav bar -> basket (A04), back to welcome (A02).
**Conditional visibility:** Only categories with items available for the current order type.
**States:** loading (handled at start level), empty categories filtered out.
**Variants:** default floating logo + centred list; cocoa nav bar + banners; costa header + welcome selector; itsu paged grid; bk V2 container + BK titles; v2 like default + mounted age dialog; shakeshack left rail + sections; sco split basket/menu.
**Related:** F-MENU-02, FR-304..FR-310

### SCR-MENU-02 - Category level (sub-categories/items)
**Route / placement:** `/home` (same route; in-screen level)
**Template values:** Same `homePage` values; item-cell template slot `mainCategoryComponent`/`productCell` style values per template
**Purpose:** Shows a category's children — more categories or items.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Category/item cells | As SCR-MENU-01/SCR-MENU-03 | Always |
| Header | Selected category name + optional description | Always |
| Back button | Returns to parent level | Navigation bar |
| Top categories rail | Jump between top categories, Home button, scroll up/down | Cocoa category level |
| Tag overlays | Category/item tag badges | When tags configured for this page |

**Navigation:** Item tap -> SCR-MENU-04 (or direct add when no options); back -> SCR-MENU-01.
**Conditional visibility:** Items filtered by order type; cells limited to 60 per lazy batch.
**States:** animation-in on level change.
**Variants:** cocoa uses top-categories rail + scroll shadows; itsu pages categories with prev/next swipe zones and page counter.
**Related:** F-MENU-02, F-MENU-03, F-MENU-13

### SCR-MENU-03 - Item cell (in-grid)
**Route / placement:** inside category grids
**Template values:** per-template cell surfaces
**Purpose:** Represents one purchasable item.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Image | Item image; placeholder on failure | Always when image exists |
| Name/label | `shortName` or `name` | Always |
| Price | Minimum price, or "+" add button (default), or price label; "from" pricing when `showFromPrice` | Always |
| Calories | "{n} kcal" | When `calories` set and template renders it |
| Popular badge | "Popular" marker | Cocoa, on the entity marked default |
| Tag badges | customizedItemTag badges | When scheduled/applicable |
| Quantity stepper | Inline qty on item-option cells | Cocoa ItemOptionsList |

**Navigation:** Tap -> item screen or direct add.
**Conditional visibility:** Whole cell removed when unavailable for the order type.
**States:** selected/deselected (item-option lists), image-failed.
**Variants:** cocoa card; default image+name+"+" price button; costa/itsu/bk/shakeshack/boparan own cells.
**Related:** F-MENU-03

### SCR-MENU-04 - Item details / variant selection
**Route / placement:** `/home` (in-screen product view)
**Template values:** product area of `homePage` tree; `singleItemProduct`/`itemWithOptions` style slots (cocoa)
**Purpose:** Show item detail and pick a child variant/quantity before customisation.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Product image + info | Image, name, description, kcal, item-label chips, allergen text | Always |
| Item options list | Child variants with qty steppers; default child pre-selected | Multi-child items |
| Quantity stepper | 1..n (decrement disabled at 1) | Single-child items and per-variant |
| Add to Order / Continue button | "Add to Order {total}" when no options, "Continue" when options exist, disabled until a variant selected | Always |
| Age-notice trigger | Photo-ID confirm before add | `verificationAge`/`ageRestriction` > 0 on simple items |
| Back | Returns to category level | Navigation bar |

**Navigation:** Continue/Add -> option stepper (SCR-MENU-05) or confirm -> overlay -> menu.
**Conditional visibility:** Variant list only when entity has >1 child; auto-advance option when `ITEM_WITH_OPTIONS` rule on.
**States:** nothing-selected (button disabled), image-failed placeholder.
**Variants:** cocoa (as above); default product panel with +/- stepper + "Add To Order"; itsu slide-down overlay; costa product overlay; shakeshack item container with Add/Customise buttons.
**Related:** F-MENU-04, F-MENU-13, FR-321..FR-328

### SCR-MENU-05 - Option group stepper (modifiers)
**Route / placement:** in-screen stepper over the product view (cocoa) or modal dialog (legacy)
**Template values:** cocoa `productOptionsSelector`/`optionGroup`/`optionGroupChoice`; legacy `optionGroup` dialog
**Purpose:** Satisfy one option group's min/max selection rules.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Group title + counter | Group name + "selected X of Y" style label | Always |
| Option choices | Name, price (+diff price under forced combos), calories, Popular badge; toggle or stepper when `maximumQuantity`>1 | Always |
| Customise button on a choice | Opens the option's nested groups | When option has nested groups |
| Continue/Next/Done button | Advances when minimum met; label shows running total | When minimum satisfied or optional |
| Back | Saves selections, previous group | Always |
| Stepper progress | Group progress indicator | Cocoa |

**Navigation:** Next group or -> SCR-MENU-07/08; Back -> previous group/item screen.
**Conditional visibility:** Invisible groups (min=1, 1 option, no nested) never shown; cocoa hides `INGREDIENTS`/`INGREDIENT_MODIFIERS`/`COMBO_MAIN` roles here.
**States:** selection at maximum (unselected options disabled); supersede active (others blocked); auto-advance ~200 ms after max reached when the `OPTION_GROUP_MAX_SELECTION` rule is on.
**Variants:** cocoa stepper; legacy modal with "Back"/"Next|Done {price}" buttons; costa/boparan own option group views.
**Related:** F-MENU-07, FR-336..FR-352

### SCR-MENU-06 - Sub-option group screen (nested modifiers)
**Route / placement:** in-screen layer over SCR-MENU-05
**Template values:** `productSubOptionsSelector`/`subOptionGroup`/`subOptionGroupChoice` (cocoa); `subOptionGroups` dialog (legacy)
**Purpose:** Complete the nested option groups belonging to one selected option.
**Elements and actions:** One sub-group at a time (pre-selects first); option cells with same min/max/quantity rules; per-option quantity stepper when `maximumQuantity`>1; Continue/Previous buttons; label shows required count ("{minimum} required" style).
**Navigation:** Continue -> next sub-group or back to parent group; Previous/back -> parent (empty required group unselects the parent option).
**States:** per-group min tracking; composite sub-options handled inline.
**Variants:** cocoa screen; legacy SubOptionGroups dialog with per-group save.
**Related:** F-MENU-07, FR-344..FR-348

### SCR-MENU-07 - Ingredient customisation screen
**Route / placement:** in-screen (cocoa) — full customisation view
**Template values:** `itemWithIngredientsCustomization`, `itemCustomization`, `customizationModal` (cocoa); `ingredientGroup` (shakeshack)
**Purpose:** Add/remove ingredients and toggle composite options.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title/subtitle | "Customise {item}" / "Make it your own" | Always |
| Ingredient groups | Add/Added toggle buttons per option (+price) | `INGREDIENTS`/`INGREDIENT_MODIFIERS` groups present |
| Composite options | Positive/negative toggles ("No X" marked "Removed") | Composite `TOGGLE` groups present |
| Reset | Restore defaults; disabled until a change | Always |
| Cancel / Save Changes | Discard or commit edits | Always |
| Backdrop tap | Cancels | Always |

**Navigation:** Save -> review/item flow; Cancel -> back.
**States:** clean (reset disabled) / modified.
**Variants:** cocoa only; shakeshack `IngredientGroup` editor; costa overlay ingredient edits.
**Related:** F-MENU-08, FR-353..FR-357

### SCR-MENU-08 - Review order item screen
**Route / placement:** in-screen (cocoa)
**Template values:** `reviewOrderItemScreen` (+`orderItemReview`, `orderItemOptionReview`, `nestedOptionsButton`)
**Purpose:** Check the item's full selection and total before adding.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title | "Review your choices" | Always |
| Item block | Image/name + qty | Always |
| Option lines | Each selected option with quantity badge and computed price (+/- under default-selection combo pricing) | Always |
| Change main | Opens combo main modal | Combo items |
| Customise buttons | Reopen nested groups for a line | Options with nested groups |
| Quantity stepper | Item quantity | Always |
| Add/Update button | "Add to Order {total}" or "Update Order {total}" when editing | Always |
| Back | Returns to customisation flow | Always |

**Navigation:** Add/Update -> overlay -> menu; Change main -> SCR-MENU-09.
**States:** add vs update mode.
**Variants:** cocoa only.
**Related:** F-MENU-09, F-MENU-12, FR-358..FR-362, 372

### SCR-MENU-09 - Combo main selection modal
**Route / placement:** modal over review screen (cocoa)
**Template values:** `comboMainItemSelectionModal`
**Purpose:** Change the combo's main item.
**Elements and actions:** Title "Select main Item"; option list (name, image, price diff); Confirm button applies; "Cancel" and backdrop close.
**Navigation:** Confirm -> review screen.
**States:** current main pre-selected.
**Variants:** cocoa only.
**Related:** F-MENU-09, FR-360

### SCR-MENU-10 - Cross-sell screen
**Route / placement:** in-screen (cocoa) or dialog (legacy) after adding an item
**Template values:** `crossSellScreen`/`crossSellGroup` (cocoa); `crossSellGroup` (legacy/shakeshack/costa)
**Purpose:** Offer companion items.
**Elements and actions:** Title "Would you like anything else?"; suggestion cells (image, name, price, kcal, quantity stepper on cocoa); "Add to Order" (disabled until >=1 selected on cocoa) vs "No Thanks"; legacy "Done"; shakeshack "Turn it up"/"Back to menu".
**Navigation:** Either action returns to the menu (item-added overlay may follow).
**Conditional visibility:** Only when a cross-sell group resolves and not disabled.
**States:** nothing selected (add disabled on cocoa).
**Variants:** cocoa screen; legacy dialog; shakeshack/costa own groups.
**Related:** F-MENU-11, FR-366..FR-370

### SCR-MENU-11 - Item-added confirmation overlay
**Route / placement:** transient overlay over menu
**Template values:** `orderItemAddedOverlay` -> orderItemAddedOverlay / orderItemAddedOverlayCocoa / orderItemAddedOverlayCosta / shakeshack variant
**Purpose:** Confirm the item landed in the order.
**Elements and actions:** Check icon + "Added To Order" (default/costa/bk/v2/sco) or cocoa rich card (item name, qty, total, kcal, "{value0} added to your order" aria); auto-dismisses after its timeout (500 ms legacy; cocoa/costa shorter config; gift-card variant 2,000 ms); tap anywhere dismisses.
**Navigation:** Auto-returns to the menu.
**States:** visible/animating/dismissed.
**Variants:** cocoa rich; costa; shakeshack; legacy simple.
**Related:** F-MENU-12, FR-371, 373

### SCR-MENU-12 - Age-restriction notice dialog
**Route / placement:** modal over menu/product screens
**Template values:** Single rendering + cocoa dialog variant
**Purpose:** Warn that photo ID may be required before adding a restricted item.
**Elements and actions:** Title "You may need photo ID"; body "You're about to add an age-restricted product to your order and we may ask you to show proof of your age"; buttons "Cancel" (aborts the add) and "Confirm" (continues the add/customisation).
**Navigation:** Confirm -> proceeds; Cancel -> stays, nothing added.
**Conditional visibility:** Items with `verificationAge`/`ageRestriction` > 0; shown once per order session until confirmed (`isAgeRestrictedConfirmed` suppresses repeats).
**Variants:** generic + cocoa styling.
**Related:** F-MENU-04, F-MENU-11, FR-327, see A04 for the full age-verification gate.

## A04 BASKET — Order summary, checkout preparation and age verification

### SCR-BASKET-01 - Order summary (basket)
**Route / placement:** `/orderSummary`
**Template values:** `orderSummaryPage` -> default / cocoa / costa / bk / boparan / itsu / shakeshack / v2 / sco variants
**Purpose:** Review items, extras and totals; launch payment.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Order lines | Name, options summary, qty, price; Edit (only when the item has option groups) / Remove (variant-specific confirm) | Basket non-empty |
| "18+" age badge | Restricted-item marker (always reads 18+) | `ageRestriction` > 0 AND SCO mode AND `ageRestrictedApprovalAvailable` `true` |
| Extra rows | Applied coupon ("Remove Coupon?"), reward ("Remove Reward?"), restaurant discount, senior discount, tip ("Tip" + Edit), charity line, gift-card purchase ("{amount} Gift Card" + Edit/Remove + "Remove Gift Card?") | Features on + applied |
| "See discounts" / discounts modal | "Your Discounts" / balance / "Discount limit reached" / "Add Discount" / "Close" | Cocoa; discounts available |
| Scan-coupon button | Coupon entry point | Coupon features on, no coupon applied |
| Restaurant-discount overlay | Available discounts; apply | Cocoa; discounts present |
| Totals block | Sub Total, Tax, Service Charge, fee lines, Discounts, charity, Total | Data exists (rules in F-BASKET-02) |
| "Updating Your Order" overlay | "This won't take long" while checkout-load totals run | Cocoa, during recalculation |
| "Checking for vouchers" line | Discount checks running | Cocoa |
| Charity block | Donate amounts + "Donate" | Charity config + Pennies data |
| Empty state | "Your basket is empty" | Basket empty |
| Pay button | "Confirm & Pay" (disabled texts: empty/"Confirm & Pay, is disabled"/"PLEASE WAIT") | Always (cocoa); nav-bar pay elsewhere |
| Reset/cancel order | Confirmation then reset | Cocoa nav bar |
| CPF/CNPJ row | "CPF/CNPJ on receipt? (optional)" | Feature enabled (BR) |
| Scanned/added split | "Added items" vs "Scanned items" + "Item Authorised" | `scoModeEnabled` |
| Gift-card banner | "Gift cards now available" / "Buy Now" | `giftCardPurchaseSettings` |

**Navigation:** Pay -> F-BASKET-03 gates -> payment (A08); Edit -> A03 item flow; Back -> menu.
**Conditional visibility:** totals/discount lines only when data; gates in F-BASKET-03.
**States:** empty, loading totals ("PLEASE WAIT"), deleting confirm, voucher-checking.
**Variants:** default list + QSR nav; cocoa rich cells + itemised fees + extras + updating overlay; costa stepper; bk/boparan default-style; shakeshack "bag" (direct remove, ingredient summaries); itsu remove-confirm dialog; sco split + authorised state.
**Related:** F-BASKET-01..03, F-BASKET-11, FR-401..FR-425, 442..446

### SCR-BASKET-02 - Cancel-order confirmation
**Route / placement:** Modal over basket/menu (cocoa)
**Purpose:** Confirm before discarding the whole order.
**Elements and actions:** Title "Cancel Order?"; confirm-copy; buttons "Go back" (dismiss) / "Cancel order" (reset).
**Navigation:** Cancel order -> `/welcome` via session reset; Go back -> closes.
**Variants:** cocoa dialog; other templates reset via the nav bar.
**Related:** F-BASKET-04, FR-423..FR-425

### SCR-BASKET-03 - Age-verification gate
**Route / placement:** `/ageVerificationGate` (cocoa)
**Purpose:** Pause checkout for staff approval of restricted items.
**Elements and actions:** Title "Age Verification"; explanation "Some items in your order require age verification. A team member will check your ID."; grouped restricted-item rows (image, name, "18+" badge, category + unit price + kcal metadata, "Qty {n}" when >1) each with "Remove"; "Staff approval" button -> PIN entry (analytics `open_pin_entry`); Back -> `guest_left` outcome + order summary.
**Navigation:** Staff approval -> SCR-BASKET-04; Back -> order summary; item remove -> stays on gate.
**States:** items pending approval.
**Variants:** cocoa only.
**Related:** F-BASKET-05, FR-426..FR-430

### SCR-BASKET-04 - Staff PIN entry
**Route / placement:** `/ageVerificationPinEntry` (cocoa)
**Purpose:** Identify the approving staff member.
**Elements and actions:** Staff bar "Staff Verification"; title "Enter your staff PIN" (locked/unavailable: "Team approval unavailable"); 4-dot indicator; keypad digits 0-9 + delete (no confirm key); explicit confirm submits; wrong PIN clears + "PIN not recognised. Try again."; locked -> "Please complete your purchase at the till."; unsupported/unavailable -> "Team approval is currently unavailable. Please complete your purchase at the till."; Back -> gate ("return_to_gate" analytics).
**Navigation:** Valid PIN -> SCR-BASKET-05.
**States:** entering, verifying, invalid, locked, unavailable.
**Variants:** cocoa only.
**Related:** F-BASKET-06, FR-427..FR-430, OP-BASKET-03

### SCR-BASKET-05 - Challenge-25 approval
**Route / placement:** `/ageVerificationChallenge25Approval` (cocoa)
**Purpose:** Let staff approve or decline after seeing the items.
**Elements and actions:** Staff bar "Age Verification"; title "Approve items"; subtitle "Check the customer's ID before confirming."; "{n} item(s) require approval"; same grouped rows as the gate; mandatory checkbox "I confirm I have applied Challenge 25 and the customer is {max required age} or over"; Approve (enabled only when ticked) / Decline / Back.
**States:** pending, approved/continuing, declined.
**Variants:** cocoa only.
**Related:** F-BASKET-07, FR-431..FR-435

### SCR-BASKET-06 - Age-verification declined
**Route / placement:** `/ageVerificationDeclined` (cocoa)
**Purpose:** Acknowledge the refusal and hand the kiosk back.
**Elements and actions:** Staff bar "Verification Declined"; title "Items not approved"; count message (single/plural); "Return kiosk to guest" -> clears declined state and returns to the basket without the items.
**Conditional visibility:** Only renders when a decline actually happened.
**Variants:** cocoa only.
**Related:** F-BASKET-08/09, FR-434..FR-436

### SCR-BASKET-07 - CPF/CNPJ entry modal
**Route / placement:** Modal over order summary (cocoa)
**Purpose:** Optional tax id for the receipt.
**Elements and actions:** Input with progressive CPF/CNPJ mask; validation on confirm (CPF 11 / CNPJ 14 digits + check digits); inline error; Cancel/Confirm.
**Navigation:** Confirm -> stores value, closes; invalid -> stays with error.
**Variants:** cocoa only.
**Related:** F-BASKET-10, FR-437..FR-441

## A05 SCAN — Scan routing, Scan-and-Go and scan feedback surfaces

### SCR-SCAN-01 - Scan routing (no dedicated screen)
**Route / placement:** Every screen where a scanner can fire — the routing routes per route.
**Purpose:** Decide what a scan means here.
**Elements and actions:** See F-SCAN-01 routing table (gift card -> app payment -> Avolta -> scan-and-go -> loyalty -> coupon -> drop).
**Conditional visibility:** Only when `scannerEnabled` and not processing another scan.
**Related:** F-SCAN-01, FR-501..FR-508

### SCR-SCAN-02 - Scan-and-Go page
**Route / placement:** `/scanAndGo` (cocoa, SCO mode)
**Purpose:** The SCO home — scan, browse, basket.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Scanning banner | "Use scanner for faster checkout" + subtitle; opens the scanned-items modal when scans exist | Always |
| Self-checkout carousel | Brand imagery behind the banner | `selfCheckoutScreens` configured |
| Default content | Title + subtitle ("Start scanning your items" style) when nothing scanned yet | Empty scan state |
| Not-found banner | Failed scan message, auto-dismiss 10 s | Last scan unmatched |
| Restricted banner | "Item cannot be purchased here", auto-dismiss 7 s | Refused scan outstanding |
| "Browse Menu" | Browse the full menu | Always |
| Scanned-items modal | Scanned items + remove + subtotal + "Browse Menu"/"Your Order" | After a scan / on return |

**Navigation:** Browse Menu -> menu; Your Order -> `/orderSummary`.
**States:** idle, modal-open, banners.
**Variants:** cocoa only.
**Related:** F-SCAN-02/03, FR-515..FR-520

### SCR-SCAN-03 - Scanned-items modal
**Route / placement:** Modal over the Scan-and-Go page
**Purpose:** List and manage scanned items.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title/subtitle | "Scanned Items" / "View and manage scanned items" | Always |
| Item row | image (initials on failure), name, "18+" badge when enabled, price, "Remove" (aria "Remove {name} from order") | Per scanned item |
| Subtotal | Scanned items subtotal | Always |
| "Browse Menu" | Link back to the menu | Always |
| "Your Order" | Go to the basket | Always |

**Navigation:** Your Order -> basket; Browse Menu -> menu.
**Conditional visibility:** Opens after a scan; re-opens on returning to the page; closes itself when the last item is removed; while open, tapping the scanning banner does NOT re-open it.
**Variants:** cocoa only.
**Related:** F-SCAN-03, FR-515..FR-520

### SCR-SCAN-04 - Item-added overlay
**Route / placement:** Overlay over the menu/SCO page (cocoa)
**Purpose:** Confirm a scan added an item.
**Elements and actions:** "{item} added to your order" aria/title + "{n} kcal" + item count/price; part of the shared item-added surfaces.
**Conditional visibility:** Shows on every successful scan add; a new scan replaces the previous overlay content.
**Related:** F-SCAN-02, FR-509..FR-513

### SCR-SCAN-05 - Not-found banner
**Route / placement:** Inline banner on `/scanAndGo` + inside the scanned-items modal (one surface at a time); legacy SCO shows a modal notification instead.
**Purpose:** Tell the guest the barcode matched nothing.
**Elements and actions:** Title `scanAndGo.notFoundTitle` + subtitle `scanAndGo.notFoundSubtitle` ("The barcode could not be recognised. Please try again or ask for help." style); auto-dismiss 10,000 ms then clears the not-found state; a successful scan clears it earlier; a repeated failed scan keeps it up.
**Variants:** cocoa banner vs legacy "Unrecognised Barcode" / "The system could not identify your barcode. Please try again or ask for help." / "Ok" modal.
**Related:** F-SCAN-04, FR-521..FR-524

### SCR-SCAN-06 - Restricted banner
**Route / placement:** Inline banner on `/scanAndGo` + inside the scanned-items modal (one surface at a time).
**Purpose:** Tell the guest a restricted item can't be sold here.
**Elements and actions:** "Item cannot be purchased here" / "This item is age-restricted and cannot be sold at the kiosk. Please purchase it at the till."; auto-dismiss 7,000 ms.
**Variants:** cocoa only.
**Related:** F-SCAN-05, FR-525..FR-528

### SCR-SCAN-07 - Restricted toast overlay
**Route / placement:** Toast over the menu (cocoa)
**Purpose:** Same refusal as the banner, on the menu surface.
**Elements and actions:** Same copy as SCR-SCAN-06; auto-dismiss 7,000 ms; the two surfaces share one constant.
**Variants:** cocoa only.
**Related:** F-SCAN-05, FR-525..FR-528

### SCR-SCAN-08 - Browse-menu modal
**Route / placement:** Modal on pay (SCO + cocoa, once per flow)
**Purpose:** Ask whether to browse before checkout.
**Elements and actions:** "Want to add anything from the menu?" / "Browse our full menu before you check out" + "Browse Menu" / "No thanks, continue"; the overlay tap continues.
**Navigation:** Browse Menu -> menu; continue -> payment gate continues.
**Variants:** cocoa only.
**Related:** FR-534, A04 FR-422

## A06 LOYALTY — Providers, sign-in, sign-out, order history

### SCR-LOYAL-01 - Loyalty logging screen
**Route / placement:** `LoyaltyLoggingPage` (cocoa)
**Purpose:** Where the guest signs in.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Sign-in banner | Scan prompt / method buttons | Logged out |
| Face-ID button | "Users, order here" (aria "POPID Users, order here") | `faceIdSigninEnabled` |
| Logging spinner | "Validating..." / "Logging in..." + "This won't take long" | Sign-in in flight |
| Logged-in banner | "You are logged in" + provider subtitle | Logged in |

**Navigation:** Success -> menu; Cancel -> back.
**States:** idle, logging, logged-in, error.
**Variants:** multi-method flow vs legacy scan-only banner + manual modal.
**Related:** F-LOYAL-01/03/04, FR-601..FR-612

### SCR-LOYAL-02 - Multi-method sign-in
**Route / placement:** Modal on the loyalty flow (cocoa)
**Purpose:** Pick + enter the identifier.
**Elements and actions:** Title "Link your loyalty account"; method buttons per `supportedSigninMethods`; entry input (phone with dial-code picker for Avolta); Continue (disabled until valid); Cancel (disabled while signing in, aria "Cancel is disabled. Signin is in progress.").
**Variants:** single-method skips the picker.
**Related:** F-LOYAL-01/03, FR-604..FR-612

### SCR-LOYAL-03 - Avolta sign-in
**Route / placement:** Avolta flow (cocoa)
**Purpose:** Club Avolta sign-in.
**Elements and actions:** QRScan ("Scan your QR Code" / "Hold your QR code in front of the scanner to sign in and enjoy your member benefits"); Signin ("No QR code?" / "Enter your mobile phone number below." / "Already a member? Open your Club Avolta app or wallet and hold your QR code in front of the scanner." / placeholder "Enter your phone number..." / "Continue" gated on a valid phone + country); country dial-code picker; last-entered number pre-fills.
**Related:** F-LOYAL-02, FR-613..FR-620

### SCR-LOYAL-04 - Avolta sign-up
**Route / placement:** Avolta flow (cocoa)
**Purpose:** Create a Club Avolta account.
**Elements and actions:** Signup ("Create Your Avolta Account" / "Select your country of residence" / phone / Continue); Terms & Conditions (skeleton while loading, accept required); CreatingAccount ("Almost There!" / "You're just a step away from enjoying your rewards!" / "We are setting up your account..."); Success.
**Related:** F-LOYAL-02/06, FR-628..FR-631

### SCR-LOYAL-05 - Face-ID entry
**Route / placement:** Button on the loyalty screen (cocoa)
**Purpose:** Biometric sign-in.
**Elements and actions:** "Users, order here" button -> Face-ID flow; failure -> error dialog (title + Try Again / continue-as-guest).
**Related:** F-LOYAL-04, FR-621..FR-623

### SCR-LOYAL-06 - Loyalty error dialogs
**Route / placement:** Modals (cocoa)
**Purpose:** Recover from sign-in/sign-up/terms/reorder failures.
**Elements and actions:**
- Sign-in error: "Sign In Error" + manual ("Sorry, we could not sign you in. Please try again or ask our staff for help.") or barcode ("Sorry, we could not recognize the code. Try again or log in with phone number") copy + "Try Again" / "Log In Manually" + "Close"; "More details" expandable (Error Description / Error Code / Location ID / Timestamp).
- Phone-account: "Register Error" + "An account already exists with this phone number. Please sign in to continue." (existing) or "Sign In Error" + "We couldn't find an account with this phone number. Please sign up to join Club Avolta." (unknown) + "OK".
- Sign-up failed: "Register Error" + "Sorry, we could not create the account. Try again or download the app to register" + "Try Again" / "Close" + more-details.
- Terms failed: "Failed to load Terms & Conditions" + "Sorry, an error occurred retrieving the terms and conditions." + "Try Again" / "Cancel".
- Face-ID failed: title + Try Again / continue-as-guest.
- Reorder failed: order-history error + Try Again / Close.
**Related:** F-LOYAL-07, FR-632..FR-640

### SCR-LOYAL-07 - Order history
**Route / placement:** `OrderHistoryPage` (cocoa)
**Purpose:** Browse past orders and reorder.
**Elements and actions:** Title "Browse past orders" / "Select orders to make your ordering faster"; order rows with Reorder; loading announcement "Loading your order, please wait"; error "Past Orders Unavailable" / "Unable to load order history at this time."
**Variants:** cocoa only.
**Related:** F-LOYAL-08, FR-641..FR-644

## A07 DISCOUNTS — Coupons, rewards, restaurant and senior discounts

### SCR-DISC-01 - Scan-coupon page (legacy)
**Route / placement:** `ScanCouponPage` (default/v2/bk)
**Purpose:** Scan a coupon code.
**Elements and actions:** "SCAN QR CODE" + subtitle (or scanner-unavailable copy); "enter manually" button.
**Navigation:** Manual -> `EnterCouponManuallyPage`; scan -> apply -> basket.
**Variants:** legacy pages.
**Related:** F-DISC-01/06, FR-701..FR-710

### SCR-DISC-02 - Enter coupon manually (legacy)
**Route / placement:** `EnterCouponManuallyPage` (+ v2/bk variants)
**Purpose:** Type a code.
**Elements and actions:** "Enter your coupon code" + code keypad + back.
**Variants:** v2/bk layouts.
**Related:** F-DISC-01/06

### SCR-DISC-03 - Discount banners (cocoa)
**Route / placement:** Basket/menu surfaces (cocoa)
**Purpose:** Sign-in and discount prompts.
**Elements and actions:** Sign-in banner (scan/tap variants); manual-entry banner (enabled-feature copy); "Discount limit reached" / "Unlock your discount with ID code" banners; "Coupon added"/"Reward added" confirmations.
**Related:** F-DISC-01/05, FR-701..FR-710, 734..738

### SCR-DISC-04 - Discount error dialogs
**Route / placement:** Modals (cocoa) + `ScanCouponErrorPage` (legacy)
**Purpose:** Recover from apply failures.
**Elements and actions:**
- Invalid coupon: "QR code not valid" / "This QR code can not be used at this location" (Close + more-details; hidden-description variant).
- Add-discount error: "Discount Error" / "A problem occurred while adding your discount" (Try Again/Close + more-details).
- Scan-error page (legacy): retriable "Try again" / non-retriable "THIS QR CODE IS NOT VALID" + "OK" + error details.
- Code already added: "Code already added" / "Only one code may be applied to an order." / "To apply a different code please remove the current code from your order."
- Senior-age error: "Sorry, this discount is only available for citizens aged {n} or over".
- Void failure: "Sorry, your discount could not be removed." (Close + more-details).
- Accesso invalid: "Details not valid" (no description).
**Related:** F-DISC-06, FR-739..FR-744

### SCR-DISC-05 - Replacement warning
**Route / placement:** Modal (cocoa)
**Purpose:** Warn before swapping discounts.
**Elements and actions:** "Replace your current discount?" + Continue/Cancel.
**Related:** F-DISC-02, FR-715..FR-718

### SCR-DISC-06 - Awards selection
**Route / placement:** Modal (cocoa)
**Purpose:** Pick awards to apply.
**Elements and actions:** "Select Your Discount..." + award rows + "Confirm Selection" + close; "More rewards available" follow-up (Add Discount/Close); LoyaltyV2 "Add New Discount" popup ("Redeem Code"/"Log In"/"Select Discounts"); redeem-code screen ("Redeem your discounts" / "Enter code to add your discount or scan your ID for Senior Discount" + Apply).
**Related:** F-DISC-03, FR-723..FR-728

## A08 PAYMENT — Method choice, authorisation, errors, tips, donation

### SCR-PAY-01 - Choose payment method
**Route / placement:** Payment chooser (cocoa `ChoosePaymentMethodPage`)
**Purpose:** Pick how to pay.
**Elements and actions:**

| Element | What it shows / does | Shown when |
|:--|:--|:--|
| Title | "Choose payment" | Always |
| Cash | Cash pay button | `cashReaderReady` |
| Card | Card pay button | `cardReaderReady` |
| Food Stamps | EBT button | card ready + `foodStampEnabled` |
| Crypto | Crypto button + unavailable notification when it can't run | crypto feature |
| Gift Card | One button per `giftcardPaymentTypes` entry | gift-card payments enabled |
| Room Charge | Room-charge button | feature on |
| App Payment | App payment button | feature on |
| Face ID | Face-ID button | feature on |
| Back | Returns to basket | Always |
| "Reversing payment" | "This won't take long" while partials reverse | payments.length > 0 |

**Navigation:** Method -> its flow; Back -> basket.
**Related:** F-PAY-01/04, FR-801..FR-808

### SCR-PAY-02 - Authorising payment
**Route / placement:** Authorising screen (cocoa `AuthorizingPaymentPage` / `AuthorizingPaymentContainer`)
**Purpose:** Wait while the payment authorises.
**Elements and actions:** Processing/authorising indicator; status polls to a terminal state.
**States:** authorising, authorised, failed.
**Variants:** cocoa; legacy processing surfaces.
**Related:** F-PAY-02, FR-809..FR-816

### SCR-PAY-03 - Processing payment
**Route / placement:** Processing screen
**Purpose:** Show progress for longer flows (incl. cash processing).
**Elements and actions:** Progress indicator; ring progress where rendered.
**Related:** F-PAY-02/04, FR-809..FR-816

### SCR-PAY-04 - Payment error
**Route / placement:** `PaymentErrorPage` (+ bk/costa/itsu/shakeshack variants)
**Purpose:** Recover from a failed payment.
**Elements and actions:** Title + subtitle; Try Again (retriable) / back/OK (fatal); payment-expired dialog on authorise timeout; cancel-payment and cancel-partial-payments confirms.
**Variants:** cocoa, bk, costa, itsu, shakeshack error pages.
**Related:** F-PAY-03, FR-817..FR-824

### SCR-PAY-05 - Cancel/expired dialogs
**Route / placement:** Modals
**Purpose:** Guard abandonment + expired payments.
**Elements and actions:** Cancel-payment confirm; cancel-partial-payments confirm; payment-expired notice.
**Related:** F-PAY-03/04, FR-817..FR-828

### SCR-PAY-06 - Tip step
**Route / placement:** `TipPage` (cocoa)
**Purpose:** Add a tip.
**Elements and actions:** Ordered preset tip choices; custom button + custom-amount modal (apply/cancel); jar fill per size; continue.
**Variants:** cocoa only.
**Related:** F-PAY-05, FR-829..FR-834

### SCR-PAY-07 - Donation modal / banners
**Route / placement:** Pay-time modal + banners (cocoa)
**Purpose:** Charity donation prompt + method banners.
**Elements and actions:** Donation modal (amount/skip) when `KioskDonationView.MODAL`; food-stamp banner; loyalty-discounts banner; wait-time line.
**Related:** F-PAY-06, FR-835..FR-840

## A09 ALTPAY — Cash, crypto, gift card, room charge, app payment, Face-ID

### SCR-ALTPAY-01 - Cash insert
**Route / placement:** `CashPaymentPage` (cocoa)
**Purpose:** Insert money.
**Elements and actions:** "Insert cash" + subtitle; amount due; running "Amount paid" (inserted + prior); cancel (disabled while the machine starts accepting money).
**States:** starting, accepting, processing.
**Variants:** cocoa.
**Related:** F-ALTPAY-01, FR-901..FR-910

### SCR-ALTPAY-02 - Cash change
**Route / placement:** `CashChangePage` (cocoa)
**Purpose:** Hand back change (or returned money on cancel).
**Elements and actions:** "Take your change" / "Please take your change and we will process your order." + "Change Due"; cancelling shows the "payment cancelled" title + money-due variant.
**Related:** F-ALTPAY-01, FR-901..FR-910

### SCR-ALTPAY-03 - Crypto payment
**Route / placement:** `CryptoPaymentPage` (cocoa)
**Purpose:** QR wallet payment.
**Elements and actions:** QR + "Scan the QR code to pay"; terms note ("This Bitcoin transaction is governed by Steak n Shake's Terms and Conditions for such payments..." / "The Terms and Conditions can be viewed here."); polling to confirmed/expired; cancel-order confirm.
**Variants:** cocoa.
**Related:** F-ALTPAY-02, FR-911..FR-918

### SCR-ALTPAY-04 - Crypto expired / cancel dialogs
**Route / placement:** Modals
**Purpose:** Expiry + cancel.
**Elements and actions:** Payment-expired dialog (confirm abandons `crypto_payment_expired`, cancel closes); "Cancel Order?" / "Are you sure you want to cancel your order? This will remove all items from your basket." + "Cancel Order"/"Go back".
**Related:** F-ALTPAY-02, FR-915..FR-918

### SCR-ALTPAY-05 - Gift card payment
**Route / placement:** `GiftCardPaymentPage` (cocoa)
**Purpose:** Spend a gift card.
**Elements and actions:** Amount due, available balance, ring progress, "pay in full"/"pay a partial amount"/"Change payment method" (insufficient), data-expiry notice.
**Variants:** cocoa.
**Related:** F-ALTPAY-03, FR-919..FR-930

### SCR-ALTPAY-06 - Gift-card entry modals
**Route / placement:** Number/code/PIN modals + PED interaction page (cocoa)
**Purpose:** Manual card entry or card-present.
**Elements and actions:** Number/code/PIN inputs; PED interaction screen for card modes.
**Related:** F-ALTPAY-03, FR-919..FR-930

### SCR-ALTPAY-07 - Custom amount modal
**Route / placement:** `EnterCustomAmountModal` (cocoa)
**Purpose:** Choose how much of the card to spend.
**Elements and actions:** Amount input + apply/cancel.
**Related:** F-ALTPAY-03, FR-919..FR-930

### SCR-ALTPAY-08 - Gift-card dialogs
**Route / placement:** Modals (cocoa)
**Purpose:** Apply failures.
**Elements and actions:** `GifCardAlreadyAddedDialog` (already-activated); `GiftCardErrorDialog` (other apply errors).
**Related:** F-ALTPAY-03, FR-925..FR-928

### SCR-ALTPAY-09 - Choose hotel
**Route / placement:** `ChooseHotel` (cocoa)
**Purpose:** Pick the staying hotel.
**Elements and actions:** "Select Hotel" / "Please select the hotel you are staying" + hotel list (skeleton while loading) + "Charge room".
**Related:** F-ALTPAY-04, FR-931..FR-938

### SCR-ALTPAY-10 - Room-charge details
**Route / placement:** `EnterRoomChargeDetails` (cocoa)
**Purpose:** Validate guest details.
**Elements and actions:** "Room Details" / "Please enter your details to charge this order to your hotel bill." + fields per `roomChargePaymentTypes` + validation.
**Related:** F-ALTPAY-04, FR-931..FR-938

### SCR-ALTPAY-11 - Room-charge checkout
**Route / placement:** `RoomChargeCheckoutPage` (cocoa)
**Purpose:** Confirm the charge.
**Elements and actions:** "Checkout" / "The order amount will be charged to your room" + Name + Room Number + amount + "Charge room" (spinner while charging); `RoomChargeConfirmErrorDialog` on failure.
**Related:** F-ALTPAY-04, FR-931..FR-938

### SCR-ALTPAY-12 - App payment
**Route / placement:** `AppPaymentPage` (cocoa)
**Purpose:** Code-presented payment.
**Elements and actions:** Title + subtitle; a scan on this route submits the code (A05).
**Related:** F-ALTPAY-05, FR-939..FR-942

### SCR-ALTPAY-13 - Face-ID payment
**Route / placement:** `FaceIdPaymentPage` (cocoa)
**Purpose:** Face-validated payment.
**Elements and actions:** "Pay with" + "Please look into the camera while we validate your ID"; "Processing Face ID payment" / "This won't take long"; cancel confirm.
**Related:** F-ALTPAY-06, FR-943..FR-948

### SCR-ALTPAY-14 - Face-ID 2FA PIN
**Route / placement:** PIN entry on the Face-ID page (cocoa)
**Purpose:** Provider 2FA.
**Elements and actions:** PIN input; bad PIN -> "Enter a valid code."; attempts bounded by the provider session; `CancelFaceIdPaymentConfirmDialog` on cancel.
**Related:** F-ALTPAY-06, FR-943..FR-948

## A10 POST — Success page, notifications, receipts, wait-time

### SCR-POST-01 - Payment success
**Route / placement:** `PaymentSuccessPage` (+ cocoa `PaymentSuccess`, V2, brand variants)
**Purpose:** Confirm the order.
**Elements and actions:** Title + subtitle + "Order number" + number; Done ("Pick a store" multi-brand + "Want to make another order?"); loyalty footers ("You have earned points on this order" / "Claim your loyalty points by scanning the barcode on your receipt"); wait-time where configured.
**Navigation:** Done/Pick a store -> start.
**Variants:** cocoa (+ email-disabled variant), V2, buzzer, shakeshack, bk, costa, itsu, SCO.
**Related:** F-POST-01, FR-1001..FR-1010

### SCR-POST-02 - Waiting screen
**Route / placement:** `WaitingScreen`
**Purpose:** Hold while the order submits.
**Elements and actions:** Waiting indicator; auto-advances to success.
**Related:** F-POST-04, FR-1027..FR-1030

### SCR-POST-03 - Buzzer / tent-card notification
**Route / placement:** `BuzzerNotificationPage`, `TentCardNotificationPage` (cocoa)
**Purpose:** Pick up a buzzer/tent card + enter its number.
**Elements and actions:** "Grab a buzzer and enter the number below" / "Please come to the collection point when the buzzer goes off."; "Grab a tent card and enter the number below" / "Find a free table and we will bring your order over."; number entry.
**Related:** F-POST-02, FR-1011..FR-1018

### SCR-POST-04 - Table-number notification
**Route / placement:** `TableNumberNotificationPage` (cocoa)
**Purpose:** Enter the table number.
**Elements and actions:** "Enter your table number below" + number entry.
**Related:** F-POST-02, FR-1011..FR-1018

### SCR-POST-05 - Phone notification
**Route / placement:** `PhoneNotificationPage` (cocoa, SMS)
**Purpose:** SMS alert.
**Elements and actions:** Phone entry (validated); failure -> `SmsErrorDialog`.
**Related:** F-POST-02, FR-1011..FR-1018

### SCR-POST-06 - Guest name
**Route / placement:** `OrderCustomerName` / `EnterGuestNameModal` (cocoa + default)
**Purpose:** Capture the guest's name on the order.
**Elements and actions:** Name entry (validated; mandatory when feature 162 on); shows on success.
**Related:** F-POST-02, FR-1011..FR-1018

### SCR-POST-07 - Print receipt
**Route / placement:** `PrintReceiptPage` + `PrintReceipt`
**Purpose:** Print the receipt.
**Elements and actions:** Print choice; failure -> "Still need a receipt? Please ask our staff at the counter."
**Related:** F-POST-03, FR-1019..FR-1026

### SCR-POST-08 - Email receipt
**Route / placement:** `EmailReceipt`/`EmailReceiptModal` + `EmailInput` (+ shakeshack, costa `EmailReceiptCosta`)
**Purpose:** Send an email receipt.
**Elements and actions:** "emailReceiptTitle" + "This email will not be used for marketing purposes" + Cancel/Send Receipt; sent -> "receiptSentTitle"/"receiptSentSubtitle".
**Variants:** cocoa/default, shakeshack, costa.
**Related:** F-POST-03, FR-1019..FR-1026

### SCR-POST-09 - SMS / QR receipt
**Route / placement:** SMS + QR/photo receipt surfaces
**Purpose:** SMS or photo/QR receipt.
**Elements and actions:** Per `kioskReceiptOptions`; SMS failure -> `SmsErrorDialog`.
**Related:** F-POST-03, FR-1019..FR-1026

## A11 PRES — Theming, accessibility, keyboards, formatting, analytics

### SCR-PRES-01 - Theme surface (cross-cutting)
**Route / placement:** Every screen (ThemeProvider/BrandingContainer/PageThemeWrapper)
**Purpose:** Apply the server theme + brand logos.
**Elements and actions:** Tokens, CSS, page overrides, images, logos (Logo/FloatingLogo/HomeFloatingLogoManager), icon font.
**Variants:** Per-brand.
**Related:** F-PRES-01, FR-1101..FR-1110

### SCR-PRES-02 - Accessibility surfaces
**Route / placement:** Nav bar accessibility button (cocoa + v2 + bk/itsu/costa), every screen in a11y mode
**Purpose:** Accessible operation.
**Elements and actions:** Toggle; accessible layout; focus trap; announcements; NavPed navigation.
**Variants:** cocoa/v2/bk/itsu/costa.
**Related:** F-PRES-02, FR-1111..FR-1122

### SCR-PRES-03 - On-screen keyboards/keypads
**Route / placement:** Text/number fields
**Purpose:** Input without a hardware keyboard.
**Elements and actions:** Language layouts (9 shipped), tabbed keyboard (cocoa), numeric keypads, currency symbol map, maxLength/inputPattern.
**Variants:** Per-language + template.
**Related:** F-PRES-03, FR-1123..FR-1130

### SCR-PRES-04 - Shared display primitives
**Route / placement:** Modals, containers, buttons, dialogs, sliding modals, titles, spinners, scrollbars
**Purpose:** Consistent presentation primitives.
**Elements and actions:** Modal/Container/Button/Dialog/SlidingModal/Title/ProgressSpinner/LoadingFullScreen/CocoaScrollBar/Money/Animated/RingProgress.
**Related:** F-PRES-04, FR-1131..FR-1138

## A12 SCO — Self-checkout screens, clerk validation, template catalogue

### SCR-SCO-01 - SCO home
**Route / placement:** `mode/sco/HomePage`
**Purpose:** SCO landing + browse.
**Elements and actions:** `HelpButton` (header), `HomeSideBar`, `ProductsSelector`/`Products`/`ProductsCell`, `MenuSettings`, `NavigationBar`.
**Related:** F-SCO-01, FR-1201..FR-1204

### SCR-SCO-02 - SCO product page
**Route / placement:** `mode/sco/ProductPage`
**Purpose:** Product details.
**Elements and actions:** Product details + add.
**Related:** F-SCO-01

### SCR-SCO-03 - SCO order summary / basket
**Route / placement:** `mode/sco/OrderSummary`
**Purpose:** Review the order.
**Elements and actions:** Order lines + pay.
**Related:** F-SCO-01, A04

### SCR-SCO-04 - Help requested
**Route / placement:** `mode/sco/HelpRequestedPage` + `HelpRequestedContent`
**Purpose:** Tell the guest staff are coming.
**Elements and actions:** "Help is on the way" / "Please wait." + `CancelHelpButton`.
**Related:** F-SCO-01, FR-1205..FR-1208

### SCR-SCO-05 - Staff login
**Route / placement:** `mode/sco/StaffLoginPage` + `StaffLogin`
**Purpose:** Unlock staff actions.
**Elements and actions:** "Staff Login" + subtitle + keypad; PIN validated vs `kioskConfig.pinCode`; wrong code -> wrong-login-code message; `CancelHelpButton`.
**Related:** F-SCO-01, FR-1209..FR-1212, OP-SCO-01

### SCR-SCO-06 - Staff product summary
**Route / placement:** `mode/sco/StaffProductSummaryPage` + `StaffProductSummary`
**Purpose:** Staff order actions.
**Elements and actions:** "Reset Session" / "Approve Item" / "Delete Item" / "Print last receipt" / "Done".
**Related:** F-SCO-01, FR-1213..FR-1214

### SCR-SCO-07 - SCO payment journey
**Route / placement:** `mode/sco/{PaymentPage,AuthorizingPaymentPage,PaymentSuccessPage,PrintReceiptPage}`
**Purpose:** SCO payment flow.
**Elements and actions:** Payment + authorising + success + print receipt (SCO variants).
**Related:** F-SCO-01, A08/A10

### SCR-SCO-08 - Scanner manager
**Route / placement:** the SCO scan routing
**Purpose:** Legacy SCO scan handling.
**Elements and actions:** Routes scans; unrecognised barcode -> modal (A05).
**Related:** F-SCO-01, A05
