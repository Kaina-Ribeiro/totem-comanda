import { AutoRefresh } from "@/components/auto-refresh";
import type { DeviceConfig } from "@/lib/device/config";
import { gateState } from "@/lib/device/gate";
import { formatNextOpening } from "@/lib/format/next-opening";

import { AttractScreen } from "./attract-screen";
import { availableOrderTypes } from "./journey/journey-state";
import { KioskJourney } from "./journey/kiosk-journey";
import { UnavailableScreen } from "./unavailable-screen";

/** FR-137: gate screens re-read the config every 45 s, so the kiosk opens and closes by itself. */
const GATE_RECHECK_MS = 45_000;

/**
 * The kiosk's gate (BR-KIOSK-09): maintenance, then at capacity, then closed,
 * else the guest journey. All of these come from the Core API's config. Gate
 * screens re-check the config; the journey re-checks only while on attract,
 * so a guest mid-order is never cut off.
 */
export function KioskGate({ config }: { config: DeviceConfig }) {
  const state = gateState(config);
  return (
    <>
      <GateScreen config={config} />
      {state !== "open" && <AutoRefresh everyMs={GATE_RECHECK_MS} />}
    </>
  );
}

function GateScreen({ config }: { config: DeviceConfig }) {
  const { restaurant } = config;
  const brand = restaurant.name;

  switch (gateState(config)) {
    case "maintenance":
      return (
        <UnavailableScreen
          brand={brand}
          title="Totem em manutenção"
          body="Faça seu pedido no balcão. Já já voltamos."
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
      const { title, description } = restaurant.closedMessage;
      return (
        <UnavailableScreen
          brand={brand}
          title={title["pt-BR"]}
          body={description["pt-BR"]}
          note={
            config.nextOpeningAt
              ? formatNextOpening(config.nextOpeningAt, restaurant.timezone)
              : undefined
          }
        />
      );
    }
    case "open": {
      const languages = restaurant.supportedLanguages.map((l) => l.code);
      return (
        <KioskJourney
          settings={{
            brand,
            defaultLanguage: restaurant.defaultLanguage,
            languages,
            orderTypes: availableOrderTypes(restaurant),
            checkNumberDigits: restaurant.posCheckNumberDisplayLength,
          }}
          attract={{
            "pt-BR": <AttractScreen brand={brand} language="pt-BR" />,
            en: <AttractScreen brand={brand} language="en" />,
          }}
        />
      );
    }
  }
}
