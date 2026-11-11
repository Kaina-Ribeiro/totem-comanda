// Walks every v2 operation through Prism (contract/openapi.yaml) with the
// mock running (`npm run mock`), and fails on any status it did not expect.
// Prism runs with --errors, so a response that breaks the contract comes back
// as an error instead of the mock's answer: a clean run proves the shapes match.
//
//   npm run mock:smoke         (CORE_API_URL and MOCK_CONTROL_URL override the ports)

import { randomUUID } from "node:crypto";

const API = process.env.CORE_API_URL ?? "http://localhost:4010";
const CONTROL = process.env.MOCK_CONTROL_URL ?? "http://localhost:4020/__mock";

// The smoke reads loose JSON; the contract, not this script, owns the shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

let calls = 0;
const failures: string[] = [];

type Options = { token?: string; body?: unknown; headers?: Record<string, string> };

async function call(method: string, path: string, expected: number, opts: Options = {}) {
  calls += 1;
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  const violations = res.headers.get("sl-violations");
  if (res.status !== expected || violations) {
    failures.push(`${method} ${path} → ${res.status} (expected ${expected}) ${violations ?? ""} ${text.slice(0, 400)}`);
  }
  return { status: res.status, body: body as Json, headers: res.headers };
}

const control = (path: string, body?: unknown) =>
  fetch(`${CONTROL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => r.json() as Promise<Json>);

async function main() {
  await control("/scenario", { name: "afternoon" });
  const kiosk = await control("/device-credentials?kind=KIOSK");
  const kitchenCreds = await control("/device-credentials?kind=KITCHEN");

  // Devices
  await call("POST", "/v2/devices/auth", 401, { body: { deviceId: kiosk.deviceId, deviceSecret: "wrong" } });
  const device = (await call("POST", "/v2/devices/auth", 200, { body: kiosk })).body.accessToken as string;
  const kitchen = (await call("POST", "/v2/devices/auth", 200, { body: kitchenCreds })).body.accessToken as string;
  const config = await call("GET", "/v2/devices/me/config", 200, { token: device });
  await call("GET", "/v2/devices/me/config", 304, { token: device, headers: { "If-None-Match": config.headers.get("etag")! } });
  await call("GET", "/v2/devices/me/config", 401);
  await call("POST", "/v2/devices/heartbeat", 204, { token: device, body: { appVersion: "smoke", screenResolution: "1080x1920" } });
  await call("POST", "/v2/devices/status", 204, {
    token: device,
    body: { kind: "STATUS", statusType: "TRADING", category: "APPLICATION_STATUS" },
  });

  // Guest menu and journey
  const menu = await call("GET", "/v2/menus/active?language=pt-BR", 200, { token: device });
  await call("GET", "/v2/menus/active?language=pt-BR", 304, { token: device, headers: { "If-None-Match": menu.headers.get("etag")! } });
  await call("GET", "/v2/menus/active?language=en", 200, { token: device });
  await call("GET", "/v2/languages/en", 200, { token: device });
  const nonce = randomUUID();
  await call("POST", "/v2/journeys", 201, { token: device, body: { orderNonce: nonce, language: "pt-BR" } });
  await call("POST", `/v2/journeys/${nonce}/events`, 204, { token: device, body: { type: "RESET", orderTotal: 9.5 } });

  // Totals and coupons
  const items = [
    {
      id: "1001",
      quantity: 1,
      uniqueId: 1,
      specialNotes: "Sem cebola",
      modifiers: [
        { id: "X-CHEESE", quantity: 2, uniqueId: 2, parentId: 1, position: 1, modifierType: "MODI" },
        { id: "X-SAUCE", quantity: 1, uniqueId: 3, parentId: 1, position: 3, modifierType: "MODI" },
        { id: "S-BBQ", quantity: 1, uniqueId: 4, parentId: 3, position: 1, modifierType: "MODI" },
      ],
    },
    {
      id: "2001",
      quantity: 1,
      uniqueId: 5,
      modifiers: [{ id: "2001-L", quantity: 1, uniqueId: 6, parentId: 5, position: 2, modifierType: "SIZE" }],
    },
  ];
  const totals = (await call("POST", "/v2/totals?language=pt-BR", 200, { token: device, body: { orderType: "DINEIN", items } })).body;
  const basketId = totals.basketId as string;
  await call("POST", "/v2/totals?language=en", 200, { token: device, body: { basketId, orderType: "DINEIN", items } });
  await call("POST", "/v2/totals?language=pt-BR", 422, {
    token: device,
    body: { orderType: "DINEIN", items: [{ id: "1001", quantity: 1, uniqueId: 1, modifiers: [{ id: "X-BACON", quantity: 1, uniqueId: 2, parentId: 1 }] }] },
  });
  await call("POST", "/v2/totals?language=pt-BR", 404, { token: device, body: { basketId: "B-none", orderType: "DINEIN", items } });
  const discount = { basketId, orderType: "DINEIN", items, awards: [{ id: "BEMVINDO10", type: "CODE" }] };
  await call("POST", "/v2/discounts/apply?language=pt-BR", 200, { token: device, body: discount });
  await call("POST", "/v2/discounts/apply?language=pt-BR", 409, { token: device, body: discount });
  await call("POST", "/v2/discounts/apply?language=pt-BR", 422, { token: device, body: { ...discount, awards: [{ id: "NOPE1", type: "CODE" }] } });
  await call("POST", "/v2/discounts/cancel", 204, { token: device, body: { basketId, orderType: "DINEIN", items, codesToRemove: ["BEMVINDO10"] } });
  await call("POST", "/v2/discounts/apply?language=pt-BR", 200, { token: device, body: discount });
  const priced = (await call("POST", "/v2/totals?language=pt-BR", 200, { token: device, body: { basketId, orderType: "DINEIN", items } })).body;

  // Payments: Pix declined, card cancelled, Pix approved
  const pay = (method: string, amount: number, key = randomUUID(), expected = 201) =>
    call("POST", "/v2/payments", expected, { token: device, headers: { "Idempotency-Key": key }, body: { basketId, method, amount } });
  await pay("PIX", priced.total + 1, randomUUID(), 409);
  const pix1 = (await pay("PIX", priced.total)).body;
  await call("POST", `/v2/payments/${pix1.id}/simulate`, 200, { token: device, body: { outcome: "DECLINED" } });
  await call("POST", `/v2/payments/${pix1.id}/simulate`, 409, { token: device, body: { outcome: "APPROVED" } });
  await call("GET", `/v2/payments/${pix1.id}`, 200, { token: device });
  const card = (await pay("CARD", priced.total)).body;
  await call("POST", `/v2/payments/${card.id}/cancel`, 200, { token: device });
  await call("POST", `/v2/payments/${card.id}/cancel`, 409, { token: device });
  const key = randomUUID();
  const pix2 = (await pay("PIX", priced.total, key)).body;
  await pay("PIX", priced.total, key); // same key and body: the first session again
  const order = {
    basketId,
    orderType: "DINEIN",
    items,
    payments: [{ tenderId: pix2.tenderId, tenderRef: pix2.tenderRef, amount: pix2.amount }],
  };
  await call("POST", "/v2/orders", 409, { token: device, headers: { "Idempotency-Key": randomUUID() }, body: order });
  await control(`/payments/${pix2.id}`, { outcome: "APPROVED" });
  await pay("CARD", priced.total, randomUUID(), 409);
  const placed = (await call("POST", "/v2/orders", 201, { token: device, headers: { "Idempotency-Key": randomUUID() }, body: order })).body;
  await call("POST", "/v2/orders", 200, { token: device, headers: { "Idempotency-Key": randomUUID() }, body: order });
  await call("GET", `/v2/orders/${placed.number}`, 200, { token: device });
  await call("GET", "/v2/orders/nope", 404, { token: device });

  // Kitchen
  await call("GET", "/v2/kitchen/orders", 200, { token: kitchen });
  await call("POST", `/v2/kitchen/orders/${placed.number}/status`, 200, { token: kitchen, body: { status: "PREPARING", expectedVersion: 1 } });
  await call("POST", `/v2/kitchen/orders/${placed.number}/status`, 409, { token: kitchen, body: { status: "PREPARING", expectedVersion: 1 } });
  await call("POST", `/v2/kitchen/orders/${placed.number}/status`, 200, { token: kitchen, body: { status: "READY" } });
  await call("POST", `/v2/kitchen/orders/${placed.number}/status`, 200, { token: kitchen, body: { status: "COLLECTED" } });
  await call("GET", "/v2/kitchen/orders?status=collected", 200, { token: kitchen });
  await call("PUT", "/v2/kitchen/availability", 200, { token: kitchen, body: { id: "X-CHEESE", available: false } });
  await call("PUT", "/v2/kitchen/availability", 200, { token: kitchen, body: { id: "X-CHEESE", available: true } });
  await call("POST", "/v2/kitchen/close-day", 200, { token: kitchen });
  await call("GET", "/v2/kitchen/pace", 200, { token: kitchen });
  await call("PUT", "/v2/kitchen/pace", 200, { token: kitchen, body: { pace: "BUSY" } });
  await call("PUT", "/v2/kitchen/pace", 200, { token: kitchen, body: { pace: "NORMAL" } });

  // Back office
  await call("POST", "/v2/admin/auth/login", 401, { body: { email: "dono@padaria.test", password: "x" } });
  const owner = (await call("POST", "/v2/admin/auth/login", 200, { body: { email: "dono@padaria.test", password: "padaria-teste" } })).body.accessToken as string;
  const o = { token: owner };
  const store = (await call("GET", "/v2/admin/store", 200, o)).body;
  await call("PUT", "/v2/admin/store", 200, { ...o, body: { ...store, locationName: "Padaria (smoke)" } });
  await call("PUT", "/v2/admin/store", 422, { ...o, body: { ...store, businessDayCutoff: "25:00" } });
  const form = new FormData();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    "base64",
  );
  form.append("file", new Blob([png], { type: "image/png" }), "pixel.png");
  calls += 1;
  const upload = await fetch(`${API}/v2/admin/media`, { method: "POST", headers: { Authorization: `Bearer ${owner}` }, body: form });
  if (upload.status !== 201 || upload.headers.get("sl-violations")) failures.push(`POST /v2/admin/media → ${upload.status} ${await upload.text()}`);
  await call("GET", "/v2/admin/images", 200, o);

  const devices = (await call("GET", "/v2/admin/devices", 200, o)).body;
  const created = (await call("POST", "/v2/admin/devices", 201, {
    ...o,
    body: { name: "Totem 2", kind: "KIOSK", status: "ACTIVE", idleTimerIntervalMilliseconds: 45000, printerEnabled: false, maintenanceMode: false, atCapacityMode: false, paymentTerminalId: "POINT-2" },
  })).body;
  const { id: _id, online: _on, appVersion: _a, lastSeenAt: _l, ip: _ip, screenResolution: _s, ...input } = devices[0];
  await call("PUT", `/v2/admin/devices/${devices[0].id}`, 200, { ...o, body: { ...input, paymentTerminalId: "POINT-1" } });
  await call("POST", `/v2/admin/devices/${created.device.id}/secret`, 200, o);

  const menus = (await call("GET", "/v2/admin/menus", 200, o)).body;
  await call("PUT", "/v2/admin/menus/mnu-noite", 200, { ...o, body: { id: "mnu-noite", name: "Noite", root: [{ type: "CATEGORY", id: "300" }] } });
  await call("PUT", "/v2/admin/menus/mnu-noite", 422, { ...o, body: { id: "mnu-noite", name: "Noite", root: [{ type: "CATEGORY", id: "999" }] } });
  await call("GET", `/v2/admin/menus/${menus[0].id}/schedules`, 200, o);
  await call("PUT", "/v2/admin/menus/mnu-noite/schedules", 409, { ...o, body: [{ dayOfWeek: "MONDAY", open: "10:00:00", close: "12:00:00" }] });
  await call("PUT", "/v2/admin/menus/mnu-noite/schedules", 200, { ...o, body: [{ dayOfWeek: "MONDAY", open: "20:00:00", close: "23:00:00" }] });
  await call("POST", "/v2/admin/menus/mnu-noite/force", 200, { ...o, body: { until: new Date(Date.now() + 3_600_000).toISOString() } });
  await call("DELETE", "/v2/admin/menus/mnu-noite/force", 204, o);
  await call("DELETE", "/v2/admin/menus/mnu-noite", 204, o);

  const sections = (await call("GET", "/v2/admin/sections", 200, o)).body;
  await call("PUT", `/v2/admin/sections/${sections[0].id}`, 200, { ...o, body: sections[0] });
  await call("PUT", "/v2/admin/sections/400", 200, { ...o, body: { id: "400", name: "Doces", type: "CATEGORY", available: true, links: [], translations: { en: { name: "Sweets" } } } });
  await call("DELETE", "/v2/admin/sections/400", 204, o);
  await call("DELETE", "/v2/admin/sections/110", 422, o);

  const allItems = (await call("GET", "/v2/admin/items", 200, o)).body;
  await call("GET", "/v2/admin/items?type=COMBO_MEAL", 200, o);
  const cheese = allItems.find((i: { id: string }) => i.id === "X-CHEESE");
  await call("PUT", "/v2/admin/items/X-CHEESE", 200, { ...o, body: { ...cheese, price: 1.25 } });
  await call("PUT", "/v2/admin/items/X-NEW", 200, { ...o, body: { id: "X-NEW", name: "Picles", type: "ITEM", price: 0.5, available: true, links: [] } });
  await call("PUT", "/v2/admin/items/X-NEW", 422, { ...o, body: { id: "X-NEW", name: "Picles", type: "ITEM", price: 0.5, available: true, links: [{ type: "MODIFIERS", id: "NOPE" }] } });
  await call("PUT", "/v2/admin/items/X-OTHER", 422, { ...o, body: { id: "X-NEW", name: "Picles", type: "ITEM", price: 0.5, available: true, links: [] } });
  await call("DELETE", "/v2/admin/items/X-NEW", 204, o);
  await call("DELETE", "/v2/admin/items/X-CHEESE", 422, o);
  await call("PUT", "/v2/admin/items/X-BACON/availability", 200, { ...o, body: { available: true } });

  const groups = (await call("GET", "/v2/admin/modifier-groups", 200, o)).body;
  await call("PUT", `/v2/admin/modifier-groups/${groups[0].id}`, 200, { ...o, body: groups[0] });
  await call("PUT", "/v2/admin/modifier-groups/M-EMPTY", 422, { ...o, body: { id: "M-EMPTY", name: "Vazio", type: "MODIFIERS", min: 0, max: 1, links: [] } });
  await call("DELETE", "/v2/admin/modifier-groups/M-SAUCE", 422, o);

  const swaps = (await call("GET", "/v2/admin/swap-sells", 200, o)).body;
  await call("PUT", `/v2/admin/swap-sells/${swaps[0].id}`, 200, { ...o, body: swaps[0] });
  await call("DELETE", "/v2/admin/swap-sells/SS-1001", 422, o);

  await call("GET", "/v2/admin/badges", 200, o);
  await call("PUT", "/v2/admin/badges/VEG", 200, { ...o, body: { id: "VEG", name: "Vegano", textColour: "#FFFFFF", backgroundColour: "#2E7D32" } });
  await call("DELETE", "/v2/admin/badges/VEG", 204, o);
  await call("DELETE", "/v2/admin/badges/NOVO", 422, o);

  await call("GET", "/v2/admin/discount-rules", 200, o);
  await call("PUT", "/v2/admin/discount-rules/dr-new", 200, { ...o, body: { id: "dr-new", code: "NOVO15", name: "15%", type: "PERCENT", value: 15, active: true } });
  await call("PUT", "/v2/admin/discount-rules/dr-other", 409, { ...o, body: { id: "dr-other", code: "NOVO15", name: "15%", type: "PERCENT", value: 15, active: true } });
  await call("DELETE", "/v2/admin/discount-rules/dr-new", 204, o);

  await call("POST", `/v2/admin/orders/${placed.number}/cancel`, 409, { ...o, body: { reason: "OTHER" } });
  await call("GET", "/v2/admin/pace", 200, o);
  await call("PUT", "/v2/admin/pace", 200, { ...o, body: { pace: "PAUSED", pauseMinutes: 15 } });
  await call("PUT", "/v2/admin/pace", 200, { ...o, body: { pace: "NORMAL" } });
  await call("PUT", "/v2/admin/pace/wait-minutes", 200, { ...o, body: { NORMAL: 8, BUSY: 15 } });
  await call("GET", `/v2/admin/reports/daily?date=${placed.number.slice(0, 4)}-${placed.number.slice(4, 6)}-${placed.number.slice(6, 8)}`, 200, o);

  await control("/scenario", { name: "normal" });
  if (failures.length) {
    console.error(`smoke: ${failures.length} of ${calls} calls failed`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`smoke: ${calls} calls, all valid`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
