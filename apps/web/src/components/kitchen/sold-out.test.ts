import { describe, expect, it } from "vitest";

import { kitchenLines, type KitchenOrder } from "@/lib/kitchen/order";

import { lineTargets, soldOutKey } from "./sold-out";

describe("lineTargets", () => {
  it("offers the whole product, then each chosen option once, nested ones too", () => {
    const [latte] = kitchenLines({
      orderItems: [
        {
          id: "item-latte",
          name: "Latte",
          quantity: 1,
          modifiers: [
            { id: "opt-aveia", name: "Leite de aveia", quantity: 2 },
            { id: "opt-calda", name: "Calda", quantity: 1, modifiers: [{ id: "opt-canela", name: "Canela", quantity: 1 }] },
          ],
        },
      ],
    } as KitchenOrder);
    const targets = lineTargets(latte);
    expect(targets.map(soldOutKey)).toEqual(["item-latte", "opt-aveia", "opt-calda", "opt-canela"]);
    expect(targets.map((t) => t.whole)).toEqual([true, false, false, false]);
  });
});
