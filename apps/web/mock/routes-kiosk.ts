// Kiosk guest journey: active menu, language packs, journeys, quotes and discounts.

import { createHash } from "node:crypto";

import {
  authDevice,
  notFound,
  ok,
  problem,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
import { applyDiscount, priceBasket, PricingError, resolveMenu } from "./kiosk-menu.ts";
import { activeMenu, businessDate } from "./schedule.ts";
import { now, state } from "./state.ts";

const isLanguage = (value: unknown): value is Schemas["LanguageCode"] =>
  value === "pt-BR" || value === "en";

export const today = () => businessDate(now(), state.restaurant.timezone);

export function currentMenu() {
  return activeMenu(state.menus, now(), state.restaurant.timezone)?.menu as
    (typeof state.menus)[number] | undefined;
}

/** The menu a device's journey is on: the one it last loaded, else the active one. */
export function journeyMenuId(deviceId: string): string | null {
  return state.deviceMenus.get(deviceId) ?? currentMenu()?.id ?? null;
}

export function pricingProblem(error: unknown) {
  if (error instanceof PricingError)
    return problem(error.status, error.code, error.title, error.detail);
  throw error;
}

function requestLanguage(req: Request): Schemas["LanguageCode"] {
  const language = (req.body as { language?: unknown } | null)?.language;
  return isLanguage(language) ? language : state.restaurant.defaultLanguage;
}

export const kioskRoutes: Route[] = [
  [
    "GET",
    /^\/v1\/menus\/active$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      const language = req.query.get("language");
      if (!isLanguage(language))
        return problem(422, "VALIDATION_FAILED", "Validation failed", "language");
      const menu = currentMenu();
      if (!menu) return problem(404, "NO_ACTIVE_MENU", "No menu is active now");
      state.deviceMenus.set(device.id, menu.id);
      const body = resolveMenu(menu, state.catalogue, language, today());
      const hash = createHash("sha1").update(JSON.stringify(body)).digest("hex").slice(0, 12);
      const etag = `"menu-${menu.id}-${hash}-${language}"`;
      if (req.headers["if-none-match"] === etag) return { status: 304, headers: { ETag: etag } };
      return { status: 200, body, headers: { ETag: etag } };
    },
  ],
  [
    "GET",
    /^\/v1\/languages\/([^/]+)$/,
    (req, [code]) => {
      const { error } = authDevice(req);
      if (error) return error;
      if (!isLanguage(code)) return notFound();
      return ok({
        code,
        name: code === "pt-BR" ? "Português" : "English",
        strings: state.languagePacks[code],
      } satisfies Schemas["LanguagePack"]);
    },
  ],
  [
    "POST",
    /^\/v1\/journeys$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      const body = req.body as Partial<Schemas["StartJourneyRequest"]> | null;
      if (!body?.orderNonce || !isLanguage(body.language)) {
        return problem(422, "VALIDATION_FAILED", "Validation failed");
      }
      const startedAt = now().toISOString();
      state.journeys.set(body.orderNonce, {
        orderNonce: body.orderNonce,
        deviceId: device.id,
        language: body.language,
        startedAt,
        events: [],
      });
      return ok({ journeyStartedTimestamp: startedAt } satisfies Schemas["JourneyStarted"], 201);
    },
  ],
  [
    "POST",
    /^\/v1\/journeys\/([^/]+)\/events$/,
    (req, [nonce]) => {
      const { error } = authDevice(req);
      if (error) return error;
      const event = req.body as Partial<Schemas["JourneyEvent"]> | null;
      if (!event?.type) return problem(422, "VALIDATION_FAILED", "Validation failed");
      // Fire-and-forget: an unknown nonce (journey start failed) is still recorded.
      const journey = state.journeys.get(nonce);
      journey?.events.push({ ...(event as Schemas["JourneyEvent"]), at: now().toISOString() });
      console.log(`[mock] journey ${nonce.slice(0, 8)}: ${event.type} (${event.orderTotal ?? 0})`);
      return { status: 204 };
    },
  ],
  [
    "POST",
    /^\/v1\/quotes$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      const body = req.body as Schemas["QuoteRequest"];
      try {
        const { total } = priceBasket(
          { ...body, menuId: journeyMenuId(device.id) },
          state.catalogue,
          state.restaurant,
          { today: today(), at: now(), language: state.restaurant.defaultLanguage },
        );
        return ok(total);
      } catch (e) {
        return pricingProblem(e);
      }
    },
  ],
  [
    "POST",
    /^\/v1\/discounts\/validate$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      const body = req.body as Schemas["DiscountValidationRequest"];
      if (
        body.currentDiscountCode &&
        body.currentDiscountCode.trim().toUpperCase() === body.code.trim().toUpperCase()
      ) {
        return problem(409, "COUPON_ALREADY_APPLIED", "This code is already applied");
      }
      try {
        const language = requestLanguage(req);
        const { total } = priceBasket(
          { ...body, discountCode: null, menuId: journeyMenuId(device.id) },
          state.catalogue,
          state.restaurant,
          { today: today(), at: now(), language },
        );
        return ok(
          applyDiscount(
            body.code,
            total.subtotal,
            state.catalogue.discounts,
            now(),
            language,
            body.entryMethod,
          ),
        );
      } catch (e) {
        return pricingProblem(e);
      }
    },
  ],
];
