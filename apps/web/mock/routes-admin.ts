// Back office (owner) routes. Every route but login needs the owner's token.

import { randomBytes } from "node:crypto";

import {
  authOwner,
  notFound,
  ok,
  problem,
  type Reply,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
import { firstFile, imageSize } from "./media.ts";
import { state } from "./state.ts";

const OWNER_TTL_S = Number(process.env.MOCK_OWNER_TOKEN_TTL ?? 8 * 60 * 60);

/** Wraps an owner-only handler: 401 without a valid owner token. */
export const owner =
  (handler: (req: Request, params: string[]) => Reply) => (req: Request, params: string[]) =>
    authOwner(req) ?? handler(req, params);

export const adminRoutes: Route[] = [
  [
    "POST",
    /^\/v1\/admin\/auth\/login$/,
    (req) => {
      const { email, password } = (req.body ?? {}) as Partial<Schemas["OwnerLoginRequest"]>;
      const match =
        email?.trim().toLowerCase() === state.owner.email && password === state.owner.password;
      if (!match) return problem(401, "INVALID_CREDENTIALS", "Invalid credentials");
      const accessToken = randomBytes(24).toString("base64url");
      state.ownerTokens.set(accessToken, Date.now() + OWNER_TTL_S * 1000);
      return ok({
        accessToken,
        tokenType: "Bearer",
        expiresIn: OWNER_TTL_S,
      } satisfies Schemas["OwnerToken"]);
    },
  ],
];

adminRoutes.push(
  ["GET", /^\/v1\/admin\/restaurant$/, owner(() => ok(state.restaurant))],
  [
    "PUT",
    /^\/v1\/admin\/restaurant$/,
    owner((req) => {
      const input = req.body as Partial<Schemas["RestaurantInput"]> | null;
      const invalid = restaurantProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      state.restaurant = { ...state.restaurant, ...(input as Schemas["RestaurantInput"]) };
      return ok(state.restaurant);
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/media$/,
    owner((req) => {
      const file = firstFile(req.raw, req.headers["content-type"]);
      if (!file || !/^image\/(png|jpe?g|webp)$/.test(file.type) || file.bytes.length === 0) {
        return problem(
          422,
          "VALIDATION_FAILED",
          "Validation failed",
          "file must be a PNG, JPEG or WebP image",
        );
      }
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const id = `med-${randomBytes(4).toString("hex")}`;
      state.media.set(`${id}.${ext}`, { bytes: file.bytes, type: file.type });
      return ok(
        {
          id,
          url: `/media/${id}.${ext}`,
          ...imageSize(file.bytes),
        } satisfies Schemas["MediaAsset"],
        201,
      );
    }),
  ],
);

/** The first field that breaks RestaurantInput's rules, or null. */
function restaurantProblem(input: Partial<Schemas["RestaurantInput"]> | null): string | null {
  if (!input) return "body";
  if (!input.name?.trim()) return "name";
  if (!/^[0-9]{14}$/.test(input.cnpj ?? "")) return "cnpj";
  if (!input.supportedLanguages?.includes(input.defaultLanguage ?? "pt-BR"))
    return "defaultLanguage";
  const digits = input.posCheckNumberDisplayLength ?? 0;
  if (digits < 1 || digits > 6) return "posCheckNumberDisplayLength";
  if (!input.closedMessage?.title?.["pt-BR"] || !input.closedMessage.description?.["pt-BR"])
    return "closedMessage";
  return null;
}

/** AdminDevice.online: a heartbeat in the last 3 minutes. */
const ONLINE_MS = 3 * 60_000;

function adminDevice(device: (typeof state.devices)[number]): Schemas["AdminDevice"] {
  const { secret: _, ...rest } = device;
  const seen = device.lastSeenAt ? Date.parse(device.lastSeenAt) : 0;
  return { ...rest, online: Date.now() - seen < ONLINE_MS };
}

function deviceProblem(input: Partial<Schemas["DeviceInput"]> | null): string | null {
  if (!input?.name?.trim()) return "name";
  if (input.kind !== "KIOSK" && input.kind !== "KITCHEN") return "kind";
  if (input.status !== "ACTIVE" && input.status !== "DISABLED") return "status";
  if (
    !Number.isInteger(input.idleTimerIntervalMilliseconds) ||
    input.idleTimerIntervalMilliseconds! < 0
  ) {
    return "idleTimerIntervalMilliseconds";
  }
  return null;
}

const newSecret = () => randomBytes(18).toString("base64url");

/** Drops every token a device holds, so a new secret or a disable takes effect at once. */
function forgetTokens(deviceId: string) {
  for (const [token, entry] of state.tokens)
    if (entry.deviceId === deviceId) state.tokens.delete(token);
}

adminRoutes.push(
  ["GET", /^\/v1\/admin\/devices$/, owner(() => ok(state.devices.map(adminDevice)))],
  [
    "POST",
    /^\/v1\/admin\/devices$/,
    owner((req) => {
      const input = req.body as Schemas["DeviceInput"];
      const invalid = deviceProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      const prefix = input.kind === "KIOSK" ? "KIOSK" : "KITCHEN";
      const count = state.devices.filter((d) => d.kind === input.kind).length + 1;
      const device = {
        ...input,
        id: `${prefix}-TBT-${String(count).padStart(3, "0")}`,
        secret: newSecret(),
        appVersion: null,
        lastSeenAt: null,
        ip: null,
        screenResolution: null,
      };
      state.devices.push(device);
      return ok(
        {
          device: adminDevice(device),
          deviceSecret: device.secret,
        } satisfies Schemas["DeviceCredentials"],
        201,
      );
    }),
  ],
  [
    "PUT",
    /^\/v1\/admin\/devices\/([^/]+)$/,
    owner((req, [deviceId]) => {
      const device = state.devices.find((d) => d.id === deviceId);
      if (!device) return notFound();
      const input = req.body as Schemas["DeviceInput"];
      const invalid = deviceProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      Object.assign(device, input);
      if (device.status === "DISABLED") forgetTokens(device.id);
      return ok(adminDevice(device));
    }),
  ],
  [
    "POST",
    /^\/v1\/admin\/devices\/([^/]+)\/secret$/,
    owner((_req, [deviceId]) => {
      const device = state.devices.find((d) => d.id === deviceId);
      if (!device) return notFound();
      device.secret = newSecret();
      forgetTokens(device.id);
      return ok({
        device: adminDevice(device),
        deviceSecret: device.secret,
      } satisfies Schemas["DeviceCredentials"]);
    }),
  ],
);
