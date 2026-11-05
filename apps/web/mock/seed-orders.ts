// Places paid kiosk orders on the running mock, as the seeded kiosk, through
// the same calls the kiosk makes (journey → order → payment → simulate → place).
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

type Entity = { id: string; type: string; optionGroups?: unknown[]; childEntities?: Entity[] };

async function placeOne(token: string) {
  const orderNonce = randomUUID();
  await call("POST", `${API}/v1/journeys`, token, { orderNonce, language: "pt-BR" });
  const menu = await call<{ entities: Entity[] }>("GET", `${API}/v1/menus/active?language=pt-BR`, token);
  const item = menu.entities
    .flatMap((c) => c.childEntities ?? [])
    .find((e) => e.type === "ITEM" && (e.optionGroups ?? []).length === 0);
  if (!item) throw new Error("No live menu with a plain item: is the store open?");
  const order = await call<{ id: string }>("POST", `${API}/v1/orders`, token, {
    orderNonce,
    orderType: "TAKE_OUT",
    language: "pt-BR",
    orderItems: [{ itemId: item.id, quantity: 1, options: [] }],
  });
  const payment = await call<{ id: string }>("POST", `${API}/v1/orders/${order.id}/payments`, token, {
    method: "CREDIT",
  });
  await call("POST", `${API}/v1/payments/${payment.id}/simulate`, token, { outcome: "AUTHORISED" });
  return call<{ posCheckNumber: string }>("POST", `${API}/v1/orders/${order.id}/place`, token);
}

const minutes = daysAgo * 24 * 60;
if (minutes) await call("POST", `${CONTROL}/clock`, undefined, { minutes: -minutes });
try {
  const { accessToken } = await call<{ accessToken: string }>("POST", `${API}/v1/devices/auth`, undefined, KIOSK);
  for (let i = 0; i < count; i++) {
    const placed = await placeOne(accessToken);
    console.log(`#${placed.posCheckNumber}${daysAgo ? ` (${daysAgo} days ago)` : ""}`);
  }
} finally {
  if (minutes) await call("POST", `${CONTROL}/clock`, undefined, { minutes });
}
