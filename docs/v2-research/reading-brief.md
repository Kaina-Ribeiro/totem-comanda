# Reading brief: full byte-by-byte read of the reference specs

You are one of 17 readers. Each reader gets a chunk of the reference functional specs and must read
**every line of every file in its chunk, to the last line**, then write an inventory file.

## Context (decided by Kai, 5 Nov 2026; do not revisit)

Comanda is a self-service ordering product: kiosk (totem), kitchen screen (KDS) and back office,
built as Next.js front end + BFF, against a stateful mock of the Core API. A partner builds the Go
Core API later. Repo: `C:\Users\gabri\Documents\projects\comanda`.

New direction:
1. **All data models follow `C:\Users\gabri\Desktop\totem\MODELS.md` (the "v2" models) to the letter**:
   menu graph (CATEGORY, ITEM, SIZED_ITEM, MODIFIERS with modifierType MODI/SIZE/INGR/SURC/INGM,
   nested modifiers, COMBO_MEAL/COMBO_MAIN/COMBO_SIDE, IMAGE, TAX groups with per-channel rates,
   SWAP_SELL, section availableHours, allergens list, per-order-type price overrides and flags,
   ageRestriction, alcoholic, calories, barcodes, internalName, plu), OrderItem (uniqueId/parentId/
   position, line taxes and discounts, specialNotes), OrderType (DINEIN, TAKE_OUT, PICKUP, DELIVERY,
   PAY_AT_TABLE, DRIVE_THRU, DELIVEROO), Payment (tenderId, tipAmount, donationAmount, card fields,
   collectPaymentOnDelivery), Customer, Address, Discount, Award (CODE, PROMOTION, ITEM; loyalty is cut),
   ServiceCharge, Tax, totals, IPosCheck (open check / bill, employeeId, guestCount), table validation,
   store configuration (hours per pickup/delivery/seat, liveFlag, deliveryCharge), dateToFire/pickupTime,
   invoiceCpfCnpj, fiscal fields. Money is a decimal in the main currency unit (BRL), not cents.
2. **Comanda does NOT play the POS-integration role for now**: no `/internal/v2/*` endpoints, no
   per-venue `config`, no init/destroy, pos-health, raw-menu, pos-data, no menu sync/import from a POS.
3. **New features: tables, open checks (bills) and waiters.** The reference barely covers them, so
   flag every line that touches seats, tables, checks/bills/tabs, waiters/staff/clerks, guest count,
   service charge, request bill, call waiter, pay at table.
4. **Everything the v2 models can express is in scope**, including what an older plan cut: all order
   types, delivery with address and delivery charge, scheduled orders, tips, donations, service
   charges, codes and promotions.
5. **Still cut (the original brief):** more than one visual template / multi-brand; more than one
   restaurant (multi-store, store groups); loyalty (points, stamps, loyalty providers, loyalty awards,
   external loyalty ids); Scan-and-Go and staff age approval; split bill (one order paid with several
   payments); guest walks away; accessibility mode.
6. Work now is front end + BFF + mock only. Hardware (payment terminal, printers, scanners, PED,
   cash machines, the board itself) is a later phase.

## How to read

- Use the Read tool with `offset`/`limit` and continue until the reported end of the file. Do not
  skip, skim or sample. Do not rely on grep to decide what to read.
- Lines longer than ~2000 characters may be cut by Read: when a line looks cut, print it in full with
  Bash (`sed -n '<N>p' <file> | fold -w 400`).
- Boilerplate (repeated template text such as "Empty/reset/persistence" or "Acceptance" blocks) must
  still be read. Record it once as a pattern row, then record every line that differs from it.
- Read first, quickly: `C:\Users\gabri\Documents\projects\comanda\docs\plan-next.md` (what Comanda
  already has in v0.2, its gaps and its cut list) so you can fill the Comanda column. Do not read the
  Comanda code.

## Output

Write ONE file: the path given in your prompt. Format:

```
# Inventory <chunk id>

## Coverage
| File | Lines read | Total lines |
(one row per file; "Lines read" must reach the total)

## Items
| Ref | Where | What (one line, concrete) | v2 model | Area | Scope | T | Comanda |
```

Column rules:
- **Ref**: the spec's own id (FEAT-, FR-, BR-, SCR-, CFG-, DM-, EP-, UJ-, PERM-, …) or the heading when
  there is no id. One row per distinct behaviour, rule, field, screen, endpoint, validation or
  message. Merge rows only when they describe the exact same thing.
- **Where**: `file:line` (or `file:start-end`), path relative to the spec root folder.
- **What**: the concrete behaviour, limit, default, copy text or rule. Keep numbers, enum values,
  defaults and exact UI strings; they matter.
- **v2 model**: the MODELS.md entity/field it maps to (e.g. `ITEM.dineInPriceOverride`,
  `OrderItem.specialNotes`, `IPosCheck.guestCount`, `Payment.tipAmount`), or `—` when none.
- **Area**: kiosk | kitchen | backoffice | waiter | bff | platform (cross-cutting).
- **Scope**: `IN` (in scope under the rules above) · `CUT` (matches a cut in rule 5; name which) ·
  `POS` (POS-integration role, rule 2) · `HW` (hardware or local-service/Electron specifics, rule 6) ·
  `EXT` (a third-party provider integration: payment gateway, gift card, crypto, face-ID, SMS/email
  vendor, maps, analytics, SSO…) · `?` (unsure; say why in What).
- **T**: `Y` when it touches tables / checks / waiters (rule 3), else blank.
- **Comanda**: `HAS` / `PART` / `NO` / `?` per plan-next.md.

Then, after the table:

```
## Notes
- Contradictions inside the chunk, Unknowns the spec admits, anything a v2 model cannot express.
```

## Reply to the coordinator

Reply in at most 5 lines: the output path, the coverage (every file read to its last line: yes/no),
the number of item rows, and the 3 most important findings for table/check/waiter or for the v2
models. Do not paste the inventory.
