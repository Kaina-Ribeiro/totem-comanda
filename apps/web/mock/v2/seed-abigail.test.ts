import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyScenario, now } from "../state";
import { SEED_MEDIA } from "../media";
import { guestMenu, validateCatalogue } from "./menu";
import { ABIGAIL_CATEGORY_IDS, ABIGAIL_MEDIA } from "./seed-abigail";
import { v2 } from "./state";

describe("Abigail Coffee demo menu (MOCK_MENU unset)", () => {
  beforeEach(() => {
    delete process.env.MOCK_MENU;
    applyScenario("afternoon");
  });
  afterEach(() => {
    process.env.MOCK_MENU = "reference";
    applyScenario("afternoon");
  });

  it("passes the validator", () => {
    expect(validateCatalogue(v2().entities, v2().menus, v2().badges)).toEqual([]);
  });

  it("comes before the reference menu in the afternoon menu", () => {
    const menu = guestMenu(now(), "pt-BR")!;
    expect(menu.root.map((l) => l.id)).toEqual([...ABIGAIL_CATEGORY_IDS, "100", "200", "300"]);
  });

  it("has a photo file for every image it links", () => {
    const menu = guestMenu(now(), "pt-BR")!;
    const files = menu.entities
      .filter((e) => e.type === "IMAGE" && e.id.startsWith("AB-"))
      .map((e) => ("url" in e ? String(e.url).replace("/media/", "") : ""));
    expect(files).toHaveLength(ABIGAIL_MEDIA.length);
    for (const file of files) expect(existsSync(fileURLToPath(SEED_MEDIA[file]))).toBe(true);
  });
});
