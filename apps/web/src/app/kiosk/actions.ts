"use server";

import { coreApi } from "@/lib/core/client";
import {
  deviceCall,
  loadActiveMenu,
  loadLanguagePack,
  type Menu,
  reportKeyAction,
  type Result,
  success,
} from "@/lib/kiosk/core";
import { type Language, mergeStrings, type Strings } from "@/lib/kiosk/strings";

// Server Actions of the kiosk journey. The browser holds the journey state;
// these are its only way to the Core API, and they hold the device token.

const isLanguage = (value: unknown): value is Language => value === "pt-BR" || value === "en";

export type JourneyStart = {
  orderNonce: string;
  journeyStartedTimestamp: string | null;
  menu: Menu;
  strings: Strings;
};

/**
 * Starts a guest journey (OP-START-01, OP-START-04): records it, and loads
 * the active menu and language pack once. Recording the journey never blocks
 * the guest; a menu that cannot load does.
 */
export async function beginJourney(language: Language): Promise<Result<JourneyStart>> {
  if (!isLanguage(language)) return { ok: false, code: "VALIDATION_FAILED" };
  const orderNonce = crypto.randomUUID();

  const [journey, menu, pack] = await Promise.all([
    deviceCall((headers) => coreApi().POST("/v1/journeys", { headers, body: { orderNonce, language } })),
    loadActiveMenu(language),
    loadLanguagePack(language),
  ]);

  if (!journey.ok) console.warn(`Journey start not recorded: ${journey.code}`);
  if (!menu.ok) {
    reportKeyAction({
      kind: "KEY_ACTION",
      type: "START_JOURNEY_FAILED",
      kioskStatusType: "TRADING",
      reason: "FAILED_LOAD_MENU",
      message: menu.code,
    });
    return menu;
  }
  reportKeyAction({ kind: "KEY_ACTION", type: "START_JOURNEY_SUCCESS", kioskStatusType: "TRADING" });
  return success({
    orderNonce,
    journeyStartedTimestamp: journey.ok ? journey.data.journeyStartedTimestamp : null,
    menu: menu.data,
    strings: mergeStrings(language, pack),
  });
}

/** Reloads menu and strings in another language mid-journey (F-START-03). */
export async function switchLanguage(
  language: Language,
): Promise<Result<{ menu: Menu; strings: Strings }>> {
  if (!isLanguage(language)) return { ok: false, code: "VALIDATION_FAILED" };
  const [menu, pack] = await Promise.all([loadActiveMenu(language), loadLanguagePack(language)]);
  if (!menu.ok) return menu;
  return success({ menu: menu.data, strings: mergeStrings(language, pack) });
}
