import { describe, expect, it } from "vitest";

import {
  businessDate,
  dayIsOver,
  greeting,
  kioskState,
  localNow,
  nextOpening,
  signalLabel,
  totalVersusLastWeek,
  versusLastWeek,
  weekBefore,
  whenLabel,
  windowEnd,
} from "./home";

const TZ = "America/Sao_Paulo";

describe("back office home", () => {
  it("reads the restaurant's clock, not the server's", () => {
    // 01:30 UTC on Thursday is 22:30 on Wednesday in São Paulo.
    expect(localNow(new Date("2026-11-05T01:30:00Z"), TZ)).toEqual({
      day: 3,
      minutes: 22 * 60 + 30,
      hour: 22,
      date: "2026-11-04",
    });
  });

  it("greets by the hour", () => {
    expect([4, 5, 11, 12, 17, 18, 23].map(greeting)).toEqual([
      "Boa noite",
      "Bom dia",
      "Bom dia",
      "Boa tarde",
      "Boa tarde",
      "Boa noite",
      "Boa noite",
    ]);
  });

  it("compares with the same weekday a week before", () => {
    expect(weekBefore("2026-11-04")).toBe("2026-10-28");
    expect(versusLastWeek(112, 100, 3)).toBe("+12% que na quarta passada");
    expect(versusLastWeek(90, 100, 6)).toBe("-10% que no sábado passado");
    expect(versusLastWeek(100, 100, 3)).toBe("Igual à quarta passada");
    expect(versusLastWeek(100, 0, 3)).toBeNull();
  });

  describe("a running total against last week (COM-127)", () => {
    const brl = (cents: number) => `R$ ${cents / 100}`;

    it("does not compare the morning with last week's whole day", () => {
      // 09:00: R$ 50 so far against R$ 1.000 for all of last Wednesday.
      expect(totalVersusLastWeek(5_000, 100_000, 3, false, brl)).toBe(
        "A quarta passada fechou em R$ 1000",
      );
      expect(totalVersusLastWeek(3, 40, 6, false, String)).toBe("O sábado passado fechou em 40");
    });

    it("compares once the day is over", () => {
      expect(totalVersusLastWeek(112_000, 100_000, 3, true, brl)).toBe(
        "+12% que na quarta passada",
      );
    });

    it("says nothing when last week sold nothing", () => {
      expect(totalVersusLastWeek(5_000, 0, 3, false, brl)).toBeNull();
    });

    it("knows the day is over only when nothing opens again today", () => {
      const tomorrow = { menu: "Manhã", inDays: 1, time: "06:00" };
      const later = { menu: "Tarde", inDays: 0, time: "15:00" };
      expect(dayIsOver({ open: true, next: tomorrow })).toBe(false);
      expect(dayIsOver({ open: false, next: later })).toBe(false);
      expect(dayIsOver({ open: false, next: tomorrow })).toBe(true);
      expect(dayIsOver({ open: false, next: null })).toBe(true);
    });
  });

  it("finds when the live window ends, overnight windows included", () => {
    const day = [{ weekday: "WED", timeStart: "11:00", timeEnd: "20:00" }] as const;
    expect(windowEnd([...day], 3, 15 * 60)).toBe("20:00");
    expect(windowEnd([...day], 3, 20 * 60)).toBeNull();
    const night = [{ weekday: "WED", timeStart: "22:00", timeEnd: "02:00" }] as const;
    expect(windowEnd([...night], 3, 23 * 60)).toBe("02:00");
    expect(windowEnd([...night], 4, 60)).toBe("02:00");
  });

  it("finds the next opening across menus", () => {
    const menus = [
      { name: "Manhã", schedules: [{ weekday: "THU", timeStart: "06:00", timeEnd: "11:00" }] },
      { name: "Tarde", schedules: [{ weekday: "WED", timeStart: "11:00", timeEnd: "20:00" }] },
    ] as never;
    const late = nextOpening(menus, 3, 21 * 60)!;
    expect(late).toEqual({ menu: "Manhã", inDays: 1, time: "06:00" });
    expect(whenLabel(late, 3)).toBe("amanhã às 06:00");
    expect(whenLabel(nextOpening(menus, 3, 9 * 60)!, 3)).toBe("hoje às 11:00");
  });

  it("describes a device's signal", () => {
    const now = new Date("2026-11-04T13:42:12Z");
    expect(signalLabel(true, "2026-11-04T13:42:00Z", now, TZ)).toBe("online, sinal há 12 s");
    expect(signalLabel(true, "2026-11-04T13:39:00Z", now, TZ)).toBe("online, sinal há 3 min");
    expect(signalLabel(false, "2026-11-04T13:30:00Z", now, TZ)).toBe("sem sinal desde 10:30");
    expect(signalLabel(false, null, now, TZ)).toBe("nunca conectou");
  });
});

describe("kioskState (decision 14)", () => {
  const live = { open: true, maintenance: false, pace: { pace: "NORMAL" as const } };
  it.each([
    [{ ...live, maintenance: true, open: false, pace: { pace: "PAUSED" as const } }, "maintenance"],
    [{ ...live, open: false, pace: { pace: "PAUSED" as const } }, "closed"],
    [{ ...live, pace: { pace: "PAUSED" as const } }, "paused"],
    [{ ...live, pace: { pace: "BUSY" as const } }, "busy"],
    [live, "open"],
  ])("%o is %s", (status, expected) => {
    expect(kioskState(status)).toBe(expected);
  });
});

describe("businessDate", () => {
  it("counts the hours before the cutoff as the day before (cutoff 04:00)", () => {
    // 01:30 in São Paulo is 04:30 UTC.
    expect(businessDate(new Date("2026-11-10T04:30:00Z"), "America/Sao_Paulo", "04:00")).toBe("2026-11-09");
    // 04:30 in São Paulo.
    expect(businessDate(new Date("2026-11-10T07:30:00Z"), "America/Sao_Paulo", "04:00")).toBe("2026-11-10");
  });

  it("is the calendar date with a 00:00 cutoff", () => {
    expect(businessDate(new Date("2026-11-10T04:30:00Z"), "America/Sao_Paulo", "00:00")).toBe("2026-11-10");
  });
});
