import { listKitchenOrders } from "@/lib/kitchen/core";

/** The kitchen's polling fallback (every 2 s) when the event stream is down. */
export async function GET() {
  const result = await listKitchenOrders();
  if (!result.ok) return Response.json({ code: result.code }, { status: 502 });
  return Response.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
