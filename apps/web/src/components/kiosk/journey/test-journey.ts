// Fixtures for the kiosk journey's component tests (not a test file itself).
import type { PaymentSession, SubmitOrderResponse, TotalsResponse } from "@/app/kiosk/actions";
import type { BasketLine } from "@/lib/kiosk/basket-v2";
import { readMenu } from "@/lib/kiosk/menu-graph";
import { BUNDLED } from "@/lib/kiosk/strings";

import { applyScenario, now } from "../../../../mock/state";
import { guestMenu } from "../../../../mock/v2/menu";
import { initialJourney, type Journey, type JourneyAction, journeyReducer, totalsKey } from "./journey-state";

/** The v2 mock's afternoon menu (MODELS 5.20 minus tax), as the kiosk reads it. */
export function referenceMenu() {
  applyScenario("afternoon");
  return readMenu(guestMenu(now(), "pt-BR")!);
}
export const menu = referenceMenu();

export const strings = BUNDLED["pt-BR"];

/** A basket line of a product with no choices (2010 is the pint, 1002 the veggie burger). */
export const line = (productId: string, quantity = 1, guid = `line-${productId}`): BasketLine => ({
  guid,
  productId,
  quantity,
  picks: [],
});

/** A journey started in pt-BR on the reference menu, with `actions` applied after the start. */
export function journeyAt(...actions: JourneyAction[]): Journey {
  const started = [
    { type: "start" },
    {
      type: "started",
      orderNonce: "00000000-0000-4000-8000-000000000001",
      journeyStartedTimestamp: "2026-11-10T12:00:00Z",
      menu,
      strings,
    },
  ] satisfies JourneyAction[];
  return [...started, ...actions].reduce(journeyReducer, initialJourney("pt-BR"));
}

export const totals = (total: number, extra: Partial<TotalsResponse> = {}): TotalsResponse => ({
  basketId: "B-1",
  subTotal: total,
  discount: 0,
  tax: 0,
  total,
  orderItems: [],
  taxes: [],
  discounts: [],
  ...extra,
});

/** Go's totals for the journey's basket as it is now. */
export const pricedAt = (journey: Journey, total: number, extra: Partial<TotalsResponse> = {}): JourneyAction => ({
  type: "priced",
  key: totalsKey(journey),
  result: { ok: true, data: totals(total, extra) },
});

export const session = (
  status: PaymentSession["status"],
  method: PaymentSession["method"] = "PIX",
  id = "pay-1",
): PaymentSession => ({
  id,
  basketId: "B-1",
  method,
  amount: 5.2,
  status,
  tenderId: method === "PIX" ? "MP_PIX" : "MP_POINT",
  tenderRef: "1319876543",
  qrCode: method === "PIX" ? "data:image/png;base64,iVBORw0KGgo=" : null,
  copyPaste: method === "PIX" ? "00020126580014br.gov.bcb.pix-mock" : null,
  expiresAt: method === "PIX" ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
  terminalId: method === "CARD" ? "PAX_A910__SMARTPOS1" : null,
  createdAt: new Date().toISOString(),
});

export const placed: SubmitOrderResponse = {
  ...totals(5.2),
  number: "20261110-0042",
  customerCheckNumber: "42",
  displayText: "Pedido 42",
  orderType: "DINEIN",
  status: "PAID",
  version: 1,
  placedAt: "2026-11-10T12:04:10Z",
  history: [{ status: "PAID", at: "2026-11-10T12:04:10Z", by: "KIOSK" }],
};
