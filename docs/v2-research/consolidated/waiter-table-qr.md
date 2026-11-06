# Waiter, tables and QR menu — consolidated requirements

Area: waiter-table-qr. Source rows: all 513 inventory rows with T set (426 `Y`, 87 `Y?` or `Y (…)`), plus `table-service-reference.md`. Canvas: `docs/prototype/full/project/` (G1–G8, Q1–Q9, proposal only).

Verdict legend: IN · MODEL-ONLY · CUT (brief rule) · OUT (decision) · HW-LATER · OPEN → OQ-n (the decisions do not settle it; see Open questions).

## Summary

- **Almost nothing exists yet.** Comanda has only kiosk eat-in and take-away (HAS) and partial seat/dine-in flags. Waiter login, tables, open checks, rounds, guest count, requests, table bill and QR are all NO.
- **v2 has no table, waiter or request model.** `IPosCheck` and the check endpoints (MODELS 8.14, 8.15, 9.7) are written for the POS role. The partner must agree new Core endpoints, and `table/validate` has no response model (9.13).
- **Scope conflict to settle first (OQ-1).** Decision 4 makes waiter and QR channels in scope; CLAUDE.md and the canvas README say they are outside the MVP.
- **Canvas conflict (OQ-29).** Decision 4 says the QR menu is view only. Canvas Q5–Q8 let the guest order, track and pay by Pix.
- **Counts (distinct features, 94):** IN 40 · OPEN 43 (question asked) · CUT 7 · OUT 3 · HW-LATER 1.
- **Biggest risk:** the partner builds the Go side on v2 as written and never gets tables, rounds and open checks, so the waiter app has nothing to call. Agree the new entities (TABLE, TABLE_REQUEST, WAITER) before any screen work.

## Features

### 1. Waiter access

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 1 | Waiter sign-in by name and PIN | Staff picks a name, then types a 4-digit PIN (canvas G1: "Quem está no turno?", "Escolha seu nome e digite seu PIN de 4 números."). Reference: clerk lookup checks the PIN against the POS clerk first, then the venue pinCode; match gives 200, miss gives 404. `pin` is required. Do not copy the decimal-string comparison (see defects). | NEW WAITER (NF-16) | NO | OPEN → OQ-2 | B1 AUTH-CLERK, BR-SES-08, FEAT-SES-05, FR-SES-005, EP-SES-05, UJ-SES-02; B1 VAL-SES |
| 2 | Waiter accounts | Reference has no waiter list. Waiters would come from back-office user records (invitation flow). Canvas shows three placeholder names (Ana, Bruno, Carla). | NEW WAITER | NO | OPEN → OQ-3 | D5 FEAT-013, SCR-078..081; D7 FEAT-013, FORM-009; D13 FEAT-013, CFG-021, CFG-023, CFG-024 |
| 3 | Waiter role and permissions | Roles are service-defined; no waiter role is listed. Proposed rights: open check, send round, request bill, close check and take payment. No discount or refund rights (proposal). | NEW role value (NF-16) | NO | OPEN → OQ-4 | D7 ROLE-MATRIX, README-ROLES, PERM-020; D5 SCR-078 |
| 4 | Device pairing for the waiter screen | Canvas marks device pairing as open (A13/M13 and G1). Data-model open question: device pairing and secret storage. | NEW DEVICE (only if OQ-5 = A) | NO | OPEN → OQ-5 | canvas README "Still open"; CLAUDE.md open questions |

### 2. Tables and locations

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 5 | Table record | Table with a number (string), channel flags (dine-in or seat, pay at table), active flag. Location name required, max 100, HTML-injection check; location type max 12 characters. | NEW TABLE (NF-14) | NO | IN (fields: OQ-6) | D2 FR-644, FR-645; D3 FR-1255, FR-1259; D11 FEAT-075; D7 FEAT-075; D3 FR-1249 (multi-store part cut, see 12) |
| 6 | Zone or location group | Reference: location group with label required, max 100, holding locations. Heading "additional info" required, max 100 (CFG-636). v2 has no zone. | NEW TABLE.zone or entity (NF-14) | NO | OPEN → OQ-7 | D11 FEAT-075, CFG-636; D3 FR-1253, FR-1254; D8 ENT-086 |
| 7 | Seat number range | Start and end seat numbers, integer, max 9999, non-digits stripped. Customers pick a numbered seat in the range. | NEW TABLE.seatStart, seatEnd (only if OQ-8 = B) | NO | OPEN → OQ-8 | D2 FR-641, FR-647; D11 CFG-641, CFG-647; D3 FR-1256 |
| 8 | Free-text table entry | Customers type location text instead of picking a numbered seat. Enabled per location. | none (ValidateTableRequest.tableNumber is a plain string) | NO | OPEN → OQ-33 | D2 FR-643; D11 CFG-643; D3 FR-1257 |
| 9 | Table number validation | Request: `ValidateTableRequest` {config, tableNumber (string, required)}. Response is undefined in v2 (9.13). The rule for a valid table is not in the reference. | ValidateTableRequest (8.15); response NEW | NO | OPEN → OQ-9 | B1 VAL-SES; table-service-reference #1; MODELS 8.15, 9.13 |
| 10 | Location services | A table can serve dine-in (DINEIN) and pay at table (PAY_AT_TABLE). | OrderType DINEIN, PAY_AT_TABLE (8.1) | NO | IN | D3 FR-1258; D4 FEAT-075; table-service-reference #2 |
| 11 | Edit and delete a table | Create, edit and delete a location. Detaching a link is separate from deleting the record. Reference has no rule for deleting a table with an open check (ask in OQ-6). | TABLE | NO | IN | D3 FR-1255, FR-1259; D5 ACT-505..515; D8 ENT-086, ENT-087; D11 FEAT-075 |
| 12 | Outlets, outlet menus, store-level seat service | Outlets with location trees, outlet menu assignment, enabled seat stores after publication. One restaurant only. | — | NO | CUT (rule 10: one restaurant, no multi-store) | D3 FR-1249..1252; D5 SCR-156..158; D7 FORM-020; D8 CFG-095; D11 FEAT-023, CFG-095; D2 FR-835; D5 ACT-091; D1 FR-095 |
| 13 | Waiter table list (screen) | Canvas G2. Tile statuses: "Livre", "Ocupada" (total and time, e.g. "há 25 min"), "Pediu a conta", "Pronto para servir", "Pedido novo pelo QR", "Ocupada" with "aberta por Ana". Filters: "Todas" (12), "Minhas" (1), "Precisam de mim" (3). Reference: none. | derived from TABLE, IPosCheck, request state | NO | OPEN → OQ-10, OQ-25, OQ-26 (screen is a proposal) | canvas G2 |

### 3. Open check (bill)

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 14 | Open check per table | An order can be sent with `openCheck: true` so the POS (here Comanda Core) leaves the check open for more rounds and payment later. Default `false`. Canvas: one open check per table. | SubmitOrderRequest.openCheck (8.12) | NO | IN | MODELS 8.12; canvas README; table-service-reference #3 |
| 15 | Check read model | Fields of the open check: number, subTotal, discount, serviceCharge, tax, total, items[], payments[], guestCount, employeeId, checkOpenedAtInUTC, displayText. POS-only fields do not apply to Comanda: basketId, isOpenedByPosEmployee, text (printing). | IPosCheck (9.7) | NO | IN | MODELS 9.7; table-service-reference #3 |
| 16 | Read the open check by table | Endpoints `check` and `checks` read by table number (GetCheckRequest config). Re-home as Comanda Core read endpoints; the `/internal/v2` path is the POS role. | IPosCheck (8.14) | NO | IN (endpoint re-homed) | MODELS 8.14; decision 2; table-service-reference #3 |
| 17 | Guest count | Integer count of guests on the check (`guestCount`). Reference has no range. Canvas stepper "Pessoas": min 1, max 12, shown as "1 pessoa" / "N pessoas". | IPosCheck.guestCount (9.7) | NO | IN (range: OQ-14) | MODELS 9.7; canvas G3 |
| 18 | Check owner and opening time | Check opened by a waiter: canvas "Aberta às 10:02 por Ana". v2: employeeId and checkOpenedAtInUTC. Type conflict: employeeId is an integer, but ids are strings (decision 1). | IPosCheck.employeeId (TYPE CHANGE to string), checkOpenedAtInUTC | NO | IN | MODELS 9.7; decision 1; canvas G3 |
| 19 | Check status | Reference has no status. Proposal: OPEN → BILL_REQUESTED → PAID. Table becomes free when PAID (canvas G8: "Mesa liberada", "A mesa 12 volta a aparecer como livre na lista de mesas."). | NEW IPosCheck.status (NF-2) | NO | OPEN → OQ-10 | canvas G8; table-service-reference #3 |
| 20 | Add a round to an open check | Reference: "adding a round undefined". Canvas shows rounds per check. | — | NO | OPEN → OQ-11 | table-service-reference #3; canvas G3 |
| 21 | Transfer table, void, comp | Canvas G3 has the action "Transferir mesa". Reference is silent on transfer, void, comp and merge. | — | NO | OPEN → OQ-15 | canvas G3; table-service-reference "Not covered" |
| 22 | Close check and pay at the table | `PayCheckRequest`: config (tableNumber) and payments[] (default []). The whole check is paid in one payment (split bill is cut). Order type PAY_AT_TABLE. Closing sets the check to PAID. | PayCheckRequest (8.14), Payment (8.8), OrderType.PAY_AT_TABLE | NO | IN (manual step: OQ-12) | MODELS 8.14, 8.8; table-service-reference #5 |
| 23 | Tenders at the table | Payment by tenderId (cash, card, others). Card through the terminal is HW-LATER (phase 4). Pix appears on canvas Q8 only. Vendor-specific tenders are OUT (decision 9). | Payment.tenderId, tenderRef, cardScheme, cardLast4Digits (8.8) | NO | IN (cash, card record); Pix: OQ-13 | MODELS 8.8; decision 9; canvas G7, G8, Q8 |
| 24 | Cash change | Canvas G7: "Troco para", "Deixe em branco se o cliente não precisa de troco.", "Total a receber". Not in reference or v2. | NEW Payment.cashTendered (NF-5) | NO | OPEN → OQ-12 | canvas G7 |
| 25 | Tip on the check payment | Tip paid with the payment. | Payment.tipAmount (8.8, 9.3) | NO | IN | decision 8; MODELS 8.8; table-service-reference #5 |
| 26 | CPF on the fiscal note at close | Canvas G7 "CPF na nota" (optional: "Preencha só se o cliente pedir."); Q8 "Usamos o CPF só para a nota fiscal." v2 has invoiceCpfCnpj on the order request but not on PayCheckRequest. | NEW PayCheckRequest.invoiceCpfCnpj (NF-4) | NO | IN (where: OQ-20) | MODELS 8.12 (invoiceCpfCnpj); canvas G7, Q8 |
| 27 | Several payments on one check | One check paid with several payments (split bill). | Payment[] | NO | CUT (rule 10: split bill) | brief rule 10; MODELS 8.14 payments[] |
| 28 | Print the check | Canvas G8 "Imprimir conta", note "Impressora chega na fase 4." Printer is hardware. | — | NO | HW-LATER | canvas G8; decision 11 |

### 4. Rounds sent by the waiter

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 29 | Send a round to a table | A round is an order with orderType DINEIN, openCheck true, the table, the waiter and the notes. POST needs an Idempotency-Key (UUID per attempt). | SubmitOrderRequest: orderType, openCheck, notes, NEW tableNumber (NF-6), NEW employeeId (NF-7) | NO | IN | MODELS 8.12; decision 5; CLAUDE.md contract rules |
| 30 | Round record and origin | Canvas: "Rodada 1 · 10:04", status "Entregue" or "Preparando", origin "Enviada por Ana" or "Pelo QR Code da mesa". Round numbering per check is not in reference. | NEW Order.source (WAITER, QR, KIOSK) and Order.roundNumber (NF-8) | NO | IN (fields); numbering: OQ-11 | canvas G3, Q7; table-service-reference #2 |
| 31 | Menu on the waiter screen | Same menu and availability as the kiosk. Canvas G4: search "Buscar item", categories "Todos", "Pães", "Folhados", "Doces", "Sanduíches", "Cafés"; sold-out items shown. Availability belongs to the menu area. | ITEM.available, ITEM.seatFlag (5.9) | PART | IN (menu area owns rules) | canvas G4; D6 CFG-181..214; D9 FEAT-033; MODELS 5.9 |
| 32 | Item builder | Canvas G5: required choice "Pão · Obrigatório · escolha 1"; removable ingredients "Tirar ingredientes · Opcional · sem custo" (R$ 0,00); add-ons "Adicionais · Opcional · até 3"; quantity; note "Observação para a cozinha". Duplicate-attachment rules apply. | MODIFIERS (5.12, types INGR/SURC/MODI, 5.13), OrderItem.specialNotes (8.2) | PART | IN (menu area owns modifier rules) | canvas G5; MODELS 5.12, 5.13, 8.2; D8 BR-025 |
| 33 | "Para quem" per item | Canvas G5: "Para quem" (Opcional) assigns an item to a guest. Not in reference. | NEW OrderItem.guestNumber (NF-9) | NO | OPEN → OQ-21 | canvas G5 |
| 34 | Review and send a round | Canvas G6: title "Revisar rodada 3"; "Mesa 12 · Ana · 3 pessoas"; "Enviado às 10:44 · a cozinha já recebeu"; "A rodada 3 já aparece na Mesa 12 como Preparando."; empty round blocked with "Nenhum item na rodada. Volte e adicione."; button "Enviar para a cozinha"; "Voltar para a Mesa 12". Reference: none. Treat as the proposed flow, to confirm with the owner in review. | SubmitOrderRequest | NO | IN (copy from canvas; flow proposed) | canvas G6 |
| 35 | Round note for the kitchen | Canvas G6 "Observação para a cozinha". Reference: specialNotes = customer's note for the whole order; notes = POS ticket reference. | SubmitOrderRequest.specialNotes, notes (8.12) | PART | IN | MODELS 8.12; canvas G6 |
| 36 | Table orders use the DINEIN type and seat flag | Table orders are DINEIN; tax follows seatTax (decision 5). Items must have seatFlag true to be sold at a table. | OrderType.DINEIN; ITEM.seatFlag (5.19) | PART | IN | decision 5; MODELS 5.19; D1 FR-212 |
| 37 | Acceptance and minimum for table orders | Auto-accept seat orders (CFG-063, FR-063); off gives a rejection timeout. Reject unaccepted seat orders after N minutes (CFG-080, FR-080; unit not stated; three entries share this label). Minimum seat order, money (CFG-074, FR-074). | — | NO | OPEN → OQ-23 | D1 FR-063, FR-074, FR-080; D6 CFG-063, CFG-074; D8 CFG-063, CFG-074; D11 CFG-063, CFG-074, CFG-080 |
| 38 | Seat delivery time | Non-negative integer, required: time allowance to deliver an order to a seat or table (CFG-082, FR-082). Unit not stated. | — | NO | OPEN → OQ-23 (only if acceptance is kept) | D1 FR-082; D6 CFG-082; D8 CFG-082; D11 CFG-082 |
| 39 | Seat order limits and interval | Default, expanded and reduced seat capacity: non-negative integer, max 11 characters (CFG-130, CFG-133, CFG-140). Order interval for seat orders: positive integer, required (CFG-137). Kitchen order capacity (FEAT-027..029). | — | NO | OPEN → OQ-24 | D1 FR-130, FR-133, FR-137, FR-140; D11 FEAT-027..029, CFG-130, CFG-133, CFG-137, CFG-140; D6 CFG-125..140 |
| 40 | Seat service name for customers | Customer-facing name of the seat or table service, max 50 (CFG-077, FR-077). | — | NO | IN | D1 FR-077; D11 CFG-077 |

### 5. Seat hours, tax, prices and channel settings

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 41 | Seat service hours | Base or custom hours ("Same as base" default). Opening 00:00 and closing 23:59 by default. Weekdays: none selected by default. Optional capacity profile (CFG-121). | IHours with seat = 1 (9.10); day 1 = Sunday; times HH:mm:ss.SSS | PART (kiosk dine-in hours only) | IN | D8 CFG-120..124; D11 CFG-120..124; D1 FR-120..124; D6 CFG-120..124; MODELS 9.10 |
| 42 | Seat service on or off (store) | Store switch with autosave after a 1 s debounce (ACT-076, FR-820). v2 has no store flag; switching off = no seat hours rows. | IHours seat = 1 (no separate flag) | NO | IN (confirm no flag needed) | D2 FR-820; D4 ACT-074..080; D5 ACT-074..080; D9 FEAT-033 |
| 43 | Seat tax rate | Percentage 0–100, stored as a fraction (FR-425, CFG-425, FORM-053). Applies to DINEIN and PAY_AT_TABLE (decision 5). FR-425 text "six-place adjustment" is unclear: do not copy. | TAX.taxRates.seatTax (5.16) | NO | IN | MODELS 5.16, 5.19; decision 5; D2 FR-425; D10 CFG-425; D7 FEAT-050, FORM-053 |
| 44 | Seat price for table orders | Seat price override: boolean "Override price for seat" (CFG-230) and money "Seat price" (CFG-232, FR-232). Reference lists it; v2 has no seat price and uses ITEM.price for table orders (5.19). | NEW ITEM.seatPriceOverride (NF-10) | NO | OPEN → OQ-22 | D1 FR-230, FR-232; D8 CFG-230, CFG-232; D9 CFG-230, CFG-232; D4 FORM-031; MODELS 5.19 |
| 45 | Dine-in price override (kiosk eat-in) | Dine-in price (CFG-217, CFG-224): separate from seat. Used for eat-in (DINEIN from the kiosk). Relevant to OQ-22 because table orders are also DINEIN. | ITEM.dineInPriceOverride (5.9) | NO | IN (see OQ-22) | D8 CFG-217, CFG-224; D6 CFG-209..233; MODELS 5.9, 5.19 |
| 46 | Hide a section outside its schedule for table bill and to seat | Per-section flags: "Hide scheduled for table bill" (CFG-171), "Hide scheduled for to seat" (CFG-173); the same family has dine in (CFG-169), delivery, pickup, take out. Section hours have no channel in v2. | NEW CATEGORY.hideOutsideSchedule.{seat, tableBill, …} (NF-11) | NO | IN | D8 CFG-169, CFG-171, CFG-173; D9 CFG-171, CFG-173, FEAT-032; D6 CFG-168..173; D1 FR-171, FR-173 |
| 47 | Item sold for table orders (seat flag) | "Allow seat/table ordering for the item" (CFG-212, FR-212); "Seat delivery available" (CFG-081, FR-081, FR-646) per item and size. | ITEM.seatFlag (5.9, 5.19) | PART | IN | D1 FR-081, FR-212, FR-646; D8 CFG-212; D9 CFG-212; D11 CFG-081, CFG-646; D6 CFG-081, CFG-082 |
| 48 | Kiosk dine-in and take-out switches | Kiosk dine-in service on or off (CFG-534, default on). Dine-in and take-out cannot both be off; each switch is disabled while the other is off (BR-041, DEP-209, DEP-210, FEAT-063, JOURNEY-012 alt). | OrderType.DINEIN, TAKE_OUT (8.1) | PART | IN | D12 FEAT-063, CFG-534; D8 BR-041, DEP-209, DEP-210, JOURNEY-012; K1 BR-START-11 |

### 6. Kitchen view of table orders

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 49 | "To seat" label on the kitchen order | Service name fallback "TO SEAT ORDER" when toSeatName is empty (BR-029). Override in settings: toSeatName (CFG-036, DM-VENUE-SERVICENAMES). Kitchen type SEAT maps to DINEIN; VOUCHER has no equivalent (DM-ORDER-TYPE). Portuguese label to set (not in spec). | OrderType.DINEIN | NO | IN | KDS1 BR-029, CFG-036, DM-VENUE-SERVICENAMES, DM-ORDER-TYPE, FEAT-019a |
| 50 | Table on the kitchen card | Card has no table number, seat, guest count, waiter or check element. Only the service name and type icon show table service. | none (kitchen card) | NO | OPEN → OQ-28 | KDS1 SCR-005-GAP, SCR-005-HEADER; table-service-reference #6 |
| 51 | Served state for table orders | Reference has no served state. Canvas G2 shows "Pronto para servir" on a table; waiter marks it served. | NEW Order status READY_TO_SERVE, SERVED (NF-13) | NO | OPEN → OQ-27 | canvas G2; table-service-reference #6 |

### 7. Service charge

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 52 | Service charge definition | Name required; internal name required and distinct from display name; internal description required; type percentage or fixed (default percentage); order type "All" only (CFG-413). | ServiceCharge {id, name, type, value} (8.5) | NO | IN | D10 FEAT-048, CFG-394, CFG-408, CFG-409, CFG-412, CFG-413; D4 CFG-401..418; D1 FR-394, FR-408, FR-409, FR-412, FR-413 |
| 53 | Service charge rate in store config | Percentage (e.g. 10%) in store configuration. Entered 0–100 and stored as a fraction ("percentages divided by 100 for storage"). | NEW StoreConfiguration.serviceChargeRate (NF-12) | NO | IN | decision 6; D3 FR-1041..1046; D5 ACT-297..304; D7 FEAT-048 |
| 54 | Service charge amount computed by Core | Core computes the amount and sends it in ServiceCharge.value. The POS does not compute it. Totals show serviceChargeTotal. | ServiceCharge.value (8.5); TotalsResponse | NO | IN | decision 6; MODELS 8.5, 9.4; K2 ENT-BASKET-02 |
| 55 | Charge screens | Charges list, new and edit (SCR-229..231). Create, edit, delete, cancel editor, save returns to the list. | ServiceCharge | NO | IN | D5 SCR-229..231; D3 FR-1041..1048; D4 SCR-229..231, ACT-297..304; D7 FEAT-048, FORM-049, FORM-050 |
| 56 | Charge validity dates | Start date and hour required (CFG-414, CFG-415); end date and hour optional (CFG-405, CFG-406). Not in v2 ServiceCharge. | NEW only if OQ-18 keeps dates | NO | OPEN → OQ-18 | D10 CFG-405, CFG-406, CFG-414, CFG-415; D1 FR-405, FR-406, FR-414, FR-415 |
| 57 | Charge scope and once per order | Applies to the total basket by default (CFG-402). Options: items, sections, tags (CFG-395..397). "Once per order" applies to the cheapest eligible item (CFG-404, default on). | none in v2 | NO | OPEN → OQ-18 | D10 CFG-395..397, CFG-402, CFG-404; D1 FR-395..397; D3 FR-1045 |
| 58 | Minimum and maximum basket for the charge | Minimum order to apply (CFG-411) and maximum order to apply (CFG-410), money. Same label as CFG-364 with the opposite meaning. | none in v2 | NO | OPEN → OQ-18 | D1 FR-410, FR-411; D10 CFG-410, CFG-411; D10 CFG-410 note on CFG-364 |
| 59 | Service charge on or off per check | Canvas G7 toggle "Cobrar serviço de 10%" on the check. Canvas Q7 shows "Serviço 10% (opcional)". Reference: none. | NEW IPosCheck.serviceChargeApplied (NF-3) | NO | OPEN → OQ-16 | canvas G7, Q7 |
| 60 | Service charge base | Canvas example: subtotal R$ 95,60 plus 10% = R$ 9,56 (total R$ 105,16). Base before or after discounts not in reference. | — | NO | OPEN → OQ-17 | canvas G3, G7, Q7 |
| 61 | Tax on the service charge | Charge has a tax group (FR-1044, "Set tax group"). Which rate applies is not in reference. | TAX on ServiceCharge (conditional, see new fields) | NO | OPEN → OQ-19 | D3 FR-1044; D7 UNK-003 |
| 62 | Discounts on the service charge | "Apply offer to fees" (CFG-312) and "Apply discount on fees" (CFG-355) both switch fee discounts on. | none in v2 | NO | OPEN → OQ-19 | D10 CFG-312, CFG-355 |
| 63 | POS representation, external id, integrate with POS | "Set POS representation" (FR-1043, CFG-398), external id required (CFG-403, FR-403), "Integrate with POS" (CFG-407, FR-407) delegates calculation. | ServiceCharge.id (POS id) | NO | OUT (decision 2) | D3 FR-1043, FR-403, FR-407; D10 CFG-398, CFG-403, CFG-407; D1 FR-398, FR-407 |
| 64 | Service charge lines on the kiosk basket | Totals block: Sub Total, Tax (when exclusive or configured), Service Charge, itemised fees, Discounts, charity amount, Total. Itemised fees show when total > 0 and named. The aggregate "Service Charge" line is hidden when the fees sum to at least serviceCharge. A fee named "round up" shows the charity name. Applies to kiosk dine-in too: see OQ-16. | ServiceCharge, TotalsResponse, Payment.donationAmount | NO | IN (kiosk area) | K2 FR-409, FR-411; K1 F-BASKET-02; K2 ENT-BASKET-02 |

### 8. Table bill (pay at table) settings

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 65 | Table-bill container | Back-office container for table-bill settings (`/table-bill`, SCR-145; FEAT-072). Holds the custom-field groups. | IPosCheck, OrderType.PAY_AT_TABLE | NO | IN | D4 FEAT-072, SCR-145; D5 SCR-145; D7 FEAT-072; D4 FEAT-072 (feature-checklist) |
| 66 | Table-bill custom fields | Template with 1 to 3 text inputs. Heading required, max 500 (CFG-607); subheading required, max 500 (CFG-608); title required, max 50 (CFG-609, CFG-619); description max 140 (CFG-610); enabled (CFG-611); helper text max 50 (CFG-612); operator instructions max 140 (CFG-613); internal name required, max 50 (CFG-614); trigger "Before ordering" or "When placing order" (CFG-615); repeat "Just once" or "Every order round" (CFG-616). Add only below 3, remove only above 1; removal compacts order. UI says one enabled template; backend exclusivity not proven. The legacy location field (CFG-604..606: name and placeholder required) uses the same shape. | none in v2 | NO | OPEN → OQ-32 | D2 FR-607..619; D4 FEAT-071, FORM-081, FORM-082, CFG-604..619, ACT-474..482; D7 FEAT-071, FORM-081, FORM-082, UNK-011; D8 CFG-604..619; D12 FEAT-071, CFG-607..619 |
| 67 | Table-bill loading text and pay-table logo | Loading text (CFG-709) and pay-table logo image (CFG-710) on the table-bill screen. | — | NO | CUT (rule 10: one visual template) | D2 FR-709, FR-710; D6 CFG-710; D8 CFG-709, CFG-710; D12 CFG-709, CFG-710 |
| 68 | Table-bill POS consent | "Consent for table-bill payment" (CFG-591, FR-591): applies POS consent handling to table-bill payments. | — | NO | CUT (decision 8: consent workflows out) | D2 FR-591; D8 CFG-591; D12 CFG-591; D6 CFG-585..594 |
| 69 | Table-bill shared device flag | Feature flag "table-bill shared device" (DEP-F43). Meaning not explained in reference. | NEW DEVICE setting (only with OQ-5) | NO | OPEN → OQ-5 | D8 DEP-F43 |
| 70 | Tag action on the table bill | Tag action application type "table-bill payment" (FR-273, CFG-273), allow removing the trigger item (CFG-272), operators only (CFG-280). Menu-marketing feature; owned by the menu area. | — | NO | OPEN (menu area decides) | D1 FR-273; D9 CFG-272, CFG-273, CFG-280, FEAT-037 |
| 71 | Table-bill reports | Report choices: "table bills", "table-bill summary", "busiest table-bill days" (FEAT-077). Same periods and filters as the other reports. | Payment, IPosCheck | NO | IN (reports area) | D13 FEAT-077 |
| 72 | Check analytics screens | `/analytics/analyticsChecks/:reportName` and `/analytics/analyticsSummaryCheck` (SCR-016, SCR-017; PERM-010 or PERM-011). Reference does not say whether "check" means IPosCheck or a receipt. | IPosCheck (?) | NO | OPEN → OQ-37 | D4 SCR-016, SCR-017; D5 SCR-016, SCR-017 |

### 9. Customers and assisted ordering

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 73 | Customer data on a payment | First name, last name, email, phone on the payment (kept in scope by decision 8). | Customer (8.6), Payment.customer (8.8) | NO | IN | decision 8; MODELS 8.6, 8.8; D13 FEAT-073 (field rules) |
| 74 | Customer management screens | Search; create and edit with first and last name required (max 100), email max 100 (conditionally required), phone required (max 100); marketing opt-in; notes max 2048; order history. v2 Customer has no opt-in or notes. Decision 8 keeps Customer but not the screens. | Customer (no opt-in, no notes in v2) | NO | OPEN → OQ-36 | D13 FEAT-073; D4 SCR-041..050, FORM-083, ACT-484..494; D7 FEAT-073, FORM-083 |
| 75 | Assisted ordering | Staff place an order for a guest inside an external scoped session ("Launch assisted ordering"). The external session is EXT. | — | NO | OPEN → OQ-35 | D3 FR-1237; D4 FEAT-073, ACT-493; D7 FEAT-073 |

### 10. Call waiter and request bill

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 76 | Guest asks for the bill | Provider PAY_WAITER: cloud waiter-call provider; authorise maps to a request-for-bill or waiter flow; never persisted locally. The name "pay-waiter" is undefined in the spec. Canvas: "Pagar com o garçom" (Q7), "Ver a conta" (Q6). | NEW TABLE_REQUEST (NF-15) | NO | OPEN → OQ-25 | B1 PROV-PAYWAITER, FR-PAY-004; canvas Q6, Q7 |
| 77 | Guest calls the waiter from the table | No reference for a table call. Canvas has no call button on the Q screens; the waiter sees "Precisam de mim" tiles. | NEW TABLE_REQUEST (type CALL_WAITER) | NO | OPEN → OQ-25 | canvas G2; table-service-reference "Not covered" |
| 78 | Kiosk help button | HelpButton requests staff help (FR-1205). "Help is on the way" / "Please wait." while pending (FR-1206). Cancel help (FR-1207). Kiosk area owns it; help analytics: row 81. | none (request) | NO | IN (kiosk) | K2 FR-1205, FR-1206, FR-1207, UJ-SCO-03, DI-A12-SCO-HELP; K1 F-SCO-01 |
| 79 | Waiter alerts | Canvas G2 alert strip: "Mesa 6: pedido pronto", "Mesa 4 pediu a conta", "Mesa 8: pedido novo pelo QR". Alert channel not in reference. | — | NO | OPEN → OQ-26 | canvas G2 |
| 80 | StaffFeed external app | External staff feed: order alerts, accept, cancel and complete actions, card content (collection time, customer name, instructions, items, location, order total), notification config, selected stores. | — | NO | OUT (external app; in-app alerts replace it if OQ-26 = A) | D4 FEAT-087, SCR-136, SCR-137; D6 CFG-010, CFG-726..742, API-017, API-018, API-019, API-060, API-061; D8 CFG-741; D13 CFG-010, CFG-723..744 |
| 81 | Help request analytics | Analytics for help request and cancel (FR-1208). | — | NO | OUT (EXT, analytics vendor) | K2 FR-1208 |

### 11. Guest QR menu (mobile, guest by table QR code)

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 82 | Table QR entry | Guest scans the table QR. Canvas Q1: "Mesa 12 · Boas-vindas", restaurant name "Padaria Café e Trigo", language buttons PT and EN. The table comes from the QR. | TABLE (qr identifier, NF-14) | NO | OPEN → OQ-30 | canvas Q1; decision 4; CLAUDE.md (pt-BR and en) |
| 83 | QR menu view | Canvas Q2–Q4: "Combo" entry "Café da manhã" ("Um salgado e uma bebida", R$ 24,90), tags "Mais pedido" and "Esgotado", item detail with allergen line ("Contém glúten, leite, ovos" / "pode conter castanhas"), option "Esgotado hoje", combo choices "Escolha o salgado", "Escolha a bebida", "Tamanho do café". View only (decision 4). | ITEM.allergens (5.11), ITEM.available, combo types (5.14) | NO | IN (view only) | canvas Q2, Q3, Q4; decision 4; MODELS 5.11, 5.14 |
| 84 | QR ordering and tracking | Canvas Q5: cart "Rodada 2 · nova para a mesa 12", "Combina com" cross-sell, optional note "Observação para a cozinha (opcional)", optional name "Seu nome (opcional)", "Não cobra agora. Entra na conta da mesa."; Q6 tracking "Pedido enviado" / "Preparando" / "A caminho da mesa"; buttons "Pedir mais" and "Ver a conta". Conflicts with decision 4 (cannot order). | SubmitOrderRequest (DINEIN, openCheck) | NO | OPEN → OQ-29 (conflict) | canvas Q5, Q6; decision 4 |
| 85 | QR table bill view | Canvas Q7 "Conta da mesa": all rounds (origin "Garçom Ana" or "Você, pelo QR Code"), subtotal R$ 95,60, "Serviço 10% (opcional)" R$ 9,56, total R$ 105,16, buttons "Pagar a conta · {{totalValue}}" and "Pagar com o garçom". | IPosCheck, Order.source | NO | OPEN → OQ-31 | canvas Q7 |
| 86 | QR payment with Pix | Canvas Q8: Pix QR code, "Expira em 9:58", optional "CPF na nota", "Cartão: peça ao garçom", "Já paguei". Q9: "Conta paga. Obrigado!", "Pago via Pix · hoje, 10:47". Pix as a tender is not decided. | Payment.tenderId (Pix tender?) | NO | OPEN → OQ-13 (also OQ-29) | canvas Q8, Q9; decision 9 |

### 12. Kiosk table and tent identifiers (kiosk area; table-related)

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 87 | Eat-in and take-away start | Buttons "Eat In" (DINEIN) and "Take Away" (TAKE_OUT). Only these two are valid; DINEIN sorts first; default is the first filtered type; fallback DINEIN when the list is empty. Eat-in = seated guest; no table number in spec. | OrderType (8.1) | HAS | IN | K1 BR-START-11, BR-START-13, F-START-07 |
| 88 | Table number on the kiosk | Table capture: "Enter your table number below" (FR-1013). Find a free table: "Find a free table and we will bring your order over." (FR-1012, screens 927–937). Stored once on the order. | NEW SubmitOrderRequest.tableNumber (NF-6) or notes | NO | OPEN → OQ-33 | K2 FR-1013, FR-1012, UJ-POST-02; K1 F-POST-02 |
| 89 | Tent card number | "Grab a tent card and enter the number below" (FR-1012). | notes (unstructured) or new field | NO | OPEN → OQ-33 | K2 FR-1012, ENT-POST-01 |
| 90 | Order identifier on the notification | One identifier stored on the order notification: buzzer, tent, table, phone or name, plus guest name (FR-1016, UJ-POST-02, ENT-POST-01, OP-POST-01). Stored as free text in notes today. | SubmitOrderRequest.notes | PART | IN (structure: OQ-33) | K2 FR-1016, UJ-POST-02, ENT-POST-01, OP-POST-01 |
| 91 | Notification template slots for table and tent | Template slots tableNumberNotificationPage and tentCardNotificationPage. | — | NO | CUT (rule 10: one visual template) | K2 DI-A12-SLOTS-NOTIFY |

### 13. Staff approvals and kiosk staff (cut)

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 92 | Staff approval PIN and restricted-item gate | Approval PIN exactly 4 digits; rejects repeated digits and sequences (1234 … 0987). Restricted-item gate: "Staff approval", age-check copy, "Approved" toast, "Items not approved" screen. This PIN is not the waiter PIN. | — | NO | CUT (rule 10: staff age approval) | D1 FR-015; D5 FEAT-010, ACT-023, ACT-024; D7 FORM-006, PERM-029; D13 CFG-015; K1 F-BASKET-05..09 |
| 93 | Kiosk staff login and clerk actions | Staff PIN checked against kioskConfig.pinCode. Staff actions: "Reset Session", "Approve Item", "Delete Item", "Print last receipt", "Done". Clerk validation via /clerk. Staff-assisted self-checkout (UJ-E2E-07) is cut. | — | NO | OPEN → OQ-34 | K1 F-SCO-01, business-rules 899–926; K2 UJ-SCO-02, ENT-SCO-01, UJ-E2E-07 |

### 14. Store listing (kiosk)

| # | Feature | Behaviour (rules, limits, defaults, exact copy) | v2 model (existing, or NEW) | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| 94 | Store card services | Store card lists services including "to table"; default service (CFG-518: delivery, collection or to table, preselected); services position (CFG-529); services visibility (CFG-530). One restaurant, so no store listing. | OrderType (8.1) | NO | CUT (rule 10: one restaurant) | D13 FEAT-062, CFG-518, CFG-529, CFG-530; D2 FR-518, FR-528 |

## New fields to add to the v2 models

Decision 3: new capabilities are fields on the v2 models. Three things are new entities, not fields. Counts: 13 fields or enum values, 3 entities, 2 conditional, 1 type change.

| Entity.field | Type | Meaning | Why (feature #) |
|:--|:--|:--|:--|
| NF-1 `IPosCheck.tableNumber` | string | Table of the open check | 15, 16 |
| NF-2 `IPosCheck.status` | enum OPEN, BILL_REQUESTED, PAID | Check state (OQ-10) | 19, 13 |
| NF-3 `IPosCheck.serviceChargeApplied` | boolean | Service charge on or off for this check (OQ-16) | 59 |
| NF-4 `PayCheckRequest.invoiceCpfCnpj` | string | CPF or CNPJ for the fiscal note at close (OQ-20) | 26 |
| NF-5 `Payment.cashTendered` | decimal (BRL) | Cash handed over; change is shown, not stored (OQ-12) | 24 |
| NF-6 `SubmitOrderRequest.tableNumber` | string | Table for a waiter round or a kiosk table order (OQ-33) | 29, 88 |
| NF-7 `SubmitOrderRequest.employeeId` | string | Waiter who sent the round | 29, 30 |
| NF-8 `Order.source`, `Order.roundNumber` | enum WAITER/QR/KIOSK; integer | Origin and round number of a round (OQ-11) | 30, 85 |
| NF-9 `OrderItem.guestNumber` | integer, optional | Guest the item is for (OQ-21) | 33 |
| NF-10 `ITEM.seatPriceOverride` | decimal, nullable | Price for table orders when set (OQ-22) | 44 |
| NF-11 `CATEGORY.hideOutsideSchedule.{seat, tableBill, dineIn, pickup, delivery, takeOut}` | booleans | Hide a section outside its schedule per channel | 46 |
| NF-12 `StoreConfiguration.serviceChargeRate` | decimal (e.g. 0.10) | Service charge percentage, computed by Core (decision 6) | 53, 54 |
| NF-13 Order status values `READY_TO_SERVE`, `SERVED` | enum values | Served state for table orders (OQ-27) | 51 |
| NF-14 Entity `TABLE` {id, number, zone?, active, services, qrIdentifier; seatStart?, seatEnd? only if OQ-8 = B} | entity | Table list for the waiter and QR (OQ-6, OQ-7, OQ-8, OQ-30) | 5, 6, 7, 11, 82 |
| NF-15 Entity `TABLE_REQUEST` {id, tableNumber, type CALL_WAITER or REQUEST_BILL, status, createdAt} | entity | Call waiter and request bill (OQ-25) | 76, 77 |
| NF-16 Entity `WAITER` {id, name, pinHash, role, active} | entity | Waiter login, role and audit (OQ-2, OQ-3, OQ-4) | 1, 2, 3 |
| Conditional `DEVICE` entity | entity | Paired waiter device and table-bill shared device (only if OQ-5 = A) | 4, 69 |
| Conditional `ServiceCharge.taxGroup` | reference | Tax for the charge (only if OQ-19 = B) | 61 |
| TYPE CHANGE `IPosCheck.employeeId` | integer to string | Ids are strings in v2 (decision 1); the integer is a defect | 18 |

## Open questions for Kai

Each question: the decisions do not settle it. ⭐ marks the proposed pick.

### OQ-1 Are waiter and QR in the MVP?

Decision 4 makes them channels. CLAUDE.md and the canvas README say the waiter and QR apps are outside the MVP.
- A) In scope now, as decision 4 says ⭐ (then update CLAUDE.md and the canvas README in the same PR).
- B) Outside the MVP, as CLAUDE.md says: build the Core and the kiosk first, waiter and QR after phase 5.
- C) Waiter only; QR waits. Trade-off: the waiter needs no guest-side screens.

### OQ-2 How does a waiter sign in?

- A) Name tile plus 4-digit PIN; lock after 5 wrong tries, as the kiosk staff PIN does (K1 F-BASKET-06) ⭐.
- B) PIN only, no name picker: faster, but staff are not identified until a round is sent.
- C) Email and password, like the back office: safer, slower at a shared device.

### OQ-3 How are waiter accounts created?

- A) A "Equipe" list in the back office: name, PIN set by the owner, role, active flag ⭐.
- B) Invitation by email, as the back-office users work (FEAT-013): needs an email per waiter.
- C) Import from the POS: OUT (decision 2).

### OQ-4 Which role can waiters have?

- A) A new fixed role "waiter": open check, send rounds, request bill, close and take payment. No discount or refund ⭐.
- B) Service-defined role, set per account in the back office (the reference model): flexible, but no default.
- C) Same as manager: simple, but a waiter could refund.

### OQ-5 How is the waiter device paired?

- A) A pairing code shown in the back office, typed once on the device; the device then stays logged in with a token ⭐.
- B) No pairing: the waiter signs in on any browser with name and PIN.
- C) Fixed URL on the device only. Trade-off: no per-device control. The table-bill "shared device" flag (DEP-F43) follows this choice.

### OQ-6 Is a table an entity or just a number?

- A) A TABLE entity: number, channel flags, active flag, QR identifier ⭐. Needed for the table list and the QR.
- B) Only `tableNumber` text on the check: no list, no QR, no status per table.
- C) A TABLE entity plus location groups as their own entity (see OQ-7). Trade-off: more to build for one bakery.

### OQ-7 Are tables grouped into zones?

- A) No zones; an optional `zone` text on the table ⭐.
- B) Location groups as an entity with a label, max 100 (reference CFG-636 and FR-1253).
- C) No grouping and no zone field.

### OQ-8 How are seats numbered?

- A) One number per table ⭐.
- B) A seat range per location (start and end, max 9999, CFG-641 and CFG-647).
- C) Free text only (see OQ-33).

### OQ-9 What makes a table number valid?

- A) The number exists in the TABLE list and is active ⭐.
- B) As A, and the table has no open check yet. Trade-off: blocks a second group on the same table.
- C) Any text is accepted (free text).

### OQ-10 What states does a check have, and when is a table free?

- A) OPEN → BILL_REQUESTED → PAID; the table is free when PAID ⭐.
- B) OPEN and PAID only; "bill requested" comes from a table request (OQ-25).
- C) No status field: derived from payments and requests.

### OQ-11 How is a second round added to an open check?

- A) A new order with openCheck true and the same table; Core appends it and numbers the round per check ⭐.
- B) A dedicated endpoint, for example rounds under the check. Trade-off: one more endpoint for the partner.
- C) A new check per round. Trade-off: no single bill.

### OQ-12 How is a payment taken before the terminal exists (phase 4)?

- A) The waiter picks the tender and types the amount; marked as manual; cash change shown from `cashTendered` ⭐.
- B) Close the check without recording a payment. Trade-off: no money trail.
- C) Block closing until phase 4. Trade-off: no table bill can be closed before then.

### OQ-13 Is Pix a tender?

- A) Yes: a Pix QR from the payment provider, in phase 4 with the terminal ⭐.
- B) Only cash and card until phase 4; Pix later.
- C) Pix is out of the MVP. Trade-off: the QR bill (canvas Q8) cannot be paid.

### OQ-14 What is the guest count range?

- A) Required when the check opens, 1 to 12, editable until paid ⭐ (canvas stepper max 12).
- B) Optional, default 1.
- C) No guest count at all.

### OQ-15 Transfer, void and comp

- A) Transfer the table only; no void, comp or merge in the MVP ⭐.
- B) Transfer plus void of a line, with a reason.
- C) All of them: transfer, merge, void, comp.

### OQ-16 Service charge: on or off per check, and on the kiosk?

- A) A toggle per check, default on, at the store rate; kiosk dine-in follows the same rule ⭐.
- B) Always on, no toggle.
- C) A toggle per check, default off.

### OQ-17 Service charge base

- A) Items subtotal before discounts, as the canvas example ⭐.
- B) Subtotal after discounts.
- C) After discounts and tax. Trade-off: more complex; the tax treatment is in OQ-19.

### OQ-18 Service charge scope, limits and dates

- A) Whole order, no minimum or maximum, no validity dates ⭐.
- B) Whole order plus minimum and maximum thresholds (CFG-410, CFG-411).
- C) Items, sections or tags, once per order (CFG-395..404). Trade-off: a big rule engine for one charge.

### OQ-19 Tax and discounts on the service charge

- A) No own tax group; discounts do not apply to the charge ⭐. The accountant confirms the fiscal treatment.
- B) Own tax group (`ServiceCharge.taxGroup`), discounts do not apply.
- C) Follows seatTax, discounts apply (CFG-312, CFG-355).

### OQ-20 Where does the CPF go?

- A) On the check at close, as `invoiceCpfCnpj` on PayCheckRequest ⭐.
- B) A table-bill custom field (see OQ-32).
- C) No CPF on table bills.

### OQ-21 "Para quem" per item

- A) No: the round has one guest count and no per-guest assignment ⭐.
- B) Yes: `OrderItem.guestNumber` on each item.

### OQ-22 Which price does a table order use?

- A) A new `ITEM.seatPriceOverride`, used for table orders when set (reference CFG-230 and CFG-232) ⭐.
- B) The base `price` (MODELS 5.19 "order to table").
- C) `dineInPriceOverride` (eat-in price), because table orders are DINEIN.

### OQ-23 Acceptance and minimum for table orders

- A) Waiter rounds go straight to the kitchen; no minimum and no acceptance step ⭐ (the waiter is the acceptance).
- B) Keep auto-accept, rejection timeout and minimum (CFG-063, CFG-074, CFG-080, CFG-082).
- C) Keep the minimum only.

### OQ-24 Capacity and interval for table orders

- A) No per-channel capacity for table orders; kitchen pace decides ⭐ (plan G-K5 replaces capacity with pace).
- B) Keep default, expanded and reduced seat capacity and the interval (CFG-130, CFG-133, CFG-137, CFG-140).
- C) Capacity only for the kiosk.

### OQ-25 Call waiter and request bill

- A) A TABLE_REQUEST entity with types CALL_WAITER and REQUEST_BILL; the guest can cancel; shows as alerts ⭐.
- B) Only REQUEST_BILL, as `IPosCheck.status` BILL_REQUESTED; no call button.
- C) Reuse the kiosk help flow (FR-1205) for tables.

### OQ-26 How do waiters get alerts?

- A) In-app alert strip, live through the same channel as the kitchen (SSE, phase 3) ⭐.
- B) Push notifications to the device.
- C) StaffFeed external app: OUT (EXT).

### OQ-27 Served state

- A) The kitchen sets READY_TO_SERVE; the waiter sets SERVED ⭐.
- B) Only the waiter sets SERVED.
- C) No served state; the table stays "Preparando".

### OQ-28 Table information on the kitchen card

- A) Table number and round number on the card ⭐.
- B) As A, plus guest count and waiter name.
- C) Service name only (today's reference).

### OQ-29 QR: view only, or order?

Decision 4 says view only. Canvas Q5–Q8 let the guest order, track and pay by Pix.
- A) View the menu and the table bill, and call or request the bill through the waiter ⭐ (decision 4).
- B) View plus order a round (canvas Q5–Q6); no payment from the QR.
- C) Full canvas: view, order, Pix payment.

### OQ-30 How does the QR identify the table?

- A) A signed token per table in the QR link; the table number is not in the URL ⭐.
- B) A plain table number in the URL: simple, guessable.
- C) A session token created when the guest scans.

### OQ-31 What does the QR table bill show?

- A) Rounds and total for the table; no waiter names; no other guests' personal data ⭐.
- B) Menu only, no bill.
- C) Full detail, including the waiter's name per round (canvas Q7 shows "Garçom Ana").

### OQ-32 Table-bill custom fields

- A) Drop the template engine; keep the CPF field only (OQ-20) ⭐.
- B) Keep the template: 1 to 3 text inputs, triggers and repeat rules (CFG-604..619).
- C) Keep one free-text observation field only.

### OQ-33 How does a kiosk diner identify the table or tent?

- A) The guest types the table number (validated, see OQ-9) ⭐.
- B) The guest types a tent-card number (FR-1012).
- C) Buzzer only; no table on kiosk orders. Trade-off: the table stays unknown to the kitchen.

### OQ-34 Kiosk staff login

- A) Cut: the waiter app covers staff help; the kiosk has no staff PIN ⭐.
- B) Keep the staff login for clerk actions (reset, approve, delete, print last receipt).
- C) Keep only "Print last receipt". Trade-off: the printer is phase 4 anyway.

### OQ-35 Assisted ordering

- A) Out for the MVP; the waiter app covers staff orders ⭐.
- B) Staff order in the store without an external session.
- C) External scoped session (EXT). Trade-off: a third party in the order path.

### OQ-36 Customer management screens

- A) No screens; Customer lives only on payments and the fiscal note ⭐.
- B) A list with name, phone and email to edit; no notes, no marketing opt-in.
- C) Full: notes, marketing opt-in, order history (readers marked cut).

### OQ-37 Which reports show checks?

- A) Table-bill reports only (FEAT-077) ⭐.
- B) Table-bill reports plus the receipts report (SCR-016, SCR-017).
- C) Drop SCR-016 and SCR-017; keep only FEAT-077.

## Rows owned by other areas (T=Y, kept as source refs)

These rows were read and carry T=Y, but the owning area decides them. Nothing is dropped.

| Area | Rows | Note |
|:--|:--|:--|
| kiosk (session, config, order, payment) | B1 BR-SES-04, DM-SES-01b, DT-SES-01, FEAT-SES-01, FEAT-SES-04, FR-SES-001, FR-SES-004, EP-SES-01, EP-SES-04, CHK-SES-004, UJ-E2E-03, DM-ORD-01, DM-ORD-03, DT-ORD-03, VAL-ORD, FEAT-ORD-01, UJ-ORD-01, UJ-E2E-01, FR-ORD-001, FR-ORD-004, FR-ORD-005, FR-ORD-008, EP-ORD-01, EP-ORD-02, ORCH-ORDER, ORCH-TOTALS, INT-13, INT-17, ORD-ENC, ORD-SCALAR, EP-LOY-01, EP-LOY-02, FEAT-MNU-01, FR-MNU-002, EP-MNU-01, DM-PAY-01, DT-PAY-01, FEAT-PAY-01, FEAT-PAY-07, FR-PAY-002, FR-PAY-003, UJ-PAY-01, PAY-COMMON, PAY-01, ORCH-PAY, ORCH-CONFIG, INT-30, ORCH-CONFIG; K2 UJ-E2E-01, UJ-BASKET-01, ENT-BASKET-02, OP-BASKET-01 | Order and payment flows. Table-related parameters (DINEIN, openCheck, tip) are in features 25, 29, 35. |
| platform (health, auth, roles, invitations) | B1 BR-OPS-01, DM-OPS-01, FEAT-OPS-02, FR-OPS-002, EP-OPS-02; KDS1 API-01, DM-USER, DM-VENUE-OWNER, FEAT-001, SCR-002, SCR-ROLE, BR-045, ER-SESSION; D3 FR-1383; D7 FEAT-002, FEAT-010 (PIN part cut), UNK-004; D13 CFG-021, CFG-023, CFG-024 (also feature 2) | Health for the owner; login and session. |
| kitchen (KDS) | KDS1 API-21, BR-006, FEAT-009, FEAT-019a (feature 49), FEAT-019e, FEAT-023, FEAT-038, SCR-003, SCR-007-SUB, OL-T-CANCEL, OL-NOREOPEN, JRN-007, PR-DEFAULT (HW), PR-LABEL (HW), CFG-036 (feature 49), DM-ORDER-TYPE (feature 49) | Cancel with admin re-auth, print (hardware), lists. |
| backoffice-menu | D4 CFG-154..215, ACT-144..159, CFG-216..233 (partly feature 44/45), CFG-311..331 (offers); D9 FEAT-032 (feature 46), FEAT-033 (feature 47), FEAT-037 (feature 70), CFG-212 (feature 47); D8 BR-218, BR-253..257; D8 JOURNEY-020, JOURNEY-044 step 3 (CUT); D8 BR-025 (feature 32) | Items, modifiers, sections and publish checks. |
| backoffice-store-ops | D4 CFG-061..095, CFG-096..127, ACT-074..080, ACT-089..092, FORM-020; D5 SCR-032, SCR-245; D6 CFG-125..140 (partly feature 39), CFG-168..173 (feature 46), CFG-419..426 (feature 43 and others), CFG-181..214; D11 FEAT-021, FEAT-023 (feature 12), FEAT-027..029 (feature 39); D8 CFG-110..114 (kiosk dine-in hours) | Online services, hours, capacity, tax rates. |
| styling and legal (CUT) | D4 SCR-216..228, CFG-564..603, CFG-691..744 (except feature 80), VAL-C; D5 SCR-222; D12 FEAT-070; D8 ENT-096 | Themes, legal, allergen policy; cut by rule 10 and decision 8. |
| POS role (OUT, decision 2) | KDS1 BR-032, FEAT-045, SCR-021, JRN-022; B1 ORCH-* POS paths | Items tab, POS sync. |
| hardware (HW-LATER) | KDS1 PR-DEFAULT, PR-LABEL; B1 items on triggers and printers | Phase 4. |

## Proposal canvas: what the waiter and QR screens show

Source: `docs/prototype/full/project/` (README: "proposal, outside the MVP"). Not spec. Use for layout and copy only, after OQ-1.

| Screen | What it shows | Status against the spec |
|:--|:--|:--|
| G1 Entrar | Staff name tiles (Ana, Bruno, Carla), 4-dot PIN, keypad 1–9, 0, "Apagar", button "Entrar"; note "Login do garçom ainda em aberto" | Method open (OQ-2); names are placeholders |
| G2 Mesas | Header "Mesas" with date "Qua, 4 nov · 10:42"; alerts strip; filter chips "Todas" (12), "Minhas" (1), "Precisam de mim" (3); 12 table tiles with status and totals (R$ 48,30; R$ 72,10; R$ 31,80; R$ 22,40; R$ 95,60 "aberta por Ana") | Tile statuses are proposal (OQ-10, OQ-26, OQ-27) |
| G3 Mesa 12 | Guest stepper "Pessoas" (1–12, default 3); "Aberta às 10:02 por Ana"; rounds with status and origin; subtotal R$ 95,60; "Serviço 10% (opcional)" R$ 9,56; total R$ 105,16; actions "Adicionar itens", "Fechar conta", "Transferir mesa" | Guest count (OQ-14), transfer (OQ-15), service (OQ-16) |
| G4 Adicionar itens | Header "Mesa 12 · Rodada 3"; search; categories; item cards with price; "tem opções"; sold-out items; bar with count and "Revisar" | Menu rules belong to the menu area; sold-out copy "Esgotado" |
| G5 Item builder | Required choice, removable ingredients (R$ 0,00), add-ons up to 3, "Para quem", note, quantity | "Para quem" (OQ-21); modifier types (5.12, 5.13) |
| G6 Revisar rodada | Round review, sent-at line, empty-round block, "Enviar para a cozinha", "Voltar para a Mesa 12" | Flow proposed (feature 34) |
| G7 Fechar conta | Lines grouped by round and origin; "Cobrar serviço de 10%" toggle; "CPF na nota" (optional); "Forma de pagamento"; "Troco para"; "Total a receber" | OQ-12, OQ-16, OQ-20 |
| G8 Mesa paga | "Conta fechada às 10:47", paid value R$ 105,16, "Forma: Crédito", "Mesa liberada", "Imprimir conta" (printer phase 4) | Table freed (OQ-10); print HW-LATER |
| Q1 Boas-vindas | "Mesa 12 · Boas-vindas", restaurant name, PT / EN | QR entry (OQ-30) |
| Q2 Cardápio | Combo banner, "Mais pedido" and "Esgotado" tags, cart summary "2 itens · R$ 53,80", "Ver pedido" | View only (OQ-29) |
| Q3 Item | Allergen line, required bread choice with "Esgotado hoje" options, "Quer tirar algo?", add-ons, "Adicionar · {{total}}" | Allergens: ITEM.allergens (5.11) |
| Q4 Combo | "Escolha o salgado", "Escolha a bebida", "Tamanho do café", "Preços de exemplo" | Combo types (5.14) |
| Q5 Carrinho | "Rodada 2 · nova para a mesa 12", cross-sell "Combina com", notes and name (optional), "Não cobra agora. Entra na conta da mesa." | Conflicts with decision 4 (OQ-29) |
| Q6 Acompanhar | Tracking steps "Pedido enviado", "Preparando", "A caminho da mesa"; "Pedir mais", "Ver a conta" | Conflicts with decision 4 (OQ-29) |
| Q7 Conta da mesa | All rounds with origin, subtotal, service (optional), total, "Pagar a conta · {{totalValue}}", "Pagar com o garçom" | OQ-31; pay-waiter (OQ-25) |
| Q8 Pagar com Pix | Pix QR, expiry "Expira em 9:58", optional CPF, "Cartão: peça ao garçom", "Já paguei" | Pix (OQ-13); conflicts with decision 4 |
| Q9 Conta paga | "Conta paga. Obrigado!", "Pago via Pix · hoje, 10:47", "Voltar ao cardápio" | Depends on OQ-13 |

## Spec contradictions and defects not to copy

1. **Waiter and QR scope.** Decision 4 says in scope. CLAUDE.md and the canvas README say outside the MVP (OQ-1).
2. **QR ordering vs decision 4.** Canvas Q5–Q8 let the guest order and pay; decision 4 says view only (OQ-29).
3. **Prices in cents.** Reference examples and prototype data use integer cents (canvas G4 `c: 1390`; EP-MNU-01 "999"; PAY-01 minor units). Decision 1 says decimal BRL. Do not copy the cents.
4. **employeeId type.** IPosCheck.employeeId is an integer (MODELS 9.7), but ids are strings in v2 (decision 1). Fix to string.
5. **Empty clerk object.** The group POS clerk lookup returns `{}` (EP-SES-05): no name and no id, so the waiter is not identified. Comanda must store the waiter itself.
6. **Clear PIN in config.** The venue pinCode sits in the cached config and is compared as a decimal string (BR-SES-08, FR-SES-005, FEAT-SES-05). Store a hash; never send it to the browser.
7. **Pay-waiter name.** PAY_WAITER / pay-waiter is undefined in the spec and is never persisted (FR-PAY-004). Decide the request model first (OQ-25).
8. **Table validation response.** `table/validate` has no response model (MODELS 9.13): "agree the answer format with the platform team".
9. **Unit missing.** "Reject seat after" (CFG-080) and "seat delivery time" (CFG-082) have no unit. Three entries share the CFG-080 label.
10. **Clashing label.** "Maximum order to apply" (CFG-410) has the opposite meaning of CFG-364 (same label).
11. **Unclear rule.** FR-425 "six-place adjustment" for the seat tax rate: unclear, not a rule.
12. **Identifiers in free text.** Buzzer, tent, table, phone and name are saved as one free-text identifier in notes (FR-1016). Use structured fields (OQ-33).
13. **Single restaurant.** Outlets and store seat settings (FR-1249, CFG-095) assume many stores: cut.
14. **Ids as numbers.** Table numbers are strings in ValidateTableRequest, but seat ranges are integers (CFG-641, CFG-647). Use one type.
15. **Day numbering.** IHours uses day 1 = Sunday and HH:mm:ss.SSS; menu section hours use day names and HH:mm:ss (MODELS 9.10 vs 5.8). Keep the two apart in the API.
16. **Close minute.** BR-SES-04 and DT-SES-01 count the close minute as open; DM-SES-01b says close is exclusive and the NPE when one of dine-in or take-out is null is a bug. Kiosk area; noted here because it touches dine-in flags.
17. **Restricted approval PIN.** The 4-digit approval PIN (FR-015, CFG-015) looks like the waiter PIN. They are different features; do not reuse one for the other.
18. **Kitchen label.** "TO SEAT ORDER" is an English fallback in the spec: use the Portuguese label in the product copy.
19. **Canvas G4 sold-out flag** is set on items directly ("out: true"); the menu area owns the real availability rule.
20. **Tax on seat.** Decision 5 says table orders are taxed with seatTax; the reference FR-425 talks about a seat rate on the store, so keep one source (MODELS 5.16).
