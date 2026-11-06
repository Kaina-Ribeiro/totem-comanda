# POS Integration Models

This document explains every data model in the `lib-pos-integration` library. For each model it
gives the purpose, the meaning of every field, the rules a valid payload must follow, and a full
JSON example. Someone who has never seen the code should be able to build a service that produces
and reads these payloads correctly.

The most important part is the **menu model** (section 5). It is a graph, not a simple tree, so
read sections 5.1 to 5.4 before you build a menu.

## Contents

1. [Who calls whom](#1-who-calls-whom)
2. [General rules](#2-general-rules)
3. [Endpoints and the models they use](#3-endpoints-and-the-models-they-use)
4. [Request envelope: `config`](#4-request-envelope-config)
5. [Menu model](#5-menu-model)
6. [Light menu (menu state)](#6-light-menu-menu-state)
7. [Raw menu](#7-raw-menu)
8. [Order and request models](#8-order-and-request-models)
9. [Response models](#9-response-models)
10. [Checklist](#10-checklist)

---

## 1. Who calls whom

There are two parties:

- **The platform**: the ordering system (web, app and kiosk ordering). It sends requests.
- **The POS integration**: a small HTTP service that you build for one POS (point of sale)
  system. It receives the requests, talks to the POS in the POS's own language, and answers using
  the models in this document.

```
 Ordering platform  --->  POS integration (you build this)  --->  POS system
                    <---  answers with these models         <---
```

The library defines the endpoints (as Java interfaces called `...ControllerContract`) and the
models (Java classes and interfaces). Model names in this document use the Java names, for example
`IPosEntityItem`. The names that start with `I` are interfaces: the library only lists their
getters, and each POS integration provides its own class that implements them. The JSON field
names come from those getters (see 2.2).

---

## 2. General rules

### 2.1 Transport

- Every endpoint is an HTTP `POST` with a JSON body and `Content-Type: application/json`.
- Every response body is JSON, except where this document says otherwise.

### 2.2 Field names

- Field names are **camelCase** and must match this document exactly. They are case-sensitive.
- For interfaces, the JSON name comes from the getter: `getPlu()` becomes `plu`, and
  `isAvailable()` becomes `available`. So the JSON uses `available` and `alcoholic`, not
  `isAvailable` or `isAlcoholic`.
- Watch the spelling of `dineinFlag` and `takeoutFlag` (lower-case `i` and `o`). They come from
  `getDineinFlag()` and `getTakeoutFlag()`. By contrast, the price fields are `dineInPriceOverride`
  and `takeOutPriceOverride` (upper-case `I` and `O`).
- A small number of response fields keep an `is` prefix because the getter is named that way:
  `isOpenedByPosEmployee` and `isExternal`.

### 2.3 Values

| Kind of value | Format | Example |
|:--|:--|:--|
| Money (prices, totals, amounts, discounts, tips) | JSON number in the **main currency unit**, with decimals. It is never in cents. | `9.50` means nine and a half (for example GBP 9.50) |
| Tax rate | JSON number written as a **fraction**, not a percentage | `0.20` means 20% |
| Discount rate | JSON number written as a fraction | `0.10` means 10% off |
| Flags (`deliveryFlag`, `liveFlag`, `pickup`, ...) | Integer `1` (yes) or `0` (no) | `1` |
| Booleans | `true` or `false` | `true` |
| Enums | Upper-case string, exactly as listed | `"MODIFIERS"` |
| Ids | String, even when the value looks like a number | `"1001"` |
| Local time of day (menu section hours) | `"HH:mm:ss"`, 24-hour clock. `"HH:mm"` is also accepted when reading | `"11:30:00"` |
| Local date and time (no time zone) | ISO-8601 `"yyyy-MM-ddTHH:mm:ss"`. A fraction of a second may follow | `"2026-11-05T18:30:00"` |

Java tip: Spring Boot already writes times and dates as text. If you build your own Jackson
`ObjectMapper`, turn off `SerializationFeature.WRITE_DATES_AS_TIMESTAMPS`. If you leave it on,
times are written as number arrays such as `[11,0]` instead of `"11:00:00"`.

### 2.4 Optional fields

- An optional field can be left out or sent as `null`. Both mean "not provided".
- A few fields treat "not provided" and "empty" differently, and this document says so where it
  matters (for example `barcodes` and `posMetadata`).
- Lists that the reader walks through, such as `links` and `root`, must be sent as `[]` when
  empty. Never send them as `null`.
- **Ignore unknown fields.** The platform may add fields to requests over time. A POS integration
  must not fail when a request has a field it does not know.

### 2.5 Ids and the `::` sequence

Never put the two-character sequence `::` inside any id. The platform uses `::` internally to join
a modifier group id and an option id (`<groupId>::<optionId>`), and splits on it when it sends
orders back to the POS.

---

## 3. Endpoints and the models they use

The POS integration exposes these endpoints. All paths start with `/internal/v2`.

| Endpoint | What it does | Request model | Response model |
|:--|:--|:--|:--|
| `POST /internal/v2/menu` | Returns the full menu | `GetMenuRequest` (5) | `IMenuResponse` (5) |
| `POST /internal/v2/menu-state` | Returns current prices and availability only | `GetMenuRequest` | `ILightMenuResponse` (6) |
| `POST /internal/v2/raw-menu` | Returns the POS menu in the POS's own format (optional) | `GetMenuRequest` | Any JSON, or HTTP 501 (7) |
| `POST /internal/v2/totals` | Prices a basket without placing the order | `TotalsRequest` (8.11) | `ITotalsResponse` (9.4) |
| `POST /internal/v2/order` | Places (injects) the order in the POS | `SubmitOrderRequest` (8.12) | `ISubmitOrderResponse` (9.5) |
| `POST /internal/v2/check` | Returns one open check (bill) | `GetCheckRequest` (8.14) | `IPosCheck` (9.7) |
| `POST /internal/v2/checks` | Returns a list of open checks | `GetCheckRequest` | List of `IPosCheck` |
| `POST /internal/v2/check/pay` | Pays a check | `PayCheckRequest` (8.14) | `IPosCheck` |
| `POST /internal/v2/discount/apply` | Applies discounts, codes or loyalty awards | `DiscountRequest` (8.13) | `IDiscountResponse` (9.8) |
| `POST /internal/v2/discount/cancel` | Removes discounts | `DiscountRequest` | Empty body |
| `POST /internal/v2/pos-health` | Says whether the POS can be reached | `PosHealthRequest` (8.16) | Health (9.12) |
| `POST /internal/v2/init` | Registers a venue with the POS (for example webhooks) | `RegistrationRequest` (8.16) | `IRegistrationResponse` (9.9) |
| `POST /internal/v2/destroy` | Removes that registration | `RegistrationRequest` | `IRegistrationResponse` |
| `POST /internal/v2/store-configuration` | Returns store details and opening hours | `PosRequest` (4) | `IStoreConfigurationResponse` (9.10) |
| `POST /internal/v2/table/validate` | Checks that a table number exists | `ValidateTableRequest` (8.15) | Defined by the integration (9.13) |
| `POST /internal/v2/pos-data` | Returns any extra POS data as key/value pairs | `PosDataRequest` (8.17) | `IPosDataResponse` (9.11) |

A POS integration only needs to implement the endpoints its POS supports.

---

## 4. Request envelope: `config`

Every request model extends `PosRequest`. `PosRequest` has one field, `config`.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `config` | object | Yes | Settings for one venue in one POS: addresses, store or location ids, credentials, mappings. Its content is defined by **each POS integration**, not by this library. The platform stores it per venue and sends it unchanged on every call. |

`config` usually contains secrets. Never write it to logs.

**Example: `PosRequest`** (also the body of `store-configuration`). The fields inside `config` are
only an illustration.

```json
{
  "config": {
    "baseUrl": "https://pos.example.com/api",
    "locationId": "17",
    "username": "integration-user",
    "password": "<secret>",
    "timezone": "Europe/London",
    "orderTypes": {
      "DINEIN": "1",
      "TAKE_OUT": "2",
      "DELIVERY": "3"
    }
  }
}
```

`GetMenuRequest`, `GetCheckRequest` and `PosDataRequest` add no fields. Their body is exactly the
example above.

---

## 5. Menu model

### 5.1 The big picture

A menu is returned by `POST /internal/v2/menu` as an `IMenuResponse`. It has only two fields:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `root` | array of [Link](#56-link) | Yes | The entry points of the menu: usually the top-level sections, in display order. |
| `entities` | array of entities | Yes | **Every** entity of the menu, in one flat list: sections, items, modifier groups, combos, images, tax groups and swap sells. |

There is no nesting. A section does not contain its items, and an item does not contain its
modifier groups. Instead, each entity has a `links` list that **points** at other entities by
`type` and `id`. Think of `entities` as a box of cards, and `links` as arrows between the cards.

```
root ──> CATEGORY "Burgers" ──> ITEM "Classic Burger" ──> MODIFIERS "Extras" ──> ITEM "Cheese"
                            │                         ├─> IMAGE   "Classic Burger photo"
                            │                         └─> TAX     "Standard rate"
                            └─> CATEGORY "Veggie" ────> ITEM "Veggie Burger" ──> MODIFIERS "Extras" (same group, reused)
```

Why a graph? Because the same thing is often used in many places. One "Extras" modifier group can
belong to ten burgers. With links, it is written once and pointed at ten times.

### 5.2 Identity and links: the rules

1. **An entity is identified by its `type` and its `id` together.** Two entities of different
   types may share the same id. For example an `IMAGE` with id `"1001"` and an `ITEM` with id
   `"1001"` are different entities.
2. **Within one type, every id must be unique.** If two entities have the same type and id, one of
   them is lost.
3. **Every link must point at an entity that exists in `entities`**, with the same `type` and
   `id`. A link to a missing entity is skipped without an error, so that part of the menu silently
   disappears.
4. **Order matters.** Keep `root` and every `links` list in the order you want things shown. The
   platform uses the list order to number sections, images and modifier options.
5. **Reuse is allowed and encouraged.** The same item can be an option in several modifier groups,
   and the same modifier group can be linked from several items.
6. **Do not create loops.** For example, an option must not link back to the group it belongs to.
   The platform stops when it finds a loop, so the looping branch is dropped.
7. **The entity `id` is sent back in orders.** When a customer orders an item or an option, the
   order line (`OrderItem.id`, section 8.2) carries the same id that the menu used. Choose ids that
   your POS can recognise again.

### 5.3 Entity types

Every entity has a `type` field. Its value comes from the enum `PosEntityType`. The type decides
which fields the entity has (its "shape").

| `type` | Shape (Java interface) | What it is |
|:--|:--|:--|
| `CATEGORY` | Section (`IPosEntitySection`) | A menu section, such as "Burgers". It can contain sub-sections. |
| `ITEM` | Item (`IPosEntityItem`) | A product. The same shape is used for a product on the menu and for an option inside a modifier group. |
| `SIZED_ITEM` | Item (`IPosEntityItem`) | A product sold in sizes. Its sizes are `ITEM` links (see 5.10). |
| `MODIFIERS` | Modifier group (`IPosEntityModifier`) | A group of options for an item, such as "Choose a sauce". |
| `COMBO_MEAL` | Combo meal (`IPosEntityComboMeal`) | A meal deal. It is an item with one extra field, `comboMealId`. |
| `COMBO_MAIN` | Modifier group (`IPosEntityComboMain`) | The "main" choice of a combo meal, such as "Choose your burger". |
| `COMBO_SIDE` | Modifier group (`IPosEntityComboSide`) | A "side" choice of a combo meal, such as "Choose your drink". A combo can have several. |
| `IMAGE` | Image (`IPosEntityImage`) | A picture for a section, item or modifier group. |
| `TAX` | Tax group (`IPosEntityTaxGroup`) | A set of tax rates that applies to an item. |
| `SWAP_SELL` | Swap sell (`IPosEntitySwapSell`) | An upgrade offer: the customer can swap an item for another, for example a regular burger for a double. |
| `CROSS_SELLS` | Item shape | Defined in the enum. The platform reads it with the item shape, but does not follow `CROSS_SELLS` links when it builds the menu. See 5.18. |
| `INGREDIENTS` | None | Defined in the enum but has no shape of its own. Not used in menus. See 5.18. |
| `COMBO_ITEM` | None | Defined in the enum but has no shape of its own. Not used in menus. See 5.18. |

### 5.4 Linking rules

This table shows which links the platform follows for each kind of entity. Links that are not
listed are ignored.

| From | Link type | Meaning |
|:--|:--|:--|
| `root` | `CATEGORY` | A top-level section. |
| `root` | `ITEM`, `SIZED_ITEM`, `COMBO_MEAL` | A product that is not inside any section. This is allowed but rare. |
| `CATEGORY` | `CATEGORY` | A sub-section. Sections can be nested many levels deep. |
| `CATEGORY` | `ITEM`, `SIZED_ITEM`, `COMBO_MEAL` | A product shown in this section. |
| `CATEGORY` | `IMAGE` | Picture of the section. |
| `ITEM`, `SIZED_ITEM`, `COMBO_MEAL` (as a product) | `MODIFIERS` | A modifier group offered with the product. |
| `COMBO_MEAL` | `COMBO_MAIN`, `COMBO_SIDE` | The choices of the meal deal. |
| `ITEM`, `SIZED_ITEM`, `COMBO_MEAL` | `IMAGE` | Pictures of the product, in display order. |
| `ITEM`, `SIZED_ITEM`, `COMBO_MEAL` | `TAX` | The tax group of the product. **Only the first `TAX` link is used.** |
| `ITEM`, `SIZED_ITEM`, `COMBO_MEAL` | `SWAP_SELL` | An upgrade offer shown with the product. |
| `SIZED_ITEM` | `ITEM`, `SIZED_ITEM` | One size of the product (see 5.10). |
| `MODIFIERS`, `COMBO_MAIN`, `COMBO_SIDE` | `ITEM`, `SIZED_ITEM` | An option of the group. **A group with no option links is dropped.** |
| `MODIFIERS`, `COMBO_MAIN`, `COMBO_SIDE` | `IMAGE` | Picture of the group. |
| `ITEM` (as an option inside a group) | `MODIFIERS` | A nested modifier group. It opens when the customer picks this option. |
| `ITEM` (as an option) | `TAX` | Tax group of the option. Only the first is used. |
| `ITEM` (as an option) | `IMAGE` | Picture of the option. |
| `SWAP_SELL` | `ITEM`, `SIZED_ITEM` | A product the customer can swap to. **A swap sell with no item links is dropped.** |
| `TAX`, `IMAGE` | (none) | These are leaves. Send `"links": []`. |

The same `ITEM` entity can be used both as a product (linked from a section) and as an option
(linked from a modifier group). Its fields mean the same in both places, with one difference: the
choice fields `defaultQuantity`, `minChoices` and `maxChoices` only matter when the item is used as
an option.

### 5.5 Common entity fields (`IPosEntity`)

Every entity, of every type, has these fields.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The entity's id in the POS. Unique within its type. Must not contain `::`. Sent back in orders. |
| `name` | string | Yes | The name customers see. |
| `type` | string (enum) | Yes | One of the values in 5.3. It decides the shape of the rest of the entity. |
| `gfcId` | integer | No | Id of a shared "guest-facing content" record (translations, rich descriptions, pictures) that the platform may hold for this product. Leave it out unless the platform gave you such ids. |
| `links` | array of [Link](#56-link) | Yes | Arrows to other entities, following the rules in 5.4. Send `[]` when there are none. |
| `posMetadata` | object (string to string) | No | Extra POS-specific values, as text keys and text values. The platform stores them and does not interpret them. Leave the field out (or send `null`) to keep what is already stored. Send `{}` to delete what is stored. |

**Example: the common fields on their own** (a swap sell has no other fields, so it is shown here).

```json
{
  "id": "SS-1001",
  "name": "Upgrade your burger",
  "type": "SWAP_SELL",
  "gfcId": 52011,
  "links": [
    { "id": "1003", "type": "ITEM" }
  ],
  "posMetadata": {
    "upsellGroup": "BURGER-UPGRADES",
    "screen": "2"
  }
}
```

### 5.6 Link

A link (`PosEntityLink`) is an arrow to another entity. It is used in `root` and in every `links`
list.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The `id` of the target entity. |
| `type` | string (enum) | Yes | The `type` of the target entity. Together with `id` it finds exactly one entity. |

```json
{ "id": "M-EXTRAS", "type": "MODIFIERS" }
```

### 5.7 Section: `CATEGORY` (`IPosEntitySection`)

A section groups products, for example "Burgers" or "Drinks". It has the common fields plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `description` | string | No | Text shown under the section name. |
| `available` | boolean | No | `true` (the default) shows the section. `false` hides it. |
| `availableHours` | array of [Section hours](#58-section-hours-iposentitysectionhours) | No | When present, the section is only shown during these time windows (a "scheduled" section). When absent or empty, the section is always shown. |

Links: sub-sections (`CATEGORY`), products (`ITEM`, `SIZED_ITEM`, `COMBO_MEAL`) and pictures
(`IMAGE`).

```json
{
  "id": "100",
  "name": "Burgers",
  "type": "CATEGORY",
  "gfcId": 52001,
  "description": "Flame-grilled burgers served in a brioche bun",
  "available": true,
  "availableHours": [
    { "dayOfWeek": "MONDAY", "open": "11:00:00", "close": "22:00:00" },
    { "dayOfWeek": "SATURDAY", "open": "12:00:00", "close": "23:30:00" }
  ],
  "links": [
    { "id": "100", "type": "IMAGE" },
    { "id": "110", "type": "CATEGORY" },
    { "id": "1001", "type": "ITEM" }
  ],
  "posMetadata": {
    "posMenuGroup": "BURGERS"
  }
}
```

### 5.8 Section hours (`IPosEntitySectionHours`)

One time window in which a section is shown. It is not an entity: it only appears inside a
section's `availableHours`.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `dayOfWeek` | string (enum) | Yes | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY` or `SUNDAY`. |
| `open` | string (time) | Yes | Start of the window, local venue time, `"HH:mm:ss"`. |
| `close` | string (time) | Yes | End of the window, local venue time, `"HH:mm:ss"`. |

Use one object per day and window. To show a section on two separate windows on the same day,
send two objects for that day.

```json
{ "dayOfWeek": "FRIDAY", "open": "17:00:00", "close": "23:00:00" }
```

### 5.9 Item: `ITEM` (`IPosEntityItem`)

An item is a product. The same shape is used for:

- a product on the menu (linked from a section or from `root`),
- an option inside a modifier group (linked from `MODIFIERS`, `COMBO_MAIN` or `COMBO_SIDE`),
- a size of a sized item (linked from `SIZED_ITEM`),
- a product offered by a swap sell (linked from `SWAP_SELL`).

It has the common fields plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `price` | number | Yes | Base price in the main currency unit. For an option, this is the **extra** amount added when the option is picked (use `0` for a free option). |
| `dineInPriceOverride` | number | No | Price for dine-in orders. When absent, `price` is used. |
| `takeOutPriceOverride` | number | No | Price for take-out orders. When absent, `price` is used. |
| `deliveryPriceOverride` | number | No | Price for delivery orders. When absent, `price` is used. |
| `description` | string | No | Text shown under the item name. |
| `available` | boolean | Yes | `true` when the item can be ordered now. `false` when it cannot (for example out of stock). |
| `alcoholic` | boolean | No | `true` when the item contains alcohol. Default `false`. |
| `ageRestriction` | integer | No | Minimum customer age to buy the item, for example `18`. |
| `plu` | string | No, but recommended | The POS product code (PLU, "price look-up"). It is sent back on order lines (`OrderItem.plu`). |
| `internalName` | string | No | Short name for staff and kitchen tickets. When empty, `name` is used. The platform sends this name back on order lines (`OrderItem.name`). |
| `calories` | string | No | Energy value as text, for example `"650"`. |
| `allergens` | array of strings | No | Allergens and dietary tags. Each value must be a name from the [allergen list](#511-allergen-and-dietary-values). Unknown values are ignored. |
| `barcodes` | array of strings | No | Barcodes of the product (for example EAN-13). Leave the field out to keep stored barcodes. Send `[]` to delete them. |
| `factor` | number | No | A POS-specific multiplier, such as a size or portion factor. The platform stores it and sends it back unchanged on order lines (`OrderItem.factor`). Leave it out if your POS has no such idea. |
| `deliveryFlag` | integer (1/0) | No | `1` (default) when the item is offered for delivery. |
| `pickupFlag` | integer (1/0) | No | `1` (default) when the item is offered for pickup (collection). |
| `seatFlag` | integer (1/0) | No | `1` (default) when the item is offered for order-to-table (the customer is seated). |
| `dineinFlag` | integer (1/0) | No | `1` (default) when the item is offered for dine-in. |
| `takeoutFlag` | integer (1/0) | No | `1` (default) when the item is offered for take-out. |
| `defaultQuantity` | integer | No | Only for options. How many of this option are already selected when the customer opens the group. Use `1` for an ingredient that is in the dish by default. Default `0`. |
| `minChoices` | integer | No | Only for options. The smallest quantity of **this option** the customer may choose. Default `0`. |
| `maxChoices` | integer | No | Only for options. The largest quantity of **this option** the customer may choose, for example `2` for "double cheese". Default `1`. |

Links: modifier groups (`MODIFIERS`, and `COMBO_MAIN`/`COMBO_SIDE` for combos), pictures (`IMAGE`),
one tax group (`TAX`) and upgrade offers (`SWAP_SELL`). An item used as an option may link nested
modifier groups (`MODIFIERS`).

**Example: a product with every field**

```json
{
  "id": "1001",
  "name": "Classic Burger",
  "type": "ITEM",
  "gfcId": 52010,
  "price": 9.50,
  "dineInPriceOverride": 9.50,
  "takeOutPriceOverride": 9.00,
  "deliveryPriceOverride": 10.50,
  "description": "Beef patty, lettuce, tomato and house sauce",
  "available": true,
  "alcoholic": false,
  "ageRestriction": null,
  "plu": "1001",
  "internalName": "CLASSIC BRGR",
  "calories": "650",
  "allergens": ["GLUTEN", "MILK", "SESAME"],
  "barcodes": ["5012345678900"],
  "factor": 1,
  "deliveryFlag": 1,
  "pickupFlag": 1,
  "seatFlag": 1,
  "dineinFlag": 1,
  "takeoutFlag": 1,
  "defaultQuantity": 0,
  "minChoices": 0,
  "maxChoices": 1,
  "links": [
    { "id": "M-ING-1001", "type": "MODIFIERS" },
    { "id": "M-EXTRAS", "type": "MODIFIERS" },
    { "id": "1001", "type": "IMAGE" },
    { "id": "TAX-STD", "type": "TAX" },
    { "id": "SS-1001", "type": "SWAP_SELL" }
  ],
  "posMetadata": {
    "kitchenPrinter": "grill"
  }
}
```

**Example: an item used as an option** ("Extra cheese", up to two portions, costs 1.00 each)

```json
{
  "id": "X-CHEESE",
  "name": "Extra cheese",
  "type": "ITEM",
  "price": 1.00,
  "available": true,
  "plu": "9001",
  "defaultQuantity": 0,
  "minChoices": 0,
  "maxChoices": 2,
  "links": []
}
```

### 5.10 Sized item: `SIZED_ITEM`

A sized item is a product sold in sizes, for example a cola in small and large. It uses the
[item shape](#59-item-item-iposentityitem). Its sizes are separate `ITEM` entities that it links to.

How the platform reads it:

- It creates a size group named "Choose a size" for the product, with exactly one choice required
  (`min` 1, `max` 1, type `SIZE`).
- Each `ITEM` (or `SIZED_ITEM`) link of the sized item becomes one size in that group, in link
  order.
- The sized item's own `price` is replaced by `0`. The customer pays the size's `price`. So put
  the full price of each size on the size item.
- Other links (modifier groups, images, tax, swap sells) work as for a normal item.

```json
{
  "id": "2001",
  "name": "Cola",
  "type": "SIZED_ITEM",
  "price": 0,
  "description": "Ice-cold cola",
  "available": true,
  "plu": "2001",
  "links": [
    { "id": "2001-S", "type": "ITEM" },
    { "id": "2001-L", "type": "ITEM" },
    { "id": "2001", "type": "IMAGE" },
    { "id": "TAX-STD", "type": "TAX" }
  ]
}
```

The two size items it points at:

```json
[
  {
    "id": "2001-S",
    "name": "Small",
    "type": "ITEM",
    "price": 2.50,
    "available": true,
    "plu": "2001-S",
    "links": []
  },
  {
    "id": "2001-L",
    "name": "Large",
    "type": "ITEM",
    "price": 3.20,
    "available": true,
    "plu": "2001-L",
    "links": []
  }
]
```

### 5.11 Allergen and dietary values

The `allergens` field accepts these names. Matching ignores upper and lower case (`"Gluten"` and
`"GLUTEN"` both work), but the spelling must be exact, with underscores where shown.

| Group | Values |
|:--|:--|
| Allergens | `CELERY`, `GLUTEN`, `GRAINS_GLUTEN`, `CRUSTACEANS`, `EGGS`, `FISH`, `LUPIN`, `MILK`, `MOLLUSCS`, `MUSTARD`, `NUTS`, `PEANUTS`, `SHELLFISH`, `SOYA`, `SULPHUR`, `SESAME`, `SULPHITES`, `CEREALS`, `DAIRY` |
| Nuts and grains | `ALMONDS`, `BARLEY`, `BRAZIL_NUT`, `CASHEW`, `HAZELNUTS`, `KAMUT`, `MACADAMIA`, `OATS`, `PECAN`, `PISTACHIOS`, `RYE`, `SPELT`, `WALNUTS`, `WHEAT` |
| Diet | `GLUTEN_FREE`, `DAIRY_FREE`, `LACTOSE_FREE`, `SUGAR_FREE`, `VEGETARIAN`, `VEGAN`, `PLANT_BASED`, `HALAL`, `KOSHER`, `ORGANIC`, `NATURAL`, `KETO`, `PALEO`, `PORK` |
| Spice level | `MILD`, `MEDIUM`, `HOT`, `VERY_HOT` |
| Drinks | `SOFT`, `SUGARED`, `NGCI` |

### 5.12 Modifier group: `MODIFIERS` (`IPosEntityModifier`)

A modifier group is a question asked about an item, such as "Choose a sauce" or "Add extras". Its
answers (options) are `ITEM` entities that it links to. It has the common fields plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `min` | integer | Yes | The fewest options the customer must pick. `0` makes the group optional. |
| `max` | integer | Yes | The most options the customer may pick in total. |
| `included` | integer | No | How many picks are included in the item price (free). Default `0`. The platform only uses it when the venue has this feature turned on. |
| `modifierType` | string (enum) | No | The kind of group. See [5.13](#513-modifier-types). Default `MODI`. |
| `internalName` | string | No | Short name for staff and kitchen tickets. When empty, `name` is used. |

Links: options (`ITEM` or `SIZED_ITEM`, at least one) and pictures (`IMAGE`).

How `min`, `max` and the option fields work together:

- `min` and `max` count picks across the **whole group**.
- `minChoices` and `maxChoices` on each option limit the quantity of **that one option**.
- `defaultQuantity` on an option says how many are pre-selected.

Example: `"min": 0, "max": 3` with an option that has `"maxChoices": 2` means the customer may pick
up to three extras in total, and at most two of that particular extra.

```json
{
  "id": "M-EXTRAS",
  "name": "Add extras",
  "type": "MODIFIERS",
  "gfcId": 52100,
  "min": 0,
  "max": 3,
  "included": 1,
  "modifierType": "MODI",
  "internalName": "EXTRAS",
  "links": [
    { "id": "X-CHEESE", "type": "ITEM" },
    { "id": "X-BACON", "type": "ITEM" },
    { "id": "X-SAUCE", "type": "ITEM" }
  ],
  "posMetadata": {
    "posModifierGroup": "77"
  }
}
```

**Nested modifier groups.** An option can link its own modifier groups. The nested group opens when
the customer picks that option. In this example, picking "Add a sauce" asks "Choose a sauce":

```json
[
  {
    "id": "X-SAUCE",
    "name": "Add a sauce",
    "type": "ITEM",
    "price": 0,
    "available": true,
    "plu": "9003",
    "links": [
      { "id": "M-SAUCE", "type": "MODIFIERS" }
    ]
  },
  {
    "id": "M-SAUCE",
    "name": "Choose a sauce",
    "type": "MODIFIERS",
    "min": 1,
    "max": 1,
    "modifierType": "MODI",
    "links": [
      { "id": "S-BBQ", "type": "ITEM" },
      { "id": "S-MAYO", "type": "ITEM" }
    ]
  }
]
```

### 5.13 Modifier types

The `modifierType` field of a modifier group uses the enum `ModifierType`. The same enum is used on
order lines (`OrderItem.modifierType`, section 8.2) to say what kind of group an option came from.

| Value | Name | Use it for |
|:--|:--|:--|
| `MODI` | Modifier | A normal group of options or add-ons, such as sauces or extras. This is the default. |
| `SIZE` | Size | A size choice (small, medium, large). Size groups are shown before other groups. Usually `min` 1 and `max` 1. |
| `INGR` | Ingredients | The ingredients already in the dish, which the customer may remove. Give each option `"defaultQuantity": 1` and `"price": 0`. |
| `SURC` | Surcharge | Options that add a charge, such as packaging. |
| `INGM` | Ingredient modifiers | Options that change an ingredient, such as "light mayo" or "extra onion". |

**Example: an ingredients group** (the customer can remove lettuce or tomato)

```json
[
  {
    "id": "M-ING-1001",
    "name": "Ingredients",
    "type": "MODIFIERS",
    "min": 0,
    "max": 2,
    "modifierType": "INGR",
    "links": [
      { "id": "I-LETTUCE", "type": "ITEM" },
      { "id": "I-TOMATO", "type": "ITEM" }
    ]
  },
  {
    "id": "I-LETTUCE",
    "name": "Lettuce",
    "type": "ITEM",
    "price": 0,
    "available": true,
    "plu": "8001",
    "defaultQuantity": 1,
    "minChoices": 0,
    "maxChoices": 1,
    "links": []
  },
  {
    "id": "I-TOMATO",
    "name": "Tomato",
    "type": "ITEM",
    "price": 0,
    "available": true,
    "plu": "8002",
    "defaultQuantity": 1,
    "minChoices": 0,
    "maxChoices": 1,
    "links": []
  }
]
```

### 5.14 Combo meal: `COMBO_MEAL`, `COMBO_MAIN`, `COMBO_SIDE`

A combo meal (meal deal) is built from three kinds of entity:

- **`COMBO_MEAL`** (`IPosEntityComboMeal`): the meal itself. It has the full
  [item shape](#59-item-item-iposentityitem) plus one field:

  | Field | JSON type | Required | Meaning |
  |:--|:--|:--|:--|
  | `comboMealId` | integer | Yes | The id of this meal deal in the POS. |

  Its `price` is the price of the meal. It links one `COMBO_MAIN`, one or more `COMBO_SIDE`, and
  optionally `IMAGE`, `TAX`, `MODIFIERS` and `SWAP_SELL`.
- **`COMBO_MAIN`** (`IPosEntityComboMain`): the main choice, such as "Choose your burger".
- **`COMBO_SIDE`** (`IPosEntityComboSide`): a side choice, such as "Choose your side" or "Choose
  your drink".

`COMBO_MAIN` and `COMBO_SIDE` have exactly the [modifier group shape](#512-modifier-group-modifiers-iposentitymodifier)
(`min`, `max`, `included`, `modifierType`, `internalName`). They are usually `"min": 1, "max": 1`.
Their options are `ITEM` entities. An option's `price` is the **extra** cost on top of the meal
price, so it is usually `0`. Use a positive price for a premium choice, such as a salad instead of
fries.

Tip: create separate option items for the combo (for example `C-1001`) instead of reusing the menu
product (`1001`). The menu product's `price` is its full price, and as an option it would be added
to the meal price.

```json
[
  {
    "id": "3001",
    "name": "Burger Meal",
    "type": "COMBO_MEAL",
    "comboMealId": 7,
    "price": 12.95,
    "description": "Any burger with a side and a drink",
    "available": true,
    "alcoholic": false,
    "plu": "3001",
    "calories": "1100",
    "deliveryFlag": 1,
    "pickupFlag": 1,
    "seatFlag": 1,
    "dineinFlag": 1,
    "takeoutFlag": 1,
    "links": [
      { "id": "3001-MAIN", "type": "COMBO_MAIN" },
      { "id": "3001-SIDE-1", "type": "COMBO_SIDE" },
      { "id": "3001-SIDE-2", "type": "COMBO_SIDE" },
      { "id": "3001", "type": "IMAGE" },
      { "id": "TAX-STD", "type": "TAX" }
    ]
  },
  {
    "id": "3001-MAIN",
    "name": "Choose your burger",
    "type": "COMBO_MAIN",
    "min": 1,
    "max": 1,
    "modifierType": "MODI",
    "links": [
      { "id": "C-1001", "type": "ITEM" },
      { "id": "C-1002", "type": "ITEM" }
    ]
  },
  {
    "id": "3001-SIDE-1",
    "name": "Choose your side",
    "type": "COMBO_SIDE",
    "min": 1,
    "max": 1,
    "modifierType": "MODI",
    "links": [
      { "id": "C-FRIES", "type": "ITEM" },
      { "id": "C-SALAD", "type": "ITEM" }
    ]
  },
  {
    "id": "C-SALAD",
    "name": "Side salad",
    "type": "ITEM",
    "price": 0.50,
    "available": true,
    "plu": "4002",
    "links": []
  }
]
```

### 5.15 Image: `IMAGE` (`IPosEntityImage`)

A picture. Sections, items, combo meals, modifier groups and options link to images. It has the
common fields plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `url` | string | Yes | Public HTTPS address of the picture. |
| `altText` | string | No | Short description of the picture for screen readers. |

An image has no links of its own. A common pattern is to give the image the same id as the entity
that uses it, which is allowed because the types differ (rule 1 in 5.2).

```json
{
  "id": "1001",
  "name": "Classic Burger",
  "type": "IMAGE",
  "url": "https://images.example.com/menu/classic-burger.jpg",
  "altText": "A beef burger with lettuce and tomato in a brioche bun",
  "links": []
}
```

### 5.16 Tax group and tax rate: `TAX` (`IPosEntityTaxGroup`, `IPosEntityTaxRate`)

A tax group is a set of tax rates applied together to an item. Items and options link to it with a
`TAX` link. Only the first `TAX` link of an entity is used. It has the common fields plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `taxRates` | array of tax rates | Yes | The rates in this group. A group with no rates is ignored. |

A **tax rate** (`IPosEntityTaxRate`) is not an entity. It only lives inside `taxRates`, so it is
never linked and needs no `type` or `links`.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The tax rate's id in the POS. |
| `name` | string | Yes | Name of the rate, for example `"VAT 20%"`. Also used as the display name. |
| `pickupTax` | number (fraction) | Yes | Rate for pickup (collection) orders. `0.20` is 20%. |
| `deliveryTax` | number (fraction) | Yes | Rate for delivery orders. |
| `seatTax` | number (fraction) | Yes | Rate for order-to-table orders (the customer is seated). |
| `voucherTax` | number (fraction) | Yes | Rate for voucher sales. |
| `bookingTax` | number (fraction) | Yes | Rate for bookings. |

Use `0` for a rate that does not apply. The platform picks the column that matches the kind of
order.

```json
{
  "id": "TAX-STD",
  "name": "Standard rate",
  "type": "TAX",
  "taxRates": [
    {
      "id": "VAT20",
      "name": "VAT 20%",
      "pickupTax": 0.20,
      "deliveryTax": 0.20,
      "seatTax": 0.20,
      "voucherTax": 0,
      "bookingTax": 0.20
    }
  ],
  "links": []
}
```

### 5.17 Swap sell: `SWAP_SELL` (`IPosEntitySwapSell`)

A swap sell is an upgrade offer attached to an item. When the customer adds the item, they are
offered to swap it for one of the linked products, for example "Upgrade to a double burger".

It has **only** the [common fields](#55-common-entity-fields-iposentity). Its `links` point at the
products the customer can swap to (`ITEM` or `SIZED_ITEM`, at least one). Those products are
normal items and must exist in `entities`, but they do not need to appear in any section. The
example in 5.5 is a complete swap sell.

### 5.18 Types with no dedicated shape: `CROSS_SELLS`, `INGREDIENTS`, `COMBO_ITEM`

These values exist in `PosEntityType` but the menu reading rules in 5.4 do not use them:

- `CROSS_SELLS` is read with the item shape, but no `CROSS_SELLS` link is followed. Products sent
  only through `CROSS_SELLS` do not reach the menu.
- `INGREDIENTS` and `COMBO_ITEM` have no interface in the library and no linking rule.

Do not use them in new menus. For ingredients, use a `MODIFIERS` group with `"modifierType":
"INGR"` (5.13). For combo choices, use `COMBO_MAIN` and `COMBO_SIDE` (5.14).

### 5.19 Fields that depend on the kind of order

Some item fields only apply to one kind of order. This table puts them side by side.

| Kind of order | Item price field | Item availability flag |
|:--|:--|:--|
| Dine-in | `dineInPriceOverride`, else `price` | `dineinFlag` |
| Take-out | `takeOutPriceOverride`, else `price` | `takeoutFlag` |
| Delivery | `deliveryPriceOverride`, else `price` | `deliveryFlag` |
| Pickup (collection) | `price` | `pickupFlag` |
| Order to table (customer is seated) | `price` | `seatFlag` |

The tax rate columns are named after the kind of order they apply to: `pickupTax` (pickup),
`deliveryTax` (delivery), `seatTax` (order to table), `voucherTax` (voucher sales) and `bookingTax`
(bookings).


### 5.20 Complete menu example

This is a full `IMenuResponse` that uses every entity type. Every link points at an entity in the
list. It contains:

- Three top-level sections: "Burgers" (with a scheduled time window, a picture and a "Veggie"
  sub-section), "Drinks" and "Meal deals".
- A burger with an ingredients group, a shared extras group, a nested sauce group, a picture, a tax
  group and an upgrade offer.
- A cola sold in two sizes, and a beer with an age limit that is not offered for delivery or
  take-out.
- A meal deal with a main choice and two side choices.

```json
{
  "root": [
    { "id": "100", "type": "CATEGORY" },
    { "id": "200", "type": "CATEGORY" },
    { "id": "300", "type": "CATEGORY" }
  ],
  "entities": [
    {
      "id": "100",
      "name": "Burgers",
      "type": "CATEGORY",
      "description": "Flame-grilled burgers served in a brioche bun",
      "available": true,
      "availableHours": [
        { "dayOfWeek": "MONDAY", "open": "11:00:00", "close": "22:00:00" },
        { "dayOfWeek": "TUESDAY", "open": "11:00:00", "close": "22:00:00" },
        { "dayOfWeek": "WEDNESDAY", "open": "11:00:00", "close": "22:00:00" },
        { "dayOfWeek": "THURSDAY", "open": "11:00:00", "close": "22:00:00" },
        { "dayOfWeek": "FRIDAY", "open": "11:00:00", "close": "23:00:00" },
        { "dayOfWeek": "SATURDAY", "open": "12:00:00", "close": "23:00:00" },
        { "dayOfWeek": "SUNDAY", "open": "12:00:00", "close": "21:00:00" }
      ],
      "links": [
        { "id": "100", "type": "IMAGE" },
        { "id": "110", "type": "CATEGORY" },
        { "id": "1001", "type": "ITEM" }
      ]
    },
    {
      "id": "110",
      "name": "Veggie",
      "type": "CATEGORY",
      "available": true,
      "links": [
        { "id": "1002", "type": "ITEM" }
      ]
    },
    {
      "id": "200",
      "name": "Drinks",
      "type": "CATEGORY",
      "available": true,
      "links": [
        { "id": "2001", "type": "SIZED_ITEM" },
        { "id": "2010", "type": "ITEM" }
      ]
    },
    {
      "id": "300",
      "name": "Meal deals",
      "type": "CATEGORY",
      "available": true,
      "links": [
        { "id": "3001", "type": "COMBO_MEAL" }
      ]
    },
    {
      "id": "1001",
      "name": "Classic Burger",
      "type": "ITEM",
      "price": 9.50,
      "deliveryPriceOverride": 10.50,
      "description": "Beef patty, lettuce, tomato and house sauce",
      "available": true,
      "alcoholic": false,
      "plu": "1001",
      "internalName": "CLASSIC BRGR",
      "calories": "650",
      "allergens": ["GLUTEN", "MILK", "SESAME"],
      "barcodes": ["5012345678900"],
      "deliveryFlag": 1,
      "pickupFlag": 1,
      "seatFlag": 1,
      "dineinFlag": 1,
      "takeoutFlag": 1,
      "links": [
        { "id": "M-ING-1001", "type": "MODIFIERS" },
        { "id": "M-EXTRAS", "type": "MODIFIERS" },
        { "id": "1001", "type": "IMAGE" },
        { "id": "TAX-STD", "type": "TAX" },
        { "id": "SS-1001", "type": "SWAP_SELL" }
      ],
      "posMetadata": { "kitchenPrinter": "grill" }
    },
    {
      "id": "1002",
      "name": "Veggie Burger",
      "type": "ITEM",
      "price": 8.95,
      "description": "Plant-based patty with avocado",
      "available": true,
      "plu": "1002",
      "calories": "520",
      "allergens": ["GLUTEN", "SOYA", "VEGAN"],
      "links": [
        { "id": "M-EXTRAS", "type": "MODIFIERS" },
        { "id": "TAX-STD", "type": "TAX" }
      ]
    },
    {
      "id": "1003",
      "name": "Double Burger",
      "type": "ITEM",
      "price": 11.50,
      "description": "Two beef patties, double cheese",
      "available": true,
      "plu": "1003",
      "calories": "980",
      "allergens": ["GLUTEN", "MILK", "SESAME"],
      "links": [
        { "id": "M-EXTRAS", "type": "MODIFIERS" },
        { "id": "TAX-STD", "type": "TAX" }
      ]
    },
    {
      "id": "2001",
      "name": "Cola",
      "type": "SIZED_ITEM",
      "price": 0,
      "description": "Ice-cold cola",
      "available": true,
      "plu": "2001",
      "allergens": ["SOFT", "SUGARED"],
      "links": [
        { "id": "2001-S", "type": "ITEM" },
        { "id": "2001-L", "type": "ITEM" },
        { "id": "2001", "type": "IMAGE" },
        { "id": "TAX-STD", "type": "TAX" }
      ]
    },
    {
      "id": "2001-S",
      "name": "Small",
      "type": "ITEM",
      "price": 2.50,
      "available": true,
      "plu": "2001-S",
      "links": []
    },
    {
      "id": "2001-L",
      "name": "Large",
      "type": "ITEM",
      "price": 3.20,
      "available": true,
      "plu": "2001-L",
      "links": []
    },
    {
      "id": "2010",
      "name": "Lager (pint)",
      "type": "ITEM",
      "price": 5.20,
      "available": true,
      "alcoholic": true,
      "ageRestriction": 18,
      "plu": "2010",
      "allergens": ["BARLEY"],
      "deliveryFlag": 0,
      "pickupFlag": 1,
      "seatFlag": 1,
      "dineinFlag": 1,
      "takeoutFlag": 0,
      "links": [
        { "id": "TAX-STD", "type": "TAX" }
      ]
    },
    {
      "id": "3001",
      "name": "Burger Meal",
      "type": "COMBO_MEAL",
      "comboMealId": 7,
      "price": 12.95,
      "description": "Any burger with a side and a drink",
      "available": true,
      "plu": "3001",
      "links": [
        { "id": "3001-MAIN", "type": "COMBO_MAIN" },
        { "id": "3001-SIDE-1", "type": "COMBO_SIDE" },
        { "id": "3001-SIDE-2", "type": "COMBO_SIDE" },
        { "id": "3001", "type": "IMAGE" },
        { "id": "TAX-STD", "type": "TAX" }
      ]
    },
    {
      "id": "M-ING-1001",
      "name": "Ingredients",
      "type": "MODIFIERS",
      "min": 0,
      "max": 2,
      "modifierType": "INGR",
      "links": [
        { "id": "I-LETTUCE", "type": "ITEM" },
        { "id": "I-TOMATO", "type": "ITEM" }
      ]
    },
    {
      "id": "M-EXTRAS",
      "name": "Add extras",
      "type": "MODIFIERS",
      "min": 0,
      "max": 3,
      "included": 1,
      "modifierType": "MODI",
      "links": [
        { "id": "X-CHEESE", "type": "ITEM" },
        { "id": "X-BACON", "type": "ITEM" },
        { "id": "X-SAUCE", "type": "ITEM" }
      ]
    },
    {
      "id": "M-SAUCE",
      "name": "Choose a sauce",
      "type": "MODIFIERS",
      "min": 1,
      "max": 1,
      "modifierType": "MODI",
      "links": [
        { "id": "S-BBQ", "type": "ITEM" },
        { "id": "S-MAYO", "type": "ITEM" }
      ]
    },
    {
      "id": "3001-MAIN",
      "name": "Choose your burger",
      "type": "COMBO_MAIN",
      "min": 1,
      "max": 1,
      "modifierType": "MODI",
      "links": [
        { "id": "C-1001", "type": "ITEM" },
        { "id": "C-1002", "type": "ITEM" }
      ]
    },
    {
      "id": "3001-SIDE-1",
      "name": "Choose your side",
      "type": "COMBO_SIDE",
      "min": 1,
      "max": 1,
      "modifierType": "MODI",
      "links": [
        { "id": "C-FRIES", "type": "ITEM" },
        { "id": "C-SALAD", "type": "ITEM" }
      ]
    },
    {
      "id": "3001-SIDE-2",
      "name": "Choose your drink",
      "type": "COMBO_SIDE",
      "min": 1,
      "max": 1,
      "modifierType": "MODI",
      "links": [
        { "id": "C-COLA", "type": "ITEM" },
        { "id": "C-WATER", "type": "ITEM" }
      ]
    },
    {
      "id": "I-LETTUCE",
      "name": "Lettuce",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "8001",
      "defaultQuantity": 1,
      "minChoices": 0,
      "maxChoices": 1,
      "links": []
    },
    {
      "id": "I-TOMATO",
      "name": "Tomato",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "8002",
      "defaultQuantity": 1,
      "minChoices": 0,
      "maxChoices": 1,
      "links": []
    },
    {
      "id": "X-CHEESE",
      "name": "Extra cheese",
      "type": "ITEM",
      "price": 1.00,
      "available": true,
      "plu": "9001",
      "allergens": ["MILK"],
      "minChoices": 0,
      "maxChoices": 2,
      "links": []
    },
    {
      "id": "X-BACON",
      "name": "Bacon",
      "type": "ITEM",
      "price": 1.50,
      "available": false,
      "plu": "9002",
      "allergens": ["PORK"],
      "minChoices": 0,
      "maxChoices": 1,
      "links": []
    },
    {
      "id": "X-SAUCE",
      "name": "Add a sauce",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "9003",
      "links": [
        { "id": "M-SAUCE", "type": "MODIFIERS" }
      ]
    },
    {
      "id": "S-BBQ",
      "name": "BBQ sauce",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "9101",
      "links": []
    },
    {
      "id": "S-MAYO",
      "name": "Mayonnaise",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "9102",
      "allergens": ["EGGS"],
      "links": []
    },
    {
      "id": "C-1001",
      "name": "Classic Burger",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "1001",
      "links": []
    },
    {
      "id": "C-1002",
      "name": "Veggie Burger",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "1002",
      "links": []
    },
    {
      "id": "C-FRIES",
      "name": "Fries",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "4001",
      "links": []
    },
    {
      "id": "C-SALAD",
      "name": "Side salad",
      "type": "ITEM",
      "price": 0.50,
      "available": true,
      "plu": "4002",
      "links": []
    },
    {
      "id": "C-COLA",
      "name": "Cola (regular)",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "2001-S",
      "links": []
    },
    {
      "id": "C-WATER",
      "name": "Still water",
      "type": "ITEM",
      "price": 0,
      "available": true,
      "plu": "5001",
      "links": []
    },
    {
      "id": "SS-1001",
      "name": "Upgrade your burger",
      "type": "SWAP_SELL",
      "links": [
        { "id": "1003", "type": "ITEM" }
      ]
    },
    {
      "id": "TAX-STD",
      "name": "Standard rate",
      "type": "TAX",
      "taxRates": [
        {
          "id": "VAT20",
          "name": "VAT 20%",
          "pickupTax": 0.20,
          "deliveryTax": 0.20,
          "seatTax": 0.20,
          "voucherTax": 0,
          "bookingTax": 0.20
        }
      ],
      "links": []
    },
    {
      "id": "100",
      "name": "Burgers",
      "type": "IMAGE",
      "url": "https://images.example.com/menu/burgers-section.jpg",
      "altText": "A selection of burgers",
      "links": []
    },
    {
      "id": "1001",
      "name": "Classic Burger",
      "type": "IMAGE",
      "url": "https://images.example.com/menu/classic-burger.jpg",
      "altText": "A beef burger with lettuce and tomato",
      "links": []
    },
    {
      "id": "2001",
      "name": "Cola",
      "type": "IMAGE",
      "url": "https://images.example.com/menu/cola.jpg",
      "links": []
    },
    {
      "id": "3001",
      "name": "Burger Meal",
      "type": "IMAGE",
      "url": "https://images.example.com/menu/burger-meal.jpg",
      "links": []
    }
  ]
}
```

---

## 6. Light menu (menu state)

`POST /internal/v2/menu-state` returns an `ILightMenuResponse`. It is a quick answer to the
question "what does each item cost right now, and can it be ordered?". The platform calls it often,
so it must be fast. It has no sections, groups or links.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `posItems` | array of [items](#59-item-item-iposentityitem) | Yes | Items with their current price and availability. Each `id` must be the same id the item has in the full menu. |

Each entry uses the item shape, but only these fields matter here:

| Field | Required | Meaning |
|:--|:--|:--|
| `id` | Yes | Same id as in the full menu. |
| `name` | No | Helps when reading logs. |
| `type` | No | Usually `ITEM`. |
| `price` | Yes | Current base price. |
| `dineInPriceOverride`, `takeOutPriceOverride`, `deliveryPriceOverride` | No | Current prices per kind of order. |
| `available` | Yes | Whether the item can be ordered now. |
| `deliveryFlag`, `pickupFlag`, `seatFlag`, `dineinFlag`, `takeoutFlag` | No | Current availability per kind of order. |

The model does not say what it means when an item is missing from `posItems`. To avoid guessing,
include every item whose price or availability you know, options included.

The `posItems` list is a set: do not repeat an id.

```json
{
  "posItems": [
    {
      "id": "1001",
      "name": "Classic Burger",
      "type": "ITEM",
      "price": 9.50,
      "deliveryPriceOverride": 10.50,
      "available": true,
      "deliveryFlag": 1,
      "pickupFlag": 1,
      "seatFlag": 1,
      "dineinFlag": 1,
      "takeoutFlag": 1
    },
    {
      "id": "X-BACON",
      "name": "Bacon",
      "type": "ITEM",
      "price": 1.50,
      "available": false
    },
    {
      "id": "2001-L",
      "name": "Large",
      "type": "ITEM",
      "price": 3.40,
      "available": true
    }
  ]
}
```

---

## 7. Raw menu

`POST /internal/v2/raw-menu` is optional. It returns the menu exactly as the POS gives it, before
any conversion, so people can compare the two when they investigate a problem. The body is any JSON
that the POS returns. There is no fixed model.

A POS integration that does not support it answers **HTTP 501 Not Implemented** with no body. This
is the default behaviour in the library, so an integration only writes code for this endpoint if it
supports it.

---

## 8. Order and request models

### 8.1 OrderType

The enum `OrderType` says how the customer gets the order.

| Value | Meaning |
|:--|:--|
| `DINEIN` | The customer eats at the venue. |
| `TAKE_OUT` | The customer takes the food away. |
| `PICKUP` | The customer collects the order (click and collect). |
| `DELIVERY` | The order is delivered to an address. |
| `PAY_AT_TABLE` | The customer pays a bill that is already open at a table. |
| `DRIVE_THRU` | The order is collected at a drive-through. |
| `DELIVEROO` | The order comes from the Deliveroo delivery marketplace. |

### 8.2 OrderItem

One line of an order or basket. The same model is used for a product line and for an option line.
The fields that start with `item...` describe **one unit of this line without its options**. The
fields that start with `total...` (and `total`) describe **one unit including all its options**.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The menu entity id of the product or option (see rule 7 in 5.2). |
| `name` | string | No | The item's `internalName` from the menu, or its `name` when there is no internal name. |
| `plu` | string | No | The `plu` from the menu. |
| `quantity` | integer | Yes | How many units this line stands for. Default `1`. The platform currently sends one line per unit (quantity `1`) and repeats the line when the customer orders more, but a POS integration must still respect `quantity`. |
| `itemPrice` | number | Yes | Price of one unit, without options. |
| `itemDiscount` | number | No | Discount on one unit, without options. |
| `itemTax` | number | No | Tax on one unit, without options. |
| `itemNet` | number | No | One unit without options, after discount and without tax. |
| `itemTotal` | number | No | One unit without options, after discount. Tax is added only when prices exclude tax. |
| `discountRate` | number (fraction) | No | Share of the price that is discounted. `0.10` is 10%. Default `0`. |
| `totalPrice` | number | No | Price of one unit including its options. |
| `totalDiscount` | number | No | Discount on one unit including its options. |
| `totalTax` | number | No | Tax on one unit including its options. |
| `totalNet` | number | No | One unit including options, after discount and without tax. |
| `total` | number | No | One unit including options, after discount. Tax is added only when prices exclude tax. |
| `factor` | number | No | The `factor` from the menu, returned unchanged. |
| `specialNotes` | string | No | The customer's note for this line, for example "no onions please". |
| `modifierType` | string (enum) | No | Only on option lines: the `modifierType` of the group the option came from (5.13). |
| `uniqueId` | integer | Yes | A number that identifies this line within the order. |
| `parentId` | integer | No | Only on option lines: the `uniqueId` of the line this option belongs to. For a nested option, this is the `uniqueId` of the parent option. |
| `position` | integer | No | Only on option lines: the option's position inside its group. |
| `modifiers` | array of OrderItem | No | The option lines of this line. |
| `taxes` | array of [Tax](#83-tax) | No | The taxes on this line. |
| `discounts` | array of [Discount](#84-discount) | No | The discounts on this line. |

**How options are sent.** The `modifiers` field can nest, because an OrderItem can contain
OrderItems. The platform, however, puts **all** option lines of a product into the product's
`modifiers` list, nested options included, and shows the tree with `parentId`. Rebuild the tree by
matching each `parentId` to a `uniqueId`.

**Example: a burger line with two options and one nested option.** The burger (line `5001`) has
"Extra cheese" (`5002`) and "Add a sauce" (`5003`). "BBQ sauce" (`5004`) was picked inside "Add a
sauce", so its `parentId` is `5003`. Prices include 20% tax and a 10% discount.

```json
{
  "id": "1001",
  "name": "CLASSIC BRGR",
  "plu": "1001",
  "quantity": 1,
  "itemPrice": 9.50,
  "itemDiscount": 0.9500,
  "itemTax": 1.4250,
  "itemNet": 7.13,
  "itemTotal": 8.55,
  "discountRate": 0.10,
  "totalPrice": 10.50,
  "totalDiscount": 1.0500,
  "totalTax": 1.5750,
  "totalNet": 7.88,
  "total": 9.45,
  "factor": 1,
  "specialNotes": "Cut in half, please",
  "uniqueId": 5001,
  "taxes": [
    { "id": "VAT20", "name": "VAT 20%", "taxTotal": 1.4250, "netTotal": 7.1250, "taxRate": 0.20, "quantity": 1 }
  ],
  "discounts": [
    { "id": "D-LUNCH", "rate": 0.10, "value": 1.05, "name": "Lunch deal 10%", "providerType": "POS", "uniqueItemId": 5001 }
  ],
  "modifiers": [
    {
      "id": "X-CHEESE",
      "name": "Extra cheese",
      "plu": "9001",
      "quantity": 1,
      "itemPrice": 1.00,
      "itemDiscount": 0.1000,
      "itemTax": 0.1500,
      "itemNet": 0.75,
      "itemTotal": 0.90,
      "discountRate": 0.10,
      "totalPrice": 1.00,
      "totalDiscount": 0.1000,
      "totalTax": 0.1500,
      "totalNet": 0.75,
      "total": 0.90,
      "modifierType": "MODI",
      "uniqueId": 5002,
      "parentId": 5001,
      "position": 1,
      "taxes": [
        { "id": "VAT20", "name": "VAT 20%", "taxTotal": 0.1500, "netTotal": 0.7500, "taxRate": 0.20, "quantity": 1 }
      ]
    },
    {
      "id": "X-SAUCE",
      "name": "Add a sauce",
      "plu": "9003",
      "quantity": 1,
      "itemPrice": 0,
      "totalPrice": 0,
      "total": 0,
      "modifierType": "MODI",
      "uniqueId": 5003,
      "parentId": 5001,
      "position": 3
    },
    {
      "id": "S-BBQ",
      "name": "BBQ sauce",
      "plu": "9101",
      "quantity": 1,
      "itemPrice": 0,
      "totalPrice": 0,
      "total": 0,
      "modifierType": "MODI",
      "uniqueId": 5004,
      "parentId": 5003,
      "position": 1
    }
  ]
}
```

### 8.3 Tax

A tax amount on an order or on one line (`Tax` in requests, `ITax` in responses; both have the same
fields).

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The tax rate id from the menu (`IPosEntityTaxRate.id`). |
| `name` | string | No | Name of the tax. |
| `taxRate` | number (fraction) | No | The rate. `0.20` is 20%. |
| `taxTotal` | number | Yes | Amount of tax. |
| `netTotal` | number | No | Amount the tax was calculated on (without tax). |
| `quantity` | integer | No | Number of units the amounts cover. |

```json
{ "id": "VAT20", "name": "VAT 20%", "taxRate": 0.20, "taxTotal": 1.58, "netTotal": 7.87, "quantity": 1 }
```

### 8.4 Discount

A discount on an order or on one line.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The discount's id in the POS. |
| `name` | string | No | Name of the discount. |
| `rate` | number (fraction) | No | Discount as a share of the price. `0.10` is 10%. |
| `value` | number | No | Discount amount. |
| `providerType` | string | No | Which system issued the discount, as free text. |
| `uniqueItemId` | integer | No | The `uniqueId` of the order line the discount is for, when it is for one line. |

```json
{ "id": "D-LUNCH", "name": "Lunch deal 10%", "rate": 0.10, "value": 1.05, "providerType": "POS", "uniqueItemId": 5001 }
```

### 8.5 ServiceCharge

A charge added to the order, such as a service charge or a delivery fee.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The charge's id in the POS. |
| `name` | string | No | Name of the charge. |
| `type` | string | No | Kind of charge, as free text defined by the integration. |
| `value` | number | Yes | Amount of the charge. |

```json
{ "id": "SC-1", "name": "Service charge", "type": "SERVICE", "value": 1.00 }
```

### 8.6 Customer

The person who placed or paid for the order. This is personal data: do not log it.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `firstName` | string | No | First name. When the customer is not known, the value is `"Unknown"` and the other fields are empty. |
| `lastName` | string | No | Last name. |
| `email` | string | No | Email address. |
| `phoneNumber` | string | No | Phone number, ideally in international format. |

```json
{ "firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com", "phoneNumber": "+44 20 7946 0000" }
```

### 8.7 Address

The delivery address. This is personal data: do not log it.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `line1` | string | No | First address line. |
| `line2` | string | No | Second address line. |
| `city` | string | No | City or town. |
| `stateOrProvince` | string | No | State, county or province. |
| `postCode` | string | No | Postal code. |
| `country` | string | No | Country. |

```json
{ "line1": "1 Example Street", "line2": "Flat 2", "city": "London", "stateOrProvince": "Greater London", "postCode": "EC1A 1AA", "country": "GB" }
```

### 8.8 Payment

One payment made for the order or check (`Payment` in requests).

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `tenderId` | string | Yes | The POS id of the payment method (tender) to record the payment against. |
| `tenderRef` | string | No | Reference of the payment, for example the payment provider's transaction id. |
| `amount` | number | Yes | Amount paid with this payment. |
| `tipAmount` | number | No | Tip paid with this payment. |
| `donationAmount` | number | No | Charity donation paid with this payment. |
| `customer` | [Customer](#86-customer) | No | Who paid. |
| `collectPaymentOnDelivery` | boolean | No | `true` when the money is collected when the order is delivered (the order is not paid yet). |
| `authCode` | string | No | Card authorisation code. |
| `cardScheme` | string | No | Card brand, for example `"VISA"`. |
| `cardLast4Digits` | string | No | Last four digits of the card. Never send a full card number. |

```json
{
  "tenderId": "101",
  "tenderRef": "txn_000123456",
  "amount": 10.45,
  "tipAmount": 1.00,
  "donationAmount": 0.50,
  "customer": { "firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com", "phoneNumber": "+44 20 7946 0000" },
  "collectPaymentOnDelivery": false,
  "authCode": "A1B2C3",
  "cardScheme": "VISA",
  "cardLast4Digits": "4242"
}
```

### 8.9 ExternalUserId

The customer's id in another system, such as a loyalty scheme (`ExternalUserId` in requests,
`IExternalUserId` in responses).

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `externalId` | string | Yes | The customer's id in that system. |
| `system` | string | Yes | The name of that system. |

```json
{ "externalId": "LOY-778899", "system": "LOYALTY" }
```

### 8.10 Award

A loyalty reward or promotion (`Award` in requests, `IAward` in responses).

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The award's id. |
| `posId` | string | No | The award's id in the POS, when different from `id`. |
| `description` | string | No | Text shown to the customer. |
| `type` | string | No | Kind of award. Values in use: `PSEUDO_CURRENCY` (points), `CODE` (a voucher or promo code), `PROMOTION`, `ITEM` (a free item). |
| `source` | string | No | Where the award comes from, for example `"POS"`. |
| `isExternal` | boolean | No | `true` when the award comes from a system outside the POS. |
| `sourceExternalId` | string | No | The award's id in the system it comes from. |
| `discountAmount` | number | No | Value of the award as money. |

```json
{
  "id": "AW-123",
  "posId": "55",
  "description": "Free coffee",
  "type": "ITEM",
  "source": "POS",
  "isExternal": false,
  "sourceExternalId": "COUPON-2026-0042",
  "discountAmount": 2.50
}
```

### 8.11 TotalsRequest (and OrderRequest)

`POST /internal/v2/totals` receives a `TotalsRequest`. It asks the POS to price a basket **without**
placing the order. `TotalsRequest` adds nothing to `OrderRequest`, so the fields below are the
`OrderRequest` fields. `SubmitOrderRequest` and `DiscountRequest` build on the same fields.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `config` | object | Yes | See section 4. |
| `orderId` | integer | No | The platform's id for this order. It may be missing before the order is saved. |
| `basketId` | string | No | The POS basket id returned by an earlier `totals` call (`ITotalsResponse.basketId`), for POS systems that keep baskets. |
| `orderType` | string (enum) | Yes | How the customer gets the order (8.1). |
| `items` | array of [OrderItem](#82-orderitem) | Yes | The product lines. Default `[]`. |
| `subTotal` | number | No | Sum of the line prices, before discounts and service charges. |
| `discountTotal` | number | No | Total of all discounts. |
| `serviceChargeTotal` | number | No | Total of all service charges. |
| `taxTotal` | number | No | Total tax. |
| `total` | number | No | Amount the customer pays. |
| `discounts` | array of [Discount](#84-discount) | No | Discounts on the whole order. |
| `taxes` | array of [Tax](#83-tax) | No | Tax totals, one entry per tax rate. |
| `serviceCharges` | array of [ServiceCharge](#85-servicecharge) | No | Service charges and fees. |

The totals sent by the platform are its own calculation. The POS answers with its own figures in
the `ITotalsResponse` (9.4).

**Example** (the line inside `items` is the line from 8.2, shortened here to its main fields)

```json
{
  "config": { "baseUrl": "https://pos.example.com/api", "locationId": "17" },
  "orderId": 98765,
  "basketId": "B-55501",
  "orderType": "TAKE_OUT",
  "items": [
    {
      "id": "1001",
      "name": "CLASSIC BRGR",
      "plu": "1001",
      "quantity": 1,
      "itemPrice": 9.50,
      "totalPrice": 10.50,
      "total": 9.45,
      "discountRate": 0.10,
      "uniqueId": 5001,
      "modifiers": [
        { "id": "X-CHEESE", "name": "Extra cheese", "plu": "9001", "quantity": 1, "itemPrice": 1.00, "totalPrice": 1.00, "total": 0.90, "modifierType": "MODI", "uniqueId": 5002, "parentId": 5001, "position": 1 },
        { "id": "X-SAUCE", "name": "Add a sauce", "plu": "9003", "quantity": 1, "itemPrice": 0, "totalPrice": 0, "total": 0, "modifierType": "MODI", "uniqueId": 5003, "parentId": 5001, "position": 3 },
        { "id": "S-BBQ", "name": "BBQ sauce", "plu": "9101", "quantity": 1, "itemPrice": 0, "totalPrice": 0, "total": 0, "modifierType": "MODI", "uniqueId": 5004, "parentId": 5003, "position": 1 }
      ]
    }
  ],
  "subTotal": 10.50,
  "discountTotal": 1.05,
  "serviceChargeTotal": 1.00,
  "taxTotal": 1.58,
  "total": 10.45,
  "discounts": [
    { "id": "D-LUNCH", "name": "Lunch deal 10%", "rate": 0.10, "value": 1.05, "providerType": "POS", "uniqueItemId": 5001 }
  ],
  "taxes": [
    { "id": "VAT20", "name": "VAT 20%", "taxRate": 0.20, "taxTotal": 1.58, "netTotal": 7.87, "quantity": 1 }
  ],
  "serviceCharges": [
    { "id": "SC-1", "name": "Service charge", "type": "SERVICE", "value": 1.00 }
  ]
}
```

### 8.12 SubmitOrderRequest

`POST /internal/v2/order` receives a `SubmitOrderRequest`. It asks the POS to **place** the order.
It has every field of 8.11 plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `payments` | array of [Payment](#88-payment) | No | Payments already taken for the order. |
| `customer` | [Customer](#86-customer) | No | Who placed the order. |
| `address` | [Address](#87-address) | No | Delivery address, for delivery orders. |
| `externalUserIds` | array of [ExternalUserId](#89-externaluserid) | No | The customer's ids in other systems, such as loyalty. |
| `specialNotes` | string | No | The customer's note for the whole order. |
| `notes` | string | No | A note for the POS ticket. Its content depends on venue settings, for example a table or collection reference. |
| `dateToFire` | string | No | When the POS should start preparing the order. ISO-8601 date and time with offset and zone name, for example `"2026-11-05T18:15Z[Europe/London]"` (seconds are left out when they are zero). When missing, prepare the order now. |
| `pickupTime` | string (date-time) | No | When the customer will collect the order, local venue time, for example `"2026-11-05T18:30:00.000"`. |
| `dateCreated` | string (date-time) | No | When the customer placed the order, local venue time. |
| `openCheck` | boolean | No | `true` asks the POS to leave the check (bill) open, so more items can be added and it can be paid later. Default `false`. |
| `invoiceCpfCnpj` | string | No | Brazilian taxpayer number (CPF for a person, CNPJ for a company) to print on the fiscal invoice. Personal data: do not log it. |

```json
{
  "config": { "baseUrl": "https://pos.example.com/api", "locationId": "17" },
  "orderId": 98765,
  "basketId": "B-55501",
  "orderType": "TAKE_OUT",
  "items": [
    {
      "id": "1001",
      "name": "CLASSIC BRGR",
      "plu": "1001",
      "quantity": 1,
      "itemPrice": 9.50,
      "totalPrice": 10.50,
      "total": 9.45,
      "discountRate": 0.10,
      "uniqueId": 5001,
      "modifiers": [
        { "id": "X-CHEESE", "name": "Extra cheese", "plu": "9001", "quantity": 1, "itemPrice": 1.00, "totalPrice": 1.00, "total": 0.90, "modifierType": "MODI", "uniqueId": 5002, "parentId": 5001, "position": 1 }
      ]
    }
  ],
  "subTotal": 10.50,
  "discountTotal": 1.05,
  "serviceChargeTotal": 1.00,
  "taxTotal": 1.58,
  "total": 10.45,
  "discounts": [
    { "id": "D-LUNCH", "name": "Lunch deal 10%", "rate": 0.10, "value": 1.05, "providerType": "POS", "uniqueItemId": 5001 }
  ],
  "taxes": [
    { "id": "VAT20", "name": "VAT 20%", "taxRate": 0.20, "taxTotal": 1.58, "netTotal": 7.87, "quantity": 1 }
  ],
  "serviceCharges": [
    { "id": "SC-1", "name": "Service charge", "type": "SERVICE", "value": 1.00 }
  ],
  "payments": [
    {
      "tenderId": "101",
      "tenderRef": "txn_000123456",
      "amount": 10.45,
      "tipAmount": 1.00,
      "customer": { "firstName": "Jane", "lastName": "Doe" },
      "collectPaymentOnDelivery": false,
      "authCode": "A1B2C3",
      "cardScheme": "VISA",
      "cardLast4Digits": "4242"
    }
  ],
  "customer": { "firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com", "phoneNumber": "+44 20 7946 0000" },
  "address": { "line1": "1 Example Street", "line2": "Flat 2", "city": "London", "stateOrProvince": "Greater London", "postCode": "EC1A 1AA", "country": "GB" },
  "externalUserIds": [
    { "externalId": "LOY-778899", "system": "LOYALTY" }
  ],
  "specialNotes": "No napkins, please",
  "notes": "Collection order 4521",
  "dateToFire": "2026-11-05T18:15Z[Europe/London]",
  "pickupTime": "2026-11-05T18:30:00.000",
  "dateCreated": "2026-11-05T17:58:12.000",
  "openCheck": false,
  "invoiceCpfCnpj": "00000000000"
}
```

### 8.13 DiscountRequest

`POST /internal/v2/discount/apply` and `POST /internal/v2/discount/cancel` receive a
`DiscountRequest`. It has every field of 8.11 (the basket the discount is for) plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `awards` | array of [Award](#810-award) | No | Loyalty awards or codes to apply. Default `[]`. |
| `codesToRemove` | array of strings | No | Discount codes to take off the basket. Default `[]`. |

```json
{
  "config": { "baseUrl": "https://pos.example.com/api", "locationId": "17" },
  "basketId": "B-55501",
  "orderType": "TAKE_OUT",
  "items": [
    { "id": "1001", "name": "CLASSIC BRGR", "plu": "1001", "quantity": 1, "itemPrice": 9.50, "totalPrice": 9.50, "total": 9.50, "uniqueId": 5001 }
  ],
  "subTotal": 9.50,
  "total": 9.50,
  "awards": [
    { "id": "AW-123", "posId": "55", "description": "Free coffee", "type": "ITEM", "source": "POS", "isExternal": false }
  ],
  "codesToRemove": ["SUMMER10"]
}
```

### 8.14 GetCheckRequest and PayCheckRequest

`POST /internal/v2/check` and `POST /internal/v2/checks` receive a `GetCheckRequest`. It has only
`config` (section 4). The check to read, for example by table number, is described by values inside
`config`, as defined by the integration.

`POST /internal/v2/check/pay` receives a `PayCheckRequest`:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `config` | object | Yes | See section 4. It also tells the integration which check to pay. |
| `payments` | array of [Payment](#88-payment) | Yes | The payments to record on the check. Default `[]`. |

```json
{
  "config": { "baseUrl": "https://pos.example.com/api", "locationId": "17", "tableNumber": "12" },
  "payments": [
    { "tenderId": "101", "tenderRef": "txn_000987654", "amount": 18.50, "tipAmount": 2.00, "cardScheme": "MASTERCARD", "cardLast4Digits": "4444" }
  ]
}
```

### 8.15 ValidateTableRequest

`POST /internal/v2/table/validate` receives a `ValidateTableRequest`.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `config` | object | Yes | See section 4. |
| `tableNumber` | string | Yes | The table number to check. |

```json
{
  "config": { "baseUrl": "https://pos.example.com/api", "locationId": "17" },
  "tableNumber": "12"
}
```

### 8.16 RegistrationRequest and PosHealthRequest

`POST /internal/v2/init` and `POST /internal/v2/destroy` receive a `RegistrationRequest`.
`POST /internal/v2/pos-health` receives a `PosHealthRequest`. Both have the same fields:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `config` | object | Yes | See section 4. |
| `venueId` | integer | No | The platform's id for the venue. |

```json
{
  "config": { "baseUrl": "https://pos.example.com/api", "locationId": "17" },
  "venueId": 4321
}
```

### 8.17 PosDataRequest and the store configuration request

`POST /internal/v2/pos-data` receives a `PosDataRequest`, and
`POST /internal/v2/store-configuration` receives a plain `PosRequest`. Both have only `config`. See
the example in section 4.

---

## 9. Response models

All response models are interfaces. Your integration returns its own classes, but the JSON must
have the field names shown here. Leave out fields you do not have, or send them as `null`.

### 9.1 CheckItem (`ICheckItem`)

One line of a priced basket, placed order or open check.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The menu id of the product or option. |
| `name` | string | No | Name of the line. |
| `quantity` | integer | Yes | Number of units. |
| `price` | number | No | Price of one unit. |
| `netTotal` | number | No | Line amount without tax. |
| `taxTotal` | number | No | Tax on the line. |
| `total` | number | No | Line amount including tax. |
| `modifiers` | array of CheckItem | No | The option lines of this line. They can nest. |
| `taxes` | array of [Tax](#83-tax) | No | Tax amounts on this line. |

```json
{
  "id": "1001",
  "name": "Classic Burger",
  "quantity": 1,
  "price": 9.50,
  "netTotal": 7.88,
  "taxTotal": 1.57,
  "total": 9.45,
  "modifiers": [
    { "id": "X-CHEESE", "name": "Extra cheese", "quantity": 1, "price": 1.00, "netTotal": 0.75, "taxTotal": 0.15, "total": 0.90, "modifiers": [], "taxes": [] }
  ],
  "taxes": [
    { "id": "VAT20", "name": "VAT 20%", "taxRate": 0.20, "taxTotal": 1.57, "netTotal": 7.88, "quantity": 1 }
  ]
}
```

### 9.2 Discount in responses (`IDiscount`)

A discount the POS applied.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `id` | string | Yes | The discount's id in the POS. |
| `name` | string | No | Name of the discount. |
| `rate` | number (fraction) | No | Discount as a share of the price. |
| `value` | number | No | Discount amount. |
| `locked` | boolean | No | `true` when the customer cannot remove this discount. Default `false`. |

```json
{ "id": "D-LUNCH", "name": "Lunch deal 10%", "rate": 0.10, "value": 1.05, "locked": false }
```

### 9.3 Payment in responses (`IPayment`)

A payment recorded on a check.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `tenderId` | string | Yes | The POS id of the payment method. |
| `tenderRef` | string | No | Reference of the payment. |
| `amount` | number | Yes | Amount paid. |
| `tipAmount` | number | No | Tip paid. |

```json
{ "tenderId": "101", "tenderRef": "txn_000987654", "amount": 18.50, "tipAmount": 2.00 }
```

### 9.4 TotalsResponse (`ITotalsResponse`)

The answer to `totals`: the basket priced by the POS.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `basketId` | string | No | The POS basket id. The platform sends it back in later requests (`basketId` in 8.11). |
| `subTotal` | number | Yes | Sum of the lines before discounts and service charges. |
| `discount` | number | No | Total of all discounts. |
| `serviceChargeTotal` | number | No | Total of all service charges. |
| `tax` | number | Yes | Total tax. |
| `total` | number | Yes | Amount the customer pays. |
| `orderItems` | array of [CheckItem](#91-checkitem-icheckitem) | No | The priced lines. |
| `taxes` | array of [Tax](#83-tax) | No | Tax totals, one entry per tax rate. |
| `discounts` | array of [Discount](#92-discount-in-responses-idiscount) | No | The discounts the POS applied. |

```json
{
  "basketId": "B-55501",
  "subTotal": 10.50,
  "discount": 1.05,
  "serviceChargeTotal": 1.00,
  "tax": 1.58,
  "total": 10.45,
  "orderItems": [
    {
      "id": "1001",
      "name": "Classic Burger",
      "quantity": 1,
      "price": 9.50,
      "netTotal": 7.88,
      "taxTotal": 1.57,
      "total": 9.45,
      "modifiers": [
        { "id": "X-CHEESE", "name": "Extra cheese", "quantity": 1, "price": 1.00, "netTotal": 0.75, "taxTotal": 0.15, "total": 0.90 }
      ]
    }
  ],
  "taxes": [
    { "id": "VAT20", "name": "VAT 20%", "taxRate": 0.20, "taxTotal": 1.58, "netTotal": 7.87, "quantity": 1 }
  ],
  "discounts": [
    { "id": "D-LUNCH", "name": "Lunch deal 10%", "rate": 0.10, "value": 1.05, "locked": false }
  ]
}
```

### 9.5 SubmitOrderResponse (`ISubmitOrderResponse`)

The answer to `order`. It has every field of the TotalsResponse (9.4) plus:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `number` | string | Yes | The order or check number in the POS. Keep it: it identifies the order in the POS later. |
| `customerCheckNumber` | string | No | The short number shown to the customer, for example to call the order at collection. |
| `displayText` | string | No | A short text to show the customer about the order. |
| `text` | string | No | The printable receipt text from the POS, with line breaks (`\n`). |
| `orderType` | string | No | The order type the POS recorded. |
| `externalUserIds` | array of [ExternalUserId](#89-externaluserid) | No | The customer's ids in other systems, as known by the POS. |
| `fiscalQrCodeData` | string | No | Fiscal QR code content from the POS fiscal service (for example a Brazilian NFC-e address). Passed to the caller unchanged. Leave it out when there is none. |
| `fiscalAccessKey` | string | No | Fiscal document key (for example the 44-digit NFC-e key). Passed to the caller unchanged. Leave it out when there is none. |

```json
{
  "number": "4521/8890",
  "customerCheckNumber": "4521",
  "displayText": "Order 4521",
  "text": "ORDER 4521\nTAKE OUT\n1 Classic Burger       9.50\n  Extra cheese         1.00\nLunch deal 10%        -1.05\nService charge         1.00\nTOTAL                 10.45\n",
  "orderType": "TAKE_OUT",
  "externalUserIds": [
    { "externalId": "LOY-778899", "system": "LOYALTY" }
  ],
  "fiscalQrCodeData": "https://www.example.test/qrcode?p=00000000000000000000000000000000000000000000|3|2",
  "fiscalAccessKey": "00000000000000000000000000000000000000000000",
  "basketId": "B-55501",
  "subTotal": 10.50,
  "discount": 1.05,
  "serviceChargeTotal": 1.00,
  "tax": 1.58,
  "total": 10.45,
  "orderItems": [
    { "id": "1001", "name": "Classic Burger", "quantity": 1, "price": 9.50, "netTotal": 7.88, "taxTotal": 1.57, "total": 9.45 }
  ],
  "taxes": [
    { "id": "VAT20", "name": "VAT 20%", "taxRate": 0.20, "taxTotal": 1.58, "netTotal": 7.87, "quantity": 1 }
  ],
  "discounts": [
    { "id": "D-LUNCH", "name": "Lunch deal 10%", "rate": 0.10, "value": 1.05, "locked": false }
  ]
}
```

### 9.6 Shared parts in responses

These response interfaces have the same fields as the request models already described:

- `ITax`: same as [Tax](#83-tax).
- `IExternalUserId`: same as [ExternalUserId](#89-externaluserid).
- `IAward`: same as [Award](#810-award).

### 9.7 PosCheck (`IPosCheck`)

An open check (bill) in the POS, returned by `check`, `checks` (as a list) and `check/pay`.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `number` | string | Yes | The check number in the POS. |
| `basketId` | string | No | The POS basket id linked to the check, when there is one. |
| `subTotal` | number | Yes | Sum of the lines before discounts and service charges. |
| `discount` | number | No | Total of all discounts. |
| `serviceCharge` | number | No | Total of all service charges. |
| `tax` | number | Yes | Total tax. |
| `total` | number | Yes | Total of the check. |
| `items` | array of [CheckItem](#91-checkitem-icheckitem) | No | The lines on the check. |
| `payments` | array of [Payment](#93-payment-in-responses-ipayment) | No | Payments already recorded on the check. |
| `guestCount` | integer | No | Number of guests on the check. |
| `employeeId` | integer | No | The POS id of the employee who owns the check. |
| `isOpenedByPosEmployee` | boolean | No | `true` when staff opened the check on the POS, not the ordering platform. |
| `checkOpenedAtInUTC` | string (date-time) | No | When the check was opened, in UTC, for example `"2026-11-05T18:02:11"`. |
| `text` | string | No | The printable check text from the POS, with line breaks (`\n`). |
| `displayText` | string | No | A short label for the check, for example the table name. |

```json
{
  "number": "1234",
  "basketId": "B-60010",
  "subTotal": 18.45,
  "discount": 0,
  "serviceCharge": 0,
  "tax": 3.07,
  "total": 18.45,
  "items": [
    { "id": "1001", "name": "Classic Burger", "quantity": 1, "price": 9.50, "netTotal": 7.92, "taxTotal": 1.58, "total": 9.50 },
    { "id": "1002", "name": "Veggie Burger", "quantity": 1, "price": 8.95, "netTotal": 7.46, "taxTotal": 1.49, "total": 8.95 }
  ],
  "payments": [
    { "tenderId": "101", "tenderRef": "txn_000987654", "amount": 10.00, "tipAmount": 0 }
  ],
  "guestCount": 2,
  "employeeId": 101,
  "isOpenedByPosEmployee": true,
  "checkOpenedAtInUTC": "2026-11-05T18:02:11",
  "text": "CHECK 1234   TABLE 12\n1 Classic Burger    9.50\n1 Veggie Burger     8.95\nTOTAL              18.45\n",
  "displayText": "Table 12"
}
```

### 9.8 DiscountResponse (`IDiscountResponse`)

The answer to `discount/apply`. `discount/cancel` returns an empty body.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `awards` | array of [Award](#810-award) | Yes | The awards the POS applied. |

```json
{
  "awards": [
    {
      "id": "AW-123",
      "posId": "55",
      "description": "Free coffee",
      "type": "ITEM",
      "source": "POS",
      "isExternal": false,
      "sourceExternalId": "COUPON-2026-0042",
      "discountAmount": 2.50
    }
  ]
}
```

### 9.9 RegistrationResponse (`IRegistrationResponse`)

The answer to `init` and `destroy`.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `success` | boolean | Yes | `true` when the registration (or its removal) worked. |
| `message` | string | No | A human-readable explanation, useful when `success` is `false`. |

```json
{ "success": true, "message": "Venue 4321 registered for order status updates" }
```

### 9.10 StoreConfigurationResponse and Hours (`IStoreConfigurationResponse`, `IHours`)

The answer to `store-configuration`: details of the store as the POS knows them.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `locationName` | string | No | Name of the store. |
| `email` | string | No | Contact email of the store. |
| `phone` | string | No | Contact phone of the store. |
| `liveFlag` | integer (1/0) | No | `1` when the store is live and takes orders. |
| `deliveryCharge` | number | No | Delivery charge. |
| `hours` | array of Hours | No | Opening hours. |

One **Hours** entry is one time window on one day:

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `day` | integer | Yes | Day of the week: `1` Sunday, `2` Monday, `3` Tuesday, `4` Wednesday, `5` Thursday, `6` Friday, `7` Saturday. |
| `open` | string (time) | Yes | Opening time, local store time, in the format `"HH:mm:ss.SSS"`, for example `"11:00:00.000"`. |
| `close` | string (time) | Yes | Closing time, same format. |
| `pickup` | integer (1/0) | No | `1` when the window applies to pickup orders. |
| `delivery` | integer (1/0) | No | `1` when the window applies to delivery orders. |
| `seat` | integer (1/0) | No | `1` when the window applies to order-to-table orders. |
| `opening` | integer (1/0) | No | `1` when the row describes opening hours. |

Note: these store hours use a **different day numbering and time format** from the menu section
hours in 5.8. Section hours use day names (`"MONDAY"`) and `"HH:mm:ss"`.

```json
{
  "locationName": "Example Burgers - High Street",
  "email": "highstreet@example.com",
  "phone": "+44 20 7946 0001",
  "liveFlag": 1,
  "deliveryCharge": 2.99,
  "hours": [
    { "day": 2, "open": "11:00:00.000", "close": "22:00:00.000", "pickup": 1, "delivery": 1, "seat": 1, "opening": 1 },
    { "day": 7, "open": "12:00:00.000", "close": "23:00:00.000", "pickup": 1, "delivery": 0, "seat": 1, "opening": 1 }
  ]
}
```

### 9.11 PosDataResponse (`IPosDataResponse`)

The answer to `pos-data`: any extra information the POS can give, as a free set of keys and values.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `data` | object | Yes | Keys are text. Values can be any JSON value. The keys are defined by each integration. |

```json
{
  "data": {
    "tenders": [
      { "id": "101", "name": "Card" },
      { "id": "102", "name": "Cash" }
    ],
    "revenueCenter": "21",
    "serviceChargeEnabled": true
  }
}
```

### 9.12 Health

The answer to `pos-health`. It uses the standard Spring Boot `Health` object, so the JSON has a
`status` and an optional `details` object.

| Field | JSON type | Required | Meaning |
|:--|:--|:--|:--|
| `status` | string | Yes | `UP` when the POS can be reached and answers correctly. Other values: `DOWN`, `OUT_OF_SERVICE`, `UNKNOWN`. |
| `details` | object | No | Free keys and values that help explain the status, for example the time of the check or an error message. Never put secrets here. |

```json
{
  "status": "UP",
  "details": {
    "checkedAt": "2026-11-05T18:00:00Z",
    "posVersion": "5.2.1"
  }
}
```

```json
{
  "status": "DOWN",
  "details": {
    "error": "Connection timed out after 5000 ms"
  }
}
```

### 9.13 Table validation response

The library does not fix a response model for `table/validate`. Each integration decides what to
return, so agree the answer format with the platform team before you build it.

---

## 10. Checklist

Use this list to check a menu before you send it.

1. `root` lists the top-level sections in display order, and every link in `root` exists in
   `entities`.
2. Every entity has `id`, `name`, `type` and `links` (`[]` when empty).
3. No two entities share the same `type` **and** `id`.
4. No id contains `::`.
5. Every link points at an entity of the same `type` and `id` in `entities`.
6. Links follow the table in 5.4. Links not in that table are ignored.
7. Every `MODIFIERS`, `COMBO_MAIN`, `COMBO_SIDE` and `SWAP_SELL` links at least one `ITEM`.
8. Every item has a `price` and `available`. Option prices are the extra cost (`0` when free).
9. Each sized item links its sizes as `ITEM`s, and each size carries the full price.
10. Each combo meal has a `comboMealId`, one `COMBO_MAIN` and at least one `COMBO_SIDE`.
11. Items link at most one `TAX` group, and each tax group has at least one rate. Rates are
    fractions (`0.20`, not `20`).
12. Money is in the main currency unit (`9.50`, not `950`).
13. The JSON field names are spelled exactly as in this document, including `available`,
    `alcoholic`, `dineinFlag` and `takeoutFlag`.
14. There are no loops (an option does not lead back to its own group).
15. `allergens` only uses values from 5.11.
16. The light menu (`menu-state`) uses the same ids as the full menu.
