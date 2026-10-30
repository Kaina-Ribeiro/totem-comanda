import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AutoRefresh } from "@/components/auto-refresh";
import { DeviceReporter } from "@/components/device-reporter";
import { UnavailableScreen } from "@/components/kiosk/unavailable-screen";
import { type DeviceConfig, getDeviceConfig } from "@/lib/device/config";
import { gateState } from "@/lib/device/gate";
import { DeviceAuthError } from "@/lib/device/session";

const AREA_KIND = { kiosk: "KIOSK", kitchen: "KITCHEN" } as const;

/** BR-KIOSK-02: a failed configuration load retries every 5 s. */
const CONFIG_RETRY_MS = 5_000;

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
 * Authenticates this browser as its device and hands its config to
 * `children`. Unprovisioned or rejected credentials go back to /setup, a
 * device opened in the other area goes to its own, a disabled device gets its own screen; an unreachable Core API shows the
 * preparing screen and retries. Reads cookies, so render it inside <Suspense>.
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
    config = await getDeviceConfig();
  } catch (error) {
    if (!(error instanceof DeviceAuthError)) throw error;
    switch (error.code) {
      case "NOT_PROVISIONED":
      case "INVALID_CREDENTIALS":
      case "WRONG_DEVICE":
        redirect("/setup");
      case "DEVICE_DISABLED":
        return <UnavailableScreen {...DISABLED_COPY[area]} />;
      case "CORE_UNAVAILABLE":
        return <PreparingScreen />;
    }
  }
  // Each device has one area: a kiosk never shows the kitchen, and back.
  if (config.kind !== AREA_KIND[area]) redirect(config.kind === "KITCHEN" ? "/kitchen" : "/kiosk");
  return (
    <>
      {children(config)}
      <DeviceReporter state={gateState(config)} />
    </>
  );
}

/** SCR-KIOSK-01: shown while the config cannot be loaded; retries by itself. */
export function PreparingScreen() {
  return (
    <>
      <UnavailableScreen
        title="Preparando tudo pra você"
        body="O totem está iniciando e fica pronto em instantes. Se quiser pedir agora, fale com a gente no balcão."
      />
      <AutoRefresh everyMs={CONFIG_RETRY_MS} />
    </>
  );
}
