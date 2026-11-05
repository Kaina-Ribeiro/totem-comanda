// Fixtures for the kiosk journey's component tests (not a test file itself).
import type { Order, OrderTotal, Payment } from "@/app/kiosk/actions";
import type { BasketLine } from "@/lib/kiosk/menu-view";
import { BUNDLED } from "@/lib/kiosk/strings";

import { seedCatalogue } from "../../../../mock/catalogue";
import { resolveMenu } from "../../../../mock/kiosk-menu";
import {
  initialJourney,
  type Journey,
  type JourneyAction,
  journeyReducer,
  quoteKey,
} from "./journey-state";

/** The mock's morning menu, the same shape the Core API returns. */
export const menu = resolveMenu(
  { id: "mnu-manha", name: { "pt-BR": "Manhã" }, showCategoriesPrice: false },
  seedCatalogue(),
  "pt-BR",
  "2026-10-30",
);

export const strings = BUNDLED["pt-BR"];

export const line = (itemId: string, quantity = 1, guid = `line-${itemId}`): BasketLine => ({
  guid,
  itemId,
  quantity,
  options: [],
});

/** A journey started in pt-BR, take-away, with `actions` applied after the start. */
export function journeyAt(...actions: JourneyAction[]): Journey {
  const started = [
    { type: "start" },
    {
      type: "started",
      orderNonce: "00000000-0000-4000-8000-000000000001",
      journeyStartedTimestamp: "2026-10-30T09:00:00Z",
      menu,
      strings,
      orderType: "TAKE_OUT",
    },
  ] satisfies JourneyAction[];
  return [...started, ...actions].reduce(journeyReducer, initialJourney("pt-BR"));
}

export const total = (cents: number): OrderTotal => ({
  subtotal: cents,
  discountTotal: 0,
  total: cents,
  taxInclusive: true,
  tax: null,
  currency: "BRL",
});

/** The quote the Core API would answer for the journey's basket as it is now. */
export const quotedAt = (journey: Journey, cents: number): JourneyAction => ({
  type: "quoted",
  key: quoteKey(journey),
  result: { ok: true, data: total(cents) },
});

export const order = (cents: number, id = "ord-1"): Order => ({
  id,
  orderNonce: "00000000-0000-4000-8000-000000000001",
  orderType: "TAKE_OUT",
  status: "AWAITING_PAYMENT",
  posCheckNumber: null,
  businessDate: "2026-10-30",
  language: "pt-BR",
  orderItems: [],
  orderTotal: total(cents),
  cpfCnpj: null,
  journeyStartedTimestamp: "2026-10-30T09:00:00Z",
  createdAt: "2026-10-30T09:05:00Z",
  placedAt: null,
  readyAt: null,
});

export const payment = (
  paymentStatus: Payment["paymentStatus"],
  id = "pay-1",
  method: Payment["method"] = "CREDIT",
): Payment => ({
  id,
  orderId: "ord-1",
  method,
  amount: 1400,
  paymentStatus,
  gatewayType: "SIMULATED",
  providerRef: null,
  failureReason: null,
  pix: null,
  createdAt: "2026-10-30T09:05:00Z",
  updatedAt: "2026-10-30T09:05:00Z",
});
