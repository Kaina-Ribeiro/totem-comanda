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
  const auth = await core.POST("/v2/devices/auth", { body: { deviceId, deviceSecret } });
  if (!auth.data) {
    return Response.json(
      { step: "auth", status: auth.response.status, code: problemCode(auth.error) },
      { status: 502 },
    );
  }
  const headers = { Authorization: `Bearer ${auth.data.accessToken}` };

  const [config, menu] = await Promise.all([
    core.GET("/v2/devices/me/config", { headers }),
    core.GET("/v2/menus/active", {
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

  // Sections in display order, each with its products (MODELS 5.1: one flat list, linked by id).
  const byId = new Map(menu.data.entities.map((e) => [`${e.type}:${e.id}`, e]));
  return Response.json({
    device: config.data.kioskID,
    isOpen: config.data.isOpen,
    configEtag: config.response.headers.get("ETag"),
    menu: menu.data.menuId,
    sections: menu.data.root.map((link) => {
      const section = byId.get(`${link.type}:${link.id}`);
      return {
        name: section?.name ?? link.id,
        items: (section?.links ?? [])
          .map((l) => byId.get(`${l.type}:${l.id}`))
          .filter((e) => e && e.type !== "IMAGE")
          .map((e) => e!.name),
      };
    }),
  });
}
