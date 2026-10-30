import { describe, expect, it } from "vitest";

import { formatNextOpening } from "./next-opening";

const tz = "America/Sao_Paulo";
// Thursday 30 Oct 2026, 21:00 in São Paulo (UTC-3).
const now = new Date("2026-10-31T00:00:00Z");

describe("formatNextOpening", () => {
  it("says only the time when it opens later today", () => {
    expect(formatNextOpening("2026-10-31T01:30:00Z", tz, now)).toBe("Voltamos às 22:30");
  });

  it("says tomorrow for the next local day", () => {
    expect(formatNextOpening("2026-10-31T09:00:00Z", tz, now)).toBe("Voltamos amanhã às 06:00");
  });

  it("names the weekday further ahead", () => {
    expect(formatNextOpening("2026-11-02T09:00:00Z", tz, now)).toBe(
      "Voltamos segunda-feira às 06:00",
    );
  });

  it("uses the restaurant's timezone, not the server's", () => {
    // 02:00 UTC on the 31st is still the 30th, 23:00, in São Paulo.
    expect(formatNextOpening("2026-10-31T02:00:00Z", tz, now)).toBe("Voltamos às 23:00");
  });
});
