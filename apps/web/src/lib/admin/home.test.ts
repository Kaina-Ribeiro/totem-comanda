import { describe, expect, it } from "vitest";

import {
  greeting,
  kioskState,
  localNow,
  nextOpening,
  signalLabel,
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
