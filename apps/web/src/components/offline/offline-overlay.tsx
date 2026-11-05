"use client";

import { usePathname } from "next/navigation";
import { useOffline } from "next/offline";
import { Suspense } from "react";

import { offlineArea } from "./offline-copy";
import { OfflineScreen } from "./offline-screen";

/**
 * Covers the page while Next.js reports the server unreachable (a refresh or
 * navigation failed, or the OS went offline). Next.js retries on its own and
 * the overlay goes away when the connection is back.
 *
 * The overlay sits in the root layout and reads the pathname, which is only
 * known at request time. Without a Suspense boundary that read blocks the
 * prerender of every route with a dynamic segment, and `next build` fails.
 */
export function OfflineOverlay() {
  return (
    <Suspense fallback={null}>
      <Overlay />
    </Suspense>
  );
}

function Overlay() {
  const offline = useOffline();
  const pathname = usePathname();
  if (!offline) return null;
  return (
    <div role="status" className="fixed inset-0 z-50 flex flex-col">
      <OfflineScreen area={offlineArea(pathname)} />
    </div>
  );
}
