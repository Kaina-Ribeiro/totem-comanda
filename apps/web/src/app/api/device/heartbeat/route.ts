import { APP_VERSION } from "@/lib/app-version";
import { coreApi } from "@/lib/core/client";
import { asDevice } from "@/lib/device/session";

/**
 * Called by the device's browser every minute (DeviceReporter), so the Core
 * API's `lastSeenAt` proves the screen itself is alive. Fire-and-forget:
 * always 204; failures only go to the server log.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const screenResolution =
    typeof body === "object" && body !== null && "screenResolution" in body &&
    typeof body.screenResolution === "string" && /^\d{2,5}x\d{2,5}$/.test(body.screenResolution)
      ? body.screenResolution
      : "unknown";

  try {
    const { response } = await asDevice((headers) =>
      coreApi().POST("/v2/devices/heartbeat", {
        headers,
        body: { appVersion: APP_VERSION, screenResolution },
      }),
    );
    if (!response.ok) console.warn(`Heartbeat rejected: HTTP ${response.status}`);
  } catch (error) {
    console.warn("Heartbeat failed:", error instanceof Error ? error.message : error);
  }
  return new Response(null, { status: 204 });
}
