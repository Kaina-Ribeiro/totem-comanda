import "server-only";

import { cookies } from "next/headers";

/**
 * Development-only controls for the stateful mock Core API (apps/web/mock).
 * Scenarios are the mock's own state, switched through its control endpoint
 * (MOCK_CONTROL_URL); "Core API down" is simulated here in the BFF.
 */

export const CORE_DOWN_COOKIE = "comanda_mock_core_down";

export type MockState = { scenario: string; scenarios: Record<string, string> };

const isDev = () => process.env.NODE_ENV === "development";
const controlUrl = () => process.env.MOCK_CONTROL_URL;

/** True when /dev/mock asked the BFF to behave as if the Core API were unreachable. */
export async function isCoreDownSimulated(): Promise<boolean> {
  if (!isDev()) return false;
  try {
    return (await cookies()).get(CORE_DOWN_COOKIE)?.value === "1";
  } catch {
    return false;
  }
}

/** The mock's current scenario and the ones it offers; null without a mock. */
export async function readMockState(): Promise<MockState | null> {
  const url = controlUrl();
  if (!isDev() || !url) return null;
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? ((await response.json()) as MockState) : null;
  } catch {
    return null;
  }
}

export async function setMockScenario(name: string): Promise<void> {
  const url = controlUrl();
  if (!isDev() || !url) return;
  await fetch(`${url}/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}
