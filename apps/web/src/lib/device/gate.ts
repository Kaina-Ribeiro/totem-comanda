import type { components } from "@/lib/core-api";

type DeviceConfig = components["schemas"]["DeviceConfig"];
type DeviceStatusReport = components["schemas"]["DeviceStatusReport"];

export const GATE_STATES = ["open", "maintenance", "at-capacity", "closed"] as const;
export type GateState = (typeof GATE_STATES)[number];

export function isGateState(value: unknown): value is GateState {
  return typeof value === "string" && (GATE_STATES as readonly string[]).includes(value);
}

/** The trading check (BR-KIOSK-09): maintenance, then at capacity, then closed. */
export function gateState(
  config: Pick<DeviceConfig, "maintenanceMode" | "atCapacityMode" | "isOpen">,
): GateState {
  if (config.maintenanceMode) return "maintenance";
  if (config.atCapacityMode) return "at-capacity";
  if (!config.isOpen) return "closed";
  return "open";
}

const UNAVAILABLE_REASON = {
  maintenance: "MAINTENANCE",
  "at-capacity": "AT_CAPACITY",
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
