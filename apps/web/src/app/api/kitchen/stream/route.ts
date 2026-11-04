import { CALL_TIMEOUT_MS } from "@/lib/core/client";
import { requireDeviceKind } from "@/lib/device/config";
import { asDevice } from "@/lib/device/session";
import { kitchenStreamUrl } from "@/lib/kitchen/core";

/**
 * Relays the Core API's kitchen events (GET /v1/kitchen/stream) to the
 * kitchen browser, which never holds the device token. Closes with the
 * browser's request; any failure is a non-200 the client answers by polling.
 */
export async function GET(request: Request) {
  let upstream: Response;
  try {
    await requireDeviceKind("KITCHEN");
    ({ response: upstream } = await asDevice(async (headers) => {
      // The stream never ends, so the timeout covers only the wait for its headers.
      const connecting = new AbortController();
      const timer = setTimeout(() => connecting.abort(), CALL_TIMEOUT_MS);
      try {
        return {
          response: await fetch(kitchenStreamUrl(), {
            headers: { ...headers, Accept: "text/event-stream" },
            signal: AbortSignal.any([request.signal, connecting.signal]),
            cache: "no-store",
          }),
        };
      } finally {
        clearTimeout(timer);
      }
    }));
  } catch {
    return new Response(null, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response(null, { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
