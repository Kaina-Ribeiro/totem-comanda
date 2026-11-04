import type { components } from "@/lib/core-api";

type Weekday = components["schemas"]["Weekday"];
type Schedule = components["schemas"]["MenuSchedule"];

// Display helpers for the back office home (plan G-A1, prototype A1). Which
// menu is live is Go's answer (`AdminMenu.isActive`); these only describe it.

const WEEKDAYS: Weekday[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_NAME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Wall-clock parts of `now` in the restaurant's timezone. */
export function localNow(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = WEEKDAYS.indexOf(parts.weekday.toUpperCase().slice(0, 3) as Weekday);
  return {
    /** 0 = Sunday. */
    day,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    hour: Number(parts.hour),
    /** Business date, YYYY-MM-DD. */
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** "Bom dia", "Boa tarde", "Boa noite" by the restaurant's clock (fixes COM-67). */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** The same business date a week earlier, for "que na quarta passada". */
export function weekBefore(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** "+12% que na quarta passada"; null when last week had nothing to compare. */
export function versusLastWeek(today: number, lastWeek: number, day: number): string | null {
  if (lastWeek <= 0) return null;
  const percent = Math.round(((today - lastWeek) / lastWeek) * 100);
  const name = DAY_NAME[day];
  const passada = day === 0 || day === 6 ? "passado" : "passada";
  const na = day === 0 || day === 6 ? "no" : "na";
  if (percent === 0) return `Igual ${na === "no" ? "ao" : "à"} ${name} ${passada}`;
  return `${percent > 0 ? "+" : ""}${percent}% que ${na} ${name} ${passada}`;
}

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * When the live menu's current window ends ("20:00"), from its schedule.
 * A window whose end is before its start runs past midnight.
 */
export function windowEnd(schedules: Schedule[], day: number, minutes: number): string | null {
  const today = WEEKDAYS[day];
  const yesterday = WEEKDAYS[(day + 6) % 7];
  for (const w of schedules) {
    const start = toMinutes(w.timeStart);
    const end = toMinutes(w.timeEnd);
    const overnight = end <= start;
    if (w.weekday === today && minutes >= start && (overnight || minutes < end)) return w.timeEnd;
    if (w.weekday === yesterday && overnight && minutes < end) return w.timeEnd;
  }
  return null;
}

export type NextOpening = { menu: string; inDays: number; time: string };

/** The next window start after now across all menus, within a week. */
export function nextOpening(
  menus: { name: string; schedules: Schedule[] }[],
  day: number,
  minutes: number,
): NextOpening | null {
  let best: (NextOpening & { at: number }) | null = null;
  for (const menu of menus) {
    for (const w of menu.schedules) {
      const offset = (WEEKDAYS.indexOf(w.weekday) - day + 7) % 7;
      const start = toMinutes(w.timeStart);
      const inDays = offset === 0 && start <= minutes ? 7 : offset;
      const at = inDays * 1440 + start;
      if (!best || at < best.at) best = { menu: menu.name, inDays, time: w.timeStart, at };
    }
  }
  return best && { menu: best.menu, inDays: best.inDays, time: best.time };
}

/** "hoje às 15:00", "amanhã às 06:00", "sexta às 06:00". */
export function whenLabel(opening: NextOpening, day: number): string {
  const when =
    opening.inDays === 0
      ? "hoje"
      : opening.inDays === 1
        ? "amanhã"
        : DAY_NAME[(day + opening.inDays) % 7];
  return `${when} às ${opening.time}`;
}

/** "sinal há 12 s", "sinal há 3 min", "sem sinal desde 10:30". */
export function signalLabel(
  online: boolean,
  lastSeenAt: string | null,
  now: Date,
  timeZone: string,
): string {
  if (!lastSeenAt) return "nunca conectou";
  const seconds = Math.max(0, Math.round((now.getTime() - Date.parse(lastSeenAt)) / 1000));
  if (!online) {
    const time = new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(lastSeenAt));
    return `sem sinal desde ${time}`;
  }
  if (seconds < 60) return `online, sinal há ${seconds} s`;
  if (seconds < 3600) return `online, sinal há ${Math.floor(seconds / 60)} min`;
  return `online, sinal há ${Math.floor(seconds / 3600)} h`;
}

export type KioskState = "maintenance" | "closed" | "paused" | "busy" | "open";

/**
 * What the kiosk shows, in the screen precedence of decision 14 (offline is
 * the kiosk's own): maintenance, then closed, then paused, then live (busy or
 * normal).
 */
export function kioskState(status: { open: boolean; maintenance: boolean; pace: { pace: "NORMAL" | "BUSY" | "PAUSED" } }): KioskState {
  if (status.maintenance) return "maintenance";
  if (!status.open) return "closed";
  if (status.pace.pace === "PAUSED") return "paused";
  return status.pace.pace === "BUSY" ? "busy" : "open";
}
