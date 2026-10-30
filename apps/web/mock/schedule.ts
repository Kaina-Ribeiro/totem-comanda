// Menu schedule evaluation for the mock, following the contract's rules:
// windows in the restaurant's timezone, timeStart later than timeEnd runs past
// midnight, a forced menu wins until forcedUntil. The Go API owns the real one.

export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
export type Window = { weekday: Weekday; timeStart: string; timeEnd: string };
export type ScheduledMenu = { id: string; schedules: Window[]; forcedUntil: string | null };

const WEEKDAYS: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_MS = 86_400_000;

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Local calendar date (as a UTC-midnight timestamp) and minute of day in `timeZone`. */
function local(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const day = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  return { day, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

/** The instant of a local date (UTC-midnight timestamp) plus minutes, in `timeZone`. */
function instant(day: number, minutes: number, timeZone: string): Date {
  const guess = new Date(day + minutes * 60_000);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")!.value; // "GMT-03:00" or "GMT"
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  const offsetMs = match
    ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000
    : 0;
  return new Date(guess.getTime() - offsetMs);
}

const weekdayOf = (day: number) => WEEKDAYS[new Date(day).getUTCDay()];

/** The business date (`YYYY-MM-DD`) of `now` in `timeZone`. */
export function businessDate(now: Date, timeZone: string): string {
  return new Date(local(now, timeZone).day).toISOString().slice(0, 10);
}

/** Today's `hhmm` in `timeZone`, as an instant. */
export function todayAt(hhmm: string, now: Date, timeZone: string): Date {
  return instant(local(now, timeZone).day, minutesOf(hhmm), timeZone);
}

/** The menu active at `now` and when it stops, or null when closed. */
export function activeMenu(menus: ScheduledMenu[], now: Date, timeZone: string) {
  const forced = menus.find((m) => m.forcedUntil && new Date(m.forcedUntil) > now);
  if (forced) return { menu: forced, until: new Date(forced.forcedUntil!) };

  const { day, minutes } = local(now, timeZone);
  for (const menu of menus) {
    for (const w of menu.schedules) {
      const start = minutesOf(w.timeStart);
      const end = minutesOf(w.timeEnd);
      if (start < end) {
        if (w.weekday === weekdayOf(day) && minutes >= start && minutes < end) {
          return { menu, until: instant(day, end, timeZone) };
        }
      } else {
        // Overnight: today from start, or yesterday's window until end.
        if (w.weekday === weekdayOf(day) && minutes >= start) {
          return { menu, until: instant(day + DAY_MS, end, timeZone) };
        }
        if (w.weekday === weekdayOf(day - DAY_MS) && minutes < end) {
          return { menu, until: instant(day, end, timeZone) };
        }
      }
    }
  }
  return null;
}

/** When the next window opens after `now`, within a week; null if never. */
export function nextOpening(menus: ScheduledMenu[], now: Date, timeZone: string): Date | null {
  const { day } = local(now, timeZone);
  let best: Date | null = null;
  for (let d = 0; d <= 7; d++) {
    const date = day + d * DAY_MS;
    for (const menu of menus) {
      for (const w of menu.schedules) {
        if (w.weekday !== weekdayOf(date)) continue;
        const at = instant(date, minutesOf(w.timeStart), timeZone);
        if (at > now && (!best || at < best)) best = at;
      }
    }
  }
  return best;
}
