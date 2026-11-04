import "server-only";

import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

import { localNow, nextOpening, type NextOpening, windowEnd } from "./home";

type Schemas = components["schemas"];

export type StoreStatus = {
  /** A menu is live (Go's `isActive`) and the store takes at least one order type. */
  open: boolean;
  /** Every active kiosk is in maintenance. */
  maintenance: boolean;
  live: { name: string; until: string | null; forcedUntil: string | null } | null;
  next: NextOpening | null;
  timeZone: string;
  day: number;
  /** The store's pace (decision 3), the same one the kitchen sets. */
  pace: Schemas["StorePace"];
};

/**
 * Is the kiosk selling now, which menu and until when (A1's band and the
 * sidebar pill). Go decides which menu is live; the schedules only say for
 * how long, for display.
 */
export async function loadStoreStatus(
  now: Date,
  loaded: { restaurant?: Schemas["Restaurant"]; devices?: Schemas["AdminDevice"][] } = {},
): Promise<StoreStatus> {
  const [restaurant, menus, devices, pace] = await Promise.all([
    loaded.restaurant ??
      asOwner((headers) => coreApi().GET("/v1/admin/restaurant", { headers })),
    asOwner((headers) => coreApi().GET("/v1/admin/menus", { headers })),
    loaded.devices ?? asOwner((headers) => coreApi().GET("/v1/admin/devices", { headers })),
    asOwner((headers) => coreApi().GET("/v1/admin/pace", { headers })),
  ]);
  const schedules = await Promise.all(
    menus.map((menu) =>
      asOwner((headers) =>
        coreApi().GET("/v1/admin/menus/{menuId}/schedules", {
          headers,
          params: { path: { menuId: menu.id } },
        }),
      ),
    ),
  );
  const clock = localNow(now, restaurant.timezone);
  const named = menus.map((menu, i) => ({
    menu,
    name: menu.name["pt-BR"],
    schedules: schedules[i] as Schemas["MenuSchedule"][],
  }));
  const active = named.find((m) => m.menu.isActive) ?? null;
  const kiosks = devices.filter((d) => d.kind === "KIOSK" && d.status === "ACTIVE");
  return {
    open: active !== null && (restaurant.isDineInAvailable || restaurant.isTakeOutAvailable),
    maintenance: kiosks.length > 0 && kiosks.every((d) => d.maintenanceMode),
    live: active && {
      name: active.name,
      until: windowEnd(active.schedules, clock.day, clock.minutes),
      forcedUntil: active.menu.forcedUntil,
    },
    next: nextOpening(
      named.filter((m) => m !== active),
      clock.day,
      clock.minutes,
    ),
    timeZone: restaurant.timezone,
    day: clock.day,
    pace,
  };
}
