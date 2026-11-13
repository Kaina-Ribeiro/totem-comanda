import { afterEach, vi } from "vitest";

// next/image needs the Next.js image config; a plain <img> is enough to test screens.
vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  type Props = {
    src: string;
    alt: string;
    sizes?: string;
    width?: number;
    className?: string;
    onLoad?: () => void;
    ref?: (node: HTMLImageElement | null) => void;
  };
  return {
    default: ({ src, alt, sizes, width, className, onLoad, ref }: Props) =>
      createElement("img", { src, alt, sizes, width, className, onLoad, ref }),
    getImageProps: ({ src, sizes }: Props) => ({ props: { src, sizes, srcSet: undefined } }),
  };
});

// Component tests only (jsdom): Node tests have no DOM to clean up. Vitest runs
// without globals, so Testing Library cannot clean up after each test by itself.
if (typeof window !== "undefined") {
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => cleanup());
}
