import { connection } from "next/server";

import { coreApi, problemCode } from "@/lib/core/client";

// Development smoke test of the generated client against the Prism mock:
// authenticate, then read the device config and the active menu.
// Device auth for real is GAB-7; these are the contract's example credentials.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }
  await connection();

  const core = coreApi();
  const auth = await core.POST("/v1/devices/auth", {
    body: { deviceId: "KIOSK-TBT-001", deviceSecret: "s3cr3t-from-provisioning" },
  });
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
