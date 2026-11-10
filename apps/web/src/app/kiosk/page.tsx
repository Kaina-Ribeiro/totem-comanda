import { Suspense } from "react";

import { KioskDeviceGate } from "@/components/kiosk/kiosk-gate";

export default function KioskPage() {
  return (
    <Suspense>
      <KioskDeviceGate />
    </Suspense>
  );
}
