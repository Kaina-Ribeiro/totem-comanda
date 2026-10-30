# Data and Integrations

The business entities, the backend operations and the devices and providers that the functionality needs.
Only what is required to reproduce the behaviour is listed.

## How the kiosk connects

- The kiosk user interface talks to exactly one counterpart: a kiosk service running on the same machine,
  reached on a loopback address. Every backend operation below is a request to that local service. The
  local service is responsible for reaching the cloud platform, the POS, payment terminals, printers, cash
  machines and other devices; how it does so is outside this specification.
- Some hardware signals reach the user interface directly from the desktop shell rather than through the
  local service: keyboard-wedge (HID) barcode scanners, status-terminal discovery and reporting, and the ATP
  hosting board (see A01 and A05).
- What the local service does with each request (proxy, cache, offline answers) is not known from this
  application and is not described.
- Each entity is defined once, by the area that owns it (`ENT-<AREA>-NN`). Other areas list only the extra
  fields they use. Each backend operation (`OP-<AREA>-NN`) states when it is called, what is sent, what is
  read from the answer, and how the interface reacts to errors, retries and timeouts.

## A01 KIOSK — Start-up, configuration, availability, session and device health

### Entities

### ENT-KIOSK-01 - Kiosk configuration (top level)
| Field | Meaning | Used by |
|:--|:--|:--|
| `brandConfigs` | Per-brand/location configs; count decides landing route | Routing, trading check |
| `defaultLanguage` | Kiosk fallback language | Language setup |
| `kioskID` | Kiosk identity | Status reporting, UI id |
| `idleTimerIntervalMilliseconds` | Idle timeout; >0 enables | Idle manager |
| `printerEnabled` | Gate printer status checks | Printer checker |
| `scoModeEnabled` | Scan-and-go routing | A02 post-start routing |
| `multiBranding` | Multi-brand carousel/branding | Multi-brand selector |
| `isInMaintenanceMode()` / `isInAtCapacityMode()` | Availability flags | Trading check |
| `closedMessagingAvailability` / `unavailableScreenVisibility` | Closed-message presentation | Lane-closed behaviour |

### ENT-KIOSK-02 - Notification descriptor
| Field | Meaning | Used by |
|:--|:--|:--|
| `key` | Notification identity | Dedup |
| `title` | Message text | Render |
| `options[]` | Action buttons {title, type default/destructive, action} | Buttons |
| `timeout` | Auto-expire ms | Auto-action |
| `timeoutAction` | Runs on expiry | Auto-action |

### ENT-KIOSK-03 - Closed message (carousel settings)
| Field | Meaning | Used by |
|:--|:--|:--|
| `title` | Custom closed title | Lane Closed |
| `description` | Custom closed subtitle | Lane Closed |
| `unavailableScreenVisibility` / `closedMessagingAvailability` | `ALWAYS_SHOW`/`SHOW_BEHIND_ATTRACT_SCREENS`/`NEVER_SHOW` | Presentation |

### Fields used from other areas' entities
- Brand config (A01-owned fields listed above plus A02 uses): `isOpen`, `isDineInAvailable`, `isTakeOutAvailable`, `language`, `locationId`, `venueId`, `channelId`, `name`.
- Order details (A04): `orderNonce`, `orderTotal` used in session-reset/abandon requests.

### Backend operations

### OP-KIOSK-01 - Reset session
`POST /resetSession`-style request to the local kiosk backend (service `resetSessionService`).
- Called when: session reset (idle timeout, manual cancel, next-order, back-to-root).
- Request data: `orderNonce`, `orderTotal`, `currency`, `locationId`.
- Response data used: none.
- Errors: logged; reset still completes locally.
- Retries: none observed.

### OP-KIOSK-02 - Abandon journey
`POST /abandonJourney` (service `abandonJourneyService`).
- Called when: idle abandonment (`IDLE_TIMEOUT`) or guest cancel (`CANCELLED_BY_GUEST`).
- Request data: derived from the order — order nonce/details, `locationId`, `venueId`, abandon type.
- Response data used: none.
- Errors: fire-and-forget.

### OP-KIOSK-03 - Cash health check
- `GET /health/cash/latest` on the local kiosk service -> `CashHealthResponse` (`errorImageUrl` -> ATP error dialog).
- `POST /admin/cash/refresh-status` -> `CashHealthResponse`; called once per app start when `cashEnabled` && `cashReaderReady` false, and via admin actions.
- Called when: admin-panel gesture completes / app start refresh.
- Errors: admin panel opens anyway.

### OP-KIOSK-04 - Kiosk status and action reporting
- `POST /health/kiosk-app/status` — `KioskStatus` body: `statusType` (`APPLICATION_STARTING`/`APPLICATION_START_FAILED`/`TRADING`/`UNAVAILABLE`), `reason` (`MAINTENANCE`/`AT_CAPACITY`/`STORE_CLOSED`/`UNKNOWN`), `category` (`APPLICATION_STATUS`/`DISPLAYING_SCREEN`), `message`. Sent on status changes incl. each config refresh (`TRADING` or `UNAVAILABLE`+reason).
- `POST /health/kiosk-app/track-key-action` — `KioskAction` body: `type` (`START_JOURNEY_SUCCESS`/`START_JOURNEY_FAILED`/`APPLICATION_START_FAILED`), `kioskStatusType` (current status attached), `reason` (`FAILED_START_JOURNEY`/`FAILED_LOAD_MENU`/`FAILED_DOWNLOAD_TEMPLATE_SCRIPT_FILES`), `message`.
- Side effect: every report is also written to the local metrics log (`electronLogAPI`, logId `metrics-log`).
- Response: none consumed. Errors: logged, swallowed.

### OP-KIOSK-05 - Printer status
`printerStatusService` -> printer availability boolean.
- Called when: landing on listed screens (BR-KIOSK-18), `printerEnabled`, not maintenance.
- Response: `available` updates printer state.

### OP-KIOSK-06 - Configuration load
Configuration/branding/template/language loads from the local backend (the `Configuration` flow behind `/`); failures retry every 5 s. Details are the config service contract (endpoints partially traced — see coverage).

### OP-KIOSK-07 - Open admin panel
`POST /admin/open` on the local kiosk service.
- Called when: admin gesture completes (after cash health check passes/bypassed).
- Response: none consumed — the panel content is hosted by the local kiosk service, outside this app.
- Errors: logged.

### OP-KIOSK-08 - Scanner status
Scanner status service call -> availability boolean.
- Called when: route changes to `/welcome` or `/orderSummary`, `scannerEnabled`, not maintenance, HID keyboard scanner off.
- Errors: timeout -> status unchanged; other failure -> unavailable.

### OP-KIOSK-09 - Terminal status reporting (main-process bridge)
Component statuses (`monitoredComponent`, `requiresAttention`, `message`) to configured status terminals through the desktop shell: discovery via UDP ports (default 9,837) or strict-IP TCP (default 9,838); failed report re-triggers discovery.
- Called when: component status changes (e.g. `HELP_BUTTON`).
- Response: none consumed.

### Device and external integrations
- Printer: status service (OP-KIOSK-05); errors surface as notifications (specific transient notifications in payment areas).
- Scanner: availability checker feeding flags used by loyalty-scan prompts (OP-KIOSK-08); scan processing suppresses idle checks.
- Cash machine: health refresh + on-demand health fetch for admin (OP-KIOSK-03).
- Status terminals: component statuses via main-process bridge (OP-KIOSK-09).
- Payment terminal (PED): gift-card PED interaction screen suppresses idle; PED events live in payment areas.
- Navigation ped (NavPed): key events drive accessibility (see A02); resets on session reset.
- Screen orientation: dev-only orientation listener restarts the app (production cannot rotate).
- ATP board: config file `C:\comanda\config\kiosk-app-atp-config.json`; board init + `applicationDidStart` + heartbeat scheduler; wrapper HTTP `willappear` endpoints show the window; `SIGTERM` closes the wrapper; `errorImageUrl` surfaced in admin-entry dialog.
- Windows packaging: WiX installer + Shell Launcher scripts lock the device into kiosk shell.

## A02 START — Attract screen, brand selection, language selection, order type

### Entities

### ENT-START-01 - Carousel media (attract media)
One media entry in `restaurant.branding.carousel` or `multiBranding.carousel`.

| Field | Meaning | Used by |
|:--|:--|:--|
| `url` | Media URL; `.mp4`/`.webm`/`.ogg` (or `?id=` ending so) => video | Carousel render |
| `duration` | Slide display time in ms; default 7,000 ms; videos use real duration | Rotation timer |
| `timeStart`, `timeEnd` | 24-h window bounds (string compare); inverted = overnight | Active-media filter |
| `altText` | Accessibility label; presence also makes the slide focusable | Accessibility |
| `locale` | Language the media is for | Locale filter (see unknowns) |
| `useAsDefaultLocale` | Fallback locale flag | Locale filter |

### ENT-START-02 - Language (supported language + language config)
| Field | Meaning | Used by |
|:--|:--|:--|
| `code` | Language code, e.g. `en-gb` | Selection, packs, `lang` attribute, analytics |
| `name` | Display name, e.g. "English" | Selector cells, button label |
| `language.default` | Brand's default language code | Sorting pin, reset target, initial setup |
| `language.supported` | List of supported languages | Button visibility, cell list |
| `defaultLanguage` (kiosk level) | Multi-brand fallback + forced language on selector | Setup, BR-START-04 |

### ENT-START-03 - Order type
Not a stored entity; a string enum: `DINEIN` ("Eat In"/"Dine In") and `TAKE_OUT` ("Take Away"/"Take Out"). `DELIVERY` and other values are filtered out before display. Stored on the order as `orderType`.

### Fields used from other areas' entities
- Brand config / `brandConfigs[]` (owned by A01): `locationId`, `isOpen`, `isDineInAvailable`, `isTakeOutAvailable`, the brand's data is ready, `restaurant.branding.logo`, `restaurant.orderTypes`, `restaurant.branding.carousel`, `restaurant.branding.backgroundImage`, `restaurant.country`, `language`, `authConfig.loyaltySettings`, `avoltaEnabled`, `isLoyaltyNstYoyo`, `isLoyaltyAccesso`, `venueId`, `name`, `channelId`.
- Kiosk config (A01): the configured brands, `multiBranding`, `defaultLanguage`, `kioskID`, `scoModeEnabled`, maintenance mode is active, at-capacity mode is active, closed-messaging visibility settings.
- Order details (A04): `orderNonce`, `orderType`, `punchh.rewardBarcode`, `journeyStartedTimestamp`.
- Feature flags (A01): `KIOSK_THEMING`; page overrides `orderTypePage.eatInImage` / `takeAwayImage` / `orderTypeButtonsDirection`.
- Scanner state (A05): scanner availability (legacy loyalty-banner rule); serial scan listener on cocoa order-type page (Avolta).

### Backend operations

### OP-START-01 - Notify journey start
`POST /journeyStarted` on the local kiosk backend (kiosk-service base URL).
- Called when: journey start runs (attract tap / Continue / cocoa language-start), AFTER the trading check and order creation. Fire-and-forget.
- Request data: `locationId`, order `nonce`.
- Response data used: `journeyStartedTimestamp` — stored on the order and into analytics unless the order already has one.
- Errors and UI reaction: logged; reported to kiosk-status telemetry as `journeyStartFailed`; Sentry exception. The guest journey is NOT blocked.
- Retries/timeouts: none (single attempt, non-blocking).

### OP-START-02 - Load localization pack
`GET /resource/language?id=<languageCode-lowercase>&locationId=<locationId>` on the local kiosk backend (remote path), falling back to bundled `resources/localization/<code>.json`.
- Called when: initial language setup, guest language change, language reset.
- Request data: language code, optional location id.
- Response data used: full localization resource; merged over the bundled default pack, cached in memory per session.
- Errors and UI reaction: the language change path -> error notification with "Start Over" retry + `change_language_error` analytics; the silent language set (reset) path -> logged only; initial setup -> maintenance/configuration error path (A01).
- Retries/timeouts: manual retry via the notification button; branding-language load retries automatically every 5 s.

### OP-START-03 - Reset session
Session reset request sent to the local kiosk backend when the journey ends/resets (manual reset, idle timeout, back from order type in the reset path).
- Called when: the session reset / back-from-order-type reset path (BR-START-19), idle timeout (A01).
- Request data: `orderNonce`, `orderTotal`, `currency`, `locationId`.
- Response data used: none.
- Errors/retries: not verified in this area (see area A01).

### OP-START-04 - Load menu (used by start)
Menu load triggered by journey start and by language change on the order-type screen; the loaded menu is then filtered client-side by order type (filtered by the chosen order type).
- Endpoint details owned by A03; only the call placement is confirmed here (blocking call inside journey start; failure uses the generic service-error handling of A01).

### Device and external integrations
- **Navigation ped (NavPed)**: hardware keyboard events; `HEADPHONE_PLUGGED`/`HEADPHONE_PLUGGED_FALLBACK` key events start the screen reader, record headphone state and show the welcome message dialog (F-START-09). NavPed keys also drive focus navigation over the attract area and language cells (all interactive elements carry `selectable-accessibility-*` classes).
- **Serial scanner**: listened to on the cocoa order-type screen when Avolta loyalty is enabled (scan routing itself is A05/A06).
- **Analytics (GA4)**: events fired by this area — `welcome_page`/`multi_brand_page`/`eat_in_or_out_page`/`language_selection_page` screen views; `journey_started` (`started_by`, `journey_start_time`); `session_start`; `service_selected` (`service_type`); `language_selected` (`language_selected`, `previous_language`, `screen_name`); `change_language_error`; `accessibility_mode`; `journey_end` (`ended_by` = `automatic`|`next_order_button`, on reset paths); `onboarding_completed` (`source = service_selection`).
- **Kiosk-status telemetry** (to kiosk-service): `journeyStartSuccess`/`journeyStartFailed` actions; cocoa welcome mount reports status "Showing welcome screen"; help button etc. owned by A01.
- **Printers/scanners/PED/cash**: no direct interaction in this area.

## A03 MENU — Menu browsing and item customisation

### Entities

### ENT-MENU-01 - Menu / MenuDetails
| Field | Meaning | Used by |
|:--|:--|:--|
| `entities` | Root categories/items (sorted by `displayOrder`) | Category lists |
| `currency` | Display currency | Prices |
| `showCategoriesPrice` | Show category prices | Category cells |
| `customizedItemTags` | Tag definitions | Badges |
| `itemTagIndex`/`categoryTagIndex` | Precomputed tag lookups | Badge render |
| `menuForDineIn`/`menuForTakeOut` | Pre-filtered views | Order-type filtering |

### ENT-MENU-02 - Menu entity (category/item)
| Field | Meaning | Used by |
|:--|:--|:--|
| `id`,`plu`,`tsId`(deprecated),`name`,`shortName`,`slugName`,`description`,`image`,`smallIcon`,`largeIcon` | Identity + display | Cells/details |
| `type` | `CATEGORY`/`ITEM` | Navigation |
| `childEntities` | Children | Levels |
| `defaultEntity` | Pre-selected child | Variant list |
| `price`, `servicePriceOverride` | Base + per-order-type override | Price display |
| `calories` | kcal text | Cells/details |
| `itemLabels` | Label codes | Chips |
| `barcodes` | Scan codes | SCO |
| `optionGroups` | Customisation | Stepper |
| `crossSellGroup` | Linked suggestions | Cross-sell |
| `serviceAvailability` | dine-in/take-out flags | Filtering |
| `ageRestriction`,`verificationAge` | Age gating | Notice |
| `taxes` | Tax codes | Pricing |
| `displayOrder`,`showFromPrice`,`linkedItems` | Ordering/pricing/links | Sort/labels |

### ENT-MENU-03 - Option group
| Field | Meaning | Used by |
|:--|:--|:--|
| `id`,`name`,`displayOrder` | Identity/order | Stepper |
| `role` | `MODIFIERS`/`REQUIRED-MODIFIER`/`UPSELLS`/`INGREDIENTS`/`INGREDIENT_MODIFIERS`/`SURCHARGE`/`COMBO_MAIN` | Routing |
| `minimum`,`maximum` | Selection rules | Gating |
| `options` | Standard choices | Cells |
| `compositeOptions` | TOGGLE choices | Customisation |
| `defaultOption` | Pre-selected option id | Defaults |
| `mcpId` | External id | Backend |

### ENT-MENU-04 - Option (group detail)
| Field | Meaning | Used by |
|:--|:--|:--|
| `id`,`plu`,`name`,`shortName`,`description`,`image`,`price`,`servicePriceOverride`,`calories`,`taxes`,`displayOrder` | Display/price | Cells |
| `optionGroups` | Nested groups | Sub-option screen |
| `role` | Option role | Handling |
| `maximumQuantity`,`defaultQuantity` | Qty cap / preset | Steppers/defaults |
| `supersede` | Blocks others | Selection rules |
| `serviceAvailability`,`ageRestriction`,`barcodes`,`linkedItems` | Availability/age/scan | Gating |

### ENT-MENU-05 - Composite option
| Field | Meaning | Used by |
|:--|:--|:--|
| `type` | `TOGGLE` | Toggle UI |
| `positiveOption`,`negativeOption` | The two choices | Buttons |
| `defaultChoice` | `POSITIVE`/`NEGATIVE`/none | Pre-selection |

### ENT-MENU-06 - Customized item tag
| Field | Meaning | Used by |
|:--|:--|:--|
| `badgeName`,`textColour`,`backgroundColour` | Badge display | Rendering |
| `items[]` | Associated `menuItemId`/`categoryId` + `enabled` | Lookups |
| `tagsPages` | `ITEM_MENU`/`ITEM_PAGE`/`BASKET` scoping | Visibility |
| `scheduleEnabled`+`startDate`/`endDate`, `advancedScheduleEnabled`+`openingHours[]` | Schedule gating | Visibility |

### ENT-MENU-07 - Cross-sell group / cross-sell item group
| Field | Meaning | Used by |
|:--|:--|:--|
| `id`,`name` | Group identity | Display |
| `crossSells` | Linked entity ids -> resolved items | Suggestions |

### Fields used from other areas' entities
- Order/order item (A04): `orderItems`, options, quantity, `orderType`, `orderNonce`.
- Kiosk config (A01): `scoModeEnabled`, `giftCardPurchaseSettings`, auto-advance rule flags, brand feature flags (nutritional disclaimer), `activeLocationId`.
- Age verification (A04): confirmation state.

### Backend operations

### OP-MENU-01 - Fetch menu
`GET /menu` on the local kiosk backend (kiosk-service base URL) with brand authentication header and `language` query/header.
- Called when: journey start, language change.
- Request data: brand auth headers, language code.
- Response data used: `cargo` payload -> entities, `currency`, `showCategoriesPrice`, `customizedItemTags`, per-entity fields above.
- Errors: thrown on error response -> start flow error handling (A01).
- Retries: none at this level (config retry loop covers failures).

### Device and external integrations
- No direct device interaction in this area. Scanner affects SCO presentation (A05); NavPed drives focus (A11); analytics events `select_item`, `view_item_list`, `item_tag_impression`, screen view `home_page` are emitted (A11 owns catalogue).

## A04 BASKET — Order summary, checkout preparation and age verification

### Entities

### ENT-BASKET-01 - Order details (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `orderItems[]` | Basket lines (item, options, quantity, guid) | Lines, gates |
| `orderType` | DINEIN/TAKE_OUT | Pricing, gate context |
| `orderNonce` | Current order identity | Age approval binding, outcome posts, PIN request |
| `charityDonated` / `orderTotal.charityDonated` | Donation applied | Totals, prompt |
| `punchh` (`rewardBarcode`, `hasRedemption`) | Loyalty rewards | Rewards line, discount checks |
| `verifiedAge` | Age approved for this order | Approval validation |
| `locationId` | Active venue | PIN request, outcome posts |

### ENT-BASKET-02 - Order total (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `subtotal`,`total`,`tax`,`taxInclusive`,`serviceCharge`,`fees[]` | Totals lines | Totals block |
| `discountTotal` | Applied discounts | Discounts line |
| `charityAmount`,`donationInfo` | Donation data | Charity line/block |
| `remaining`,`totalPaid`,`cashRoundingDiscount` (payment totals) | Payment-side totals | Payment screens (A08) |

### ENT-BASKET-03 - Order line (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `item` (MenuEntity) | The menu entity | Display, restrictions |
| `options[]` | Selected options (incl. nested/composite) | Summary text, grouping, price |
| `quantity` | Line count (may be absent on scanned lines -> counts as 1) | Stepper, unit counts |
| `guid` | Line identity | Delete/edit keys, approval fingerprint |
| `entityPath` | Where it came from | Cross-sell/scan context |

### ENT-BASKET-04 - Age-verification approval (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `phase` | inactive/pin_verifying/challenge_pending/approved/continuing/declined/locked/unavailable | Page routing |
| `orderNonce` / `contextOrderNonce` / `approvedOrderNonce` | Nonce binding | Re-verify rule |
| `restrictedItems` fingerprint | Line identity + quantity + required age | Retention rule |
| `incorrectPinAttempts` | Wrong-PIN count | Error/lock (max 5) |
| `locked`/`lockTransition` | Lock state | Flow lock |
| `approvedAge` | Highest required age approved | Challenge-25 text, retention |
| `declinedItemCount`/`approvedItemCount` | Unit counts | Messages, outcome posts |

### Fields used from other areas' entities
- MenuEntity (A03): name, price, `ageRestriction`, `verificationAge`, barcodes, `entityPath`.
- Kiosk config (A01): `punchhEnabled`/`couponEnabled`/`discountPosProviderEnabled`, `scoModeEnabled`, `giftCardPurchaseSettings`, charity config, `cpfCnpj` feature, `ageRestrictedApprovalAvailable` (brand-level).

### Backend operations

### OP-BASKET-01 - Order totals
POS totals call behind the totals recompute (queued via the totals queue manager).
- Called when: every basket/discount/tip/charity mutation (item add/update/delete, discount apply/delete, checkout load, ingredients update, charity apply, tip add).
- Request data: current order lines + order type.
- Response data used: `orderTotal` fields (subtotal/tax/serviceCharge/fees/discountTotal/charityAmount/donationInfo/total) and the `BASKET_ITEM_LIMIT_EXCEEDED` flag (matched from any error shape).
- Errors: item-line limit -> flag + blocking modal (FR-421); generic -> blocking modal ("Unable to add this item to your basket..." cocoa item-add with item rolled back, or "Unable to contact point-of-sale system..." + "Start Over"); basket-empty requests skipped.

### OP-BASKET-02 - Age-verification outcome
`POST /users/auth/restricted-item-approval/approve` (30 s timeout, fire-and-forget, skipped when the restricted-item count is not a positive integer).
- Called when: staff approve or decline; gate left (`guest_left` via the not-approved event).
- Body: `{outcome:"approved", restrictedItemCount}` or `{outcome:"declined", reason:"staff_declined", restrictedItemCount}`.
- Response: none consumed.

### OP-BASKET-03 - Staff PIN verification
`POST /users/auth/restricted-item-approval/pin/verify`.
- Called when: staff submits PIN at the gate.
- Body: `{locationId, orderNonce, pin}`.
- Response used: `{valid, locked, lockTransition}` -> valid = Challenge-25; invalid = attempt consumed; locked/lockTransition = locked; 404 = unavailable.
- Errors: network/malformed/server categorised; 404 treated as unsupported.

### OP-BASKET-04 - Invoice CPF/CNPJ
Stored on invoice state (update action); sent with the invoice on order submission (invoice internals in A08).

### Device and external integrations
- None beyond shared status reporting (A01) and payment terminals (A08).

## A05 SCAN — Scan routing, Scan-and-Go and scan feedback surfaces

### Entities

### ENT-SCAN-01 - Scanned-item tracking (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `scannedItems[]` | Not-yet-committed scanned lines | Modal |
| `committedScannedItemGuids[]` | Guids committed to the basket as scanned | Added/scanned split, modal re-read |
| `lastScanNotFound` | Last unmatched barcode | Not-found banner |
| restricted-refusal flag | Counted outstanding refusal | Restricted surfaces |

### Fields used from other areas' entities
- MenuEntity (A03): `barcodes`, `ageRestriction`, `entityPath`.
- Order details (A04): `orderItems`, `orderNonce`, `guid`.
- Kiosk config (A01): `scoModeEnabled`, `ageRestrictedApprovalAvailable`, `avoltaEnabled`, `scannerEnabled`, `selfCheckoutScreens`, `giftCardPurchaseSettings`.

### Backend operations

### OP-SCAN-01 - Item barcode match
Menu-side lookup of `barcodes` (no dedicated endpoint — resolved from the loaded menu; a match builds an order item and totals recompute via A04).
- Called when: SCO scan on `/home`/`/scanAndGo`.
- Errors: no match -> not-found state (falls through to loyalty/coupon).

### OP-SCAN-02 - Scanner status
Scanner status service call -> availability boolean.
- Called when: navigation to `/welcome`/`/orderSummary`, `scannerEnabled`, not maintenance, HID keyboard scanner off.
- Errors: timeout -> status unchanged; other failure -> unavailable.

### OP-SCAN-03 - Routed scan handlers (owned by other areas)
- Gift card scan -> A09; app-payment code -> A08; Avolta code/phone sign-in -> A06; coupon apply -> A07; loyalty sign-in -> A06.

### Device and external integrations
- HID-keyboard scanner: key events buffered in the Electron main process, completed on terminator or auto-complete timeout, dead-key layouts handled, flushed over IPC to the routing.
- Serial scanner: serial listener forwards completed barcodes with source `SerialScan`.
- Status terminals: `SCANNER` component status reported (A01).
- Analytics: `age_verification_item_blocked` (venue, kiosk, item id).

## A06 LOYALTY — Providers, sign-in, sign-out, order history

### Entities

### ENT-LOYAL-01 - Loyalty user (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| Identity (phone/email/userId/barcode) | How the member was matched | Sign-in, display |
| `tier` (Avolta) | Membership tier | Logged-in banner |
| `punchh.rewardBarcode`/`hasRedemption` | Applied reward | Basket/discounts |
| `kioskUserContext` | Active member context | Requests |

### ENT-LOYAL-02 - Order history entry (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `orderId` | Past order id | Reorder |
| items/summary | What was ordered | List display |

### Fields used from other areas' entities
- Kiosk config (A01): `isLoyaltyEnabled`, `punchhEnabled`, `avoltaEnabled`, `isLoyaltyAccesso`, `isLoyaltyNstYoyo`, `supportedSigninMethods`, `faceIdSigninEnabled`.
- Order (A04): `orderDetails` (created pre-basket for Avolta), `orderItems` (reorder).

### Backend operations

### OP-LOYAL-01 - Loyalty sign-in
`POST /loyalty/signin` (and provider variants).
- Called when: barcode/code/phone/credentials sign-in; scanned phone posts `{phone}`.
- Request data: identifier (code/phone/email/userId/credentials) + venue/order context.
- Response used: member identity -> logged-in state, banner, rewards.
- Errors: unsupported code, already-applied reward, network/server -> sign-in error dialog; unknown Avolta phone -> sign-up dialog; existing phone on signup -> account-exists dialog.

### OP-LOYAL-02 - Loyalty sign-up + terms
`POST /loyalty/signup` + `GET` terms.
- Called when: Avolta account creation.
- Errors: `USER_ALREADY_EXISTS`/409 -> account-exists; terms fetch failure -> error dialog; other -> "Register Error".

### OP-LOYAL-03 - Face-ID auth
`faceIdAuthService` session + verification.
- Called when: PopID button -> face scan.
- Errors: unrecognised/failed -> Face-ID error dialog.

### OP-LOYAL-04 - Order history + reorder
History fetch + reorder request.
- Called when: "Browse past orders" + Reorder.
- Errors: fetch -> "Past Orders Unavailable"; reorder -> reorder dialog.

### Device and external integrations
- Scanner (A05): barcode/QR scans routed to sign-in.
- PopID camera: face recognition.
- Analytics: a loyalty sign-in analytics event (type, entry method, screen, success, message), `age_verification_item_blocked`, `reorder_error_*` buttons.

## A07 DISCOUNTS — Coupons, rewards, restaurant and senior discounts

### Entities

### ENT-DISC-01 - Discount item (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `type` | CouponTypeType (Comanda/Punchh/Loyalty/RestaurantDiscount/SeniorDiscount/Unknown) | Dispatch, void routing |
| `value`/`barcode` | The code | Apply, removal |
| `entryMethod` | scan/manual/unknown | Analytics |
| `title`/`description`/`amount` | Display + value | Basket row, totals |
| `awardSource`/`awardType` | Award origin | Award selection |

### ENT-DISC-02 - Award (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| id/name/description/value | Award identity + benefit | Selection modal |
| `availableAwards[]` (on orderTotal) | Redeemable awards | Auto-show rule |

### Fields used from other areas' entities
- Order (A04): `orderItems`, `orderTotal` (fees/discountTotal), `orderNonce`, `seniorDiscount`.
- Loyalty (A06): member context for Punchh/Loyalty apply.
- Kiosk config (A01): `couponEnabled`, `punchhEnabled`, `discountPosProviderEnabled`, `seniorDiscountEnabled`, `isAwardsSelectionEnabled`, `AWAIT_QUEUE_BEFORE_DISCOUNT` (159), maximum-discount rule.

### Backend operations

### OP-DISC-01 - Coupon apply
`POST` coupon use (`coupon/**`) per type.
- Called when: Comanda code apply.
- Errors: invalid -> invalid-coupon dialog/scan-error; already-applied -> code-already-added.

### OP-DISC-02 - Loyalty/reward apply + void
`loyalty/**` apply coupon / apply award / void redemption.
- Called when: Punchh/Loyalty apply + removal + sign-in.
- Errors: invalid, already-applied, server.

### OP-DISC-03 - Senior-discount apply/void
`seniorDiscount/**` apply + remove.
- Called when: senior code apply/remove.
- Errors: `minimumAge` -> age error; other -> generic.

### OP-DISC-04 - Restaurant-discount apply
Restaurant-discount apply via the POS/discount provider.
- Called when: restaurant code apply.
- Errors: invalid/unavailable -> generic.

### OP-DISC-05 - Award totals refresh
`POST` totals (Punchh with awards-selection) to refresh `availableAwards`.
- Called when: before the awards modal.
- Errors: failure -> modal still shows.

### Device and external integrations
- Scanner (A05): code scans routed to apply/sign-in.
- Analytics: a loyalty sign-in analytics event (type, entry method, screen, success, message), a loyalty sign-in attempt analytics event (type, entry method, screen), an add-loyalty-info analytics event (type, entry method, screen, success, value, error).

## A08 PAYMENT — Method choice, authorisation, errors, tips, donation

### Entities

### ENT-PAY-01 - Payment method / response (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `paymentDetails.gatewayId`/`gatewayType` | Which gateway/PED | Method list, splits |
| `payments[]` | Applied payments | Partials, splits |
| `paymentStatus` | Authorising/authorised/failed | Polling, routing |

### ENT-PAY-02 - Order payment totals (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `remaining` | Left to pay | Chooser, splits |
| `totalPaid` | Paid so far | Partials |
| `cashRoundingDiscount` | Cash rounding | Totals |
| `seniorDiscount` | Applied senior discount | Totals |

### ENT-PAY-03 - Donation / tip (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `donationInfo`/`charityAmount` | Donation data | Modal, totals |
| `donationProvider`/`kioskDonationView` | Modal vs inline | Provider |
| `tip`/`orderTip` | Tip choices + value | Tip step, totals |

### Fields used from other areas' entities
- Order (A04): `orderDetails`, `orderTotal`, `orderNonce`.
- Kiosk config (A01): `cardReaderReady`, `cashReaderReady`, `foodStampEnabled`, `giftcardPaymentTypes`, method features, `donationProvider`, `config.waitTime`.
- Loyalty (A06): applied discounts for the loyalty banner.

### Backend operations

### OP-PAY-01 - Payment authorise
`paymentProviderService` start transaction per method (card/cash/crypto/Face-ID/app).
- Called when: a method's pay starts.
- Request: `AuthPaymentRequest` (order, amount, gateway id/type).
- Errors: authorise failure -> error screen; timeout -> expired dialog; `702` -> second-code flow.

### OP-PAY-02 - Payment status + cancel
Cash-status poll (>=1,000 ms spacing, route-gated); cancel-cash and cancel-partial-payments requests.
- Called when: polls to terminal state; cancel on demand/re-entry.
- Errors: cancel failure logged non-fatal (re-entry) or surfaced.

### OP-PAY-03 - Order placement
`placeOrderService` — single-flight submit with `OrderRequest` (details + payments + invoice).
- Called when: last payment authorised.
- Response: `OrderResponse` (order number, `waitTime`).
- Errors: injection failure -> error path (cash-paid keeps payment state); line-limit -> A04 flag.

### Device and external integrations
- PED terminals (Adyen/FreedomPay/Ocius/generic) via the local service.
- Cash machine polling (A09); crypto, gift card, room charge, app, Face-ID providers (A09).
- Status terminals (`SCANNER` etc. — A01).

## A09 ALTPAY — Cash, crypto, gift card, room charge, app payment, Face-ID

### Entities

### ENT-ALT-01 - Cash payment state (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `insertedAmount` | Money in the machine | Paid/due display |
| `cashJourneyState` | waiting/processing/collect-change/cancelling | Screen flow |
| `cashHealthResponse` | Machine health | Method visibility |
| `cashRoundingDiscount` | Rounding | Totals |

### ENT-ALT-02 - Gift card (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| number/code/PIN | Card identity | Entry modals |
| `availableBalance` | Card funds | Full/partial |
| `giftcardPaymentTypes[]` | Card types + modes | Chooser, PED |

### ENT-ALT-03 - Room charge (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `availableHotels[]`/`selectedHotelId` | Hotel pick | Picker |
| `roomChargeDetails` (firstName/roomNumber/…) | Guest details | Validation + checkout |
| `roomChargePaymentTypes` | Allowed fields | Form |

### ENT-ALT-04 - Crypto / Face-ID / app payment state (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| Crypto QR + poll state | Code + status | Page, expiry |
| Face-ID session + 2FA | Camera + PIN state | Page |
| App-payment code | Scanned code | Submit |

### Fields used from other areas' entities
- Order (A04): `orderTotal` (due/remaining/paid), order details.
- Config (A01): method features, machine readiness.
- Loyalty/discounts (A06/A07): split payment + applied discounts.

### Backend operations

### OP-ALT-01 - Cash transaction
`paymentProviderService` start/status/end/cancel cash.
- Called when: insert, poll, complete, cancel.
- Errors: fatal machine error, cancel failure.

### OP-ALT-02 - Crypto transaction
`paymentProviderService` start/status crypto.
- Called when: QR start + poll.
- Errors: expiry, unavailable.

### OP-ALT-03 - Gift-card apply
`giftcard/**` apply + balance + purchase.
- Called when: card apply / purchase.
- Errors: already-activated, apply failure.

### OP-ALT-04 - Room charge
`roomCharge/**` fetch hotels + validate details + `roomChargeAuthPaymentRequest` charge.
- Called when: hotel pick, details submit, charge.
- Errors: validation, charge failure.

### OP-ALT-05 - App payment
`appPayment/**` submit code.
- Called when: scanned code.
- Errors: invalid/failed authorise.

### OP-ALT-06 - Face-ID payment
`paymentProviderService` start/status Face-ID + 2FA submit.
- Called when: camera validate + PIN.
- Errors: validation, PIN failure, authorise failure.

### Device and external integrations
- Cash machine (local service); crypto provider; gift-card PED + backend; hotel property API; PopID Face-ID (websocket); app-payment provider.

## A10 POST — Success page, notifications, receipts, wait-time

### Entities

### ENT-POST-01 - Order notification (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| Method (buzzer/tent/table/phone/name) | How the guest is notified | Method pages |
| Identifier (number/phone/name) | Where the order finds them | Order |
| Guest name | Name on the order | Success + kitchen |

### ENT-POST-02 - Receipt options (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `kioskReceiptOptions` (print/email/sms/qr) | Channels | Receipt surfaces |
| Email/phone/QR | Destination | Receipt send |
| `posCheckNumber` | Order number | Success + receipt |

### Fields used from other areas' entities
- Order (A04): `orderResponse` (order number, `waitTime`), guestName.
- Config (A01): `posCheckNumberDisplayLength`, `KIOSK_GUEST_NAME_MANDATORY` (162), `kioskReceiptOptions`, notification methods.
- Loyalty (A06): Punchh state for the footers.
- Idle/reset (A01): auto-return + session reset.

### Backend operations

### OP-POST-01 - Order notification
`orderNotification/**` — store the identifier on the order.
- Called when: buzzer/tent/table/phone/name entered.
- Errors: validation, save failure.

### OP-POST-02 - Email/SMS receipt
`email/**`, `sms/**` — send the receipt.
- Called when: email/SMS receipt chosen.
- Errors: invalid address, send failure (SmsErrorDialog).

### OP-POST-03 - Print receipt
`printer/printCachedService`, `order/OrderReceiptService`, `order/Receipt*`.
- Called when: print chosen.
- Errors: print failure -> staff message.

### OP-POST-04 - Fulfilment / guest name / waiting
`fulfilment/**` (puck), `guestName/**` (name on the order), order submit (A08).
- Called when: puck alert, name capture, submit.
- Errors: per service.

### Device and external integrations
- Printer (A01 health); SMS provider; puck fulfilment system; email service.

## A11 PRES — Theming, accessibility, keyboards, formatting, analytics

### Entities

### ENT-PRES-01 - Theme (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| Tokens (colours/fonts/spacing) | Theme variables | Every surface |
| Page overrides | Per-page theme | Pages |
| Logo | Brand mark | Logo/FloatingLogo |
| Server CSS | Extra styles | `cssServices` |

### ENT-PRES-02 - Localization (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| Locale files (33) | Translations | Every string |
| `localization` | Active language | Direction, keyboards |
| `language` list | Picker options | A02 |

### ENT-PRES-03 - Analytics config (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| `analyticsSettings` | GA4 config | Events |
| Screen-view names | Route -> screen name | Page tracking |

### Fields used from other areas' entities
- Config (A01): `accessibilityModeEnabled`, `KIOSK_THEMING` (170), language list.

### Backend operations

### OP-PRES-01 - Theme + CSS fetch
`themeServices` + `cssServices` — fetch theme tokens/CSS.
- Called when: app start + theme refresh.
- Errors: fallback to brand defaults.

### OP-PRES-02 - Localization
`localizationServices` — translations + currency formatting.
- Called when: language resolution + `ts.formatCurrency`.
- Errors: fallback strings.

### Device and external integrations
- GA4 analytics (`AnalyticsManager`, `AnalyticsPageManager`, `UserAuthAnalytics`); Sentry (`SentryConfiguration`); screen readers; NavPed/keyboard input.

## A12 SCO — Self-checkout screens, clerk validation, template catalogue

### Entities

### ENT-SCO-01 - Clerk / staff session (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| PIN | Staff unlock code | `kioskConfig.pinCode` + `/clerk` |
| Clerk actions | reset / approve / delete / receipt | Staff summary |

### ENT-SCO-02 - Template slot (owned)
| Field | Meaning | Used by |
|:--|:--|:--|
| Slot key | Screen slot | the screen template catalogue |
| Brand implementation | Lazy-loaded value | Per brand |

### Template catalogue

| Slot | Default | Alternatives | Brand | Owning area |
|:--|:--|:--|:--|:--|
| welcomePage | default | `welcomeCarouselPage`, `welcomePlainPage`, `welcomeMultiBrandPage`, `welcomeItsuPage`, `welcomeCostaPage`, `welcomeCocoaPage`, `welcomeBoparanPage` | carousel/plain/multi-branch/itsu/costa/cocoa/boparan | A02 |
| orderTypePage | default | `orderTypeMultiBrandPage`, `orderTypeShackPage`, `orderTypeItsuPage`, `orderTypeCostaPage`, `orderTypeCocoaPage`, `orderTypeBkPage` | multi-branch/shakeshack/itsu/costa/cocoa/bk | A02 |
| homePage | default | `homePageV2`, `homePageShack`, `homeItsuPage`, `homeCostaPage`, `homePageBk`, `homeBoparanPage`, `homeCocoaPage` | v2/shakeshack/itsu/costa/bk/boparan/cocoa | A03 |
| productsPage | default | `productsItsuPage`, `productsBoparanPage`, `productsPage` (SCO) | itsu/boparan/sco | A03 |
| navigationBar | default | `navigationBarQSRV2`, `navigationBarQSRBuzzer`, `navigationBarQSRShakeShack`, `navigationBarQSRItsu`, `navigationBarQSRBk`, `navigationBarQSRCosta`, `navigationBarQSRCocoa`, cinnamon `NavigationBar`, `NavigationBarV3` (v3) | v2/buzzer/shakeshack/itsu/bk/costa/cocoa/cinnamon/v3 | A11? nav bar |
| orderSummaryPage | default | `orderSummaryPageV2`, `orderSummaryItsuPage`, `orderSummaryPageBk`, `orderSummaryCostaPage`, `orderSummaryBoparanPage`, `orderSummaryCocoaPage` | v2/itsu/bk/costa/boparan/cocoa | A04 |
| paymentPage | default | `paymentShackPage`, `paymentItsuPage`, `paymentBkPage`, `paymentCostaPage`, `paymentCocoaPage` | shakeshack/itsu/bk/costa/cocoa | A08 |
| authorizingPaymentPage | default | `authorizingPaymentCostaPage`, `authorizingPaymentShackPage`, `authorizingPaymentItsuPage`, `authorizingPaymentBkPage`, `authorizingPaymentCocoaPage` | costa/shakeshack/itsu/bk/cocoa | A08 |
| paymentSuccessPage | default | `paymentSuccessBuzzerPage`, `paymentSuccessShackPage`, `paymentSuccessShackBuzzerPage`, `paymentSuccessItsuPage`, `paymentSuccessBkPage`, `paymentSuccessCostaPage`, `paymentSuccessCocoaPage`, `paymentSuccessEmailDisabledCocoaPage` | buzzer/shakeshack/itsu/bk/costa/cocoa | A10 |
| paymentErrorPage | default | `paymentErrorShackPage`, `paymentErrorItsuPage`, `paymentErrorBkPage`, `paymentErrorCocoaPage` | shakeshack/itsu/bk/cocoa | A08 |
| buzzerNotificationPage | default | `buzzerNotificationPage` (shakeshack), `QSRbuzzerNotificationPage`, `QSRbuzzerNotificationPageV2`, `buzzerNotificationCocoaPage` | shakeshack/buzzer/v2/cocoa | A10 |
| tableNumberNotificationPage | default | `tableNumberNotificationCocoaPage` | cocoa | A10 |
| tentCardNotificationPage | default | `tentCardNotificationCocoaPage` | cocoa | A10 |
| emailReceiptPage | default | `emailReceiptShackPage`, `emailReceiptCostaPage` | shakeshack/costa | A10 |
| phoneNotificationPage | default | `phoneNotificationPage` (shakeshack) | shakeshack | A10 |
| enterCouponManuallyPage | default | `enterCouponManuallyPageV2`, `enterCouponManuallyPageBk` | v2/bk | A07 |
| multiBrandPage | default | `multiBrandItsuPage` | itsu | A02 |
| laneClosedPage | default | `laneClosedPageShack`, `laneClosedCostaPage` | shakeshack/costa | A01 |
| maintenanceModePage | default | `maintenanceModeCostaPage` | costa | A01 |
| atCapacityModePage | default | `atCapacityModeCostaPage` | costa | A01 |
| alertOverlay / idle overlay | default | `alertOverlayShakeShack`, `alertOverlayItsu`, `alertOverlayCosta`, `alertOverlayCocoa` | shakeshack/itsu/costa/cocoa | A01 |
| allergen page | default | `allergenShackPageUK`, `allergenShackPageUS` | shakeshack | A03 |
| loyalty logging page | default | `loyaltyLoggingPageCocoa` | cocoa | A06 |
| tip page | default | `tipPageCocoa` | cocoa | A08 |
| products cell | default | cocoa/boparan variants | cocoa/boparan | A03 |

Brand template trees: bk, boparan, buzzer, cinnamon, cocoa, costa, itsu, shakeshack, v2, v3 (+ `mode/sco`).

### Backend operations

### OP-SCO-01 - Clerk validation
`/clerk` endpoint — validate the clerk PIN and staff actions.
- Called when: staff login, approve/delete/reset/receipt.
- Errors: wrong code -> wrong-login-code message; service failure -> generic.

### Device and external integrations
- SCO scanner routing (A05); SCO help/staff signalling; print receipt (A10).
