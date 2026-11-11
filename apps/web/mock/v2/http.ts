// Shared helpers of the v2 mock routes: v2 schema types, problems with v2 codes,
// and money in integer cents so totals never carry float noise.

import type { components } from "../../src/lib/core-api.d.ts";
import type { Reply } from "../http.ts";

export type S = components["schemas"];
export type Entity = S["PosEntity"];
export type EntityType = S["PosEntityType"];
export type ItemEntity = S["PosEntityItem"] | S["PosEntityComboMeal"];
export type GroupEntity = S["PosEntityModifier"];

export function problem(
  status: number,
  code: S["ProblemCode"],
  title: string,
  detail?: string,
  extra?: Partial<S["Problem"]>,
): Reply {
  return {
    status,
    body: {
      type: `/problems/${code.toLowerCase().replaceAll("_", "-")}`,
      title,
      status,
      code,
      ...(detail ? { detail } : {}),
      ...extra,
    },
    headers: { "Content-Type": "application/problem+json" },
  };
}

export const notFound = (title = "Not found") => problem(404, "NOT_FOUND", title);

/** BRL → integer cents (9.5 → 950), rounding away float noise. */
export const toCents = (brl: number | null | undefined) => Math.round((brl ?? 0) * 100);
/** Integer cents → BRL with at most 2 decimals (950 → 9.5). */
export const toBrl = (cents: number) => cents / 100;

export const key = (type: string, id: string) => `${type}:${id}`;

export const isItem = (e: Entity | undefined): e is ItemEntity =>
  !!e && (e.type === "ITEM" || e.type === "SIZED_ITEM" || e.type === "COMBO_MEAL");
export const isGroup = (e: Entity | undefined): e is GroupEntity =>
  !!e && (e.type === "MODIFIERS" || e.type === "COMBO_MAIN" || e.type === "COMBO_SIDE");
export const PRODUCT_TYPES = ["ITEM", "SIZED_ITEM", "COMBO_MEAL"] as const;
