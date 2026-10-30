"use client";

import { useOffline } from "next/offline";

import { OfflineScreen } from "./offline-screen";

/**
 * Covers the page while Next.js reports the server unreachable (a refresh or
 * navigation failed, or the OS went offline). Next.js retries on its own and
 * the overlay goes away when the connection is back.
 */
export function OfflineOverlay() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-0 z-50 flex flex-col">
      <OfflineScreen />
    </div>
  );
}
