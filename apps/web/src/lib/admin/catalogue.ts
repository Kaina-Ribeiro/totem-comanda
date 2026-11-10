import "server-only";

import { coreApiV2 } from "@/lib/core/client-v2";
import type { components } from "@/lib/core-api-v2";

import type { AdminItem, Badge, Group, Item, Section, SwapSell } from "./catalogue-form";
import type { NameOf } from "./menu-errors";
import { asOwner } from "./session";

type Image = components["schemas"]["MediaAsset"];

/** Everything the v2 menu editor links between, loaded in one go. */
export type Catalogue = {
  sections: Section[];
  items: AdminItem[];
  groups: Group[];
  swapSells: SwapSell[];
  images: Image[];
  badges: Badge[];
};

export async function loadCatalogue(): Promise<Catalogue> {
  const [sections, items, groups, swapSells, images, badges] = await Promise.all([
    asOwner((headers) => coreApiV2().GET("/v2/admin/sections", { headers })),
    asOwner((headers) => coreApiV2().GET("/v2/admin/items", { headers })),
    asOwner((headers) => coreApiV2().GET("/v2/admin/modifier-groups", { headers })),
    asOwner((headers) => coreApiV2().GET("/v2/admin/swap-sells", { headers })),
    asOwner((headers) => coreApiV2().GET("/v2/admin/images", { headers })),
    asOwner((headers) => coreApiV2().GET("/v2/admin/badges", { headers })),
  ]);
  return { sections, items, groups, swapSells, images, badges };
}

/** pt-BR names of a catalogue, for MENU_INVALID messages. */
export function namesOf(catalogue: Catalogue): NameOf {
  const names = new Map<string, string>();
  for (const e of [...catalogue.sections, ...catalogue.items, ...catalogue.groups, ...catalogue.swapSells]) {
    names.set(`${e.type}:${e.id}`, e.name);
  }
  return (type, id) => names.get(`${type}:${id}`);
}

export const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((e) => [e.id, e]));

export const putSection = (body: Section) =>
  asOwner((headers) =>
    coreApiV2().PUT("/v2/admin/sections/{sectionId}", { headers, params: { path: { sectionId: body.id } }, body }),
  );

export const putItem = (body: AdminItem) =>
  asOwner((headers) => coreApiV2().PUT("/v2/admin/items/{itemId}", { headers, params: { path: { itemId: body.id } }, body }));

export const deleteItem = (itemId: string) =>
  asOwner((headers) => coreApiV2().DELETE("/v2/admin/items/{itemId}", { headers, params: { path: { itemId } } }));

export const putGroup = (body: Group) =>
  asOwner((headers) =>
    coreApiV2().PUT("/v2/admin/modifier-groups/{modifierGroupId}", {
      headers,
      params: { path: { modifierGroupId: body.id } },
      body,
    }),
  );

export const putSwapSell = (body: SwapSell) =>
  asOwner((headers) =>
    coreApiV2().PUT("/v2/admin/swap-sells/{swapSellId}", { headers, params: { path: { swapSellId: body.id } }, body }),
  );

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The options (or sizes) of a group or sized item as the undoable first part
 * of `saveBoth()`: saves the new and changed ones; undo puts changed ones back
 * and deletes new ones, so a failed group save leaves nothing half saved.
 * Null when nothing changed.
 */
export function optionsPart(options: Item[], before: ReadonlyMap<string, AdminItem>) {
  const changed = options.filter((o) => {
    const current = before.get(o.id);
    if (!current) return true;
    const { displayPrice: _, ...rest } = current as Item;
    return !same(rest, o);
  });
  if (!changed.length) return null;
  const saved: Item[] = [];
  return {
    label: changed.length === 1 ? "a opção" : "as opções",
    save: async () => {
      for (const option of changed) {
        await putItem(option);
        saved.push(option);
      }
    },
    undo: async () => {
      for (const option of saved.reverse()) {
        const previous = before.get(option.id);
        if (previous) {
          const { displayPrice: _, ...rest } = previous as Item;
          await putItem(rest as AdminItem);
        } else {
          await deleteItem(option.id);
        }
      }
    },
  };
}

/** The next free `comboMealId` for a new combo (Go keeps it afterwards). */
export function nextComboId(items: AdminItem[]): number {
  const ids = items.map((i) => (i.type === "COMBO_MEAL" ? i.comboMealId : 0));
  return Math.max(0, ...ids) + 1;
}
