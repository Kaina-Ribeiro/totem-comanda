import { describe, expect, it } from "vitest";

import { cents } from "./form";

describe("cents", () => {
  it("reads Brazilian and plain prices as integer cents", () => {
    expect(cents("28,00")).toBe(2800);
    expect(cents("R$ 1.234,50")).toBe(123450);
    expect(cents("13.9")).toBe(1390);
    expect(cents("7")).toBe(700);
    expect(cents("")).toBeNull();
    expect(cents("-3")).toBeNull();
  });
});
