const DAY_MS = 24 * 60 * 60 * 1000;

function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date); // YYYY-MM-DD
}

/**
 * "Voltamos às 06:00", "Voltamos amanhã às 06:00" or "Voltamos segunda-feira
 * às 06:00", in the restaurant's timezone. Display only: when the kiosk opens
 * is decided by the Core API (`nextOpeningAt`).
 */
export function formatNextOpening(nextOpeningAt: string, timeZone: string, now = new Date()) {
  const opening = new Date(nextOpeningAt);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(opening);

  const day = localDate(opening, timeZone);
  if (day === localDate(now, timeZone)) return `Voltamos às ${time}`;
  if (day === localDate(new Date(now.getTime() + DAY_MS), timeZone)) {
    return `Voltamos amanhã às ${time}`;
  }
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone, weekday: "long" }).format(opening);
  return `Voltamos ${weekday} às ${time}`;
}
