# Platform — consolidated requirements

Cross-cutting mechanics: order lines, totals, taxes, discounts, payments, tenders, customer and fiscal data, order numbers, checks and tables, order types, money, ids, time, errors, retries, timeouts, device auth and config, heartbeat, caching, offline, real-time, logs and personal data.

## Summary

- **Verdicts (160 features, primary verdict, after the second pass):** IN 102 · ? 23 · OUT 14 · CUT 12 · HW-LATER 6 · MODEL-ONLY 3. Rows with a split verdict count under the first word.
- **Second pass:** 35 new rows (P126 to P160) cover every CUT, EXT, HW and POS row in the platform area. Verdict moves: 2 CUT → IN (kiosk messages, senior discount), 8 rows → OUT, 4 HW → HW-LATER.
- **New fields:** 42 items (41 fields plus the Tender entity). **Open questions:** 15 (Q1–Q15). **Pending yes or no from Kai:** 23 "?" rows, listed in section 16 and the Coverage section.
- **Contract changes:** 34 rows.
- **Biggest gaps:** the v2 models have no payment state, no tender-level payment flow, no promotion rules, no order status, no table or check status, and no fiscal fields on items. Every one of these is listed under "New fields".
- **What Comanda already has:** device auth, device config with ETag, heartbeat, device status, problem+json errors, `Idempotency-Key` on writes, a quote endpoint, orders with payments and place, simulated payments, owner login, kitchen SSE with a version guard. All of it is in `contract/openapi.yaml` 0.2.0, not yet in Go.
- **Biggest change:** the contract moves from integer cents and Comanda names to v2 decimal BRL and v2 names. This is a breaking change for the BFF and the Go API (see "Contract changes").
- **Money rule not settled:** how tax and discount are rounded (Q1). v2 examples already show four decimals (`itemDiscount 0.9500`), so the rule must be fixed before Go prices anything.

👉 **Decide Q1 (rounding) and Q3 (tax-inclusive prices) first:** every money figure in the contract depends on them.

---

## Features

### 1. Order lines and options

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P01 | Line prices per unit | `itemPrice`, `itemDiscount`, `itemTax`, `itemNet`, `itemTotal` = one unit without options. `totalPrice`, `totalDiscount`, `totalTax`, `totalNet`, `total` = one unit with options. Money is a decimal in BRL. `factor` returned unchanged. | OrderItem (8.2) | PART: contract `OrderLine` has `unitPrice`, `lineTotal` only | IN | MODELS 8.2; contract OrderLine |
| P02 | Line identity and option tree | `uniqueId` (integer, unique in the order). Option lines carry `parentId` (uniqueId of the parent option or product), `position`, and `modifierType` (MODI, SIZE, INGR, SURC, INGM). All options sit flat in the product's `modifiers`; rebuild the tree by `parentId`. Nested options allowed. | OrderItem.uniqueId, parentId, position, modifierType, modifiers | NO: contract uses `guid` and nested `options` | IN | MODELS 8.2 example, 5.13 |
| P03 | Quantity per line | `quantity` integer, default 1. The platform sends one line per unit, but the Core must respect `quantity`. | OrderItem.quantity | PART: `quantity` on contract lines | IN | MODELS 8.2 |
| P04 | Item identity | `id` = menu entity id (string). `name` = internalName, else name. `plu` from the menu. | OrderItem.id, name, plu | PART: `itemId`, `name` | IN | MODELS 8.2 |
| P05 | Line note | `specialNotes`, free text per line, max 60 characters on the kitchen card. Example: "sem cebola". | OrderItem.specialNotes | NO | IN | MODELS 8.2; plan-next G-T7 |
| P06 | Line taxes and discounts | `taxes[]` (Tax) and `discounts[]` (Discount) on each line. A discount links to its line with `uniqueItemId`. | OrderItem.taxes, discounts | NO | IN | MODELS 8.2, 8.3, 8.4 |
| P07 | Kiosk sends ids only | The guest client sends item and option ids and quantities, never prices. The Core prices everything from the menu. | OrderItem (input) | HAS: `OrderLineInput` ids only | IN | contract README; CLAUDE.md |

### 2. Totals, taxes, discounts and service charges

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P08 | Priced basket (quote) | The Core prices a basket without placing it. Answer: subTotal, discount, serviceChargeTotal, tax, total, priced lines, taxes, discounts. The BFF shows it and never recalculates. | TotalsRequest (8.11), ITotalsResponse (9.4) | PART: `POST /v1/quotes` returns `OrderTotal` in cents, with no tax list and no service charges | IN | MODELS 8.11, 9.4; contract README "Repricing" |
| P09 | Order totals | subTotal (before discounts and charges), discountTotal, serviceChargeTotal, taxTotal, total (what the guest pays). Lists: discounts[], taxes[] (one entry per tax rate), serviceCharges[]. | SubmitOrderRequest totals (8.11) | PART: `OrderTotal` has subtotal, discountTotal, total, tax (null), one `discount` | IN | MODELS 8.11; contract OrderTotal |
| P10 | Tax rate by order type | Rate picked by order type. DINEIN, PAY_AT_TABLE, table orders → `seatTax`. TAKE_OUT, PICKUP, DRIVE_THRU → `pickupTax`. DELIVERY, DELIVEROO → `deliveryTax`. Rates are fractions (`0.20` = 20%) stored with six decimal places. Voucher tax is not used. | TAX group → rates (seatTax, pickupTax, deliveryTax) (5.16) | NO | IN (decision 5) | Decisions 5; D3 FR-1054..1056; D10 CFG-421..425 |
| P11 | Tax on lines and orders | Per line: `itemTax`, `totalTax`. Per order: `taxTotal` and one `Tax` per rate: id, name, taxRate, taxTotal, netTotal, quantity. Whether prices include tax is store config (Q3). | Tax (8.3); StoreConfiguration.pricesIncludeTax (new) | NO (`tax` is null until phase 4) | IN | MODELS 8.3; contract OrderTotal |
| P12 | Order discount (coupon) | `Discount`: id, name, rate (fraction, `0.10` = 10%), value, providerType, uniqueItemId. Response flag `locked`: guest cannot remove it. | Discount (8.4), IDiscount (9.2) | PART: `DiscountItem` (one per order, amount in cents) | IN | MODELS 8.4, 9.2; contract DiscountItem; K2 FR-704, FR-721 |
| P13 | Apply and remove codes | Apply codes and awards, remove codes (`codesToRemove`). One coupon per order. A discount larger than the basket is refused, never clamped. Errors: INVALID_COUPON, COUPON_ALREADY_APPLIED. `entryMethod` MANUAL, SCAN, UNKNOWN. | DiscountRequest (8.13), DiscountResponse (9.8), DiscountRequest.entryMethod (new) | PART: `POST /v1/discounts/validate`; `discountCode` on quote and order | IN | MODELS 8.13, 9.8; plan-next G-A12; contract ProblemCode |
| P14 | Award types | CODE (voucher or promo code), PROMOTION and ITEM (free item): IN. PSEUDO_CURRENCY (points), `isExternal`, `sourceExternalId`, `ExternalUserId`: loyalty. | Award (8.10), IAward (9.6) | NO | IN (CODE, PROMOTION, ITEM); CUT (loyalty) for points and external ids | MODELS 8.10, 8.9; brief rule 10; D10 loyalty.md |
| P15 | Promotion rules | v2 Award holds only the result. Rules needed to decide it: minimum basket, valid from and to, target (basket, item, section, tag), once per order or max uses, tender eligibility (card, cash), customer text (max 100). Scope set by Q14. | Award rule fields (new) | NO | IN (scope Q14) | MODELS 8.10 gap; D10 CFG-314..375; D1 FR-319; plan-next G-A12 |
| P16 | Service charge | A fixed amount added to the order. The percentage is store config; the Core computes the amount and sends it in `ServiceCharge.value`. Which order types get it: Q2. | ServiceCharge (8.5); StoreConfiguration.serviceChargeRate (new) | NO | IN (decision 6) | MODELS 8.5; decision 6; D10 FEAT-048; D3 FR-1041..1048 |
| P17 | Delivery fee | `deliveryCharge` on store config, applied to delivery orders only. | StoreConfiguration.deliveryCharge (9.10) | NO | MODEL-ONLY (decisions 4B, 7) | MODELS 9.10 |
| P18 | Tip and donation | `tipAmount` and `donationAmount` recorded on each payment. Whether the kiosk offers them: Q15. | Payment.tipAmount, donationAmount (8.8) | NO | IN (decision 8) | MODELS 8.8; decision 8; B1 DM-ORD-04 |
| P19 | No other price source | Totals come only from the Core. No POS totals, no local calculator, no fallback totals. The BFF formats only. | — | PART (plan rule) | IN (rule) | contract README; plan-next; B1 BR-ORD-05/06, FR-ORD-006..008 (not copied) |

### 3. Payments and tenders

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P20 | Payment record | `tenderId` (string, required), `tenderRef`, `amount`, `tipAmount`, `donationAmount`, `customer`, `authCode`, `cardScheme`, `cardLast4Digits`. Never a full card number. `collectPaymentOnDelivery` is model-only. | Payment (8.8) | PART: contract `Payment` has `method` PIX, CREDIT, DEBIT | IN (collectPaymentOnDelivery: MODEL-ONLY) | MODELS 8.8; contract Payment |
| P21 | Tender list | The Core lists the tenders a channel can use (replaces POS `pos-data`). Each tender: id, name, kind, enabled. | PosDataResponse.data.tenders (9.11) → Tender (new entity) | NO | IN (`pos-data` itself OUT, decision 2) | MODELS 9.11; decision 2 |
| P22 | Pilot tenders | Which tenders the pilot offers: Q6. | Payment.tenderId | PART: PIX, CREDIT, DEBIT in contract | IN (scope Q6) | contract PaymentMethod; decision 8 |
| P23 | Cash tender | Cash recorded as a tender at the counter or table. Amount received and change are stored. Cash machine is a separate item (P29). | Payment.tenderId (cash); Payment.amountReceived, changeAmount (new) | NO | IN (decision 8; change: Q7) | decision 8; MODELS 8.8 |
| P24 | Payment states | Core state: AUTHORISING, AUTHORISED, FAILED, CANCELLED. Simulated until phase 4. A failed payment never creates a paid order. | Payment.paymentStatus, failureReason (new) | PART: has both | IN | contract Payment; CLAUDE.md |
| P25 | Simulated payment | `POST /v1/payments/{id}/simulate` with outcome AUTHORISED or FAILED. Once a real gateway is set, answer 404 SIMULATION_DISABLED. | — (Comanda only) | HAS (phase 2) | IN | CLAUDE.md; contract simulatePayment |
| P26 | One payment per order | One order is paid by one payment. Several payments on one order (split bill) are cut. | Payment[] (list kept in the model) | PART: contract lists payments per order | IN for one payment; CUT (split bill, rule 10) for several | brief rule 10; B1 DM-ORD-07 |
| P27 | Cancel a payment | Cancel a payment before the order is placed. | — | HAS: `/v1/payments/{id}/cancel` | IN | contract cancelPayment |
| P28 | Unknown or failed result | Causes by code (PE01, PE02, PE03, PE04, PE06, PE07, PE08, PE09): refused, card not read, insufficient funds, connection, timeout, refund error, unknown. An unknown status is never shown as refused or paid. "Paid but not sent to the kitchen" screen with the number for the counter (status PAID_POS_ERROR). A printer out of paper keeps the number on screen. | Payment.failureReason; OrderStatus value (new) | NO | IN (phase 4) | plan-next G-T6; B1 BR-ORD-03, DM-PAY-02 (not copied) |
| P29 | Terminal, card reader and cash machine | Payment terminal (PED), card read, 23 provider types, cash acceptance, dispensing, change dispensed by machine. | — | NO | HW-LATER (decision 11) | B1 PROV-TYPES, PAY-03..06, CHK-PAY-002; decision 11 |
| P30 | Vendor payment methods | Gift card, room charge, stored value, food stamp, face-ID, crypto, app gateways, loyalty payments. | — | NO | OUT (decision 9) | decision 9; B1 PAY-02, PAY-08, PAY-12..14, FEAT-PAY-03 |
| P31 | Refund and cancel a paid order | Owner cancels an order (CANCELLED, confirmed by an owner login). Refund amount and reason rules are not in v2. | Order status CANCELLED (Comanda) | PART: `POST /v1/admin/orders/{orderId}/cancel` (0.2.0) | ? (Q12) | D3 FEAT-074; B1 EP-ORD-03 |

### 4. Customer, invoice and fiscal data

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P32 | Customer | `firstName`, `lastName`, `email`, `phoneNumber`. When the guest is unknown: firstName "Unknown", other fields empty. Personal data, never logged. | Customer (8.6) | NO | IN (decision 8) | MODELS 8.6; decision 8 |
| P33 | CPF or CNPJ on receipt | Optional on the kiosk. CPF 11 digits, CNPJ 14 digits, check digits. Mask 000.000.000-00, switches to 00.000.000/0000-00 at 14 digits. Empty clears. Stored masked and prefilled on reopen. Never in analytics or logs. Sent to the Core as the fiscal invoice number. | SubmitOrderRequest.invoiceCpfCnpj | PART: `cpfCnpj` digits-only pattern, no check digits | IN | K2 F-BASKET-10, FR-437..441; MODELS 8.12 |
| P34 | Privacy notice on the CPF step | One LGPD line on the CPF step, text editable in the back office. A lawyer checks the wording before the pilot. | StoreConfiguration.privacyNotice (new) | NO | IN (plan decision 13) | plan-next G-A19; D3 FR-1192..1196 |
| P35 | Fiscal identifiers on the sale | Core returns `fiscalQrCodeData` (receipt QR content) and `fiscalAccessKey` (44 digits, NFC-e key). Passed through unchanged. Omitted when none. | SubmitOrderResponse.fiscalQrCodeData, fiscalAccessKey | NO (`FiscalFields` is a phase 4 placeholder) | IN (phase 4) | MODELS 9.5; plan-next G-A14; contract FiscalFields |
| P36 | Seller fiscal identity | Seller name (max 100), street (max 256), number, district, post code, city, state, tax id (CNPJ), state registration (IE), tax regime. Published only after it is saved. | StoreConfiguration.seller* (new) | NO (`cnpj` only, on the restaurant input) | IN (phase 4) | D3 FR-427..431, FR-1057..1059; D10 CFG-428..430; plan-next G-A14 |
| P37 | Item fiscal fields | Per item: NCM (8 digits), CFOP (4), unit, origin, tax situation (CST or CSOSN). Needed for the NFC-e. | OrderItem.fiscalNcm, cfop, unit, origin, taxSituation (new) | PART: contract `FiscalFields` (ncm, cfop, taxes map) | IN (phase 4) | plan-next G-A14; contract FiscalFields; D3 FR-210 (label defect) |
| P38 | Who issues the NFC-e | A provider issues the NFC-e and the Core stores its key and QR, or Comanda builds the document. | — | NO | ? (Q13) | contract README open question 5; D3 FEAT-099 |
| P39 | Receipt text | Core returns `text` (printable receipt with line breaks) and `displayText` (short label). Printing is hardware. | SubmitOrderResponse.text, displayText (9.5) | NO | IN (text stored); HW-LATER (printing) | MODELS 9.5; B1 DT-RCP-01 |
| P40 | Email or SMS receipt | Receipt sent by email or SMS. Plan-next cut it; no brief rule covers it. | — | NO | ? (Kai decides; plan-next cut) | B1 FR-RCP-001, EP-RCP-01/02, UJ-RCP-01 |
| P41 | Latest receipt view | HTML receipt for the latest or given order. Not in plan-next. | — | NO | ? | B1 FR-RCP-002, EP-RCP-03 |

### 5. Order placement and numbers

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P42 | Place an order | Flow: create the order (lines, type, nonce) → quote → payment → place. Place assigns the number. Writes carry `Idempotency-Key`. | SubmitOrderRequest (8.12) | PART: `/v1/orders`, `/payments`, `/place` | IN | contract; MODELS 8.12 |
| P43 | Order number | `number` = the Core's check number (kept). `customerCheckNumber` = the short number shown to the guest, length from `posCheckNumberDisplayLength` (2). Sequence per restaurant per business day, assigned at place. Reset rule: Q4. | SubmitOrderResponse.number, customerCheckNumber (9.5); businessDate (new) | PART: `posCheckNumber` set at place; display length in config | IN (reset: Q4) | MODELS 9.5; contract README; K2 |
| P44 | Status and wait on place | Response carries `status` (AWAITING_PAYMENT, PAID, PREPARING, READY, COLLECTED, CANCELLED, NOT_COLLECTED) and `waitTime` (minutes for the current pace). | SubmitOrderResponse.status, waitTime (new) | PART: `PlacedOrder` has both | IN | contract OrderStatus, PlacedOrder |
| P45 | Order dates | `dateCreated` (local venue time, when the guest ordered). `dateToFire` (when to start cooking) and `pickupTime` (when to collect) are for scheduled orders. | SubmitOrderRequest.dateCreated, dateToFire, pickupTime | NO | IN (dateCreated); MODEL-ONLY (dateToFire, pickupTime, decision 7) | MODELS 8.12; decision 7 |
| P46 | Order notes | `specialNotes` (the guest's note for the whole order). `notes` (ticket note; text depends on venue, for example table or collection reference). | SubmitOrderRequest.specialNotes, notes | NO | IN | MODELS 8.12; plan-next G-T7 |
| P47 | Order identity | `orderNonce` (UUID per journey) identifies the order attempt. `Idempotency-Key` (UUID per request) guards retries. v2 has no nonce; it is a Comanda field. | SubmitOrderRequest.orderNonce (new) | HAS: `orderNonce` on create | IN | contract CreateOrderRequest; B1 API-H-NONCE |

### 6. Open checks, tables and waiter (touches tables, checks, waiters: T=Y)

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P48 | Open check (bill) | `openCheck: true` leaves the check open: items can be added and it is paid later. Check fields: number, subTotal, discount, serviceCharge, tax, total, items, payments, guestCount, employeeId, isOpenedByPosEmployee, checkOpenedAtInUTC, text, displayText. | SubmitOrderRequest.openCheck (8.12); PosCheck (9.7) | NO | IN (T=Y) | MODELS 8.12, 9.7; decision 3 |
| P49 | Check by table | Core operations to read one open check by table, and to list open checks. The table is an input to the operation, not a POS `config` value. | GetCheckRequest (8.14), new Core operation | NO | IN (T=Y) | MODELS 8.14; decision 2 |
| P50 | Pay a check | Record payments on the check and set it paid. One payment per check (P26). | PayCheckRequest (8.14) | NO | IN (T=Y) | MODELS 8.14 |
| P51 | Table validation | Check that a table number exists and is in use. The response format is not fixed in v2; Comanda sets it. | ValidateTableRequest (8.15); PosCheck.tableNumber (new) | NO | IN (T=Y) | MODELS 8.15, 9.13 |
| P52 | Guest count and table | `guestCount` (integer) and the table number on the check. | PosCheck.guestCount (9.7); PosCheck.tableNumber (new) | NO | IN (T=Y) | MODELS 9.7 |
| P53 | Check owner | `employeeId` = waiter who owns the check. `isOpenedByPosEmployee` = staff opened it on the POS; in Comanda, it means opened from the waiter site. | PosCheck.employeeId, isOpenedByPosEmployee | NO | IN (T=Y); waiter sign-in: Q9 | MODELS 9.7 |
| P54 | Check status | Lifecycle of a check: OPEN, then PAID. | PosCheck.status (new) | NO | IN (T=Y) | MODELS 9.7 (no status in v2) |
| P55 | Items added after send | Items added to an open check after the first send go to the kitchen as new tickets. | OrderItem.sentToKitchen (new) | NO | IN (T=Y) | decision 4 (waiter adds to an open check) |
| P56 | Call waiter, request bill | Guest calls a waiter or asks for the bill from the kiosk or QR menu. Not in v2. | New request on the check (Q8) | NO | ? (Q8) | K2 FR-1205..1208; B1 PROV-PAYWAITER (provider, not stored) |
| P57 | Waiter places orders | The waiter site places orders for a table onto its open check. Screens are in the waiter area. | SubmitOrderRequest.openCheck; PosCheck | NO | IN (T=Y) | decision 4 |

### 7. Order types and channels

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P58 | DINEIN | Eat in at the venue. On the waiter channel it needs a table. Uses the seat tax (P10). | OrderType (8.1) | PART: DINEIN in contract enum | IN | MODELS 8.1; decision 5 |
| P59 | TAKE_OUT | Take away. Uses the pickup tax (P10). | OrderType (8.1) | PART: TAKE_OUT in contract enum | IN | MODELS 8.1; decision 5 |
| P60 | PAY_AT_TABLE | Pays an open table bill. Staff take the payment. Uses the seat tax. | OrderType (8.1) | NO | IN (T=Y) | MODELS 8.1; decision 5 |
| P61 | PICKUP and DRIVE_THRU | Click and collect; drive-through. Uses the pickup tax. No screen creates them. | OrderType (8.1) | NO | MODEL-ONLY (decision 7) | MODELS 8.1; decision 7 |
| P62 | DELIVERY and DELIVEROO | Delivery to an address with a delivery fee; marketplace order. Uses the delivery tax. No screen creates them. | OrderType (8.1); Address (8.7) | NO | MODEL-ONLY (decisions 4B, 7) | MODELS 8.1, 8.7; decision 7 |
| P63 | Channels | Kiosk (guest orders and pays). Waiter site (places table orders on an open check). QR menu site (guest views only, cannot order). Kitchen. Back office (desktop and phone). | — | PART: kiosk, kitchen, back office; waiter and QR NO | IN | decision 4 |
| P64 | Order types the store takes | Store-level list of the order types it offers. Kiosk offers DINEIN and TAKE_OUT. | StoreConfiguration.availableOrderTypes (new) | PART: `isDineInAvailable`, `isTakeOutAvailable` | IN | MODELS 9.10; D12 gap; contract RestaurantPublic |
| P65 | Order type closed | Order refused when the type is not open or not offered. | — | HAS: ORDER_TYPE_UNAVAILABLE | IN | contract ProblemCode |

### 8. Money, numbers, ids, time, language and naming

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P66 | Money format | Decimal number in BRL, main unit, two decimals, never cents. Display with `Intl.NumberFormat('pt-BR', BRL)`. Input max 99999999.99, last valid value kept on invalid input. Refuse anything that is not a price; never guess. | All money fields (MODELS 2.3) | NO: contract `Money` is int64 cents | IN (decision 1) | MODELS 2.3; decision 1; D8 BR-060; CLAUDE.md `cents()` |
| P67 | Rounding | Not defined in v2. The examples show four decimals on line amounts (`itemDiscount 0.9500`). Rule needed. | — | NO | ? (Q1) | MODELS 8.2 example |
| P68 | Rates | Fractions: `0.20` = 20%, `0.10` = 10% discount. Shown as percent in the UI only. | Tax.taxRate, Discount.rate | PART: discount `value` is whole percent 1 to 100 in contract | IN | MODELS 2.3; contract DiscountInput |
| P69 | Ids | Strings, opaque, never parsed. No `::` in any id (it joins group and option ids in v2). Line-level `uniqueId`, `parentId`, `position` stay integers as in v2. | id fields (MODELS 2.5) | PART: ids strings; `::` not checked | IN | MODELS 2.5, 8.2; decision 7A |
| P70 | Field names and types | camelCase, exact spelling (`dineinFlag`, `takeoutFlag`, `dineInPriceOverride`, `takeOutPriceOverride`, `available`, `alcoholic`). Flags as 1 or 0 in store hours and `liveFlag`; booleans elsewhere. Lists send `[]`, never null. Ignore unknown fields. | All | PART: camelCase; flags are booleans | IN | MODELS 2.2, 2.3, 2.4 |
| P71 | Time formats | Local date-time `yyyy-MM-ddTHH:mm:ss`. Time of day `HH:mm:ss` (reads `HH:mm`). Store hours: `HH:mm:ss.SSS`, day 1 Sunday to 7 Saturday. Menu section hours: day names MONDAY..., `HH:mm:ss`. Core timestamps UTC (Q5). | Hours (9.10), section hours (5.8) | PART: `LocalTime` HH:mm, `Weekday` MON..SUN, UTC | IN (scope Q5) | MODELS 2.3, 5.8, 9.10; contract README |
| P72 | Time zone | Store time zone America/Sao_Paulo. The server decides open, closed and the menu; the kiosk never uses its own clock for that. | — | HAS: `timezone`, `serverTime` | IN | contract DeviceConfig; plan-next (BR-MNU-01) |
| P73 | Languages | `pt-BR` required, `en` optional (LocalizedText). Guest endpoints return text in the requested language. A missing English text falls back to pt-BR, never blank. | — (Comanda) | HAS: contract `LocalizedText`, `language` | IN | contract README; plan-next; B1 FR-MNU-003 |
| P74 | Language pack | Kiosk loads its language pack at journey start. A bundled copy is the fallback if the fetch fails. | — | PART: `/v1/languages/{code}` | IN | K2 OP-START-02 |

### 9. Errors, validation, retries and timeouts

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P75 | Error shape | `application/problem+json` (RFC 9457) with a stable `code`. Clients switch on `code`, never on `title`. Field errors in `errors[]`. No framework error body, no stack trace, no timestamp or path. | No v2 error model (POS framework body is OUT) | HAS: contract `Problem` | IN | contract README; B1 VAL-ERR-UP, VAL-FWBODY (not copied) |
| P76 | Error codes for v2 flows | Keep the 22 codes. Add: TABLE_NOT_FOUND, CHECK_NOT_FOUND, CHECK_NOT_OPEN, TENDER_NOT_AVAILABLE, PAYMENT_EXCEEDS_TOTAL, INVALID_DOCUMENT_NUMBER, AWARD_NOT_APPLICABLE, DISCOUNT_EXCEEDS_BASKET. | — | PART | IN (new codes proposed) | contract ProblemCode; plan-next G-A12 |
| P77 | Input validation | Validate every input before calling the Core: ids, quantity bounds, string lengths, money as a decimal with at most two places, CPF and CNPJ check digits. Malformed JSON is a 400, never a silent null. | — | PART | IN | plan-next (validate Server Actions); B1 VAL-BIND, DT-ORD-01 (not copied) |
| P78 | Retries | GET reads: up to 2 times with short backoff. POST order and payment: only with `Idempotency-Key`. Never retry a 4xx, and never retry a money call blindly. | — | NO | IN | plan-next; B1 BR-SVC-03 (plan rule) |
| P79 | Timeouts | Reads 5 s. Order placement 15 s in total, retries included. Payment per provider in phase 4. No 60 s default on any client. | — | NO: server Core client has no timeout | IN | plan-next (P1); B1 BR-XC-04, VAL-ERR-NET, INT-01 |
| P80 | Idempotency | `Idempotency-Key` (UUID per attempt) on POST orders, payments and place. Same key and same body: first result. Same key, different body: 409 IDEMPOTENCY_KEY_REUSED. Stored at least 24 h. | — | HAS: contract | IN | contract README; B1 API-H-NONCE |
| P81 | Unknown order result | Never report "failed" while the result is unknown. Retry with the same key inside the 15 s budget. If still unknown: "verificando seu pedido" with a number lookup. Never a new key. | — | NO | IN | plan-next; B1 BR-ORD-04 (3 × 5 s then failure: not copied) |
| P82 | Error mapping in the BFF | The BFF passes Core problem codes through as they are. No HTTP 200 with an error inside. | — | PART | IN | B1 BR-PAY-01, FR-XC-003 (not copied) |

### 10. Device identity, config, heartbeat and health

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P83 | Device sign-in | `deviceId` + `deviceSecret` → Bearer token, 900 s. Disabled device: 403 DEVICE_DISABLED. Bad secret: 401. The token stays on the server in an HttpOnly cookie. | — | HAS: contract phase 0 | IN | contract authenticateDevice; CLAUDE.md; B1 AUTH-IDFILE (replaced) |
| P84 | Device secret | Set at provisioning. Rotation in the back office. Never shown to the browser. Storage and pairing: Q10. | — | PART: rotate endpoint exists | IN (scope Q10) | contract rotateDeviceSecret; contract README open question 6 |
| P85 | Device config | `kioskID`, `kind`, `idleTimerIntervalMilliseconds` (0 disables), `printerEnabled` (false until phase 4), `maintenanceMode`, `atCapacityMode`, `pace`, `isOpen`, `restaurant`, `activeMenu`, `nextOpeningAt`, `serverTime`. | — | HAS | IN | contract DeviceConfig; K2 ENT-KIOSK-01 |
| P86 | Restaurant public config | `locationId`, name, logo, currency BRL, timezone, defaultLanguage, supportedLanguages, order type availability, closedMessage, posCheckNumberDisplayLength. | StoreConfiguration (9.10, partly) | PART | IN | contract RestaurantPublic |
| P87 | Config retry | Kiosk retries the config load every 5 s on failure (contract). The offline screen retries every 10 s (plan). Choice: Q11. | — | PART | IN (scope Q11) | contract getDeviceConfig; plan-next |
| P88 | Heartbeat | `POST /v1/devices/heartbeat` with appVersion, screenResolution, ip (optional). Core stores `lastSeenAt` and the source IP. Answer 204. Later: menu ETag inside the heartbeat (G-A17) and an "offline for 10 min" alert (G-A23). | — | HAS (phase 0); alert NO | IN (alert later) | contract sendHeartbeat; plan-next G-A17, G-A23 |
| P89 | Device status report | STATUS: TRADING or UNAVAILABLE, with reason MAINTENANCE, AT_CAPACITY, STORE_CLOSED or UNKNOWN. KEY_ACTION: START_JOURNEY_FAILED with reason FAILED_LOAD_MENU. Fire and forget; the kiosk ignores errors. | — | HAS (phase 0) | IN | contract reportDeviceStatus; B1 FR-130, DM-OPS-03 |
| P90 | Owner health view | Owner sees kiosk and store status on Início and Aparelhos: sections UP, DOWN or NA. Maintenance flag per device. No hardware sections. | Health (9.12) | PART | IN | B1 BR-OPS-01, FEAT-OPS-02, DM-OPS-01 (partly); D6 |
| P91 | Health probes | Unauthenticated liveness GET: 200, no sensitive data. Core health reports UP, DOWN, OUT_OF_SERVICE or UNKNOWN, with details and no secrets. | Health (9.12) | NO | IN | B1 EP-OPS-01; MODELS 9.12 |
| P92 | Maintenance and at capacity | Maintenance per device: the kiosk shows the maintenance screen. Pace PAUSED: `atCapacityMode` on every kiosk until `pausedUntil`. | — | PART: contract pace | IN | contract DeviceConfig; plan-next (pace) |
| P93 | Store hours and live flag | Hours windows with pickup, delivery, seat and opening flags. `liveFlag` 1 = store takes orders. Owned by the store-ops area; the formats are fixed here (P71). | StoreConfiguration hours and liveFlag (9.10) | PART: menu section hours only | IN (store-ops owns) | MODELS 9.10 |

### 11. Caching, offline and screen precedence

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P94 | ETag caching | `GET /v1/devices/me/config` and `GET /v1/menus/active` return an ETag. `If-None-Match` gets 304. The ETag changes when the menu, items, sold-out flags, language or pace change. | — | HAS (contract) | IN | contract README; B1 BG-BKG-03 (not copied) |
| P95 | Menu loaded once per journey | Menu kept in memory at journey start. Swapped only when a new journey starts, never mid-order. No server round trip until the quote. | — | PART | IN | CLAUDE.md; plan-next |
| P96 | Fail closed | Core unreachable: offline screen, never a live menu without quotes. One missed read does not flip a live kiosk offline. | — | PART | IN | plan-next; B1 BG-BKG-07 (fail-open: not copied), BG-BKG-08 |
| P97 | Offline order queue | Orders kept on the device and replayed later (NOT_SYNCED). | — | NO | OUT (CLAUDE.md: MVP offline is a screen, no queue) | CLAUDE.md; B1 BG-BKG-09, DM-ORD-02, UJ-ORD-02 |
| P98 | Screen precedence | Offline > Maintenance > Closed (hours or special date) > Paused > Live. One test for each overlapping pair. | — | NO | IN | plan-next (decision 14); B1 BR-SES-02/03 |
| P99 | Window edges | Menu windows start-inclusive, end-exclusive: 11:00 belongs to the afternoon menu. The close minute counts as closed. | — | NO | IN | plan-next; B1 BR-SES-04 (close minute counted open: not copied) |

### 12. Real-time and kitchen sync (kitchen area owns the detail)

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P100 | Kitchen live stream | Server-Sent Events: `order.paid`, `order.status_changed`, `store.pace_changed`. Ping every 15 s. | — | HAS (phase 3, contract) | IN | contract streamKitchenEvents; KDS1 RT-EV-FULL |
| P101 | Reconnect catch-up | On reconnect: incremental fetch merges missed changes. Full refresh when the view opens. | — | NO | IN | KDS1 RT-CATCHUP, ER-MISSED, JRN-021 |
| P102 | Stale-write guard | `version` on the kitchen order. A move sends `expectedVersion`; mismatch gives 409 STALE_ORDER_VERSION. The reference's "last write wins" is not copied. | — | HAS (0.2.0 proposal) | IN | contract README 0.2.0; KDS1 RT-CONFLICT, ER-RACE (not copied) |
| P103 | Failed move is visible | A failed status change shows an error with "Tentar de novo". The card stays where the Core has it. | — | NO | IN | plan-next G-K12 |
| P104 | Transport | Kitchen and kiosk use the BFF's SSE from the Core. The reference's third-party pub/sub is not used. | — | HAS (SSE) | IN (SSE); OUT (third-party pub/sub) | contract; KDS1 RT-TRANSPORT |

### 13. Logs, personal data and telemetry

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P105 | Trace and version | Each request has a trace id. Responses carry `logTraceId`. The kiosk sends its app version for diagnostics. | — | NO | IN | B1 API-H-TRACE, API-H-VERSION, VAL-ORD-LOGTRACE |
| P106 | No body logs | Never log order or payment bodies. Redact CPF and CNPJ. Card number never sent. | — | PART (plan rule) | IN | plan-next; MODELS 8.8 |
| P107 | CPF retention | CPF kept only as long as the NFC-e needs it (LGPD). | — | NO | IN | plan-next (personal data) |
| P108 | Analytics and error tracking | Analytics events, screen views and error tracker (GA4, Sentry). | — | NO | ? (analytics vendor: Kai decides) | B1 FR-1139a..h, K2 DI-A11-GA4; KDS1 INT-ANALYTICS |
| P109 | No personal data in analytics | Analytics events never carry a document number or card data. | — | NO | IN | K2 FR-441 |

### 14. Back-office sessions and access

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P110 | Owner sign-in | One owner login, email and password. Expired session → login. Forgot password is manual in the pilot. | — | PART: `ownerLogin` (phase 1) | IN | contract ownerLogin; D6 API-058, API-071; KDS1 API-01 |
| P111 | Scoped permissions | Return the current user, scopes, roles and effective capabilities. Never infer permission from a hidden button. The Core enforces access. | — | PART | IN | D6 AI-1; KDS1 SCR-ROLE |
| P112 | Waiter sign-in | How waiters sign in on the waiter site: Q9. | — | NO | ? (Q9) | decision 4; D8 BR-001 (PIN rules) |
| P113 | Session expiry | Expired session: back to login; the screen keeps what it can. | — | NO | IN | KDS1 JRN-023, ER-SESSION |
| P114 | Keep-alive | Session kept alive every 3 h while "stay signed in" is on. | — | NO | ? | KDS1 API-04, FEAT-003 |
| P115 | Invitations and roles | Invite staff, assign roles, scoped role assignments. Single owner login in the pilot. | — | NO | ? (second login later, per D6) | D6 API-059, API-329; D13 FEAT-013 |
| P116 | Federated sign-in | Social or SSO providers, popup, token exchange. Assisted ordering from a customer account. | — | NO | ? (no decision; not in the MVP plan) | D6 API-068/069; KDS1 FEAT-002; D6 AI-8 |

### 15. Out of scope or not carried

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources |
|:--|:--|:--|:--|:--|:--|:--|
| P117 | POS integration endpoints | `/internal/v2/*`: order, totals, check, check/pay, discount, pos-health, init, destroy, store-configuration, pos-data, raw-menu, menu-state. Replaced by Core operations (P21, P42, P49, P50, P51). | MODELS §3 | NO | OUT (decision 2) | MODELS §3; decision 2 |
| P118 | POS venue config | `config` envelope (baseUrl, locationId, tableNumber, venueId) on every request. | MODELS §4 | NO | OUT (decision 2) | MODELS §4, 8.16 |
| P119 | Loyalty | Points, stamps, loyalty providers, external ids (ExternalUserId), loyalty awards. | ExternalUserId (8.9) | NO | CUT (loyalty, rule 10) | brief rule 10; D10 loyalty.md; B1 EP-LOY-02 |
| P120 | Split bill | Several payments on one order; partial payment cancel. | Payment[] | NO | CUT (split bill, rule 10) | brief rule 10; B1 EP-ORD-03 |
| P121 | Consent, legal documents, demo mode, repeat order, guest conversion, SaaS billing | Out of scope for the MVP. | — | NO | OUT (decision 8) | decision 8; D8 ENT-073..077; KDS1 CFG-040 |
| P122 | Multi-store, store groups, multi-brand, visual templates | One restaurant, one template. `venueId` on each request. | — | NO | CUT (rules 5 and 10) | brief rules 5 and 10; KDS1 BR-036; B1 DM-MNU-02 |
| P123 | Scan-and-Go and staff age approval | Scan a code to add items; age approval PIN for restricted items. | — | NO | CUT (rule 10) | brief rule 10; D8 CFG-015 |
| P124 | Hardware | Payment terminal, printers, scanners, cash machine, peripheral board, status terminals. | — | NO | HW-LATER (decision 11) | decision 11; B1 README-DOWN, FR-128..136 |
| P125 | Reference plumbing | Java filters (415 rule), CORS, header parsing, local cache state machine, md5 file names, local disk cache. Next.js replaces them. | — | NO | OUT (replaced by Next.js) | B1 API-415, API-CORS, BG-BKG-01..01d, DT-BKG-01 |

---

### 16. Second pass: CUT, EXT, HW and POS rows re-judged under the final decisions

Each row lists its source ids. Ids written as ranges (for example CFG-564..584) cover near-identical rows of one group, all judged the same way. Original tag is the reader's tag. The Coverage section counts them per file.

| # | Feature | Behaviour | v2 model | Comanda today | Verdict | Sources (original tag) |
|:--|:--|:--|:--|:--|:--|:--|
| P126 | Journey start, reset and abandon events | Journey starts with its timestamp (stored on the order). Abandon with reason IDLE_TIMEOUT or CANCELLED_BY_GUEST. Reset when the guest leaves. Non-blocking for the guest. | Order (journeyStart) | PART: `/v1/journeys`, `/events` (phase 2) | IN | K2 FR-236 (HW), OP-START-01 (HW), OP-START-03 (HW), OP-KIOSK-01 (HW), OP-KIOSK-02 (HW), FR-120 (IN); B1 DM-SES-03 (IN) |
| P127 | Owner-edited kiosk messages | Owner edits the closed, paused and unavailable texts in PT and EN, with preview and restore default. | — (Comanda; plan G-A11) | NO | IN (decision 8 scope; plan P2) | D8 ENT-098, CFG-713..716, JOURNEY-090 (? tag, now IN); D4 CFG-713..716 |
| P128 | Senior discount | Senior apply is a discount (promotion rule). The analytics event on apply is P108. | Award / Discount | NO | IN (decision 8: codes and promotions) | K2 FR-718 (EXT); K1 senior discount gap |
| P129 | Card processor connection screens | Connect a card processor, processor portal, guest payment account, processor success page. | — | NO | OUT (decision 9) | D4 FEAT-009, SCR-250; D5 FEAT-009 ACT-019, SCR-250 (EXT); D3 FEAT-079 |
| P130 | Product feedback form | Guest-independent feedback form for the product team: title and description required; type forced. | — | NO | ? (not a brief cut; Kai decides) | D2 FR-743, FR-744 (EXT); D4 FEAT-100, ACT-622..627 (EXT); D7 FEAT-100, DLG-011, FORM-105 (EXT); D8 ENT-105, CFG-743..744, BR-059, ERR-025, JOURNEY-096 (EXT); D13 FEAT-100, CFG-743..744 (EXT) |
| P131 | Transactional email layout and store banners | Email banners and store banner images for transactional email. | — | NO | CUT (rule 10: one visual template) | D2 FR-711, FR-712 (CUT); D4 FORM-097 (CUT); D8 ENT-097, CFG-711..712 (CUT); D12 CFG-704, CFG-705 (CUT) |
| P132 | Visual style and theme | Colours, fonts, logos, wallpapers, store banners, mobile app and online ordering appearance, landing page banner, table-bill loading logo, server theme, template slots, shared CSS, SCO mode. | — | NO | CUT (rule 10: one visual template, no multi-brand) | K2 FR-1101..1104, FR-1107, FR-1108, FR-1216..1220, ENT-PRES-01 (CUT), OP-PRES-01 (CUT), ENT-SCO-02, DI-A12-SLOTS-*, DI-A12-TREES (CUT); K1 F-PRES-01, F-SCO-02 (CUT); D2 FR-691..693, FR-704, FR-705 (CUT); D4 CFG-691..722 (CUT); D8 ENT-094..096, CFG-691..712, CFG-709..710, JOURNEY-089 (CUT); KDS1 FEAT-049 (CUT) |
| P133 | Owner email and recipient lists | Recipients for special-date, order placement and order rejection emails. Owner alerts by email come later (G-A23). Needs an email sender. | — | NO | ? (needs email sender; Kai decides) | D2 FR-722..725 (EXT); D4 CFG-723..725 (EXT); D8 ENT-101, ENT-102, CFG-722..725, JOURNEY-093, JOURNEY-094, ERR-022, BR-054 (CUT); D8 BR-053 (CUT) |
| P134 | External activity feed and personal subscription | Organization feed (card fields, accept, cancel and complete action labels, linked organization ID) and personal subscription to order notifications. Staff alerts. | — | NO | ? (not a brief cut; Kai decides) | D8 ENT-103, ENT-104, CFG-726..742, JOURNEY-016, JOURNEY-028 (steps 3 to 4), JOURNEY-095, DEP-068, DEP-F08, DEP-228..237, ERR-023, BR-055, CFG-010 (IN, Y), CFG-741 (CUT, Y); D4 FORM-103, FORM-104, ACT-600..609 (EXT); D7 FEAT-087, FORM-103, FORM-104 (EXT) |
| P135 | Application messages to other applications | Messages sent to other applications: application ID, display text (max 1024), title (max 255). | — | NO | ? (Kai decides) | D2 FR-719..721 (EXT); D8 ENT-100, CFG-719..721, JOURNEY-092 (CUT); D12 CFG-719..721 (?); D4 FEAT-084, ACT-588..593 |
| P136 | Order message templates | Store text for order messages (rich text, short name max 100). | — | NO | ? (Kai decides; may be ticket text) | D2 FR-717, FR-718 (CUT); D8 ENT-099, CFG-717..718, JOURNEY-091 (CUT) |
| P137 | Legal documents, consent and statements | Terms, privacy, accessibility and cookie documents; consent for online ordering, POS consent for online orders; allergen consent; consent workflows. | — | NO | OUT (decision 8) | D8 ENT-073..077, CFG-564..584, JOURNEY-077..080, DEP-072, BR-044, BR-045 (CUT); D12 CFG-590 (POS); D8 CFG-591 (consent) |
| P138 | Billing and card update (SaaS) | Plan creation, invoices, subscription cancellation, billing card form. | — | NO | OUT (decision 8: SaaS billing) | D1 FR-017..020 (?); D7 FEAT-011, FORM-008 (?); D8 ENT-008, CFG-017..020 (EXT), JOURNEY-034 (EXT); D7 UNK-017 |
| P139 | Federated sign-in, invitation sign-up and identity migration | Social or SSO sign-in and return, invitation sign-up with federated return, identity migration route, password reset email (needs email sender). | — | NO | ? (Kai decides; default not in MVP) | D2 FR-749, FR-750, FR-756..758 (EXT); D4 FEAT-003, FEAT-004 (EXT/?); D5 SCR-003, SCR-004, SCR-006 (?), ACT-006, ACT-012..014; D8 ENT-001, ENT-002, CFG-001..005 (EXT), JOURNEY-029 step 5 (EXT), JOURNEY-031 (EXT); D13 FEAT-001 (EXT), FEAT-004 |
| P140 | Restricted-item approval PIN | Four-digit PIN that approves restricted items (staff age approval). | — | NO | CUT (rule 10: staff age approval) | D8 CFG-015 (CUT), JOURNEY-023 step 3 (IN tag, re-judged); D7 FORM-006 (CUT); D4 ACT-023..025 (CUT) |
| P141 | Loyalty stamps, cards and earning rules | Stamp count, earning and reward methods, loyalty message and card appearance; loyalty ID complement. | — | NO | CUT (loyalty, rule 10) | D4 ACT-326..330, CFG-437..445 (CUT); D1 FR-204 (CUT); D10 loyalty.md (P119) |
| P142 | Multi-store publish targets and organization context | Publish to store groups or stores, organization-wide target, source store, store ordering method, route scheme with organization and store context, entity-target pickers. | — | NO | CUT (multi-store, rule 10) | D9 CFG-286..290, CFG-301, CFG-302, CFG-307, CFG-310 (CUT); D9 FEAT-039 target rows (CUT); D13 route scheme and context, entity-target pickers (CUT); KDS1 API-08, API-09, BR-036, BR-041, CFG-001, DM-VENUE-ID, JRN-002 (CUT) |
| P143 | POS menu sync, POS import, sync schedules and logs | Scheduled POS sync, sync time and frequency, weekdays, timezone, POS import source, sync logs, external sync log, force push to POS. | — | NO | OUT (decision 2) | D9 FEAT-040, FEAT-041 (POS), CFG-291..300, CFG-303, CFG-304, CFG-306 (POS); D9 FEAT-043 POS rows (POS) |
| P144 | Publish job progress, logs and force completion | Publish dialog outcome: progress and log screens, per-store status, awaiting kiosk confirmation (advice to wait 5 minutes), terminal statuses, force completion for super-admin. | — | NO | ? (Kai decides; G-A17 later covers kiosk confirmation) | D9 FEAT-039 progress, log, force completion, awaiting-confirmation and terminal rows (CUT) |
| P145 | CSV menu import | CSV file import (max 10 MB), import listing, push limits (1500 targets), 30-second polling. | — | NO | ? (plan-next cut menu import; not a brief cut) | D9 FEAT-043 CSV and push limits (POS tag), CFG-305, CFG-308, CFG-309 (CSV, ?) |
| P146 | Remote modules: cross-sell admin, receipt QR editor, external validator, consumer previews | Remote admin host for cross-sell admin, receipt QR editor (NFC-e), external menu validator, consumer previews. Processor widgets are OUT (decision 9); assisted ordering is OUT (decision 8). | — | NO | ? (Kai decides, except the processor and assisted parts: OUT) | D7 README-REMOTE, DLG-016, UNK-014 (EXT); D6 AI-9 (EXT); D9 FEAT-042 (EXT); D8 DEP-F09 (EXT) |
| P147 | Analytics events for cut features | Events for age verification, loyalty sign-in, accessibility, and reorder. | — | NO | CUT (rules 10, decision 8 for reorder) | K2 FR-527 (CUT), FR-1121 (CUT), FR-1139d, FR-1139e, FR-1139f, FR-1139g (CUT); DI-A05-TERMINALS (CUT); DI-A07-DEVICES loyalty part (CUT) |
| P148 | Repeat order (reorder) | Start, success and failure of a reorder from a previous order. | — | NO | OUT (decision 8) | K2 FR-1139f (CUT) |
| P149 | Accessibility mode | Accessibility mode toggle and its settings. | — | NO | CUT (rule 10) | K2 DI-A11-FIELDS (CUT), FR-1121 (CUT), FR-1139g (CUT) |
| P150 | Age verification at the kiosk | Age gate, item blocked, locked item, not approved. | — | NO | CUT (rule 10: staff age approval) | K2 FR-527 (CUT), DI-A05-TERMINALS (CUT), FR-1139e (CUT) |
| P151 | Receipt printing and printer status | Receipt printers (8 types), printer status, auto print, print failure messages, reprints, printer error notifications. | — | NO | HW-LATER (decision 11) | K2 FR-128 (HW), OP-KIOSK-05 (HW), OP-POST-03 (HW), DI-A01-PRINTER (HW), DI-A10-DEVICES printer (?); B1 FR-RCP-003..005 (HW), EP-RCP-04 (HW), FEAT-RCP-03 (HW); K1 printer rows |
| P152 | Board, ATP, status terminals and kiosk admin gesture | Peripheral board (ATP) init, heartbeat, willappear, willstop and willterminate callbacks, cash status polls, frameless window, WiX installer, admin panel gesture (5 taps in 4,000 ms), orientation listener, status terminals (UDP 9,837, TCP 9,838), device health probes. | — | NO | HW-LATER (decision 11) | K2 FR-131, FR-136, FR-533 (HW), OP-KIOSK-03, OP-KIOSK-09, DI-A01-TERMINALS, DI-A01-ATP, DI-A01-ORIENTATION, DI-A01-PACKAGING, DI-A04-DEVICE (HW); B1 INT-84, FR-PER-003, EP-PER-04, EP-PER-05, EP-PER-07, PER-BOARD, PER-CALLBACK-BASE, BG-BKG-16, FEAT-PER-02 (HW); K1 F-KIOSK-06, F-KIOSK-07, F-KIOSK-09, F-KIOSK-11, SCR-KIOSK-07 (HW) |
| P153 | Scanners and barcode devices | Serial scanner (3 failed polls), HID scanner, scanner status, scan timeouts, scanner WebSocket. | — | NO | HW-LATER (decision 11) | K2 FR-530, FR-531, OP-SCAN-02, DI-A01-SCANNER (HW); B1 FR-PER-001, FR-PER-002, BR-PER-01..03, VAL-PER (HW) |
| P154 | In-store POS and POS health | Local POS totals and order submission, POS state check, POS check scheduler, POS health (NA, UP, DOWN), POS routing, POS consent, PAID_POS_ERROR caused by POS. | — | NO | OUT (decision 2) | B1 BG-BKG-08, BR-OPS-02, INT-11, INT-12, INT-15, INT-17, INT-18, BR-ORD-01, FR-ORD-003, FR-ORD-006, FR-ORD-007, BR-ORD-05, BR-ORD-06, FR-PAY-005 (POS part) (POS and HW); D12 CFG-590 (POS) |
| P155 | Reference plumbing: auth, proxy, headers, cache and shutdown | Identity file and local API without auth, Java request filters (415), CORS, header parsing, `/proxy/**`, local cache state machine, md5 file names, disk cache, startup and shutdown hooks, local order ids from hashCode, disconnected replay. | — | NO | OUT (replaced by Next.js, device auth P83, and the Core) | B1 AUTH-NONE, AUTH-IDFILE, AUTH-NOAUTHZ (HW), AUTH-BKG, API-IDFILE, API-H-LOC, API-H-GROUP, API-415, API-CORS, API-DECL, API-UPSTREAM, API-ROUTES, BG-XC-01..04, BG-BKG-01..01d, BG-BKG-05, BG-BKG-09, BG-BKG-13, BR-XC-03, BR-OPS-03, BR-ORD-02, DM-BKG-01, DT-BKG-01, FEAT-OPS-06, FEAT-OPS-07, FR-OPS-004, INT-08, INT-09 (EXT: auth config for loyalty and face-ID), INT-84 (HW), IDN-SYNC (CUT) |
| P156 | Table-bill custom fields | Custom entries on the table bill (text, number, type), a limit of three fields, positions, and their validation. | — (no v2 field) | NO | ? (new field needed; Kai decides) | D12 CFG-607..619 (?, Y); D7 FEAT-071, FORM-081, FORM-082 (?); D8 BR-046 |
| P157 | Gift card, room charge, stored value, face-ID, food stamp, app gateway and crypto payments | Vendor payment methods, their lookups, two-factor and PIN flows. | — | NO | OUT (decision 9) | K2 FR-918, FR-930, FR-938, FR-942, OP-SCAN-03 (gift card and app part) (EXT); B1 PAY-02, PAY-08, PAY-12..14, FEAT-PAY-03, FEAT-PAY-05, FR-PAY-009, DM-SVC-01, BR-SVC-01, EP-ORD-04..06, FR-ORD-011, INT-20, FEAT-ORD-04 (EXT, ?) |
| P158 | Cash machine | Cash acceptance, status polling, dispensing, expected change from the machine, cancel cash. Cash as a tender stays IN (P23). | — | NO | HW-LATER (decision 11) | K2 FR-902, FR-905, FR-907 (HW), DI-A01-CASH (HW), OP-KIOSK-03 (HW); B1 PAY-03..06, FEAT-PAY-02, UJ-PAY-03, DM-PAY-05, DT-PER-01, FR-OPS-003, DM-OPS-04 (CUT/HW) |
| P159 | Donation view and apply analytics | Donation view and apply events. Donation itself is IN (P18). | — | NO | ? (analytics, P108) | K2 FR-840 (EXT); FR-ORD-009 (B1) |
| P160 | Support and integrations header events | Help request (call staff) analytics and cancel analytics. Call staff itself is P56. | — | NO | ? (P56) | K2 FR-1208 (EXT) |

## New fields to add to the v2 models

Rule from decision 3: new fields go directly on the v2 model. Types are the JSON types.

| Entity.field | Type | Meaning | Why (feature #) |
|:--|:--|:--|:--|
| Payment.paymentStatus | enum AUTHORISING, AUTHORISED, FAILED, CANCELLED | Core state of the payment | P24 |
| Payment.failureReason | string, nullable | Short cause code (PE01 to PE09) | P28 |
| Payment.amountReceived | number (BRL) | Cash handed over by the guest | P23 |
| Payment.changeAmount | number (BRL) | Change returned on cash (if Q7 = A) | P23 |
| Tender (new entity) | id (string), name, kind (CARD_CREDIT, CARD_DEBIT, CASH, PIX if Q6 = B), enabled, channels | Payment method the Core accepts | P21, P22 |
| Award.enabled | boolean | Promotion on or off | P15 |
| Award.name | string | Internal name (customer text stays in `description`) | P15 |
| Award.minimumSubtotal | number (BRL) | Minimum basket to apply | P15 |
| Award.maxDiscount | number (BRL) | Cap on the discount | P15 |
| Award.validFrom, Award.validTo | date-time, nullable | Validity window | P15 |
| Award.applicationRule | enum BASKET, ITEMS, SECTIONS, TAGS | What the award targets | P15 |
| Award.targetIds | string list | Items, sections or tags it targets | P15 |
| Award.maxRedemptions, Award.redemptionCount | integer | Use cap; count rises when the order is paid | P15 |
| Award.allowedTenders | enum list (CARD, CASH) | Tender eligibility | P15 |
| DiscountRequest.entryMethod | enum MANUAL, SCAN, UNKNOWN | How the code was entered | P13 |
| StoreConfiguration.serviceChargeRate | number (fraction) | Service charge percentage used by the Core | P16 |
| StoreConfiguration.availableOrderTypes | list of OrderType | Types the store takes | P64 |
| StoreConfiguration.pricesIncludeTax | boolean | Menu prices already include tax (Q3) | P11 |
| StoreConfiguration.posCheckNumberDisplayLength | integer | Digits of the short order number | P43 |
| StoreConfiguration.privacyNotice | LocalizedText | LGPD line on the CPF step | P34 |
| StoreConfiguration.sellerName, sellerTaxId, sellerStateRegistration, sellerTaxRegime | text (sellerTaxId = CNPJ) | Seller fiscal identity | P36 |
| StoreConfiguration.sellerAddress | object: street, number, district, postCode, city, state | Seller address | P36 |
| OrderItem.fiscalNcm, cfop, unit, origin, taxSituation | string | Per-item fiscal fields (phase 4) | P37 |
| OrderItem.sentToKitchen | boolean | Item already sent on an open check | P55 |
| PosCheck.tableNumber | string | Table the check belongs to | P51, P52 |
| PosCheck.status | enum OPEN, PAID | Check lifecycle | P54 |
| SubmitOrderRequest.orderNonce | UUID | Journey identity of the order | P47 |
| SubmitOrderRequest.language | enum pt-BR, en | Language for guest text | P73 |
| SubmitOrderResponse.status | OrderStatus (see contract) | Order status after place | P44 |
| SubmitOrderResponse.waitTime | integer, minutes, nullable | Wait for the current pace | P44 |
| SubmitOrderResponse.businessDate | date (YYYY-MM-DD) | Business day of the number | P43 |
| PosCheck.billRequestedAt, PosCheck.waiterCalledAt | date-time, nullable | Guest asked for the bill or called a waiter (only if Q8 = A or B) | P56 |

---

## Contract changes to follow v2

The contract is `contract/openapi.yaml` 0.2.0. Every row is a place that must change. Breaking means the BFF and Go must change with it.

### A. Money and totals

| # | Contract place | Today (0.2.0) | Change to v2 | Breaking |
|:--|:--|:--|:--|:--|
| C1 | `Money` (line 2301) and its ~19 uses | int64, cents, example `2800` | Decimal BRL, two places (`number`, multipleOf 0.01). Change every example (`2800` → `28.00`, `8280` → `82.80`). Menu prices belong to the menu area but use the same type. | Yes |
| C2 | `OrderTotal.tax` (line ~3122) | Integer cents, nullable | `taxTotal` (decimal) and `taxes[]` (Tax) | Yes |
| C3 | `OrderTotal` (line ~3104) | subtotal, discountTotal, total, taxInclusive, tax, currency, one `discount` | v2 names: subTotal, discount, serviceChargeTotal, taxTotal, total. Lists: discounts[], taxes[], serviceCharges[]. Keep `taxInclusive` (Q3) and `currency` | Yes |
| C4 | `DiscountItem` (line ~3158) | One discount, `amount` in cents | IDiscount list: id, name, rate, value, locked | Yes |
| C5 | `DiscountInput` (line ~4136) | `kind` PERCENT or FIXED; `value` whole percent or cents | PERCENT stored as a fraction (`0.10`); FIXED in decimal BRL. The BFF keeps the whole-percent entry. | Yes |
| C6 | `CategoryItemLink.priceOverride` (line ~3916) | Integer cents | Decimal BRL | Yes |

### B. Order types and channels

| # | Contract place | Today (0.2.0) | Change to v2 | Breaking |
|:--|:--|:--|:--|:--|
| C7 | `OrderType` (line 2310) | DINEIN, TAKE_OUT | Add PAY_AT_TABLE (IN); PICKUP, DRIVE_THRU, DELIVERY, DELIVEROO accepted by the schema, no screen creates them (MODEL-ONLY) | No (additive) |
| C8 | `ServicePriceOverride` (2325), `ServiceAvailability` (2333), `DailyReport.byOrderType` (line ~4166), `OrderTypeTotals` (4191) | Keys DINEIN and TAKE_OUT, required | Keys follow the enum; add PAY_AT_TABLE; delivery types optional | Yes (required list) |
| C9 | `RestaurantPublic` (2476), `RestaurantInput` (3727), `DeviceConfig.restaurant` | `isDineInAvailable`, `isTakeOutAvailable` | `availableOrderTypes` (list). Keep `cnpj` as `sellerTaxId`. Add seller fields, `privacyNotice`, `serviceChargeRate`, `pricesIncludeTax`, `posCheckNumberDisplayLength` | Yes |

### C. Payments

| # | Contract place | Today (0.2.0) | Change to v2 | Breaking |
|:--|:--|:--|:--|:--|
| C10 | `PaymentMethod` (3371), `StartPaymentRequest` (3377) | Enum PIX, CREDIT, DEBIT; `method` | Remove the enum. Request carries `tenderId` (string) and the v2 Payment fields | Yes |
| C11 | `Payment` (3383) | `method`, `amount` (cents), `paymentStatus`, `gatewayType`, `providerRef`, `failureReason`, `pix` | `tenderId`, `tenderRef`, `amount` (decimal), `tipAmount`, `donationAmount`, `customer`, `authCode`, `cardScheme`, `cardLast4Digits`. Keep `paymentStatus` and `failureReason` as Core fields | Yes |
| C12 | `PixCharge` (3431) | Pix copy-and-paste | Keep only if Q6 = B | No |
| C13 | `SimulatePaymentRequest` (3443), `/payments/{id}/simulate` | outcome AUTHORISED or FAILED | No change | No |

### D. Orders and lines

| # | Contract place | Today (0.2.0) | Change to v2 | Breaking |
|:--|:--|:--|:--|:--|
| C14 | `OrderLineInput` (3059), `OrderLineOptionInput` (3076) | `itemId`, `quantity`, `options[].optionId` | `id`, `quantity`, `modifiers[].id`, `specialNotes`. Kiosk still sends ids only. | Yes |
| C15 | `OrderLine` (3332), `OrderLineOption` (3355) | `guid`, `itemId`, `name`, `unitPrice`, `quantity`, `lineTotal`, `options`, `price` | v2 names: `id`, `uniqueId`, `parentId`, `position`, `modifierType`, `itemPrice`, `totalPrice`, `itemTotal`, `total`, `taxes`, `discounts`, `specialNotes`, `modifiers`. Keep `guid` as the client line id. | Yes |
| C16 | `Order` (3223), `CreateOrderRequest` (3195) | `posCheckNumber`, `cpfCnpj`, `orderItems`, `orderTotal`, `discountCode` | `number`, `customerCheckNumber`, `invoiceCpfCnpj`, `items`, `totals`; add `customer`, `payments`, `notes`, `specialNotes`, `openCheck`, `tableNumber`, `dateCreated`, `businessDate`, `status` | Yes |
| C17 | `QuoteRequest` (3091), `POST /v1/quotes` | `orderItems`, `discountCode` | v2 TotalsRequest: `items`, `orderType`, discounts and awards | Yes |
| C18 | `DiscountValidationRequest` (3138), `/v1/discounts/validate` (343) | `code`, `entryMethod`, `currentDiscountCode` | v2 DiscountRequest: `awards`, `codesToRemove`, `entryMethod`. Answer: awards applied (DiscountResponse). | Yes |
| C19 | `DiscountType` (3135) | COMANDA_COUPON, RESTAURANT_DISCOUNT | Award.type: CODE, PROMOTION (ITEM later if used) | Yes |
| C20 | `PlacedOrder` (3450), `/v1/orders/{id}/place` (575) | `orderId`, `posCheckNumber`, `waitTime`, `status` | SubmitOrderResponse: `number`, `customerCheckNumber`, `status`, `waitTime`, `businessDate`, `displayText`, `text`, `orderType`, `fiscalQrCodeData`, `fiscalAccessKey`, totals | Yes |
| C21 | `OrderStatus` (3189) | 7 values | Keep. Add `PAID_POS_ERROR` (plan-next G-T6, phase 4). | No (additive) |
| C22 | `KitchenOrder` and its lines (3478, 3516) | `lines` with `options`, `posCheckNumber` | `modifiers`, `uniqueId`; `number` and `customerCheckNumber` (kitchen area owns the detail) | Yes |

### E. Ids, time and errors

| # | Contract place | Today (0.2.0) | Change to v2 | Breaking |
|:--|:--|:--|:--|:--|
| C23 | Ids (intro, README rules) | Opaque strings | Keep strings for every entity id, including `orderId` (decision 7A). Line-level `uniqueId`, `parentId`, `position` are integers, as in v2. v2's integer `orderId` example is not copied. | No |
| C24 | Timestamps (intro, README rules) | UTC everywhere | Pending Q5. Under A: Core converts v2 local fields (`dateCreated`, `pickupTime`) at its edge. | Depends on Q5 |
| C25 | `LocalTime` (2344), `Weekday` (2341), `ServiceAvailability` | `HH:mm`, MON..SUN | Store hours: day 1 Sunday to 7 Saturday, `HH:mm:ss.SSS`, flags pickup, delivery, seat, opening. Menu section hours (menu area): day names MONDAY..., `HH:mm:ss`. | Yes |
| C26 | `ProblemCode` (2277) | 22 codes | Add TABLE_NOT_FOUND, CHECK_NOT_FOUND, CHECK_NOT_OPEN, TENDER_NOT_AVAILABLE, PAYMENT_EXCEEDS_TOTAL, INVALID_DOCUMENT_NUMBER, AWARD_NOT_APPLICABLE, DISCOUNT_EXCEEDS_BASKET | No (additive) |

### F. Core operations that replace POS endpoints (not POS; decision 2)

| # | Contract place | Today (0.2.0) | Change to v2 | Breaking |
|:--|:--|:--|:--|:--|
| C27 | New | None | `GET /v1/tenders` (replaces pos-data) | No (additive) |
| C28 | New | None | Read an open check by table; list open checks; pay a check; validate a table | No (additive) |
| C29 | New | None | Call waiter, request bill (only if Q8 = A or B) | No (additive) |

### G. Fiscal (phase 4)

| # | Contract place | Today (0.2.0) | Change to v2 | Breaking |
|:--|:--|:--|:--|:--|
| C30 | `FiscalFields` (3917) | ncm, cfop, taxes (string map) | Per-item fields on OrderItem (P37). Seller fields on store config (P36). | No (phase 4) |
| C31 | `Order.cpfCnpj` (3214, 3252), `CreateOrderRequest.cpfCnpj` | Digits only, pattern 11 or 14 digits | `invoiceCpfCnpj`; add check digits in validation | Yes (rename) |

### H. Contract documents

| # | Place | Change |
|:--|:--|:--|
| C32 | `contract/README.md`, rules table | "Money: integer cents" and "Names", "Time", "IDs" lines to the v2 rules above |
| C33 | `info.version` | Breaking rename: bump per the README rule (major for breaking changes). Partner approves first. |
| C34 | Still open in the contract README | Price changed during a journey (keep quote or re-quote), and device pairing (also Q10). Not decided here. |

---

## Open questions for Kai

Only what the decisions do not settle. Each has a ⭐ pick.

**Q1. Rounding of tax and discount per line**
- Evidence: the reference stores percentages with 4-decimal rounding and tax fields with 6 (D13 shared-interactions); the contract says six places for tax rates (D10 CFG-421); the v2 example shows four decimals on line amounts.
- A) Round each line to cents (half up), then sum. ⭐ Usual for fiscal receipts; the accountant confirms.
- B) Round only the order total. Simpler, but line items can differ from the total by R$ 0,01.

**Q2. Which order types get the service charge (10%)**
- A) Dine-in and table orders only. ⭐ Usual "taxa de serviço" in Brazil.
- B) All order types.
- C) None in the pilot (plan decision 16 said no fee).

**Q3. Do menu prices include tax**
- A) Yes: the price shown is the price paid. ⭐ Matches the contract (`taxInclusive: true`).
- B) No: tax is added on top (v2 default when prices exclude tax).

**Q4. When the order number restarts**
- A) Every business day. ⭐ Matches the contract rule.
- B) Never; a counter that keeps going.

**Q5. Timestamps in the Core**
- A) UTC in the Core and API; v2 local fields converted at the Core edge. ⭐ Matches the contract.
- B) Keep v2 local date-times as they are; mixed time zones.

**Q6. Tenders in the pilot**
- A) Cash, credit, debit. ⭐
- B) Same plus PIX as a tender (the contract has PIX).
- C) Credit and debit only; no cash.

**Q7. Cash change**
- A) Record amount received and change on the payment. ⭐
- B) Record the exact amount only; change is given by staff and not stored.

**Q8. Guest calls a waiter or asks for the bill (kiosk or QR menu)**
- A) Both, stored on the check. ⭐
- B) Call waiter only.
- C) Neither in the MVP.

**Q9. How waiters sign in**
- A) 4-digit PIN per waiter. ⭐ Use the D8 PIN rules: no repeated or sequential digits. (The restricted-item approval PIN, D8 CFG-015 and JOURNEY-023, is staff age approval: CUT, rule 10.)
- B) Email and password per waiter.
- C) One shared login per tablet.

**Q10. Device pairing and secret**
- A) One-time code created in Aparelhos, typed on the device. ⭐
- B) Secret shown once in Aparelhos, typed on the device.
- C) Secret preloaded in the device image (nothing typed).

**Q11. Retry intervals**
- A) Config load every 5 s; offline screen every 10 s. ⭐ Keeps both documented rules.
- B) 10 s for both.
- C) 5 s for both.

**Q12. Cancelling a paid order**
- A) Owner cancels in the back office; the refund happens at the card terminal or bank, not in Comanda. ⭐ MVP.
- B) Owner cancels and Comanda records a refund.
- C) No cancel after payment.

**Q13. Who issues the NFC-e (phase 4)**
- A) An NFC-e provider issues it; the Core stores the key and the QR. ⭐
- B) Comanda builds the fiscal document itself.
- C) Defer: sell without NFC-e until the accountant confirms.

**Q14. Promotion rules in the MVP**
- A) Full set: minimum basket, dates, cap, max uses, tender eligibility. ⭐
- B) Minimum basket and dates only.
- C) Fixed-value codes only.

**Q15. Tips and donations on the kiosk**
- A) Not in the pilot. Fields stay in the model; staff add them at the check. ⭐
- B) Kiosk offers tip and donation.
- C) Donation only.

---

## Spec contradictions and defects not to copy

**Money and numbers**
- B1 ORD-WIRE: order example uses integer cents and GBP. Use decimal BRL (decision 1).
- MODELS 8.2 example: four-decimal amounts (`0.9500`). Settled by Q1.
- D8 BR-060: the integer sanitizer strips non-digits. It must not be used for money.

**Timeouts and retries**
- B1 BR-XC-04: 60 s on every client. Replace with 5 s reads and 15 s for orders (P79).
- B1 BR-ORD-04: after 3 polls of 5 s, reports failure even if the order exists. Use the unknown-result rule (P81).
- B1 VAL-ERR-NET: connect failure gives 500 on one screen, 502 on another, and success false on a third. One rule only (P75).

**Errors and responses**
- B1 BR-PAY-01, PAY-ENV: HTTP 200 with `isSuccess` and `errorCode` in the body. Use HTTP status plus problem+json.
- B1 VAL-FWBODY: framework error body with timestamp, path and trace. Never expose it.
- B1 DM-ORD-01, DT-ORD-01: malformed JSON becomes null silently. Return 400.
- B1 FR-ORD-004, ORD-ENC: form-encoded posts with JSON inside text fields. Use JSON.

**Fail-open and offline**
- B1 BG-BKG-07: maintenance check treats an unreachable upstream as live. Fail closed (P96).
- B1 BG-BKG-09, DM-ORD-02: offline order replay. Out of MVP (P97).
- B1 BR-ORD-02: local order id is the 32-bit hashCode of the nonce; collisions share a record. The Core issues ids.

**Totals source**
- B1 BR-ORD-05/06, FR-ORD-006..008: POS or local calculator totals. Only the Core prices (P19).

**Screens and times**
- B1 BR-SES-04: the close minute counts as open. Windows end-exclusive (P99).
- K1 BR-KIOSK-03 vs K2 UJ-KIOSK-01: missing default language → en-gb fallback (K1) or maintenance screen (K2). The two contradict. Decide before the kiosk boots without a language.
- K2 ENT-KIOSK-01 vs D12: idle timeout in milliseconds on one, seconds on the other. Use milliseconds (contract).

**Saved state**
- D12 FEAT-085/086, D8 BR-054: "saved" shown without a network confirmation. Show saved only after the Core answers 200.

**Concurrency**
- KDS1 BR-014, RT-CONFLICT, ER-RACE: "last write wins" and events merged without a version guard. Use `version` and `expectedVersion` (P102).
- KDS1 README-GAP-5: analytics event fires with no UI behind it. Not copied.

**Labels and names**
- D1 FR-190: row labelled "Calories" is really the modifier behaviour (`modifierType`).
- D1 FR-210: row labelled "SKU" is really a tax group reference.

**MODELS.md internal inconsistencies (for the Go side)**
- Ids: rule 2.5 and the partner answer say strings, but `orderId` (8.11) and `uniqueId` (8.2) are integers. Settled by C23.
- Store hours (9.10) use day numbers and `HH:mm:ss.SSS`; menu section hours (5.8) use day names and `HH:mm:ss`. Keep both as written; do not merge.
- `ServiceCharge.type` is free text ("SERVICE" in the example). Keep free text.

---

## Coverage

Rows checked for the platform area, per inventory file, split by the reader's original tag. Every row in this list was mapped to a feature row above (section 16 or the earlier sections). Counts are rows, not ranges: a range id such as CFG-564..584 counts as its rows in the reader's file.

| File | CUT | EXT | HW | POS | Total checked | Required by coordinator |
|:--|--:|--:|--:|--:|--:|:--|
| B1 | 4 | 2 | 73 | 5 | 84 | Yes |
| K2 | 33 | 20 | 35 | 0 | 88 | Yes |
| D6 | 0 | 3 | 0 | 0 | 3 | Yes |
| D8 | 163 | 40 | 0 | 0 | 203 | Yes (incl. 40 EXT) |
| KDS1 | 9 | 10 | 0 | 0 | 19 | Yes |
| D1 | 1 | 0 | 0 | 0 | 1 | Extra |
| D2 | 9 | 14 | 0 | 0 | 23 | Extra |
| D3 | 0 | 0 | 0 | 0 | 0 | Extra (no tagged rows) |
| D4 | 5 | 9 | 0 | 0 | 14 | Extra |
| D5 | 0 | 2 | 0 | 0 | 2 | Extra |
| D7 | 1 | 9 | 0 | 0 | 10 | Extra |
| D9 | 14 | 1 | 0 | 25 | 40 | Extra |
| D10 | 0 | 0 | 0 | 0 | 0 | Extra (no platform rows) |
| D11 | 0 | 0 | 0 | 0 | 0 | Extra (no tagged rows) |
| D12 | 2 | 0 | 0 | 1 | 3 | Extra |
| D13 | 2 | 4 | 0 | 0 | 6 | Extra |
| K1 | 2 | 1 | 6 | 0 | 9 | Extra |

**Where the mapping went**

| Source group | Mapped to |
|:--|:--|
| Kiosk journey events (K2 FR-236, OP-START, OP-KIOSK-01/02) | P126 |
| Kiosk messages (D8 warnings) | P127 (IN) |
| Senior discount (K2 FR-718) | P128 (IN) |
| Donation (K2 FR-840) | P18 (IN) and P159 |
| Card processor screens | P129 (OUT) |
| Product feedback | P130 (?) |
| Email layout and banners | P131 (CUT) |
| Visual style and template | P132 (CUT) |
| Owner email recipients | P133 (?) |
| Activity feed | P134 (?) |
| Application messages, order message templates | P135, P136 (?) |
| Legal, consent, SaaS billing | P137, P138 (OUT) |
| Federated sign-in, invitation, identity migration | P139 (?) |
| Restricted-item PIN | P140 (CUT) |
| Loyalty | P141 (CUT) |
| Multi-store and organization context | P142 (CUT) |
| POS sync and POS import | P143 (OUT) |
| Publish job log | P144 (?) |
| CSV import | P145 (?) |
| Remote modules | P146 (?) |
| Cut-feature analytics, reorder, accessibility, age verification | P147, P148, P149, P150 |
| Printing | P151 (HW-LATER) |
| Board, ATP, terminals, admin gesture | P152 (HW-LATER) |
| Scanners | P153 (HW-LATER) |
| In-store POS and POS health | P154 (OUT) |
| Reference plumbing and identity file | P155 (OUT) |
| Table-bill custom fields | P156 (?) |
| Vendor payments (gift card, room charge, face-ID, crypto, app gateway) | P157 (OUT) |
| Cash machine | P158 (HW-LATER) |
| Help request analytics | P160 (?) |

**Verdict changes from the reader's tag (the rows that moved):**
- CUT → IN: warning messages as kiosk messages (P127); senior discount (P128).
- CUT → OUT: legal and consent documents (P137); SaaS billing (P138); repeat order (P148); POS consent (P137).
- CUT → "?": activity feed, owner recipients, application messages, order message templates, product feedback, custom table-bill fields.
- CUT stays CUT (brief rules 10): visual style and template (P132), email banners (P131), loyalty (P141), multi-store (P142), restricted-item PIN (P140), accessibility (P149), age verification (P150).
- EXT → OUT: card processor screens (P129), vendor payments (P157), POS and processor widgets.
- EXT → "?": analytics and error tracking (P108), federated sign-in (P139), remote modules (P146), product feedback (P130).
- HW → HW-LATER: printing, board, scanners, cash machine (P151, P152, P153, P158).
- HW → OUT: reference plumbing (P155), in-store POS (P154).
- POS → OUT: POS sync and import (P143), POS health (P154), POS consent (P137).

**Counts after this pass:** see Summary.

## Verification

Read in full: MODELS.md sections 2, 8 and 9 (lines 48 to 103, 1401 to 2313). Contract README (164 lines). Contract `openapi.yaml`: paths list, device, order, payment and problem schemas, money references (grep). Plan-next rules for platform (lines 85 to 125).
Inventory rows: all 918 rows with Area = platform, from the 16 inventory files. Second pass (coordinator request): every CUT, EXT, HW and POS platform row of B1, K2, D6, D8 (including the 40 EXT rows), KDS1, and the tagged rows of the other files, mapped in section 16 and the Coverage table. D8 CUT rows and the K2 analytics events were mapped by id range, not each row alone, because they repeat one pattern per group. Read in full: every IN and ? row from B1, K2, KDS1, D1, D2, D3, D4, D5, D6, D7, D9, D11, D12, D13, K1, and the non-EXT rows of D8 (through JOURNEY-096). Read as summaries: CUT, HW and POS rows. Not printed: the 40 D8 EXT rows, beyond the summary of their journeys. A keyword pass over the other rows covered money, tax, fiscal, idempotency, timeouts, cache, offline, heartbeat, check, table and waiter.
Not verified: the catalogue-only D6 rows (API-080..083, API-311/312, API-326..328) are "?" and need the spec files to classify. The Comanda column uses contract 0.2.0 and plan-next; the Go side is not built, so "HAS" means "in the contract".
Nothing was run or tested: this is a reading of specs and contract, not a build.
