import { describe, expect, it } from "vitest";

import { displayCheckNumber } from "./check-number";

describe("displayCheckNumber", () => {
  it("keeps the last digits of a long number only (BR-POST-01)", () => {
    expect(displayCheckNumber("142", 2)).toBe("42");
    expect(displayCheckNumber("42", 2)).toBe("42");
    expect(displayCheckNumber("7", 2)).toBe("7");
    expect(displayCheckNumber("A-142", 2)).toBe("A-142");
    expect(displayCheckNumber("142", 0)).toBe("142");
  });
});
