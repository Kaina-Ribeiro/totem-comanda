import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
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
