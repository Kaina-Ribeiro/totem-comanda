import { describe, expect, it } from "vitest";

import { gateState, statusReport } from "./gate";

const open = { maintenanceMode: false, atCapacityMode: false, isOpen: true };

describe("gateState (decision 14: Maintenance > Closed > Paused > Live)", () => {
  const paused = { pace: { pace: "PAUSED" as const } };

  it("is open when trading", () => {
    expect(gateState(open)).toBe("open");
    expect(gateState({ ...open, pace: { pace: "BUSY" } })).toBe("open");
  });

  it("puts maintenance before closed", () => {
    expect(gateState({ ...open, maintenanceMode: true, isOpen: false })).toBe("maintenance");
  });

  it("puts maintenance before paused", () => {
    expect(gateState({ ...open, ...paused, atCapacityMode: true, maintenanceMode: true })).toBe(
      "maintenance",
    );
  });

  it("puts closed before paused, so a closed store says when it opens", () => {
    expect(gateState({ ...open, ...paused, atCapacityMode: true, isOpen: false })).toBe("closed");
  });

  it("puts closed before a kiosk at capacity", () => {
    expect(gateState({ ...open, atCapacityMode: true, isOpen: false })).toBe("closed");
  });

  it("shows the pause when the store pace is PAUSED", () => {
    expect(gateState({ ...open, ...paused, atCapacityMode: true })).toBe("paused");
  });

  it("shows at capacity for one kiosk set in Aparelhos", () => {
    expect(gateState({ ...open, atCapacityMode: true })).toBe("at-capacity");
  });

  it("is everything at once: maintenance wins", () => {
    expect(
      gateState({ maintenanceMode: true, atCapacityMode: true, isOpen: false, ...paused }),
    ).toBe("maintenance");
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
    ["paused", "AT_CAPACITY"],
    ["closed", "STORE_CLOSED"],
  ] as const)("reports UNAVAILABLE with reason when %s", (state, reason) => {
    expect(statusReport(state)).toMatchObject({ statusType: "UNAVAILABLE", reason });
  });
});
