import { describe, expect, it } from "vitest";

import type { components } from "@/lib/core-api";

import { newerPace } from "./pace";

type StorePace = components["schemas"]["StorePace"];

const pace = (level: StorePace["pace"], changedAt: string): StorePace => ({
  pace: level,
  pausedUntil: null,
  changedAt,
  changedBy: "OWNER",
  waitMinutes: { NORMAL: 8, BUSY: 15 },
});

describe("newerPace", () => {
  it("takes the first pace the board learns", () => {
    const next = pace("BUSY", "2026-11-05T10:00:00Z");
    expect(newerPace(null, next)).toBe(next);
  });

  it("takes a newer change", () => {
    const next = pace("PAUSED", "2026-11-05T10:05:00Z");
    expect(newerPace(pace("NORMAL", "2026-11-05T10:00:00Z"), next)).toBe(next);
  });

  it("keeps the board's pace when a late answer is older", () => {
    const current = pace("PAUSED", "2026-11-05T10:05:00Z");
    expect(newerPace(current, pace("NORMAL", "2026-11-05T10:00:00Z"))).toBe(current);
  });
});
