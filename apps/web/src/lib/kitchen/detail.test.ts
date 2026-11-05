import { describe, expect, it } from "vitest";

import type { components } from "@/lib/core-api";

import { changeLabel, historyRows, timesLine } from "./detail";

type KitchenOrder = components["schemas"]["KitchenOrder"];

// 10:30 in São Paulo is 13:30 UTC.
const at = (hhmm: string) =>
  `2026-11-04T${String(Number(hhmm.slice(0, 2)) + 3).padStart(2, "0")}:${hhmm.slice(3)}:00Z`;

function order(partial: Partial<KitchenOrder>): KitchenOrder {
  return {
    id: "o1",
    posCheckNumber: "41",
    orderType: "DINEIN",
    status: "PAID",
    placedAt: at("10:30"),
    readyAt: null,
    updatedAt: at("10:30"),
    version: 1,
    history: [{ status: "PAID", at: at("10:30"), by: "KIOSK" }],
    lines: [],
    ...partial,
  };
}

describe("changeLabel", () => {
  it("names forward moves, steps back and who made them", () => {
    const paid = { status: "PAID", at: at("10:30"), by: "KIOSK" } as const;
    const prep = {
      status: "PREPARING",
      at: at("10:33"),
      by: "KITCHEN",
    } as const;
    expect(changeLabel(paid, undefined)).toBe("Pago no totem");
    expect(changeLabel(prep, paid)).toBe("Começou na cozinha");
    expect(changeLabel({ ...paid, by: "KITCHEN" }, prep)).toBe("Voltou para Novos");
    expect(changeLabel({ status: "CANCELLED", at: at("10:40"), by: "OWNER" }, prep)).toBe(
      "Cancelado pela dona",
    );
  });
});

describe("historyRows", () => {
  it("ends with a late 'now' row while the order is still being made", () => {
    const o = order({
      status: "PREPARING",
      history: [
        { status: "PAID", at: at("10:30"), by: "KIOSK" },
        { status: "PREPARING", at: at("10:33"), by: "KITCHEN" },
      ],
    });
    expect(historyRows(o, Date.parse(at("10:42")))).toEqual([
      { time: "10:30", label: "Pago no totem", tone: "done" },
      { time: "10:33", label: "Começou na cozinha", tone: "done" },
      {
        time: "Agora",
        label: "12 min esperando, passou do tempo",
        tone: "late",
      },
    ]);
  });

  it("has no 'now' row once the order is ready", () => {
    const o = order({ status: "READY" });
    expect(historyRows(o, Date.parse(at("10:42"))).at(-1)?.time).toBe("10:30");
  });
});

describe("timesLine", () => {
  it("uses the last start after a step back", () => {
    const o = order({
      status: "PREPARING",
      history: [
        { status: "PAID", at: at("10:30"), by: "KIOSK" },
        { status: "PREPARING", at: at("10:31"), by: "KITCHEN" },
        { status: "PAID", at: at("10:32"), by: "KITCHEN" },
        { status: "PREPARING", at: at("10:33"), by: "KITCHEN" },
      ],
    });
    expect(timesLine(o)).toBe("Pago no totem às 10:30 · começou às 10:33");
  });
});
