import { coreApi } from "@/lib/core/client";
import { isGateState, statusReport } from "@/lib/device/gate";
import { asDevice } from "@/lib/device/session";

/**
 * Reports the device's gate state when it changes (OP-KIOSK-04, FR-130):
 * TRADING, or UNAVAILABLE with its reason. Fire-and-forget: always 204;
 * failures only go to the server log.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const state = typeof body === "object" && body !== null && "state" in body ? body.state : null;
  if (!isGateState(state)) return new Response(null, { status: 400 });

  try {
    const { response } = await asDevice((headers) =>
      coreApi().POST("/v1/devices/status", { headers, body: statusReport(state) }),
    );
    if (!response.ok) console.warn(`Status report rejected: HTTP ${response.status}`);
  } catch (error) {
    console.warn("Status report failed:", error instanceof Error ? error.message : error);
  }
  return new Response(null, { status: 204 });
}
