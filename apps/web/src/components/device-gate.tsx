import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";
import { asDevice, DeviceAuthError } from "@/lib/device/session";

export type DeviceConfig = components["schemas"]["DeviceConfig"];

const DISABLED_COPY = {
  kiosk: {
    title: "Totem desativado",
    body: "Este totem foi desativado no back office. Peça ajuda a um atendente.",
  },
  kitchen: {
    title: "Tela desativada",
    body: "Esta tela da cozinha foi desativada no back office.",
  },
} as const;

/**
 * Authenticates this browser as its device and hands the device config to
 * `children`. Unprovisioned or rejected credentials go back to /setup; a
 * disabled device gets its own screen. Reads cookies, so render it inside
 * <Suspense>.
 */
export async function DeviceGate({
  area,
  children,
}: {
  area: keyof typeof DISABLED_COPY;
  children: (config: DeviceConfig) => ReactNode;
}) {
  let config;
  try {
    config = await asDevice((headers) => coreApi().GET("/v1/devices/me/config", { headers }));
  } catch (error) {
    if (!(error instanceof DeviceAuthError)) throw error;
    if (error.code === "DEVICE_DISABLED") return <DeviceDisabled {...DISABLED_COPY[area]} />;
    if (error.code === "NOT_PROVISIONED" || error.code === "INVALID_CREDENTIALS") {
      redirect("/setup");
    }
    throw error;
  }
  if (!config.data) {
    throw new Error(`Device config failed with HTTP ${config.response.status}`);
  }
  return children(config.data);
}

function DeviceDisabled({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 flex-col justify-center gap-6 bg-ink px-[84px] text-on-accent">
      <h1 className="font-display text-[120px] font-semibold leading-[0.94] tracking-[-0.03em]">
        {title}
      </h1>
      <p className="max-w-[810px] text-[36px] leading-[1.4] text-on-accent-muted">{body}</p>
    </main>
  );
}
