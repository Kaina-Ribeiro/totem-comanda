import { spawnSync } from "node:child_process";

import { createSerwistRoute } from "@serwist/turbopack";

// Builds the service worker (src/app/sw.ts) at build time and serves it at
// /serwist/sw.js. The revision versions the precached offline page.
const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
