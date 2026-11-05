import { describe, expect, it } from "vitest";

import { OFFLINE_COPY, offlineArea } from "./offline-copy";

describe("offlineArea", () => {
  it("tells the kitchen from the kiosk", () => {
    expect(offlineArea("/kitchen")).toBe("kitchen");
    expect(offlineArea("/kitchen/anything")).toBe("kitchen");
    expect(offlineArea("/kiosk")).toBe("kiosk");
  });

  it("gives every other page the plain text", () => {
    expect(offlineArea("/")).toBe("page");
    expect(offlineArea("/admin/relatorio")).toBe("page");
    expect(offlineArea("/setup")).toBe("page");
    expect(offlineArea("/kitchenette")).toBe("page");
  });
});

describe("OFFLINE_COPY", () => {
  it("only sends guests to the counter on the kiosk (COM-91)", () => {
    expect(OFFLINE_COPY.kiosk.body).toContain("balcão");
    expect(OFFLINE_COPY.kitchen.body).not.toMatch(/totem|balcão/);
    expect(OFFLINE_COPY.page.body).not.toMatch(/totem|balcão/);
  });
});
