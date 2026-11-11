// Places paid kiosk orders on the running mock, as the seeded kiosk, through
// the same v2 calls the kiosk makes (totals → Pix payment → approved → order),
// so they reach the kitchen, the report and Início (pilot v2, COM-148).
// `--days-ago N` moves the mock's clock back N days for them and then forward
// again, so the back office has a past day to compare with (Início, Relatório).
//
//   npm run mock:orders -- 3              three orders now
//   npm run mock:orders -- 3 --days-ago 7 three orders on the same weekday last week

import { randomUUID } from "node:crypto";

const CONTROL = process.env.MOCK_CONTROL_URL ?? "http://localhost:4020/__mock";
const API = new URL(CONTROL).origin;
// The seeded kiosk (state.ts): a mock-only test credential.
const KIOSK = { deviceId: "KIOSK-TBT-001", deviceSecret: "s3cr3t-from-provisioning" };

const args = process.argv.slice(2);
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 1);
const at = args.indexOf("--days-ago");
const daysAgo = at >= 0 ? Number(args[at + 1]) : 0;

async function call<T>(method: string, url: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${url}: ${res.status} ${JSON.stringify(json)}`);
  return json as T;
}

type Link = { type: string; id: string };
type Entity = { id: string; type: string; available?: boolean; links: Link[] };

/** A product the kiosk can sell with no choices: an available ITEM in a section, linking only images. */
function plainItem(entities: Entity[]): Entity | undefined {
  const inSection = new Set(
    entities
      .filter((e) => e.type === "CATEGORY" || e.type === "SECTION")
      .flatMap((e) => e.links.filter((l) => l.type === "ITEM").map((l) => l.id)),
  );
  return entities.find(
    (e) =>
      e.type === "ITEM" &&
      e.available !== false &&
      inSection.has(e.id) &&
      e.links.every((l) => l.type === "IMAGE"),
  );
}

async function placeOne(token: string) {
  const menu = await call<{ entities: Entity[] }>("GET", `${API}/v2/menus/active?language=pt-BR`, token);
  const item = plainItem(menu.entities);
  if (!item) throw new Error("No live menu with a plain item: is the store open?");
  const items = [{ id: item.id, quantity: 1, uniqueId: 1, modifiers: [] }];
  const totals = await call<{ basketId: string; total: number }>("POST", `${API}/v2/totals?language=pt-BR`, token, {
    orderType: "DINEIN",
    items,
  });
  const payment = await call<{ id: string; tenderId: string; tenderRef: string; amount: number }>(
    "POST",
    `${API}/v2/payments`,
    token,
    { basketId: totals.basketId, method: "PIX", amount: totals.total },
  );
  await call("POST", `${CONTROL}/payments/${payment.id}`, undefined, { outcome: "APPROVED" });
  return call<{ customerCheckNumber: string }>("POST", `${API}/v2/orders`, token, {
    basketId: totals.basketId,
    orderType: "DINEIN",
    items,
    payments: [{ tenderId: payment.tenderId, tenderRef: payment.tenderRef, amount: payment.amount }],
  });
}

const minutes = daysAgo * 24 * 60;
if (minutes) await call("POST", `${CONTROL}/clock`, undefined, { minutes: -minutes });
try {
  const { accessToken } = await call<{ accessToken: string }>("POST", `${API}/v2/devices/auth`, undefined, KIOSK);
  for (let i = 0; i < count; i++) {
    const placed = await placeOne(accessToken);
    console.log(`#${placed.customerCheckNumber}${daysAgo ? ` (${daysAgo} days ago)` : ""}`);
  }
} finally {
  if (minutes) await call("POST", `${CONTROL}/clock`, undefined, { minutes });
}
