import "server-only";

import { cookies } from "next/headers";

/**
 * Development-only switches for the Prism mock, picked at /dev/mock. A
 * scenario sends `Prefer: code=...` on the listed operations, so Prism answers
 * with that response's example instead of the success one.
 */
export const MOCK_SCENARIOS = {
  normal: { label: "Normal", prefer: {} },
  "device-disabled": {
    label: "Dispositivo desativado (403 no auth)",
    prefer: { "/v1/devices/auth": "code=403" },
  },
  "invalid-credentials": {
    label: "Credenciais inválidas (401 no auth)",
    prefer: { "/v1/devices/auth": "code=401" },
  },
} as const satisfies Record<string, { label: string; prefer: Record<string, string> }>;

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

/** The `Prefer` header the active scenario sends for an operation path, if any. */
export async function mockPreferFor(schemaPath: string): Promise<string | undefined> {
  const prefer: Record<string, string> = MOCK_SCENARIOS[await getMockScenario()].prefer;
  return prefer[schemaPath];
}
