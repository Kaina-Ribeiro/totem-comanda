import { redirect } from "next/navigation";

import { AutoRefresh } from "@/components/auto-refresh";
import { PreparingScreen } from "@/components/device-gate";
import { DeviceReporter } from "@/components/device-reporter";
import { gateState } from "@/lib/device/gate";
import { DeviceAuthError } from "@/lib/device/session";
import { formatNextOpening } from "@/lib/format/next-opening";
import { getKioskConfig, type KioskConfig } from "@/lib/kiosk/core";

import { AttractScreen } from "./attract-screen";
import { KioskJourney, type KioskSettings } from "./journey/kiosk-journey";
import { PausedScreen } from "./paused-screen";
import { UnavailableScreen } from "./unavailable-screen";

/** Gate screens re-read the config every 45 s, so the kiosk opens and closes by itself. */
const GATE_RECHECK_MS = 45_000;

/** The v2 config in the shape the shared gate rules read (pace sits under `store` on v2). */
const gateOf = (config: KioskConfig) => gateState({ ...config, pace: config.store.pace });

/**
 * `/kiosk` (pilot, COM-146): signs this browser in as its device (shared
 * device session) and reads `GET /v2/devices/me/config`. Same rules as the
 * shared DeviceGate the kitchen uses:
 * unprovisioned or rejected credentials go to /setup, a kitchen device goes to
 * /kitchen, a disabled kiosk gets its own screen, an unreachable Core shows the
 * preparing screen and retries. Reads cookies, so render it inside <Suspense>.
 */
export async function KioskDeviceGate() {
  let config: KioskConfig;
  try {
    config = await getKioskConfig();
  } catch (error) {
    if (!(error instanceof DeviceAuthError)) throw error;
    switch (error.code) {
      case "NOT_PROVISIONED":
      case "INVALID_CREDENTIALS":
      case "WRONG_DEVICE":
        redirect("/setup");
      case "DEVICE_DISABLED":
        return (
          <UnavailableScreen
            title="Totem desativado"
            body="Este totem foi desativado no back office. Peça ajuda a um atendente."
          />
        );
      case "CORE_UNAVAILABLE":
        return <PreparingScreen />;
    }
  }
  if (config.kind !== "KIOSK") redirect("/kitchen");
  return (
    <>
      <KioskGate config={config} />
      <DeviceReporter state={gateOf(config)} />
    </>
  );
}

/**
 * The kiosk's screens by precedence (Offline > Maintenance > Closed > Paused >
 * Live), all from the v2 config. Gate screens re-check the config; the journey
 * re-checks only while on attract, so a guest mid-order is never cut off.
 */
export function KioskGate({ config }: { config: KioskConfig }) {
  const state = gateOf(config);
  return (
    <>
      <GateScreen config={config} />
      {state !== "open" && <AutoRefresh everyMs={GATE_RECHECK_MS} />}
    </>
  );
}

/** What the journey needs from the v2 config. */
export function kioskSettings(config: KioskConfig): KioskSettings {
  const { store } = config;
  const pace = store.pace?.pace;
  const notice = store.invoiceNotice;
  return {
    brand: store.locationName,
    defaultLanguage: store.defaultLanguage,
    languages: store.languages,
    idleMs: config.idleTimerIntervalMilliseconds,
    cardAvailable: !!config.paymentTerminalId,
    waitMinutes: pace === "NORMAL" || pace === "BUSY" ? (store.waitMinutes?.[pace] ?? null) : null,
    invoiceNotice: { "pt-BR": notice["pt-BR"], en: notice.en || notice["pt-BR"] },
  };
}

function GateScreen({ config }: { config: KioskConfig }) {
  const { store } = config;
  const brand = store.locationName;

  switch (gateOf(config)) {
    case "maintenance":
      return (
        <UnavailableScreen brand={brand} title="Totem em manutenção" body="Faça seu pedido no balcão. Já já voltamos." />
      );
    case "paused":
      return (
        <PausedScreen
          brand={brand}
          pausedUntil={store.pace?.pausedUntil ?? null}
          timeZone={store.timezone}
          languages={store.languages}
          defaultLanguage={store.defaultLanguage}
        />
      );
    case "at-capacity":
      return (
        <UnavailableScreen
          brand={brand}
          title="Cozinha a todo vapor"
          body="Estamos com muitos pedidos agora. Voltamos a aceitar pedidos em instantes."
        />
      );
    case "closed": {
      const { title, description } = store.closedMessage;
      return (
        <UnavailableScreen
          brand={brand}
          title={title["pt-BR"]}
          body={description["pt-BR"]}
          note={config.nextOpeningAt ? formatNextOpening(config.nextOpeningAt, store.timezone) : undefined}
        />
      );
    }
    case "open":
      return (
        <KioskJourney
          settings={kioskSettings(config)}
          attract={{
            "pt-BR": <AttractScreen brand={brand} logo={store.logo ?? null} language="pt-BR" />,
            en: <AttractScreen brand={brand} logo={store.logo ?? null} language="en" />,
          }}
        />
      );
  }
}
