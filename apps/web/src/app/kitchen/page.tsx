import { Suspense } from "react";

import { DeviceGate } from "@/components/device-gate";

export default function KitchenPage() {
  return (
    <Suspense>
      <DeviceGate area="kitchen">
        {(config) => (
          <main className="flex flex-1 flex-col items-center justify-center gap-4">
            <h1 className="font-display text-7xl font-semibold">Cozinha</h1>
            <p className="text-3xl text-muted">{config.kioskID}</p>
          </main>
        )}
      </DeviceGate>
    </Suspense>
  );
}
