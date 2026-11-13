import "server-only";

import { drain } from "./photos";

// Warm-up of the image optimizer for the kiosk's photos (COM-173). The first
// time a photo is asked for in a width, the server resizes it; several at once
// queue on its CPU, and the first use after a start costs about a second more.
// The kiosk gate starts this in the background (lib/kiosk/core.ts), so that
// work is done before a guest opens the menu.

/** The widths a 1080 px kiosk screen asks for: THUMB_SIZES (324px → 384) and HERO_SIZES. */
export const KIOSK_PHOTO_WIDTHS = [384, 1080] as const;
/** next/image's default quality: part of the optimizer's cache key. */
const QUALITY = 75;
/** The active menu is looked at again this often, for photos added or a menu that changed. */
export const WARM_EVERY_MS = 10 * 60_000;
/** Resizes at a time: leaves the server's CPU to the requests of people. */
const AT_ONCE = 2;
const ASK_TIMEOUT_MS = 30_000;

/** The optimizer paths of `urls`: every grid thumbnail first, then every item photo. */
export function photoVariants(urls: readonly string[]): string[] {
  return KIOSK_PHOTO_WIDTHS.flatMap((width) =>
    urls.map((url) => `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${QUALITY}`),
  );
}

/** Asks this server's own optimizer for one variant, as a browser would. */
async function askOptimizer(path: string): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}${path}`, {
    headers: { Accept: "image/webp" },
    signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Optimizer answered ${response.status}`);
  await response.arrayBuffer();
}

export function createPhotoWarmer(ask: (path: string) => Promise<unknown> = askOptimizer) {
  const warm = new Set<string>();
  let nextAt = 0;
  return {
    /** True when the menu's photos should be looked at now; the next time is WARM_EVERY_MS later. */
    due(now: number): boolean {
      if (now < nextAt) return false;
      nextAt = now + WARM_EVERY_MS;
      return true;
    },
    /** The menu could not be read: look again on the next kiosk render. */
    retry(): void {
      nextAt = 0;
    },
    /** Warms the variants of `urls` not warmed by this process yet; resolves to how many it did. */
    async warm(urls: readonly string[]): Promise<number> {
      const paths = photoVariants(urls).filter((path) => !warm.has(path));
      // Claimed up front, so a second kiosk rendering meanwhile does not repeat them.
      for (const path of paths) warm.add(path);
      let done = 0;
      await drain(paths, AT_ONCE, async (path) => {
        try {
          await ask(path);
          done += 1;
        } catch (error) {
          warm.delete(path);
          throw error;
        }
      }).done;
      return done;
    },
  };
}

/** One per server process: a new deploy starts with nothing warm. */
export const photoWarmer = createPhotoWarmer();
