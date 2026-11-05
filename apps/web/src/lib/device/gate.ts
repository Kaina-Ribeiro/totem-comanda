import type { components } from "@/lib/core-api";

type DeviceConfig = components["schemas"]["DeviceConfig"];
type DeviceStatusReport = components["schemas"]["DeviceStatusReport"];

export const GATE_STATES = ["open", "maintenance", "at-capacity", "paused", "closed"] as const;
export type GateState = (typeof GATE_STATES)[number];

export function isGateState(value: unknown): value is GateState {
  return typeof value === "string" && (GATE_STATES as readonly string[]).includes(value);
}

/**
 * Which screen the kiosk shows (plan decision 14, BFF BR-SES-02/03/04):
 * Offline > Maintenance > Closed > Paused > Live. Offline is the service
 * worker's own page, so it wins before any config is read. Closed beats a
 * pause: a store that is closed says when it opens, not "volte em 15 min".
 * At capacity comes from Aparelhos (one kiosk) or from the store pace
 * (PAUSED, every kiosk); the pause has its own screen.
 */
export function gateState(
  config: Pick<DeviceConfig, "maintenanceMode" | "atCapacityMode" | "isOpen"> & {
    pace?: Pick<DeviceConfig["pace"], "pace">;
  },
): GateState {
  if (config.maintenanceMode) return "maintenance";
  if (!config.isOpen) return "closed";
  if (config.pace?.pace === "PAUSED") return "paused";
  if (config.atCapacityMode) return "at-capacity";
  return "open";
}

const UNAVAILABLE_REASON = {
  maintenance: "MAINTENANCE",
  "at-capacity": "AT_CAPACITY",
  paused: "AT_CAPACITY",
  closed: "STORE_CLOSED",
} as const;

/** The status report for a gate state (OP-KIOSK-04, FR-130). */
export function statusReport(state: GateState): DeviceStatusReport {
  if (state === "open") {
    return {
      kind: "STATUS",
      statusType: "TRADING",
      category: "APPLICATION_STATUS",
      message: "Config refreshed",
    };
  }
  return {
    kind: "STATUS",
    statusType: "UNAVAILABLE",
    reason: UNAVAILABLE_REASON[state],
    category: "APPLICATION_STATUS",
    message: "Config refreshed",
  };
}
