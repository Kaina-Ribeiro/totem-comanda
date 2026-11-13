import { describe, expect, it } from "vitest";

import { applyScenario, now } from "../../../mock/state";
import { guestMenu } from "../../../mock/v2/menu";
import { readMenu } from "./menu-graph";
import { drain, menuPhotos } from "./photos";

/** The mock's afternoon menu (MODELS 5.20 minus tax), as the kiosk reads it. */
function reference() {
  applyScenario("afternoon");
  return readMenu(guestMenu(now(), "pt-BR")!);
}

describe("menuPhotos", () => {
  it("lists each photo of the menu once, in the order the sections show them", () => {
    expect(menuPhotos(reference())).toEqual([
      "/media/croque-monsieur.jpg",
      "/media/cookie.jpg",
      "/media/misto-quente.jpg",
    ]);
  });

  it("is empty for a menu without photos", () => {
    expect(menuPhotos({ menuId: "m", validUntil: null, sections: [], products: {} })).toEqual([]);
  });
});

describe("drain", () => {
  it("works through every item, at most `limit` at a time", async () => {
    let running = 0;
    let most = 0;
    const seen: number[] = [];
    const work = async (item: number) => {
      running += 1;
      most = Math.max(most, running);
      await Promise.resolve();
      seen.push(item);
      running -= 1;
    };
    await drain([1, 2, 3, 4, 5], 2, work).done;
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(most).toBe(2);
  });

  it("keeps going after an item fails", async () => {
    const seen: number[] = [];
    const work = async (item: number) => {
      if (item === 2) throw new Error("boom");
      seen.push(item);
    };
    await drain([1, 2, 3], 1, work).done;
    expect(seen).toEqual([1, 3]);
  });

  it("takes no new item once cancelled", async () => {
    const seen: number[] = [];
    const queue = drain([1, 2, 3], 1, async (item: number) => {
      seen.push(item);
      queue.cancel();
    });
    await queue.done;
    expect(seen).toEqual([1]);
  });
});
