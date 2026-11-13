import { describe, expect, it } from "vitest";

import { createPhotoWarmer, photoVariants, WARM_EVERY_MS } from "./warm-photos";

describe("photoVariants", () => {
  it("asks the optimizer for the grid and the item width of each photo", () => {
    expect(photoVariants(["/media/pão de queijo.jpg"])).toEqual([
      "/_next/image?url=%2Fmedia%2Fp%C3%A3o%20de%20queijo.jpg&w=384&q=75",
      "/_next/image?url=%2Fmedia%2Fp%C3%A3o%20de%20queijo.jpg&w=1080&q=75",
    ]);
  });
});

describe("photo warm-up", () => {
  it("warms each variant once per server process, two at a time", async () => {
    const asked: string[] = [];
    let running = 0;
    let most = 0;
    const warmer = createPhotoWarmer(async (path) => {
      running += 1;
      most = Math.max(most, running);
      await Promise.resolve();
      asked.push(path);
      running -= 1;
    });

    expect(await warmer.warm(["/media/a.jpg", "/media/b.jpg"])).toBe(4);
    expect(await warmer.warm(["/media/a.jpg", "/media/c.jpg"])).toBe(2);

    expect(asked).toHaveLength(6);
    expect(new Set(asked).size).toBe(6);
    expect(most).toBe(2);
  });

  it("tries a variant that failed again next time", async () => {
    let fail = true;
    const asked: string[] = [];
    const warmer = createPhotoWarmer(async (path) => {
      asked.push(path);
      if (fail) throw new Error("not ready");
    });

    expect(await warmer.warm(["/media/a.jpg"])).toBe(0);
    fail = false;
    expect(await warmer.warm(["/media/a.jpg"])).toBe(2);
    expect(asked).toHaveLength(4);
  });

  it("is due on the first kiosk render after a start, then every ten minutes", () => {
    const warmer = createPhotoWarmer(async () => {});
    const start = 1_000_000;

    expect(warmer.due(start)).toBe(true);
    expect(warmer.due(start + 45_000)).toBe(false);
    expect(warmer.due(start + WARM_EVERY_MS)).toBe(true);
    expect(warmer.due(start + WARM_EVERY_MS + 1)).toBe(false);
  });

  it("is due again at once when the menu could not be read", () => {
    const warmer = createPhotoWarmer(async () => {});

    expect(warmer.due(1_000)).toBe(true);
    warmer.retry();
    expect(warmer.due(2_000)).toBe(true);
  });
});
