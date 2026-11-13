import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js resolves `server-only` itself; outside Next it is a no-op.
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    // Component tests are *.test.tsx and declare `// @vitest-environment jsdom`;
    // everything else runs in Node.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "mock/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
    // The mock seeds only the MODELS 5.20 reference menu, which the tests assert on.
    env: { MOCK_MENU: "reference" },
  },
});
