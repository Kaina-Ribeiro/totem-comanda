import { Suspense } from "react";

import { DeviceGate } from "@/components/device-gate";
import { KioskGate } from "@/components/kiosk/kiosk-gate";

export default function KioskPage() {
  return (
    <Suspense>
      <DeviceGate area="kiosk">{(config) => <KioskGate config={config} />}</DeviceGate>
    </Suspense>
  );
}
