import type { KioskMenu, Section } from "./menu-graph";

// Menu photos on the kiosk (COM-173). The screen is 1080 px wide at one pixel
// per point, so the journey needs two variants of each photo: the grid
// thumbnail and the photo on top of the item screen. Every small use (basket,
// swap and cross-sell sheets) reuses the thumbnail the grid already loaded.

export type PhotoVariant = "thumb" | "hero";

/**
 * next/image props of the two variants. The thumbnail (a 324 px cell on
 * 03-Menu) has one fixed width instead of `fill sizes`: given a srcset of
 * every width, Chromium draws a bigger variant it already holds (the item
 * photo) in the grid and decodes 1080 px for each cell. The item photo
 * (04-Item) spans the stage. At one pixel per point these are w=384 and
 * w=1080, the widths the server warms (warm-photos.ts).
 */
export const PHOTO_PROPS = {
  thumb: { width: 384, height: 288 },
  hero: { fill: true, sizes: "1080px" },
} as const;

/** Every photo the menu can show, once each: the sections in their order, then swap and cross-sell targets. */
export function menuPhotos(menu: KioskMenu): string[] {
  const urls = new Set<string>();
  const visit = (section: Section) => {
    for (const product of section.products) if (product.picture) urls.add(product.picture.url);
    section.sections.forEach(visit);
  };
  menu.sections.forEach(visit);
  for (const product of Object.values(menu.products)) if (product.picture) urls.add(product.picture.url);
  return [...urls];
}

/**
 * Runs `work` over `items`, at most `limit` at a time. A failed item never
 * stops the rest; `cancel` lets the running ones finish and takes no new one.
 * Starts on the next microtask, so the caller holds the handle before any work.
 */
export function drain<T>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<unknown>,
): { done: Promise<void>; cancel: () => void } {
  let next = 0;
  let cancelled = false;
  const worker = async () => {
    while (!cancelled && next < items.length) {
      const item = items[next++];
      try {
        await work(item);
      } catch {
        // The caller's `work` records its own failures.
      }
    }
  };
  const done = Promise.resolve()
    .then(() => Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)))
    .then(() => undefined);
  return {
    done,
    cancel: () => {
      cancelled = true;
    },
  };
}
