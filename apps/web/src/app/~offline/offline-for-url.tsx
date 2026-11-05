"use client";

import { useSyncExternalStore } from "react";

import { offlineArea } from "@/components/offline/offline-copy";
import { OfflineScreen } from "@/components/offline/offline-screen";

const noSubscribe = () => () => {};

/**
 * The service worker serves this page in place of the one the browser asked
 * for, so the address bar still names that page: the kitchen gets the
 * kitchen's text, the kiosk the guest's (COM-91). Nothing renders before the
 * address is known, so a kitchen never flashes the kiosk text.
 */
export function OfflineForUrl() {
  const pathname = useSyncExternalStore(
    noSubscribe,
    () => window.location.pathname,
    () => null,
  );
  if (pathname === null) return <div className="flex-1 bg-[#2a1c16]" />;
  return <OfflineScreen area={offlineArea(pathname)} />;
}
