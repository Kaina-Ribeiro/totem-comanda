/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * Menu photos (next/image variants), COM-173. A photo this browser has seen is
 * drawn from here at once and refreshed behind the scenes. defaultCache keeps
 * only 64 of them for a day, less than a menu's two variants per product; a
 * kiosk keeps the whole menu for a month, across reloads and deploys.
 */
const photos: RuntimeCaching = {
  matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname === "/_next/image",
  handler: new StaleWhileRevalidate({
    cacheName: "photos",
    plugins: [
      new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 30 * 24 * 60 * 60, maxAgeFrom: "last-used" }),
    ],
  }),
};

// defaultCache's own photo cache, replaced by `photos`.
self.addEventListener("activate", (event) => event.waitUntil(caches.delete("next-image")));

// App shell, fonts and seen images come from the cache (defaultCache); a page
// load that cannot reach the server gets the precached offline screen. No
// offline order queue in the MVP. In development nothing is cached.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: process.env.NODE_ENV === "production" ? [photos, ...defaultCache] : defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
