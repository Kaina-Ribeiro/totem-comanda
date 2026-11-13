import { describe, expect, it } from "vitest";

import { createPhotoPreloader } from "./photo-preload";
import { menu } from "./test-journey";

const PHOTOS = ["/media/croque-monsieur.jpg", "/media/cookie.jpg", "/media/misto-quente.jpg"];

describe("photo preload", () => {
  it("loads every photo of the menu as the grid thumbnail first, then as the item photo", async () => {
    const loaded: string[] = [];
    const preload = createPhotoPreloader(async (url, variant) => {
      loaded.push(`${variant} ${url}`);
    }, 1);

    await preload(menu).done;

    expect(loaded).toEqual([
      ...PHOTOS.map((url) => `thumb ${url}`),
      ...PHOTOS.map((url) => `hero ${url}`),
    ]);
  });

  it("loads nothing the page already has on the next journey", async () => {
    let loads = 0;
    const preload = createPhotoPreloader(async () => {
      loads += 1;
    });

    await preload(menu).done;
    await preload(menu).done;

    expect(loads).toBe(PHOTOS.length * 2);
  });

  it("tries a photo that failed again on the next journey", async () => {
    let fail = true;
    const loaded: string[] = [];
    const preload = createPhotoPreloader(async (url, variant) => {
      if (fail && url === PHOTOS[1]) throw new Error("offline");
      loaded.push(`${variant} ${url}`);
    });

    await preload(menu).done;
    fail = false;
    await preload(menu).done;

    expect(loaded.filter((entry) => entry.endsWith(PHOTOS[1]))).toHaveLength(2);
    expect(loaded).toHaveLength(PHOTOS.length * 2);
  });

  it("stops when the journey ends", async () => {
    const loaded: string[] = [];
    const preload = createPhotoPreloader(async (url) => {
      loaded.push(url);
      queue.cancel();
    }, 1);
    const queue = preload(menu);

    await queue.done;

    expect(loaded).toEqual([PHOTOS[0]]);
  });
});
