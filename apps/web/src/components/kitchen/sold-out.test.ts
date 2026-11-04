import { describe, expect, it } from "vitest";

import { lineTargets, soldOutKey } from "./sold-out";

describe("lineTargets", () => {
  it("offers the whole item, then each chosen option once", () => {
    const targets = lineTargets({
      itemId: "item-latte",
      name: "Latte",
      quantity: 2,
      options: ["Leite de aveia", "Leite de aveia", "Canela"],
      choices: [
        { optionId: "opt-aveia", name: "Leite de aveia", quantity: 1 },
        { optionId: "opt-aveia", name: "Leite de aveia", quantity: 1 },
        { optionId: "opt-canela", name: "Canela", quantity: 1 },
      ],
    });
    expect(targets.map(soldOutKey)).toEqual([
      "item-latte:",
      "item-latte:opt-aveia",
      "item-latte:opt-canela",
    ]);
  });
});
