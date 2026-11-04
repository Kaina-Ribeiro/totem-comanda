import { connection } from "next/server";

import { coreApi, problemCode } from "@/lib/core/client";

// Development smoke test of the generated client against the mock:
// authenticate, then read the device config and the active menu. The device
// comes from DEV_DEVICE_ID and DEV_DEVICE_SECRET (.env.local), never from code.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  await connection();

  const deviceId = process.env.DEV_DEVICE_ID;
  const deviceSecret = process.env.DEV_DEVICE_SECRET;
  if (!deviceId || !deviceSecret) {
    return Response.json(
      { step: "config", error: "Set DEV_DEVICE_ID and DEV_DEVICE_SECRET (see .env.example)" },
      { status: 503 },
    );
  }

  const core = coreApi();
  const auth = await core.POST("/v1/devices/auth", { body: { deviceId, deviceSecret } });
  if (!auth.data) {
    return Response.json(
      { step: "auth", status: auth.response.status, code: problemCode(auth.error) },
      { status: 502 },
    );
  }
  const headers = { Authorization: `Bearer ${auth.data.accessToken}` };

  const [config, menu] = await Promise.all([
    core.GET("/v1/devices/me/config", { headers }),
    core.GET("/v1/menus/active", {
      headers,
      params: { query: { language: "pt-BR" } },
    }),
  ]);
  if (!config.data || !menu.data) {
    return Response.json(
      {
        step: "read",
        config: config.response.status,
        menu: menu.response.status,
        code: problemCode(config.error ?? menu.error),
      },
      { status: 502 },
    );
  }

  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  return Response.json({
    device: config.data.kioskID,
    isOpen: config.data.isOpen,
    configEtag: config.response.headers.get("ETag"),
    menu: menu.data.name,
    categories: menu.data.entities.map((category) => ({
      name: category.name,
      items: category.childEntities.map((item) => ({
        name: item.name,
        price: item.price === undefined ? null : brl.format(item.price / 100),
      })),
    })),
  });
}
