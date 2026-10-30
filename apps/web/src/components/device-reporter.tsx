"use client";

import { useEffect } from "react";

import type { GateState } from "@/lib/device/gate";

/** AdminDevice.online means a heartbeat in the last 3 minutes; one a minute leaves room for two misses. */
const HEARTBEAT_MS = 60_000;

function post(path: string, body: object) {
  // Fire-and-forget: the BFF logs failures, the screen never waits on them.
  fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Sends the device heartbeat every minute and a status report whenever the
 * gate state changes. Runs in the browser, so the heartbeat proves the screen
 * itself is alive, not just the server.
 */
export function DeviceReporter({ state }: { state: GateState }) {
  useEffect(() => {
    const beat = () =>
      post("/api/device/heartbeat", {
        screenResolution: `${window.screen.width}x${window.screen.height}`,
      });
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    post("/api/device/status", { state });
  }, [state]);

  return null;
}
