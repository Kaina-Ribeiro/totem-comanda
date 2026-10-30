"use client";

import { useEffect } from "react";

const CHECK_MS = 5_000;

/**
 * The offline page is served by the service worker in place of the page the
 * browser asked for. Checks the server every 5 s and reloads that page once it
 * answers.
 */
export function ReloadWhenOnline() {
  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch(window.location.href, { method: "HEAD", cache: "no-store" });
        if (response.ok || response.status < 500) window.location.reload();
      } catch {
        // Still offline; try again on the next tick.
      }
    };
    const timer = setInterval(check, CHECK_MS);
    window.addEventListener("online", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", check);
    };
  }, []);
  return null;
}
