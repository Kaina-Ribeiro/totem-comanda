import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  images: {
    // A resized photo is kept for a day (server cache and browser) instead of
    // the default 4 h (COM-173). Not longer: whether a replaced photo gets a
    // new URL is the Core API's call, still open (COM-45).
    minimumCacheTTL: 86_400,
  },
  experimental: {
    // Back-office photo and logo uploads go through Server Actions (1 MB by default).
    serverActions: { bodySizeLimit: "6mb" },
    // Keeps refreshes and navigations pending while the server is unreachable
    // and retries them when it is back; useOffline() drives the offline screen.
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
