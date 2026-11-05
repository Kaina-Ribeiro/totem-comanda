import { listKitchenOrders } from "@/lib/kitchen/core";

/**
 * The kitchen's reloads: the open orders (also the 2 s polling fallback when the
 * event stream is down), or `?status=collected` for "Retirados hoje".
 */
export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") === "collected" ? "collected" : "open";
  const result = await listKitchenOrders(status);
  if (!result.ok) return Response.json({ code: result.code }, { status: 502 });
  return Response.json(result.data, { headers: { "Cache-Control": "no-store" } });
}
