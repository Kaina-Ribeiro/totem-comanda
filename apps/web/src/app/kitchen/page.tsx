import { Suspense } from "react";

import { DeviceGate } from "@/components/device-gate";
import { UnavailableScreen } from "@/components/kiosk/unavailable-screen";
import { KitchenBoard } from "@/components/kitchen/kitchen-board";
import { getKitchenPace, listKitchenOrders } from "@/lib/kitchen/core";

export default function KitchenPage() {
  return (
    <Suspense>
      <DeviceGate area="kitchen">{() => <Board />}</DeviceGate>
    </Suspense>
  );
}

/** First paint with the open orders; the board keeps itself current from there. */
async function Board() {
  const [orders, collected, pace] = await Promise.all([
    listKitchenOrders(),
    listKitchenOrders("collected"),
    getKitchenPace(),
  ]);
  if (!orders.ok) {
    return <UnavailableScreen title="Cozinha sem conexão" body="Tentando de novo em instantes." />;
  }
  return (
    <KitchenBoard
      initial={orders.data}
      initialCollected={collected.ok ? collected.data : []}
      initialPace={pace.ok ? pace.data : null}
    />
  );
}
