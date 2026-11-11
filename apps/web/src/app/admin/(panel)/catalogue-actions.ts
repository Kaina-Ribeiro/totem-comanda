"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { attemptCatalogue } from "@/lib/admin/catalogue";
import { type FormState, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

/** Every back-office page shows the catalogue somewhere: refresh them all after a save. */
export async function refreshAdmin() {
  revalidatePath("/admin", "layout");
}

const DELETE = {
  section: (id: string) =>
    asOwner((headers) => coreApi().DELETE("/v2/admin/sections/{sectionId}", { headers, params: { path: { sectionId: id } } })),
  item: (id: string) =>
    asOwner((headers) => coreApi().DELETE("/v2/admin/items/{itemId}", { headers, params: { path: { itemId: id } } })),
  group: (id: string) =>
    asOwner((headers) =>
      coreApi().DELETE("/v2/admin/modifier-groups/{modifierGroupId}", { headers, params: { path: { modifierGroupId: id } } }),
    ),
  swapSell: (id: string) =>
    asOwner((headers) => coreApi().DELETE("/v2/admin/swap-sells/{swapSellId}", { headers, params: { path: { swapSellId: id } } })),
  badge: (id: string) =>
    asOwner((headers) => coreApi().DELETE("/v2/admin/badges/{badgeId}", { headers, params: { path: { badgeId: id } } })),
  coupon: (id: string) =>
    asOwner((headers) =>
      coreApi().DELETE("/v2/admin/discount-rules/{discountRuleId}", { headers, params: { path: { discountRuleId: id } } }),
    ),
  menu: (id: string) =>
    asOwner((headers) => coreApi().DELETE("/v2/admin/menus/{menuId}", { headers, params: { path: { menuId: id } } })),
} as const;

/**
 * Deletes one catalogue entity (`kind`, `id`). Go refuses with MENU_INVALID
 * while something links it, and the owner sees what. `then` goes there after.
 */
export async function deleteEntity(_: FormState, form: FormData): Promise<FormState> {
  const kind = text(form, "kind") as keyof typeof DELETE;
  const id = text(form, "id");
  const then = text(form, "then");
  const state = await attemptCatalogue(async () => {
    if (!(kind in DELETE)) throw new Error(`unknown kind ${kind}`);
    await DELETE[kind](id);
    await refreshAdmin();
    return "Apagado.";
  });
  if (!state.error && then.startsWith("/admin")) redirect(then);
  return state;
}
