// Phase 3 proof (COM-147, SPEC 8): the MODELS.md 5.20 menu (minus tax) can be
// built with the back-office editor. Every entity goes through the same form
// readers the pages use (FormData → readSection/readItem/readGroup/…), in the
// order an owner would create them, into the v2 mock. The guest menu of the new,
// forced menu must then equal the seed's 5.20 menu as a tree (ids aside), in
// pt-BR and in English.
//
// In process by default (the mock's own route handlers). With the mock running,
//   MOCK_API_URL=http://localhost:4010 npx vitest run src/lib/admin/reference-menu.test.ts
// runs the same build through Prism, which validates every call against the contract.

import { beforeAll, describe, expect, it } from "vitest";

import { adminRoutes } from "../../../mock/v2/routes-admin";
import { guestRoutes } from "../../../mock/v2/routes-guest";
import { applyScenario, state } from "../../../mock/state";
import type { components } from "@/lib/core-api";

import {
  type AdminItem,
  type Group,
  type Item,
  readGroup,
  readItem,
  readMenu,
  readOptionRows,
  readSection,
  readSwapSell,
} from "./catalogue-form";

type MenuResponse = components["schemas"]["MenuResponse"];
type Entity = components["schemas"]["PosEntity"];
// The mock answers loose JSON; the contract owns the shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type Call = (method: string, path: string, body?: unknown, token?: string) => Promise<{ status: number; body: Json }>;

const LIVE = process.env.MOCK_API_URL;
const CONTROL = process.env.MOCK_CONTROL_URL ?? "http://localhost:4020/__mock";

/**
 * `until` for a forced menu. The "afternoon" scenario moves the mock's clock to 15:00 store
 * time, up to a day away from the real clock, so one hour from now may already be past for it.
 */
const forceUntil = () => new Date(Date.now() + 2 * 86_400_000).toISOString();

// ------------------------------------------------------------ transports

function inProcess(): { call: Call; owner: string; device: string } {
  applyScenario("afternoon");
  const owner = "test-owner";
  const device = "test-device";
  state.ownerTokens.set(owner, Date.now() + 3_600_000);
  const kiosk = state.devices.find((d) => d.kind === "KIOSK")!;
  state.tokens.set(device, { deviceId: kiosk.id, expiresAt: Date.now() + 3_600_000 });
  const routes = [...adminRoutes, ...guestRoutes];
  const call: Call = async (method, path, body, token) => {
    const url = new URL(path, "http://mock");
    for (const [m, pattern, handler] of routes) {
      const match = m === method ? pattern.exec(url.pathname) : null;
      if (!match) continue;
      const reply = handler(
        {
          method,
          path: url.pathname,
          query: url.searchParams,
          headers: token ? { authorization: `Bearer ${token}` } : {},
          raw: Buffer.from(body === undefined ? "" : JSON.stringify(body)),
          body: body === undefined ? null : JSON.parse(JSON.stringify(body)),
          ip: "127.0.0.1",
        },
        match.slice(1),
      );
      return { status: reply.status, body: reply.body };
    }
    throw new Error(`no route for ${method} ${path}`);
  };
  return { call, owner, device };
}

async function live(base: string): Promise<{ call: Call; owner: string; device: string }> {
  const control = (path: string, body?: unknown) =>
    fetch(`${CONTROL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then((r) => r.json() as Promise<Json>);
  const call: Call = async (method, path, body, token) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const violations = response.headers.get("sl-violations");
    if (violations) throw new Error(`Prism: ${method} ${path} breaks the contract: ${violations}`);
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  };
  await control("/scenario", { name: "afternoon" });
  const credentials = await control("/device-credentials?kind=KIOSK");
  const device = (await call("POST", "/v2/devices/auth", credentials)).body.accessToken;
  const owner = (
    await call("POST", "/v2/admin/auth/login", { email: "dono@padaria.test", password: "padaria-teste" })
  ).body.accessToken;
  return { call, owner, device };
}

// ------------------------------------------------------------ forms as the pages post them

type Fields = Record<string, string | string[]>;
const formOf = (fields: Fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) for (const v of [value].flat()) data.append(key, v);
  return data;
};
const texts = (pt: string, en?: string, descriptionPt?: string, descriptionEn?: string): Fields => ({
  "name.pt": pt,
  ...(en ? { "name.en": en } : {}),
  ...(descriptionPt ? { "description.pt": descriptionPt } : {}),
  ...(descriptionEn ? { "description.en": descriptionEn } : {}),
});
const rows = (prefix: string, links: Array<[string, string]>): Fields =>
  Object.fromEntries(
    links.flatMap(([type, id], i) => [
      [`${prefix}.${i}.type`, type],
      [`${prefix}.${i}.id`, id],
      [`${prefix}.${i}.order`, String(i + 1)],
    ]),
  );
type OptionRow = { pt: string; en: string; price?: string; on?: boolean; def?: string; min?: string; max?: string; nested?: string };
const optionRows = (options: OptionRow[]): Fields =>
  Object.fromEntries(
    options.flatMap((o, i) => {
      const p = `opt.${i}.`;
      return [
        [`${p}id`, ""],
        [`${p}order`, String(i + 1)],
        [`${p}name.pt`, o.pt],
        [`${p}name.en`, o.en],
        [`${p}price`, o.price ?? ""],
        [`${p}defaultQuantity`, o.def ?? ""],
        [`${p}minChoices`, o.min ?? ""],
        [`${p}maxChoices`, o.max ?? ""],
        [`${p}nested`, o.nested ?? ""],
        ...(o.on === false ? [] : [[`${p}available`, "on"]]),
      ];
    }),
  );

// ------------------------------------------------------------ the owner, building 5.20

async function buildReferenceMenu(call: Call, owner: string): Promise<string> {
  const ok = async (method: string, path: string, body?: unknown) => {
    const reply = await call(method, path, body, owner);
    if (reply.status >= 300) throw new Error(`${method} ${path} → ${reply.status} ${JSON.stringify(reply.body)}`);
    return reply.body;
  };
  const items = async () => new Map<string, AdminItem>((await ok("GET", "/v2/admin/items")).map((i: AdminItem) => [i.id, i]));
  const putItem = (item: AdminItem) => ok("PUT", `/v2/admin/items/${item.id}`, item);
  const built = new Map<string, Item>(); // options this build created, by name (the seed has the same names)

  /** "Novo grupo" / group page: readGroup, options first, then the group (saveGroup). */
  const group = async (fields: Fields): Promise<Group> => {
    const { group, options } = readGroup(formOf(fields), null, await items());
    for (const option of options) {
      await putItem(option);
      built.set(option.name, option);
    }
    return ok("PUT", `/v2/admin/modifier-groups/${group.id}`, group);
  };
  /** Item page: readItem on the current item (saveItem). */
  const editItem = async (id: string, fields: Fields) => {
    const current = (await items()).get(id)!;
    return putItem(readItem(formOf({ available: "on", ...fields }), current));
  };
  /** "Novo item": type, name and price (and a combo's parts), then the item page. */
  const newItem = async (type: string, fields: Fields, nextComboId?: number): Promise<AdminItem> =>
    putItem(readItem(formOf({ type, available: "on", ...fields }), null, { nextComboId }));

  // 1. Groups, leaves first (a link must point at something that exists).
  const sauce = await group({ type: "MODIFIERS", modifierType: "MODI", min: "1", max: "1", ...texts("Escolha o molho", "Choose a sauce"),
    ...optionRows([{ pt: "Molho barbecue", en: "BBQ sauce" }, { pt: "Maionese", en: "Mayonnaise" }]) });
  const extras = await group({ type: "MODIFIERS", modifierType: "MODI", min: "0", max: "3", ...texts("Adicionais", "Add extras"),
    ...optionRows([
      { pt: "Queijo extra", en: "Extra cheese", price: "1,00", min: "0", max: "2" },
      { pt: "Bacon", en: "Bacon", price: "1,50", on: false, max: "1" },
      { pt: "Adicionar molho", en: "Add a sauce", nested: sauce.id },
    ]) });
  const ingredients = await group({ type: "MODIFIERS", modifierType: "INGR", min: "0", max: "2", ...texts("Ingredientes", "Ingredients"),
    ...optionRows([
      { pt: "Alface", en: "Lettuce", def: "1", min: "0", max: "1" },
      { pt: "Tomate", en: "Tomato", def: "1", min: "0", max: "1" },
    ]) });
  const comboMain = await group({ type: "COMBO_MAIN", modifierType: "MODI", min: "1", max: "1", ...texts("Escolha o hambúrguer", "Choose your burger"),
    ...optionRows([{ pt: "Hambúrguer clássico", en: "Classic Burger" }, { pt: "Hambúrguer vegetariano", en: "Veggie Burger" }]) });
  const comboSide = await group({ type: "COMBO_SIDE", modifierType: "MODI", min: "1", max: "1", ...texts("Escolha o acompanhamento", "Choose your side"),
    ...optionRows([{ pt: "Batata frita", en: "Fries" }, { pt: "Salada", en: "Side salad", price: "0,50" }]) });
  const comboDrink = await group({ type: "COMBO_SIDE", modifierType: "MODI", min: "1", max: "1", ...texts("Escolha a bebida", "Choose your drink"),
    ...optionRows([{ pt: "Cola (normal)", en: "Cola (regular)" }, { pt: "Água sem gás", en: "Still water" }]) });

  // 2. Option details on their item pages (allergens).
  for (const [name, allergen] of [["Queijo extra", "MILK"], ["Bacon", "PORK"], ["Maionese", "EGGS"]] as const) {
    const option = built.get(name)!;
    await editItem(option.id, {
      ...texts(name, option.translations?.en?.name),
      price: String(option.price).replace(".", ","),
      // An unticked checkbox posts nothing: Bacon stays off.
      ...(option.available ? {} : { available: [] }),
      allergens: allergen,
      minChoices: String(option.minChoices ?? ""),
      maxChoices: String(option.maxChoices ?? ""),
    });
  }

  // 3. Products.
  const cola = await newItem("SIZED_ITEM", texts("Refrigerante de cola", "Cola"));
  {
    const fields = {
      ...texts("Refrigerante de cola", "Cola", "Cola bem gelada", "Ice-cold cola"),
      allergensDeclared: "on",
      allergens: ["SOFT", "SUGARED"],
      image: "2001",
      sizes: "on",
      ...optionRows([{ pt: "Pequeno", en: "Small", price: "2,50" }, { pt: "Grande", en: "Large", price: "3,20" }]),
    };
    // saveItem for a sized item: sizes first, then the item linking them.
    const form = formOf({ available: "on", ...fields });
    const all = await items();
    const item = readItem(form, all.get(cola.id)!);
    const { links, options } = readOptionRows(form, "opt", all);
    for (const size of options) await putItem(size);
    item.links = [...item.links.filter((l) => l.type === "IMAGE"), ...links, ...item.links.filter((l) => l.type !== "IMAGE")];
    await putItem(item);
  }
  const lager = await newItem("ITEM", { ...texts("Chope (pint)", "Lager (pint)"), price: "5,20", alcoholic: "on", ageRestriction: "18",
    allergensDeclared: "on", allergens: "BARLEY" });
  const double = await newItem("ITEM", { ...texts("Hambúrguer duplo", "Double Burger", "Duas carnes, queijo em dobro", "Two beef patties, double cheese"),
    price: "11,50", calories: "980", allergensDeclared: "on", allergens: ["GLUTEN", "MILK", "SESAME"], ...rows("links", [["MODIFIERS", extras.id]]) });
  const swap = readSwapSell(formOf({ ...texts("Turbine seu hambúrguer", "Upgrade your burger"), ...rows("links", [["ITEM", double.id]]) }), null);
  await ok("PUT", `/v2/admin/swap-sells/${swap.id}`, swap);
  const classic = await newItem("ITEM", {
    ...texts("Hambúrguer clássico", "Classic Burger", "Carne bovina, alface, tomate e molho da casa", "Beef patty, lettuce, tomato and house sauce"),
    price: "9,50", internalName: "CLASSICO", calories: "650", allergensDeclared: "on", allergens: ["GLUTEN", "MILK", "SESAME"],
    badgeIds: "NOVO", crossSellIds: cola.id, image: "1001",
    ...rows("links", [["MODIFIERS", ingredients.id], ["MODIFIERS", extras.id], ["SWAP_SELL", swap.id]]),
  });
  const veggie = await newItem("ITEM", { ...texts("Hambúrguer vegetariano", "Veggie Burger", "Hambúrguer de plantas com abacate", "Plant-based patty with avocado"),
    price: "8,95", calories: "520", allergensDeclared: "on", allergens: ["GLUTEN", "SOYA", "VEGAN"], ...rows("links", [["MODIFIERS", extras.id]]) });
  const meal = await newItem("COMBO_MEAL", {
    ...texts("Combo hambúrguer", "Burger Meal", "Qualquer hambúrguer com acompanhamento e bebida", "Any burger with a side and a drink"),
    price: "12,95", image: "3001", "links.add": [`COMBO_MAIN:${comboMain.id}`, `COMBO_SIDE:${comboSide.id}`, `COMBO_SIDE:${comboDrink.id}`],
  }, 100);

  // 4. Sections, inner first; then the menu, forced on now.
  const section = async (fields: Fields) => {
    const body = readSection(formOf({ available: "on", ...fields }), null);
    return ok("PUT", `/v2/admin/sections/${body.id}`, body);
  };
  const veg = await section({ ...texts("Vegetarianos", "Veggie"), ...rows("links", [["ITEM", veggie.id]]) });
  const week = (open: string, close: string, days: string[]) =>
    Object.fromEntries(days.flatMap((d) => [[`${d}.open`, "on"], [`${d}.start`, open], [`${d}.end`, close]]));
  const burgers = await section({
    ...texts("Hambúrgueres", "Burgers", "Hambúrgueres na brasa no pão brioche", "Flame-grilled burgers served in a brioche bun"),
    image: "100", "hours.on": "on",
    ...week("11:00", "22:00", ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"]),
    ...week("11:00", "23:00", ["FRIDAY"]),
    ...week("12:00", "23:00", ["SATURDAY"]),
    ...week("12:00", "21:00", ["SUNDAY"]),
    ...rows("links", [["CATEGORY", veg.id], ["ITEM", classic.id]]),
  });
  const drinks = await section({ ...texts("Bebidas", "Drinks"), ...rows("links", [["SIZED_ITEM", cola.id], ["ITEM", lager.id]]) });
  const deals = await section({ ...texts("Combos", "Meal deals"), ...rows("links", [["COMBO_MEAL", meal.id]]) });
  const menu = readMenu(
    formOf({ ...texts("Referência", "Reference"), ...rows("root", [["CATEGORY", burgers.id], ["CATEGORY", drinks.id], ["CATEGORY", deals.id]]) }),
    null,
  );
  await ok("PUT", `/v2/admin/menus/${menu.id}`, menu);
  await ok("POST", `/v2/admin/menus/${menu.id}/force`, { until: forceUntil() });
  return menu.id;
}

// ------------------------------------------------------------ comparing menus as trees

/** Fields the editor does not set, or that only name an entity. */
// `included` is "ignored by Go in the pilot" (contract), so the editor does not offer it.
const IGNORED = new Set(["id", "links", "included", "gfcId", "plu", "comboMealId", "barcodes", "posMetadata", "deliveryPriceOverride",
  "takeOutPriceOverride", "deliveryFlag", "pickupFlag", "seatFlag", "dineinFlag", "takeoutFlag"]);

/** The menu from `root`, ids replaced by what they point at; absent, null, [] and false-by-default fields dropped. */
function tree(menu: MenuResponse) {
  const entities = new Map(menu.entities.map((e) => [`${e.type}:${e.id}`, e]));
  // crossSellIds point at products only (an IMAGE may share the id).
  const products = menu.entities.filter((e) => e.type === "ITEM" || e.type === "SIZED_ITEM" || e.type === "COMBO_MEAL");
  const names = new Map(products.map((e) => [e.id, e.name]));
  const node = (link: { type: string; id: string }): unknown => {
    const e = entities.get(`${link.type}:${link.id}`) as (Entity & Record<string, unknown>) | undefined;
    if (!e) return { missing: link.type };
    const fields = Object.fromEntries(
      Object.entries(e).filter(
        ([k, v]) =>
          !IGNORED.has(k) &&
          v !== null &&
          v !== undefined &&
          !(Array.isArray(v) && v.length === 0) &&
          !((k === "alcoholic" || k === "allergensDeclared") && v === false),
      ),
    );
    if (Array.isArray(fields.crossSellIds)) fields.crossSellIds = (fields.crossSellIds as string[]).map((id) => names.get(id));
    const image = e.links.find((l) => l.type === "IMAGE");
    return {
      ...fields,
      ...(image ? { image: (entities.get(`IMAGE:${image.id}`) as { url?: string } | undefined)?.url } : {}),
      children: e.links.filter((l) => l.type !== "IMAGE").map(node),
    };
  };
  return { root: menu.root.map(node), badges: menu.badges };
}

describe.each([LIVE ? "through Prism" : "in process"])("MODELS 5.20 built in the editor (%s)", () => {
  let api: { call: Call; owner: string; device: string };
  const activeMenu = async (language: string) => {
    const reply = await api.call("GET", `/v2/menus/active?language=${language}`, undefined, api.device);
    expect(reply.status).toBe(200);
    return reply.body as MenuResponse;
  };
  const force = (menuId: string) =>
    api.call("POST", `/v2/admin/menus/${menuId}/force`, { until: forceUntil() }, api.owner);

  let seed: Record<string, MenuResponse>;
  let built: Record<string, MenuResponse>;
  let builtId: string;

  beforeAll(async () => {
    api = LIVE ? await live(LIVE) : inProcess();
    await force("mnu-tarde"); // the seed's 5.20 menu (root 100, 200, 300)
    seed = { "pt-BR": await activeMenu("pt-BR"), en: await activeMenu("en") };
    builtId = await buildReferenceMenu(api.call, api.owner);
    built = { "pt-BR": await activeMenu("pt-BR"), en: await activeMenu("en") };
  }, 60_000);

  it("the active menu is the one built in the editor", () => {
    expect(seed["pt-BR"].menuId).toBe("mnu-tarde");
    expect(built["pt-BR"].menuId).toBe(builtId);
  });

  it.each(["pt-BR", "en"])("has the same sections, products, sizes, combos, groups and options (%s)", (language) => {
    expect(tree(built[language])).toEqual(tree(seed[language]));
  });

  it("is a real graph, not just names: sizes, nested groups, combo parts and the swap sell are linked", () => {
    const t = JSON.stringify(tree(built["pt-BR"]));
    for (const name of ["Pequeno", "Grande", "Escolha o molho", "Escolha a bebida", "Turbine seu hambúrguer", "Hambúrguer duplo"]) {
      expect(t).toContain(`"name":"${name}"`);
    }
    expect(built["pt-BR"].entities.length).toBe(seed["pt-BR"].entities.length);
  });
});
