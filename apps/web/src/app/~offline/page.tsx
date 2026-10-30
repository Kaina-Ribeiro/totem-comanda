import { OfflineScreen } from "@/components/offline/offline-screen";

import { ReloadWhenOnline } from "./reload-when-online";

// Precached by the service worker and shown when a page load cannot reach the
// server (e.g. the board boots while the server is down). Static on purpose.
export default function OfflinePage() {
  return (
    <>
      <OfflineScreen />
      <ReloadWhenOnline />
    </>
  );
}
