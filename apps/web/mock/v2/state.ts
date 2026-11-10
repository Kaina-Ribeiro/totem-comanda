// In-memory state of the v2 mock. Devices, tokens, the clock, media and the
// store pace are shared with v1 (../state.ts, ../pace.ts); everything else here
// is v2-only. It reseeds whenever v1 switched scenario (v1 replaces its `state`
// object), so both versions always reset together.

import { state as v1 } from "../state.ts";
import type { Entity, S } from "./http.ts";
import { key } from "./http.ts";
import {
  seedBadges,
  seedDiscountRules,
  seedEntities,
  seedMenus,
  seedStore,
  type MockMenuV2,
} from "./seed.ts";

export type { MockMenuV2 };

export type Basket = {
  id: string;
  deviceId: string;
  /** The last request priced, so payments and orders can re-price it. */
  request: S["TotalsRequest"];
  couponCode: string | null;
  totals: S["TotalsResponse"];
};

export type Session = S["PaymentSession"] & {
  deviceId: string;
  /** Mock only: when the simulated Mercado Pago answers (ms since epoch). */
  outcomeAt: number;
  approvedAt: number | null;
};

export type StoredOrder = S["SubmitOrderResponse"] & {
  deviceId: string;
  businessDate: string;
  couponCode: string | null;
};

export type Refund = {
  paymentId: string;
  basketId: string;
  amount: number;
  at: string;
  reason: "APPROVED_AFTER_EXPIRY" | "SECOND_PAYMENT";
};

function seed() {
  const entities = new Map<string, Entity>();
  for (const e of seedEntities()) entities.set(key(e.type, e.id), e);
  return {
    store: seedStore(),
    entities,
    menus: seedMenus(),
    badges: seedBadges(),
    discountRules: seedDiscountRules(),
    baskets: new Map<string, Basket>(),
    payments: new Map<string, Session>(),
    orders: new Map<string, StoredOrder>(),
    checkNumbers: { date: "", last: 0 },
    refunds: [] as Refund[],
    /** deviceId → Point terminal; kiosks not listed use MOCK-POINT-001. */
    terminals: new Map<string, string | null>(),
    /** Image entity id → width and height, for MediaAsset. */
    imageSizes: new Map<string, { width: number; height: number }>(),
    journeys: new Map<string, { deviceId: string; language: S["LanguageCode"]; at: string }>(),
  };
}

export type V2State = ReturnType<typeof seed>;

let current: V2State | null = null;
let boundTo: object | null = null;

/** The v2 state, reseeded when the v1 state was replaced (scenario switch). */
export function v2(): V2State {
  if (!current || boundTo !== v1) {
    current = seed();
    boundTo = v1;
  }
  return current;
}

export function paymentTerminalId(deviceId: string): string | null {
  const s = v2();
  if (s.terminals.has(deviceId)) return s.terminals.get(deviceId) ?? null;
  const device = v1.devices.find((d) => d.id === deviceId);
  return device?.kind === "KIOSK" ? "MOCK-POINT-001" : null;
}
