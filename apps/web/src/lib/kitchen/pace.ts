import type { components } from "@/lib/core-api";

type StorePace = components["schemas"]["StorePace"];

/**
 * The pace to show: `next` unless the board already has a newer one. The
 * stream event and a read can cross, and a late answer must not put an old
 * pace back on the header (COM-121).
 */
export function newerPace(current: StorePace | null, next: StorePace): StorePace {
  if (!current) return next;
  return Date.parse(next.changedAt) >= Date.parse(current.changedAt) ? next : current;
}
