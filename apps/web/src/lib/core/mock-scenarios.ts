import "server-only";

import { cookies } from "next/headers";

import type { components } from "@/lib/core-api";

type DeviceConfig = components["schemas"]["DeviceConfig"];

type Scenario = {
  label: string;
  /** `Prefer` header per operation path, so Prism answers with that response's example. */
  prefer?: Record<string, string>;
  /** Edits the mock's device config, for states the contract has no example of. */
  config?: (config: DeviceConfig) => DeviceConfig;
  /** The BFF behaves as if the Core API were unreachable. */
  coreDown?: boolean;
};

/** Next 06:00 in São Paulo (UTC-3), the mock bakery's opening time. */
function nextSixAm(): string {
  const next = new Date();
  next.setUTCHours(9, 0, 0, 0);
  if (next.getTime() <= Date.now()) next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

/**
 * Development-only switches for the Prism mock, picked at /dev/mock.
 */
export const MOCK_SCENARIOS = {
  normal: { label: "Normal (aberto)" },
  closed: {
    label: "Fechado (fora do horário)",
    config: (config) => ({
      ...config,
      isOpen: false,
      activeMenu: null,
      nextOpeningAt: nextSixAm(),
    }),
  },
  maintenance: {
    label: "Em manutenção",
    config: (config) => ({ ...config, maintenanceMode: true }),
  },
  "at-capacity": {
    label: "Cozinha lotada",
    config: (config) => ({ ...config, atCapacityMode: true }),
  },
  "core-down": { label: "Core API fora do ar", coreDown: true },
  "device-disabled": {
    label: "Dispositivo desativado (403 no auth)",
    prefer: { "/v1/devices/auth": "code=403" },
  },
  "invalid-credentials": {
    label: "Credenciais inválidas (401 no auth)",
    prefer: { "/v1/devices/auth": "code=401" },
  },
} as const satisfies Record<string, Scenario>;

export type MockScenario = keyof typeof MOCK_SCENARIOS;

export const MOCK_SCENARIO_COOKIE = "comanda_mock_scenario";

export function isMockScenario(value: unknown): value is MockScenario {
  return typeof value === "string" && Object.hasOwn(MOCK_SCENARIOS, value);
}

/** The active scenario; always "normal" outside development or outside a request. */
export async function getMockScenario(): Promise<MockScenario> {
  if (process.env.NODE_ENV !== "development") return "normal";
  try {
    const value = (await cookies()).get(MOCK_SCENARIO_COOKIE)?.value;
    return isMockScenario(value) ? value : "normal";
  } catch {
    return "normal";
  }
}

/** The active scenario's definition. */
export async function activeMockScenario(): Promise<Scenario> {
  return MOCK_SCENARIOS[await getMockScenario()];
}

/** The `Prefer` header the active scenario sends for an operation path, if any. */
export async function mockPreferFor(schemaPath: string): Promise<string | undefined> {
  return (await activeMockScenario()).prefer?.[schemaPath];
}
