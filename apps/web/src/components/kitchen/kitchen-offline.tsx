import { AutoRefresh } from "@/components/auto-refresh";
import { UnavailableScreen } from "@/components/kiosk/unavailable-screen";

/** How often the kitchen tries its first load again while the Core API cannot answer. */
export const KITCHEN_RETRY_MS = 5_000;

/**
 * The board could not load its orders: say so and try again by itself, as the
 * kiosk does, so a tablet that boots while the Core API is down recovers
 * without anyone reloading it (COM-120).
 */
export function KitchenOffline() {
  return (
    <>
      <UnavailableScreen title="Cozinha sem conexão" body="Tentando de novo em instantes." />
      <AutoRefresh everyMs={KITCHEN_RETRY_MS} />
    </>
  );
}
