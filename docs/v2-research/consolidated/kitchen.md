# Kitchen — consolidated requirements

## Summary
- **Counts (87 features):** 53 IN · 4 MODEL-ONLY · 2 CUT · 8 OUT · 6 HW-LATER · 14 KAI? (answer in Q1 to Q10). 15 new v2 fields. 10 open questions.
- **Biggest gaps:** Comanda has no order status, no status history, no undo, no new-order alert, no order detail, no sold-out duration or hidden state, and no kitchen pace. The v2 models have no order status at all (MODELS.md has no status field on orders).
- **What Comanda has:** a three-column board (Novos, Preparando, Prontos), one button per step, waiting minutes, SSE with a polling fallback, the order number, and "Esgotados" for today only.
- **New in our scope, not in the reference:** table orders must reach the kitchen before the guest pays (Q1), and the card needs a table number (new field). The reference KDS has no table, guest count or waiter.
- **Coverage:** complete for the kitchen area, see the Coverage section. Nothing rendered or run.

## Coverage
Method: every row of every inventory was scanned. Rows with Area `kitchen` were all mapped (table below). Rows in other areas were matched on kitchen terms (sold out, availability, pace, capacity, lead time, preparation, wait time, at capacity, kitchen, KDS, StaffFeed, order status, cancel, reject, no-show, printer, ticket, alarm, dispatch, Ready, Preparing) and each match was read and mapped to a row here or ruled out (payment, loyalty, sync, kiosk-only receipt and hours rows).

| Inventory | Rows in file | Area = kitchen (mapped) | Other-area rows matched and reviewed | Rows mapped to features here |
|:--|--:|--:|--:|--:|
| KDS1 | 443 | all 443 read in full (kitchen by definition) | n/a | 1 to 85 (all kitchen rows) |
| B1 | 552 | 3 | 39 | 1, 34, 55, 56, 71a, 78 (KDS dispatch, waitTime, at capacity, order statuses, printer status) |
| D1 | 301 | 1 | 10 | 52, 59, 36, 48, 49, 18 |
| D2 | 461 | 23 | 6 | 80, 59, 52, 18, 55, 83 |
| D3 | 511 | 0 | 25 | 48, 49, 45, 82, 83, 57 |
| D4 | 365 | 6 | 15 | 52, 59, 79, 80, 82 |
| D5 | 361 | 4 | 5 | 52, 59, 82 |
| D6 | 170 | 6 | 5 | 51, 18, 59, 36, 80 |
| D7 | 276 | 2 | 10 | 52, 59, 48, 49, 82, 83 |
| D8 | 1671 | 0 | 44 | 52, 59, 36, 18, 82, 83 |
| D9 | 225 | 0 | 4 | 36, 82 |
| D10 | 155 | 0 | 0 | n/a (no kitchen content) |
| D11 | 197 | 0 | 26 | 59, 52, 36, 51 |
| D12 | 138 | 19 | 0 | 80, 79 |
| D13 | 195 | 0 | 4 | 83, 80 |
| K1 | 192 | 0 | 14 | 56, 55, 49, 48 |
| K2 | 679 | 0 | 19 | 55, 56, 60, 71a |

Notes on the table: the "Rows in file" count is the number of data rows. "Other-area rows matched" counts rows matched by the kitchen-term filter outside the kitchen area. Matches on payment, gift card, loyalty, cash, crypto and face-ID were read and ruled out (not kitchen).

## Features

### Order board and card
| # | Feature | Behaviour (rules, limits, defaults, exact UI copy) | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 1 | Board columns by status | Novos = paid, not started (spec PAID); Preparando = PREPARING; Prontos = READY, kept until collected. Spec board = ACCEPTED, PAID, PREPARING; card leaves at READY. Header counts per column | NEW Order.status | PART (3 columns, v0.2) | IN | KDS1 BR-020, BR-021, FEAT-038, SCR-005-HEADER, OL-GROUPS; plan G-K7; B1 BR-ORD-03, DM-ORD-02, DM-PAY-04 (kiosk payment state to order status) |
| 2 | Order card content | "#id" (order number), created or pickup time, service name and type icon, "qty x name" lines, modifiers nested under the item, "SPECIAL REQUESTS" block when notes exist | SubmitOrderResponse.number; OrderItem.name, quantity, modifiers, parentId, specialNotes | PART | IN | KDS1 SCR-005-HEADER, SCR-005-BODY, DM-ORDER-ID, DM-ITEM-NAME, DM-ITEM-QTY |
| 3 | Modifier order and quantity | Modifiers by position ascending (negatives and missing last), else by id. Quantity above 1 shown as "name (xN)" | OrderItem.position, uniqueId | NO | IN | KDS1 BR-031, DM-MOD-POSITION, DM-MOD-NAMEQTY |
| 4 | Empty board | Spinner while requests are pending; no empty-state text in the spec. Comanda copy to define | none | ? | IN | KDS1 SCR-005-EMPTY |
| 5 | Waiting time colours | On time, attention at 5 min, late at 10 min. Spec ageing (30 s, 60 s) is for pending rows only, not used | none | PART (red from 10 min) | IN | plan G-K8; KDS1 FEAT-010 |
| 6 | Production view | Totals to make across Novos and Preparando (not Prontos), by item and option, e.g. "4× Pão na chapa: 2 manteiga, 2 requeijão". Sorted by name, read-only | OrderItem | NO | IN | plan G-K6 (P2); KDS1 FEAT-039, SCR-006, WF-12 |
| 7 | Screen size | Landscape tablet, 1280 × 800 | none | ? | IN | plan-next design section (Kitchen row) |
| 8 | Refresh | Refresh button on the board. Full refetch every 60 s while live, so a lost event never leaves the board wrong | none | NO | IN | plan G-K13; KDS1 WF-11, SCR-001-NAV |

### Status moves, undo and failures
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 9 | Start preparing | One button per card in Novos sets PREPARING. Spec allows it only from ACCEPTED; Comanda allows it from PAID | NEW Order.status | PART | IN | KDS1 FEAT-022a, SCR-005-FOOTER, BR-021; plan G-K12 |
| 10 | Mark ready | From Preparando, and from Novos on the card (spec allows ACCEPTED to READY on the card only, gap 6). Spec footer labels: "READY", "Ready for Collection", "Ready for Delivery" | NEW Order.status | PART | IN | KDS1 WF-3, OL-T-READY, FEAT-022a |
| 11 | Collected (Retirado) | READY to COLLECTED. The order leaves the board and joins today's collected list. Spec name: COMPLETED ("Completed") | NEW Order.status COLLECTED | HAS (one wrong tap loses the card, G-K3) | IN | plan G-K3, G-K7; KDS1 FEAT-022a, OL-T-COMPLETED, WF-4 |
| 12 | Undo and step back | 5 s "Desfazer" after each move, and "Voltar uma etapa" in the detail. Backward moves only READY to PREPARING and COLLECTED to READY, same business day. Deliberate deviation: the spec has no recall | Order.status; Order.updatedAt | NO | IN | plan G-K3, decision 2; KDS1 README-SCOPE-2 |
| 13 | Failed move is visible | Error with "Tentar de novo". The card stays where the server has it. The spec keeps the optimistic status after a failed PUT (defect, do not copy) | Order.status | BUG in v0.2 (failed move is silent) | IN | plan G-K12 (P1); KDS1 BR-012, ER-FAILED-ACTION, README-GAP-4 |
| 14 | Stale-event guard | A late event for an old status never puts a card back | NEW Order.updatedAt | NO | IN | plan G-K3; KDS1 RT-CONFLICT, ER-RACE |
| 15 | Accept (charge) a PENDING order | POST charge. Warning "Payment will not be processed until you accept the order". Alert on PAYMENT_REFUNDED | Payment; Order.status PENDING | NO | KAI? Q1 | KDS1 BR-001, FEAT-020, WF-2, API-18 |
| 16 | Reject before accept | Message required (a preset counts). POST reject. Status REJECTED with reason | Order.status REJECTED; statusReason | NO | KAI? Q1 | KDS1 BR-002, BR-003, BR-004, FEAT-021, JRN-004 |
| 17 | Pending bar and carousel | Bar "N order(s) waiting to be accepted". Carousel sorted by pickup time. Banner "NEW ORDER REQUIRING CONFIRMATION". Ageing states at 30 s and 60 s | none | NO | KAI? Q1 | KDS1 FEAT-010a, FEAT-010b, SCR-011, JRN-012 |
| 18 | Auto-accept and reject after time | Auto-accept charges every PENDING order after each load or update. Settings: auto-accept collection and delivery; reject order after a time, per service; auto-accept seat orders with an off-state timeout rejection where supported | none | NO | KAI? Q1 | KDS1 FEAT-036, CFG-005; D6 CFG-061, CFG-062, CFG-078 to CFG-080; D1 FR-061, FR-062, FR-063; D2 FR-823 (ACT-079 rejection timeout); D8 DEP-F33 |
| 19 | Table order before payment | A table order is sent to the kitchen before the guest pays (pay at table). Needs an unpaid state the kitchen can see | Order.status (unpaid); OrderType PAY_AT_TABLE; SubmitOrderRequest.openCheck | NO | KAI? Q1 | MODELS 8.1, 8.12; brief rule 3; KDS1 has no equivalent |
| 20 | Simplified list | Flag SIMPLIFIED_ORDERS_SCREEN: reduced list, PENDING excluded, inline Ready, Complete and Notify | none | NO | OUT (replaced by the board, row 1) | KDS1 FEAT-015, SCR-004, CFG-055, CHK-SIMPLE |

### New-order alerts and sound
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 21 | New-order alert | Alarm on arrival, repeats until someone touches the screen. New cards highlighted. Bar "N pedidos novos" (replaces the spec popup "You received N new order(s)"). Tab title flashes "N New Order(s)" and "Orders". Badge. Reset on touch, OK or any kitchen action. Spec default plays once | none | NO | IN | plan G-K1 (P1); KDS1 FEAT-016, WF-1, WF-6, SCR-012c, SCR-001-NAV |
| 22 | Alarm settings per device | Sound: Light Bells, Foghorn (default), Honk Honk, Phone Ring, None. Repeat: once to infinite (0 to 600001, step 15000; labels Once, N seconds, N minutes, Infinite). Bundled audio files. "Hide popup" dropped (the bar replaces the popup) | AlarmPreferences (local) | NO | IN | plan G-K1; KDS1 FEAT-017, CFG-011, CFG-012, CFG-013, INT-AUDIO, DM-ALARMPREF |
| 23 | Sound unlock | "Ativar som" on start (browsers block audio until the first touch). If sound is not ready within 1 s, ask "Would you like to play a sound when new orders arrive?" No sets sound to None. Yes retries under the touch | AlarmPreferences | NO | IN | plan G-K1; KDS1 FEAT-018, SCR-013, ER-AUTOPLAY |
| 24 | What triggers an alert | A paid order entering the board alerts. A status change does not re-alarm. An unknown id appends and alarms. With alerts off it appends silently | none | NO | IN | KDS1 BR-013, OL-SORT-ALERT, RT-MERGE, WF-1 |

### Order detail and history
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 25 | Detail drawer | Close by button, ESC, backdrop, or re-click. Title "#id: customer name". Created time. Current status. Actions | Order; Customer.firstName, lastName | NO | IN | plan G-K2 (P1); KDS1 FEAT-019a, SCR-007-MAIN |
| 26 | Detail items | "qty x name" and price. Per item and per option "Sold out" (hidden once sold out). Meal-deal items nested. Special instructions | OrderItem (meal lines, specialNotes); ITEM.available | PART | IN | KDS1 FEAT-019c, DM-ITEM-MEAL, DM-ITEM-SOLDOUT |
| 27 | Status history | Table Date, Time, Status, Notes. One fetch per order | NEW Order.statusHistory (StatusHistoryEntry) | NO | IN | plan G-K2; KDS1 FEAT-027, API-24, DM-STATUSHISTORY |
| 28 | Customer name and phone | Name in the title and on the card. Phone on the detail. Decision 8 brings Customer back in scope | Customer.firstName, lastName, phoneNumber (8.6) | NO | IN | decision 8; KDS1 DM-ORDER-USER, FEAT-019b |
| 29 | Verification code | Short code the guest is given, shown on the card and receipt. Mapping to v2 unsure | SubmitOrderResponse.customerCheckNumber (9.5) | ? | IN | KDS1 DM-ORDER-VERIFICATION |
| 30 | Item note | Up to 60 characters per item, shown on the card and in the detail | OrderItem.specialNotes (8.2) | NO | IN | plan G-T7 (decision 15); KDS1 DM-ITEM-NOTES, SCR-005-BODY |
| 31 | History of closed orders | Filter "All closed" or "Cancelled". Date: Latest, under 24 h, Custom (default now minus 24 h). 25 per page, Load more, 500 ms throttle. Closed orders stay actionable | Order.status; Order.updatedAt | NO | IN | KDS1 FEAT-042, BR-037, API-27, JRN-018 |
| 32 | Collected today | Today's collected orders. Move one back to Prontos. Search by number: see row 42 | Order.status COLLECTED | NO | IN | plan G-K7 (P2); KDS1 FEAT-042 |
| 33 | Totals block in detail | Subtotal, discount lines, service charge, each tax, tip, donation, total. Read-only. Shared with the back office | TotalsRequest (8.11); ServiceCharge (8.5); Payment.tipAmount; Payment.donationAmount | NO | IN | KDS1 FEAT-019e, DM-ORDER-TAX, DM-ORDER-TIP |
| 34 | Cash change due | For cash orders, show the change due on the card and in the detail. Copy "Cash Order. Cash due on delivery/collection" to define. The cash machine itself is HW-LATER | NEW Payment.changeDue | NO | IN | decision 8 (cash tender); KDS1 BR-039, FEAT-019f, DM-ORDER-CHANGE; B1 DM-PAY-05, FEAT-PAY-02 (cash machine, HW) |
| 35 | Delivery block | Delivery address, postcode map link, delivery notes, "Delivery by" time, delivery requests | Address (8.7) | NO | MODEL-ONLY | decision 7; KDS1 FEAT-019b, DM-ORDER-DELIVERYADDR, DM-ORDER-DELIVERYNOTES, INT-MAP (EXT) |
| 36 | Prepare-by, event time and scheduled items | "Prepare by" label from dateToFire; "Event Time" label when the order has an event; "DELAY PREP" on the receipt when asapFlag is false. Item and zone lead time, and pickup slots with lead time and pre-orders | SubmitOrderRequest.dateToFire, pickupTime; ITEM lead time (new if kept) | NO | MODEL-ONLY | decision 7; plan decision 17 (no pre-orders); KDS1 BR-030, DM-ORDER-PREPAREBY, DM-ORDER-ASAP; D1 FR-085, FR-201, FR-660 (lead time); D6 CFG-200 to CFG-202, CFG-648 to CFG-667 (pickup slots, pre-orders); D9 FEAT-033, CFG-201, CFG-202; D11 CFG-660, CFG-085; D8 CFG-201, CFG-202 |
| 37 | Locker panel | Locker id, PIN column, locker panel on the card and receipt | none | NO | KAI? Q2 | KDS1 FEAT-031, DM-LOCKER, CFG-061; plan cut |
| 38 | Outlet or station label | Location label (outlet or station) on the card, Location column in lists | none (ITEM.kitchenStation would be new) | NO | KAI? Q2 | KDS1 FEAT-032, DM-OUTLET, CFG-060; D11 outlets |
| 39 | Event labels and filter | Event name, occurrence and slot labels, event filter, event venue limit 500 | none | NO | OUT (decision 8: events out) | KDS1 DM-EVENT, FEAT-011, CFG-010, CFG-039 |
| 40 | Demo label and banner | "Demo Order" label, "** DEMO **" receipts, demo banner | none | NO | OUT (decision 8: demo mode out) | KDS1 DM-ORDER-DEMO, FEAT-046, SCR-016 |
| 41 | Track order | Track order link and tracking URL; "Track drivers" navbar link | none | NO | MODEL-ONLY | decision 7 (delivery); KDS1 FEAT-029, FEAT-041, CFG-033, CFG-052 |

### Search
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 42 | Find an open order by number | Keypad: 3 or more digits, exact match opens the detail; no match stays editable. Barcode scanner: "No open order found for number X" for 3 s. Scanner part is HW-LATER | none | NO | KAI? Q7 | KDS1 FEAT-013, FEAT-014, SCR-010, BR-035, JRN-011; plan cut |

### Cancel, refund and no-show
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 43 | Cancel from the kitchen | "Cancel order" from the detail or after "Acabou" (row 47). Confirmed with the owner's login (email and password, no PIN). Last email prefilled. Optional note saved as statusReason. Errors "Incorrect username or password" and "Sorry, you do not have sufficient access privileges...". Confirm button "Confirm cancellation". No refund while payment is simulated | Order.status CANCELLED; statusReason; NEW Order.cancelledBy | NO | IN | plan G-K11 (P1, decision 12); KDS1 FEAT-023, BR-006, API-21, JRN-007 |
| 44 | Which states can cancel | Spec hides cancel for NOSHOW, CANCELLED, PENDING, and shows it for COMPLETED, REJECTED, DELIVERING. Comanda rule to decide | Order.status | NO | IN (rule: Q6) | KDS1 BR-007, OL-NOREOPEN, JRN-024 |
| 45 | Refund from the detail | Full or partial. Amount 0.01 up to paid minus refunded. Reasons "Out of stock" (default), "Customer cancellation", "Customer complaint". Confirm "Are you sure you want to refund <amount> to the customer? This action cannot be undone." Refund does not change status. Phase 4 | NEW Payment.refundedAmount, Payment.refunds[] | NO | IN (phase 4, G-A3) | plan G-K11, G-A3; KDS1 FEAT-025, BR-009, BR-010, BR-011, OL-CANCEL-EFFECTS; D13 CFG-628, CFG-629; D3 FR-1247 (cancel refund) |
| 46 | No-show | "Mark as no show" with notes. Status NOSHOW with reason. Spec: cash orders only | Order.status NO_SHOW; Payment.tenderId (cash) | NO | KAI? Q5 | KDS1 FEAT-024, BR-008, OL-T-NOSHOW, JRN-008 |

### Sold out from the kitchen
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 47 | "Acabou" (sold out now) | Mark an item or an option sold out from the card or the detail. The order already placed stays open (BR-027). Error copy "Error making (modifier) item sold out, please try again." Button hides on success | ITEM.available (boolean, options too) | NO | IN | plan G-K4 (P1); KDS1 FEAT-028, BR-027, API-29, API-30, JRN-015, WF-9 |
| 48 | Sold-out duration | "só hoje" (today), "até eu liberar" (until released), "até uma data" (until a date). Spec values: immediate, indefinite, next available day, custom date; options too | NEW ITEM.unavailableUntil | PART (Esgotados, today only) | IN | plan G-A4 (P1); D1 FR-181, FR-182, FR-244, FR-245, FR-188, FR-256; D3 FR-902, FR-903, FR-918; D7 DLG-005; D6 CFG-181 to CFG-183 |
| 49 | Hidden is not sold out | "Mostrar no totem" switch. Sold out shows greyed; hidden disappears. Options can be sold out too. Kiosk unavailable-message priority (always, behind attract, suppressed) | NEW ITEM.visible (default true) | NO | IN | plan G-A4; D7 DLG-005 ("Hidden is distinct from unavailable"); D3 FR-900, FR-901, FR-1183; D2 FR-546; K1 F-MENU-03 |
| 50 | Read back the sold-out list | Kitchen reads what is sold out, so "Esgotado hoje" survives a reload. Needs a read endpoint (contract change, partner approval) | GET /v1/kitchen/availability (contract addition) | PART (COM-100) | IN | plan G-A4; KDS1 FEAT-045 (POS items list, spec only) |
| 50a | Sold-out items on the kiosk menu | Unavailable items are removed from the kiosk menu; a category with no items left is pruned (day and overnight rules). Spec found no greyed cell | ITEM.available | PART | IN | K1 F-MENU-03; B1 FEAT-MNU-01, FR-MNU-002, DM-MNU-01, DT-MNU-03; D1 FR-188 |

### Pace and preparation time
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 51 | Store pace | Normal, Movimentado, Pausado. One store-level state, set from the kitchen or the home screen (Início). Navbar dropdown in spec: "Preparation time: <name> (<min> mins)" | NEW StoreConfigurationResponse.pace (NORMAL, BUSY, PAUSED) | NO | IN | plan G-K5 (P1, decision 3); KDS1 FEAT-040, SCR-015; D6 CFG-059; D11 CFG-058 (peak is not Pausado) |
| 52 | Preparation time per level | Minutes for normal (required), busy, peak. Nonnegative integer, max 2147483646. Invalid normal time blocks the save. Spec names Standard, Busy, Peak | NEW StoreConfigurationResponse.prepTimeNormal, prepTimeBusy (prepTimePeak only if three time levels are kept) | NO | IN | D1 FR-056 to FR-058; D2 FR-804 to FR-806; D7 FORM-015; D4 ACT-060 to ACT-062, FEAT-017, SCR-243, FORM-015 to FORM-016; D5 SCR-243; D8 ENT-015, CFG-056 to CFG-058, JOURNEY-039; D11 CFG-056 to CFG-058, FEAT-017; KDS1 CFG-030, CFG-031 |
| 53 | Pause auto-resume | Pausado ends after 15 or 30 min, clock in America/Sao_Paulo. When the pause time passes, pace returns to Normal. Spec analogy: leadTimeTTL | NEW StoreConfigurationResponse.pauseUntil | NO | IN | plan G-K5; KDS1 CFG-032, CFG-041, BR-028 |
| 54 | Live change on every device | A pace change reaches all kitchen and kiosk screens at once (settings-update) | StoreConfigurationResponse | NO | IN | KDS1 WF-10, RT-EV-SETTINGS, JRN-016 |
| 55 | Kiosk wait line | Movimentado: "Current wait time is about {n} minute(s)" under the menu header, on payment and on the success screen. Number comes from pace. Shown only when the kitchen reports a wait | NEW SubmitOrderResponse.waitTime (minutes) | NO | IN | D2 FR-308, FR-839, FR-1008, FR-1028; K1 F-MENU-02, F-PAY-06, BR-POST-05, F-POST-04; K2 FR-308, FR-839, FR-1008, FR-1028; B1 DM-XC-02, BG-BKG-08 (POS check waitTime, replaced by pace, rule 2), EP-SES-01 |
| 56 | Kiosk at capacity | Pausado puts the kiosk on the at-capacity screen. Copy: "Sorry, our kitchen is currently at capacity" and "We will resume taking orders shortly." Guests cannot order. Precedence: maintenance, then at capacity, then closed. The config is re-fetched every 45 s on gate screens | pace (row 51) | PART (screen exists) | IN | K1 F-KIOSK-02, BR-KIOSK-05, BR-KIOSK-09, BR-START-15, F-START-01; K2 FR-108, FR-111, FR-132, FR-137, FR-203, FR-130 and OP-KIOSK-04 (kiosk reports TRADING or UNAVAILABLE with AT_CAPACITY, MAINTENANCE, STORE_CLOSED); B1 BG-BKG-08b, BR-SES-03, FR-SES-001, UJ-E2E-05; plan G-K5 |
| 57 | Closed or offline store | Store closed shows "Closed Venue" (spec: lead time 99999). Live or offline switch; going live needs confirmation. Storefront warnings for offline, closed and not accepting orders | StoreConfigurationResponse.liveFlag (9.10) | PART | IN | KDS1 BR-028, CFG-030, JRN-016; D7 FORM-016; D8 ENT-016; D3 FR-1321 to FR-1325 (warning conditions) |
| 58 | Demo mode | Live, demo or offline choice. Demo is out | none | NO | OUT (decision 8: demo mode out) | D1 FR-059; KDS1 CFG-040 |
| 59 | Capacity limits | Capacity profile per service (collection, delivery, seat), order interval, one kitchen order limit (CFG-134), capacity per order type. Spec admission rule is Unknown | none (no v2 field) | NO | KAI? Q8 | D1 FR-096 to FR-127; D2 FR-842, FR-855 to FR-859, FR-134; D4 FEAT-027 to FEAT-029, ACT-093 to ACT-107, ACT-111 to ACT-115, CFG-096 to CFG-127; D5 FEAT-024, FEAT-027, FEAT-028, FEAT-029, SCR-150 to SCR-152; D6 CFG-096 to CFG-140, API-204, API-205, API-317 to API-319; D7 PERM-021, FEAT-029, FORM-023; D8 CFG-096 to CFG-140, ENT-023, JOURNEY-047; D11 CFG-096 to CFG-140, FEAT-027 to FEAT-029, CFG-125; K2 ENT-START-03 (order type filter) |

### Table orders and order types on the card
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 60 | Service labels and types | TAKE_OUT card label "COLLECTION ORDER" (spec pickupName). DINEIN card label "TO SEAT ORDER" (spec toSeatName, overridable). Kiosk copy "Eat In" (DINEIN) and "Take Away" (TAKE_OUT). Copy in pt-BR to define. Kiosk offers only DINEIN and TAKE_OUT in the spec; DELIVERY is filtered out before display | OrderType TAKE_OUT, DINEIN (8.1); spec SEAT = DINEIN | PART | IN | KDS1 BR-029, CFG-036, DM-ORDER-TYPE, DM-VENUE-SERVICENAMES; K2 ENT-START-03; B1 DT-ORD-03 (orderType to enum) |
| 61 | Pay-at-table card | Table order with an open bill (PAY_AT_TABLE). Card shows the table and items; payment happens later | OrderType PAY_AT_TABLE; SubmitOrderRequest.openCheck | NO | IN | MODELS 8.1, 8.12; brief rule 3; D6 CFG-120 to CFG-124 (seat hours); D8 CFG-121 |
| 62 | Table number on the card | Table number shown on the card for DINEIN and PAY_AT_TABLE. The spec card has no table slot; v2 carries a table only as free text in notes | NEW SubmitOrderRequest.tableNumber (string) | NO | IN | KDS1 SCR-005-GAP; MODELS 8.12 notes |
| 63 | Delivery and PICKUP cards | DELIVERY label "DELIVERY ORDER", With Driver button, DELIVERING state, PICKUP cards, DRIVE_THRU and DELIVEROO | OrderType DELIVERY, PICKUP, DRIVE_THRU, DELIVEROO | NO | MODEL-ONLY | decision 7; KDS1 BR-019, OL-T-DRIVER, FEAT-022a, BR-029 |
| 64 | VOUCHER order type | Spec order type for voucher sales. Not one of the seven v2 OrderTypes | none | NO | OUT (decision 9: gift-card family out) | KDS1 DM-ORDER-TYPE, FEAT-009; MODELS 8.1 |
| 65 | Several rounds on one table | A second send for the same open check. Card per round or one card per table | SubmitOrderRequest.openCheck | NO | KAI? Q4 | brief rule 3; MODELS 8.12 |
| 66 | Guest count and waiter on the card | Guest count (IPosCheck.guestCount) and waiter name. v2 gives only a POS employeeId, not a Comanda staff member | IPosCheck.guestCount, employeeId (POS role); no Comanda staff model | NO | KAI? Q3 | MODELS 9.7; brief rule 3; KDS1 SCR-005-GAP |

### Printing (kitchen ticket printer)
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 67 | Auto-print and reprint | Each paid order printed once per device (print store). Auto-print 1 to 10 copies. Reprint from the detail. Single order copies = auto-print copies or 1 | PrintStoreRecord, PrinterSettings (local) | NO | HW-LATER | plan G-K10 (phase 4); KDS1 FEAT-035, FEAT-037, BR-024, CFG-004, CFG-019 |
| 68 | Printer setup per device | Emulation: EscPos, StarLine, StarGraphic, Epson, SunmiV2. Address (hidden for SunmiV2). Line width 42 default, 32 for SunmiV2. Epson discovery 60 s, saves "Epson_<series>" | PrinterSettings (address, model, lineWidth) | NO | HW-LATER | plan G-K10; KDS1 CFG-020 to CFG-022, SCR-017, PR-SETTINGS; BG-BKG-15 |
| 69 | Ticket layout | Label: name, address, items with modifiers, special requests with warning icon, service name, "Order #id - code", times, no prices. Receipt: "Order #:", "Customer:" block, "DELAY PREP" when asapFlag is false | none | NO | HW-LATER | plan G-K10; KDS1 PR-LABEL, PR-NEW, PR-DEFAULT, PR-ESCPOS, PR-CONVERT |
| 70 | Print-all and queue | One job per 2 s. Print-all lists open orders by pickup time. Options: "print only new" (default on), "update status to Preparing". The spec modal is defective, do not copy | PrintAllOptions (local) | NO | HW-LATER | plan G-K10; KDS1 BR-025, FEAT-034, SCR-018, PR-PRINTALL |
| 71 | Print failure | Bridge error toast 4 s. "Nothing to print" after 2 s on an empty queue. A failed job does not stop the queue | none | NO | HW-LATER | KDS1 ER-PRINT, PR-PIPE |
| 71a | Printer status and provider (shared driver) | Printer status codes OK(1), ERROR_OUT_OF_PAPER(2), ERROR_PRINTER_OPEN(3), ERROR_PRINTER_PAUSED(4), ERROR_BUFFER_FULL(5), ERROR_HEAD_TOO_HOT(6), ERROR_RIBBON_OUT(7), ERROR_UNKNOWN(99). Status routes return 200 with the code. Printer provider per type. The spec's receipt printer is the kiosk's; the kitchen ticket printer should reuse the same driver | none | NO | HW-LATER | B1 DM-RCP-02, BR-RCP-02, EP-RCP-05, INT-82, FR-RCP-005, FEAT-RCP-03; K2 FR-128; K1 F-KIOSK-07 |

### Close of day and reports
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 72 | Close the day (Encerrar o dia) | Spec base: "Complete all" confirm "This will change the status of all past, open orders to COMPLETED. Are you sure you want to continue?" (Cancel, Continue). Disabled with no orders; error "Server internal error" for 5 s. Comanda: show the count of unpicked orders, confirm, clear the board. Unpicked orders are not Retirado; they stay visible to the owner as "não retirado" | Order.status (outcome: Q5) | NO | IN | plan G-K9 (P2); KDS1 FEAT-033, SCR-012a, WF-5, BR-022, API-26, ER-COMPLETEALL, JRN-017 |

### Real-time, sync and errors
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 73 | Live updates | A status event merges at once. A fetch merges an order only when updated changed. Dedupe by id | Order.updatedAt | PART (SSE, 2 s polling fallback) | IN | KDS1 RT-EV-UPDATE, BR-014, RT-MERGE, OL-T-EVENT |
| 74 | Incremental fetch | At most once per 2 s. One follow-up when one is in flight. Catch-up on reconnect. Alerts re-arm after reload | none | HAS | IN | KDS1 BR-015, RT-LOAD-INCR, RT-CATCHUP, ER-MISSED, JRN-021 |
| 75 | Several kitchen screens | Same events to all devices. Last write wins, no lock, no conflict message | Order.updatedAt | NO | IN | KDS1 WF-MULTI, RT-CONFLICT, ER-RACE, JRN-020 |
| 76 | Connection lost | Keep the last data, no offline write queue, next poll retries. Only the temporary-offline state is shown | none | PART | IN | KDS1 ER-RT-DROP, ER-BACKEND-DOWN, README-SCOPE-4 |
| 77 | Session expiry on shift | Any 401 goes to login. A 403 during fetch clears the session (the spec then routes to Settings: device flow, do not copy) | none | PART | IN | KDS1 BR-045, ER-SESSION, JRN-023 |
| 78 | Kitchen feed is best-effort | A kitchen feed failure never decides order success. The kitchen catches up on reconnect | none | HAS | IN | B1 BR-ORD-07, INT-16, FEAT-ORD-01, BG-BKG-10, ORCH-ORDER, UJ-ORD-01; plan-next (kitchen delivery) |

### Kitchen messages, external feeds and cut features
| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 79 | Customer messages from the kitchen | Notify with preset or text. Reject text. SMS flag tied to SEND_SMS_ORDER_UPDATE. Presets ORDER_REJECT and ORDER_NOTIFY. Order message templates. Toast "Message sent" for 2 s; error "Error: API Unavailable, please try again later." Order rejection notification recipients (internal email list) | PresetMessage (no v2 field) | NO | KAI? Q9 | KDS1 FEAT-026, BR-004, BR-005, CFG-050, DM-PRESET, JRN-010; plan cut; D4 FEAT-083, SCR-139, CFG-723 to CFG-744; D2 FR-724 |
| 80 | StaffFeed external app | External staff app feed: cards (time, name, items, notes, total), accept, cancel and complete actions, per-user and organisation subscriptions, action labels (max 30), enabled flag, external organisation UUID. Multi-store selection is cut | none | NO | KAI? Q10 | D2 FR-726 to FR-742 (FR-742 CUT), FR-773; D4 CFG-723 to CFG-744; D5 SCR-136, SCR-137; D6 CFG-726 to CFG-742, API-017 to API-019, API-060, API-061; D12 CFG-726 to CFG-742, FEAT-087; D13 CFG-010; KDS1 INT-16 is Comanda's own feed |
| 81 | Loyalty scan on the kitchen screen | Scan or keyboard, redeem, stamps 1 to 999 (default 1), "Unable to redeem award, not enough cards" (409) | Award (8.10) | NO | CUT (rule 5: loyalty) | KDS1 FEAT-044, SCR-020, BR-034, JRN-014, CFG-053 |
| 82 | POS sync and menu import from the kitchen view | Unavailable items table, Sync now, last sync, banner, FAILED ITEMS. Menu import and push from POS, menu or file, force push | none | NO | OUT (decision 2: no POS integration) | KDS1 FEAT-045, SCR-021, BR-032, JRN-022; D3 FR-998 to FR-1014; D5 FEAT-043; D7 DLG-007, FEAT-043; D8 ENT-041, ENT-042, ERR-015; D9 FEAT-043 |
| 83 | Multi-store and storefront card | Venue dropdown, super-user venue search (min 3 chars), venue-scoped calls. Storefront store card with lead time visibility and drop slots | none | NO | CUT (rule 5: multi-store) | KDS1 FEAT-008, BR-036, BR-041; D13 FEAT-062, CFG-528; D3 FR-1140 to FR-1147; D8 ENT-068, ENT-069, BR-058; D2 FR-528; D7 FORM-068, FEAT-062 |
| 84 | Language | 23 locales in the spec | none | PART (PT and EN) | OUT (plan-next: PT and EN only) | KDS1 CFG-014, FEAT-004 |
| 85 | Venue feature flags | Flags that switch kitchen screen variants (ORDERS_SCREEN_NEW_UI, SOLD_OUT_ORDERS_SCREEN, DISPATCH_COMPLETE_ORDER, LOCKER_INTEGRATION and others) | none | NO | OUT (Comanda has no flags; each feature is decided above) | KDS1 CFG-053 to CFG-061; D8 DEP-F33 (flag for auto reject) |

## New fields to add to the v2 models
| Entity.field | Type | Meaning | Why (feature #) |
|:--|:--|:--|:--|
| Order.status | enum: PAID, PREPARING, READY, COLLECTED, CANCELLED. Add NOT_COLLECTED (Q5) and NO_SHOW (Q5) if chosen. DELIVERING and COMPLETED only for MODEL-ONLY | Kitchen board state | 1, 9, 10, 11, 43, 72 |
| Order.statusReason | string, optional | Reason for cancel or no-show | 43, 46 |
| Order.statusHistory | list of {updated: datetime, status, statusReason} | Detail history | 27 |
| Order.updatedAt | datetime | Stale-event guard and merge cursor | 13, 14, 31, 73, 75 |
| Order.cancelledBy | string (owner id) | Who cancelled, for audit | 43 |
| SubmitOrderRequest.tableNumber | string | Table for DINEIN and PAY_AT_TABLE orders | 62, 61 |
| SubmitOrderResponse.waitTime | integer, minutes | Wait line on the kiosk | 55 |
| ITEM.unavailableUntil | datetime, or enum NEXT_AVAILABLE_DAY, INDEFINITE | Sold-out duration | 48 |
| ITEM.visible | boolean, default true | Hidden is not sold out | 49 |
| StoreConfigurationResponse.pace | enum NORMAL, BUSY, PAUSED | Store pace | 51, 56 |
| StoreConfigurationResponse.pauseUntil | datetime, venue timezone | Pause auto-resume | 53 |
| StoreConfigurationResponse.prepTimeNormal, prepTimeBusy (prepTimePeak only if three levels) | integer, minutes | Wait per level | 52, 55 |
| Payment.changeDue | money (decimal BRL) | Cash change due | 34 |
| Payment.refundedAmount, Payment.refunds[] | decimal; list of {type, amount, reason, status} | Refund from the detail | 45 |
| ITEM.kitchenStation (only if Q2 = B) | string | Route an item to a station | 38 |

Note: the v2 models have no order status, no status history and no kitchen pace. The `posMetadata.kitchenPrinter` key on items (MODELS 5.9, example "grill") is stored by the platform and not read. See Q2.

## Open questions for Kai

**Q1. When does a kitchen order start? (rows 15 to 19)**
- A ⭐ Kiosk orders reach the kitchen after payment. Table orders reach it when sent, before the guest pays, because the kitchen needs them while the guest sits. No accept step.
- B Every order reaches the kitchen after payment. Table orders wait until the bill is paid.
- C Every order passes an accept step first (the spec's PENDING flow).

**Q2. Stations, outlets or lockers? (rows 37, 38)**
- A ⭐ One board for all items. No stations, outlets or lockers (one counter). `posMetadata.kitchenPrinter` stays unread.
- B One board with a station filter (new ITEM.kitchenStation).
- C Stations and locker pickup (adds a locker model, which v2 does not have).

**Q3. What does a table card show? (row 66)**
- A ⭐ Table number and items.
- B Table number and guest count.
- C Table, guest count and waiter name (needs a Comanda staff model; v2 has only the POS employeeId).

**Q4. A second round on the same table? (row 65)**
- A ⭐ A new card per round, marked as an addition, so the kitchen sees only what is new.
- B Items are added to the table's existing card.

**Q5. Unpicked orders at closing, and no-show? (rows 46, 72)**
- A ⭐ One outcome, "não retirado", for every unpicked order at closing (plan G-K9). No no-show.
- B The spec: no-show for cash orders only, then complete-all.
- C Both: no-show for cash orders, "não retirado" for the rest.

**Q6. Can an order be cancelled after the guest collected it? (row 44)**
- A ⭐ No. Block cancel once collected. The spec allows it (BR-007), which is a contradiction.
- B Yes, but only as a refund (phase 4).

**Q7. Find an order by number on the board? (row 42)**
- A ⭐ No search on the board. The collected-today list has search (row 32).
- B Keypad search on the board (spec SCR-010).
- C Keypad and barcode scanner (the scanner is HW-LATER).

**Q8. Capacity limits, or pace only? (row 59)**
- A ⭐ Pace only (Normal, Movimentado, Pausado). No order limits (plan G-K5).
- B Pace plus one kitchen order limit (CFG-134). The admission rule to agree with the partner.
- C Pace plus capacity per service and order interval (FEAT-027 to FEAT-029). The spec leaves admission unknown.

**Q9. Messages from the kitchen to the guest? (row 79)**
- A ⭐ None (plan-next cut).
- B In-app preset messages on an order, no SMS.
- C Presets plus SMS (an external vendor).

**Q10. Feed the external StaffFeed app? (row 80)**
- A ⭐ No. Comanda's board is the kitchen feed.
- B Yes. Needs a contract change and an external vendor.

## Spec contradictions and defects not to copy
- **DELIVERED:** in the report status set (FEAT-043, BR-038, API-28) but not in the status enum (DM-ORDER-STATUS). Do not copy.
- **Realtime merge:** BR-014 and ER-DUP merge only when `updated` differs. RT-EV-UPDATE and OL-T-EVENT merge at once. Comanda: guard every write path with `Order.updatedAt` (row 14).
- **Accept to Ready:** allowed on the card (WF-3, OL-T-READY) but not in the detail footer (FEAT-022a, JRN-005, README-GAP-6). Comanda: one rule for both.
- **Cancel after close:** BR-007 and JRN-024 allow cancel on COMPLETED and REJECTED. Q6.
- **Cancel is fire-and-forget** (API-21, ER-FIRE-FORGET). Comanda must wait for the result and show a failure (row 13).
- **Failed PUT keeps the optimistic status** (README-GAP-4, ER-FAILED-ACTION, BR-012). Defect, not copied (row 13).
- **Complete-all selection:** WF-5 says pickupTime at or before now; BR-022 and FEAT-033 say before now; the request sends pickupTime=now. Selection is Unknown (row 72).
- **Peak is not Pausado:** spec "Peak" (FR-058) is a preparation time. The plan's Pausado is a stop with auto-resume. Keep them separate (rows 51, 52). Plan names (Normal, Movimentado, Pausado) differ from spec names (Standard, Busy, Peak); use neutral enums NORMAL, BUSY, PAUSED.
- **Lead time 99999 means Closed Venue** (CFG-030, BR-028). Magic number. Use an explicit enum.
- **Payment capture:** BR-001 says payment is captured only on accept. Comanda's kiosk takes payment first (Q1).
- **Printing defects:** print-all modal injection (README-GAP-1, FEAT-034); labelPerItem template missing (README-GAP-3, CFG-006, BR-026). Not copied.
- **Analytics event with no UI** ("max orders reached", README-GAP-5). Not copied.
- **Fixed timings are spec defaults, not rules:** ageing 30 s and 60 s (FEAT-010), 2 s throttle (BR-015), 60 s filter (BR-017), 3 h keep-alive (FEAT-048).
- **403 routes to Settings** (BR-045). Device setup flow of the reference, do not copy.
- **Hide popup** is removed on purpose; the bar replaces the popup (row 22).
- **Collection:** the spec "collection" maps to TAKE_OUT. PICKUP is MODEL-ONLY (decision 7).

## Notes
- **Owner areas:** the report (FEAT-043, from and to 8 h), the refund dialog (G-A3) and capacity screens belong to backoffice-store-ops. The kiosk wait line and at-capacity screen belong to the kiosk area. Both are referenced here only where the kitchen drives them.
- **Device pairing and per-device settings** (venue, outlets, printer template, auto-accept) belong to the platform area.
- **Not verified:** nothing rendered or run. Copy strings are the spec's; pt-BR copy is not decided.
