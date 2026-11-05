# Prototype — "Café e trigo"

Approved visual design for the kiosk, 12 screens. `screens/` has a PNG of each; `source/` has the
design-tool source (`.dc.html`) for exact sizes, spacing and copy. The source files need the
design tool's runtime to render, so read them as reference, do not run them.

Interactive version (for people, not agents): https://claude.ai/artifact/FRBZKfuwy1FeUKVXZeeG2G

Canvas size: 720 × 1280. Real screen: 1080 × 1920, so **× 1.5** on every size.

## Full canvas: every screen in one place (5 Nov 2026)

"Comanda · protótipo completo": https://claude.ai/artifact/TgppHzaABZnDLkyEVFsocF (shared by link).
Sources in `full/project/` (70 artboards + `canvas.json`), the same files the canvas serves. It holds:

| Row | Artboards | Size | Status |
|:--|:--|:--|:--|
| Kiosk | 01–12 (`Main` … `Idle`) | 720 × 1280 | ✅ approved (30 Oct) |
| Kiosk, new | T1–T4 | 720 × 1280 | proposal |
| Kitchen | K1–K5 | 1280 × 800 | proposal |
| Back office, desktop | A1–A14 | page, 1440 wide | proposal |
| Back office, phone | M1–M14 + M0 (Mais, the phone menu) | 390 × 844 | proposal |
| Waiter app | G1–G8 (login, tables, table check, add items, item, send, close check, paid) | 390 × 844 | proposal, outside the MVP |
| Guest app by table QR code | Q1–Q9 (table, menu, item, combo, order, tracking, check, Pix, paid) | 390 × 844 | proposal, outside the MVP |

- A desktop screen and its phone version share the number: `A2-Pedidos` ↔ `M2-Pedidos`.
- A10–A14 / M10–M14 are the menu entries that had no drawing: Cardápios, Categorias, Selos e
  sugestões, Aparelhos, Loja e conta.
- The waiter and guest apps follow the POS integration models (`MODELS.md` from the partner side):
  one open check per table (`openCheck`), orders as `DINEIN` rounds, paying the check at the table
  (`PAY_AT_TABLE`), optional 10% service charge, sizes, removable ingredients (`INGR`), combos and
  swap-sell upgrades. Both use the same Mesa 12 data (R$ 95,60 + 10% = R$ 105,16). Split bill and
  tips stay out, as in the MVP scope.
- Still open and marked on the screens: waiter login (G1) and device pairing (A13/M13).
- `kioskNew`, kitchen and back office rows are copies of `ops/project/` with the image ids remapped;
  the kiosk row is `source/` with the image ids remapped. Images are uploads of that canvas
  (`/_blob/<id>`); the same photos are in `assets/`.
- Like `source/`, these files need the design tool's runtime: read them as reference, do not run them.

## Colour tokens

Only the `padaria` theme in the sources is current. `tomate`, `verde` and `acafrao` are old
explorations: ignore them.

| Token | Hex | Use |
|:--|:--|:--|
| `ground` | `#F3EFE8` | Page background |
| `surface` | `#FFFFFF` | Cards, chips, inputs |
| `ink` | `#2B211C` | Text, espresso buttons (cancel and error screens) |
| `muted` | `#625750` | Secondary text |
| `line` | `#E5DDD2` | Dividers |
| `accent` | `#4E3426` | Primary buttons, selected states, payment screen background |
| `onAccent` | `#FAF6F0` | Text on accent |
| `onAccentMuted` | `#D9C8B8` | Secondary text on accent |
| `detail` | `#B07A3A` | Wheat-gold details, badges, progress |
| `detailLight` | `#D8B98A` | Icons and details on the cocoa background |
| `detailText` | `#8A5A2B` | Links and small emphasis |
| `price` | `#6B4430` | Prices in the menu |
| `danger` | `#A3472F` | Cancel order, payment failed |
| `wheat` | `#EAD9C6` | Pastel tint: selected chips, item hero |
| `butter` | `#EFE4C9` | Pastel tint: "Pães", "Para viagem" card, CPF row |
| `sage` | `#DCDFD2` | Pastel tint: "Salgados", debit chip |
| `oat` | `#E2DED8` | Pastel tint: "Sanduíches" |
| `imageBg` | `#E9E2D7` | Image placeholder |

## Type

- **Fraunces** 600 for titles and big numbers (50–100 px on the canvas), italic 500 for the brand name.
- **Manrope** 500–800 for everything else (17–28 px on the canvas).
- Primary buttons: full width, 108 px tall, fully rounded. Cards: 28–36 px corner radius.

## Screens

| # | File | What it shows |
|:--|:--|:--|
| 1 | `01-Main.png` | Attract screen: full-bleed bakery photo, "Fornada fresca, sem fila.", tap to start |
| 2 | `02-OrderType.png` | Eat here (cocoa card) or take away (butter card) |
| 3 | `03-Menu.png` | Category rail on the left, 2-column item grid, basket bar with total |
| 4 | `04-Item.png` | Croque monsieur: required choice (bread), add-ons up to 3, quantity, add button with live total |
| 5 | `05-Cart.png` | Lines with edit, remove and quantity; optional CPF; total; choose payment |
| 6 | `06-Payment.png` | Pix, credit, debit; cash goes to the counter |
| 7 | `07-Authorizing.png` | Cocoa full screen with the terminal drawing; cancel and choose another method |
| 8 | `08-Success.png` | Big order number "42"; back to start in 15 s |
| 9 | `09-Cpf.png` | CPF/CNPJ keypad with mask, skip or confirm |
| 10 | `10-Cancel.png` | Cancel order dialog |
| 11 | `11-PaymentError.png` | Payment refused, nothing charged, retry or change method |
| 12 | `12-Idle.png` | "Ainda está aí?" with a 20 s countdown ring |

Example basket used everywhere: Croque monsieur (brioche, ovo pochê) R$ 40,90 + Cappuccino
R$ 13,90 + Fermentação natural (inteiro, fatiado) R$ 28,00 = **R$ 82,80**. The contract's
examples use the same data, so the Prism mock matches the screens.

## Differences from the plan, already decided

- **Success screen**: the line "Imprimindo o comprovante e a nota fiscal" applies from phase 4.
  Before that there is no printer; show only the number.
- **Authorizing screen**: shows a card terminal. Until phase 4 the payment is simulated.

## Second canvas: what is left (proposal, 4 Nov 2026)

Kitchen screen, back office and the kiosk screens added by the gap plan are drawn in a second
canvas, **pending Kai's approval**: https://claude.ai/artifact/NARUZVhf5tz1Xe4vexq344.
Sources in `ops/project/`; the gaps behind each artboard are in `../plan-next.md`. This approved
canvas was not changed.

Work screens (kitchen and back office) keep the café colour tokens above but use a sans-serif
type system (Kai, 4 Nov 2026, after comparing a grey, a green and a blue palette): Manrope carries
every heading and number, with tabular figures and smaller title sizes (page titles 28 px);
Fraunces stays only in the "Comanda" wordmark. The back office has an icon sidebar with the active
item in `accent`, sentence-case group labels and smaller corner radii (cards 14 px, controls
10 px). The kiosk screens, and kiosk previews inside the back office, keep Fraunces. The back office
already built in `apps/web` still uses Fraunces headings and must be brought in line.

## Screens not drawn yet

The kitchen screen, the whole back office (desktop and phone) and the two table apps are in the
full canvas above. Still without a drawing (built in code from these tokens):
- Language selector (PT/EN) on the kiosk attract screen (the guest QR app has one on Q1).
- Coupon entry and the "replace current coupon?" warning (SCR-DISC-05).
- Lane Closed ("Fechado agora, voltamos às 06:00") from `closedMessage` and `nextOpeningAt`
  (T4 covers only the special-date variant).
- "Temporarily offline" screen.

## Photos

`assets/` holds the photos used in the prototype (Unsplash). They are placeholders until the
bakery sends its own.
