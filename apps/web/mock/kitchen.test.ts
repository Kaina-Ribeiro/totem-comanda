import { beforeEach, describe, expect, it } from "vitest";

import { closeDay, historyOf } from "./routes-kitchen.ts";
import { applyScenario, state } from "./state.ts";
import type { Schemas } from "./http.ts";

type StoredOrder = Schemas["Order"] & { deviceId: string; menuId: string };

const DAY = 24 * 60 * 60_000;

/** A placed order with just what the kitchen routes read. */
function place(id: string, status: Schemas["OrderStatus"], placedAt: Date): StoredOrder {
  const order = {
    id,
    posCheckNumber: id,
    orderType: "TAKE_OUT",
    status,
    placedAt: placedAt.toISOString(),
    createdAt: placedAt.toISOString(),
    readyAt: null,
    orderItems: [],
    deviceId: "KIOSK-TBT-001",
    menuId: "m",
  } as unknown as StoredOrder;
  state.orders.set(id, order);
  return order;
}

describe("closeDay", () => {
  beforeEach(() => {
    applyScenario("normal");
    state.orders.clear();
  });

  it("moves today's open orders to NOT_COLLECTED with a history entry and counts them", () => {
    const at = new Date();
    for (const [id, status] of [
      ["1", "PAID"],
      ["2", "PREPARING"],
      ["3", "READY"],
      ["4", "COLLECTED"],
      ["5", "CANCELLED"],
    ] as const) {
      place(id, status, at);
    }

    expect(closeDay(at)).toBe(3);
    expect([...state.orders.values()].map((o) => o.status)).toEqual([
      "NOT_COLLECTED",
      "NOT_COLLECTED",
      "NOT_COLLECTED",
      "COLLECTED",
      "CANCELLED",
    ]);
    const last = historyOf(state.orders.get("3")!).at(-1);
    expect(last).toMatchObject({ status: "NOT_COLLECTED", by: "KITCHEN" });
  });

  it("leaves open orders of another business day alone", () => {
    const at = new Date();
    place("old", "READY", new Date(at.getTime() - DAY));
    expect(closeDay(at)).toBe(0);
    expect(state.orders.get("old")!.status).toBe("READY");
  });

  it("returns 0 when called again with nothing open", () => {
    const at = new Date();
    place("1", "PAID", at);
    closeDay(at);
    expect(closeDay(at)).toBe(0);
  });
});
