import { describe, expect, it } from "vitest";

import { activeMenu, nextOpening, type ScheduledMenu, type Weekday } from "./schedule";

const tz = "America/Sao_Paulo";
const every = (timeStart: string, timeEnd: string) =>
  (["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as Weekday[]).map((weekday) => ({
    weekday,
    timeStart,
    timeEnd,
  }));
const menus: ScheduledMenu[] = [
  { id: "manha", schedules: every("06:00", "11:00"), forcedUntil: null },
  { id: "tarde", schedules: every("11:00", "20:00"), forcedUntil: null },
];
// Friday 30 Oct 2026; São Paulo is UTC-3.
const at = (localTime: string) => new Date(`2026-10-30T${localTime}:00-03:00`);

describe("activeMenu", () => {
  it("picks the morning menu at 10:59 and says when it ends", () => {
    const active = activeMenu(menus, at("10:59"), tz);
    expect(active?.menu.id).toBe("manha");
    expect(active?.until.toISOString()).toBe("2026-10-30T14:00:00.000Z");
  });

  it("switches to the afternoon menu at 11:00", () => {
    expect(activeMenu(menus, at("11:00"), tz)?.menu.id).toBe("tarde");
  });

  it("is closed after 20:00", () => {
    expect(activeMenu(menus, at("20:30"), tz)).toBeNull();
  });

  it("runs an overnight window past midnight", () => {
    const night: ScheduledMenu[] = [
      {
        id: "noite",
        schedules: [{ weekday: "FRI", timeStart: "22:00", timeEnd: "02:00" }],
        forcedUntil: null,
      },
    ];
    expect(activeMenu(night, at("23:00"), tz)?.menu.id).toBe("noite");
    expect(activeMenu(night, new Date("2026-10-31T01:30:00-03:00"), tz)?.menu.id).toBe("noite");
    expect(activeMenu(night, new Date("2026-10-31T02:30:00-03:00"), tz)).toBeNull();
  });

  it("lets a forced menu win until forcedUntil", () => {
    const forced = [{ ...menus[1], forcedUntil: "2026-10-30T14:00:00Z" }, menus[0]];
    expect(activeMenu(forced, at("08:00"), tz)?.menu.id).toBe("tarde");
  });
});

describe("nextOpening", () => {
  it("is tomorrow 06:00 when closed in the evening", () => {
    expect(nextOpening(menus, at("21:00"), tz)?.toISOString()).toBe("2026-10-31T09:00:00.000Z");
  });

  it("is today 06:00 before dawn", () => {
    expect(nextOpening(menus, at("04:00"), tz)?.toISOString()).toBe("2026-10-30T09:00:00.000Z");
  });
});
