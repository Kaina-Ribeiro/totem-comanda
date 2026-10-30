import { describe, expect, it } from "vitest";

import { gateState, statusReport } from "./gate";

const open = { maintenanceMode: false, atCapacityMode: false, isOpen: true };

describe("gateState (BR-KIOSK-09 order)", () => {
  it("is open when trading", () => {
    expect(gateState(open)).toBe("open");
  });

  it("puts maintenance before at capacity and closed", () => {
    expect(gateState({ maintenanceMode: true, atCapacityMode: true, isOpen: false })).toBe(
      "maintenance",
    );
  });

  it("puts at capacity before closed", () => {
    expect(gateState({ ...open, atCapacityMode: true, isOpen: false })).toBe("at-capacity");
  });

  it("is closed with no active menu", () => {
    expect(gateState({ ...open, isOpen: false })).toBe("closed");
  });
});

describe("statusReport (OP-KIOSK-04)", () => {
  it("reports TRADING when open", () => {
    expect(statusReport("open")).toEqual({
      kind: "STATUS",
      statusType: "TRADING",
      category: "APPLICATION_STATUS",
      message: "Config refreshed",
    });
  });

  it.each([
    ["maintenance", "MAINTENANCE"],
    ["at-capacity", "AT_CAPACITY"],
    ["closed", "STORE_CLOSED"],
  ] as const)("reports UNAVAILABLE with reason when %s", (state, reason) => {
    expect(statusReport(state)).toMatchObject({ statusType: "UNAVAILABLE", reason });
  });
});
