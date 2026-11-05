import { afterEach, vi } from "vitest";

// next/image needs the Next.js image config; a plain <img> is enough to test screens.
vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
  };
});

// Component tests only (jsdom): Node tests have no DOM to clean up. Vitest runs
// without globals, so Testing Library cannot clean up after each test by itself.
if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}
