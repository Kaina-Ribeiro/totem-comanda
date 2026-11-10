// Owner sign-in and the back office's devices (Aparelhos). Devices, their
// secrets and tokens live in ../state.ts, shared with device sign-in; the Point
// terminal of each kiosk lives in the v2 state.

import { randomBytes } from "node:crypto";

import { authOwner, ok, type Reply, type Request, type Route } from "../http.ts";
import { state } from "../state.ts";
import { notFound, problem, type S } from "./http.ts";
import { paymentTerminalId, v2 } from "./state.ts";

const OWNER_TTL_S = Number(process.env.MOCK_OWNER_TOKEN_TTL ?? 8 * 60 * 60);
/** AdminDevice.online: a heartbeat in the last 3 minutes. */
const ONLINE_MS = 3 * 60_000;

const owner =
  (handler: (req: Request, params: string[]) => Reply) => (req: Request, params: string[]) =>
    authOwner(req) ?? handler(req, params.map(decodeURIComponent));

function adminDevice(device: (typeof state.devices)[number]): S["AdminDevice"] {
  const { secret: _, ...rest } = device;
  const seen = device.lastSeenAt ? Date.parse(device.lastSeenAt) : 0;
  return { ...rest, paymentTerminalId: paymentTerminalId(device.id), online: Date.now() - seen < ONLINE_MS };
}

function deviceProblem(input: Partial<S["DeviceInput"]> | null): string | null {
  if (!input?.name?.trim()) return "name";
  if (input.kind !== "KIOSK" && input.kind !== "KITCHEN") return "kind";
  if (input.status !== "ACTIVE" && input.status !== "DISABLED") return "status";
  if (!Number.isInteger(input.idleTimerIntervalMilliseconds) || input.idleTimerIntervalMilliseconds! < 0) {
    return "idleTimerIntervalMilliseconds";
  }
  return null;
}

const newSecret = () => randomBytes(18).toString("base64url");

/** Drops every token a device holds, so a new secret or a disable takes effect at once. */
function forgetTokens(deviceId: string) {
  for (const [token, entry] of state.tokens) if (entry.deviceId === deviceId) state.tokens.delete(token);
}

/** Splits the Point terminal (v2 state) from the rest of a device body. */
function save(device: (typeof state.devices)[number], input: S["DeviceInput"]) {
  const { paymentTerminalId: terminal, ...rest } = input;
  Object.assign(device, rest);
  if ("paymentTerminalId" in input) v2().terminals.set(device.id, terminal ?? null);
}

export const deviceAdminRoutes: Route[] = [
  [
    "POST",
    /^\/v2\/admin\/auth\/login$/,
    (req) => {
      const { email, password } = (req.body ?? {}) as Partial<S["OwnerLoginRequest"]>;
      const match = email?.trim().toLowerCase() === state.owner.email && password === state.owner.password;
      if (!match) return problem(401, "INVALID_CREDENTIALS", "Invalid credentials");
      const accessToken = randomBytes(24).toString("base64url");
      state.ownerTokens.set(accessToken, Date.now() + OWNER_TTL_S * 1000);
      return ok({ accessToken, tokenType: "Bearer", expiresIn: OWNER_TTL_S } satisfies S["OwnerToken"]);
    },
  ],
  ["GET", /^\/v2\/admin\/devices$/, owner(() => ok(state.devices.map(adminDevice)))],
  [
    "POST",
    /^\/v2\/admin\/devices$/,
    owner((req) => {
      const input = req.body as S["DeviceInput"];
      const invalid = deviceProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      const prefix = input.kind === "KIOSK" ? "KIOSK" : "KITCHEN";
      const count = state.devices.filter((d) => d.kind === input.kind).length + 1;
      const device = {
        id: `${prefix}-TBT-${String(count).padStart(3, "0")}`,
        name: "",
        kind: input.kind,
        status: input.status,
        idleTimerIntervalMilliseconds: 0,
        printerEnabled: false,
        maintenanceMode: false,
        atCapacityMode: false,
        secret: newSecret(),
        appVersion: null,
        lastSeenAt: null,
        ip: null,
        screenResolution: null,
      };
      save(device, input);
      state.devices.push(device);
      return ok({ device: adminDevice(device), deviceSecret: device.secret } satisfies S["DeviceCredentials"], 201);
    }),
  ],
  [
    "PUT",
    /^\/v2\/admin\/devices\/([^/]+)$/,
    owner((req, [deviceId]) => {
      const device = state.devices.find((d) => d.id === deviceId);
      if (!device) return notFound();
      const input = req.body as S["DeviceInput"];
      const invalid = deviceProblem(input);
      if (invalid) return problem(422, "VALIDATION_FAILED", "Validation failed", invalid);
      save(device, input);
      if (device.status === "DISABLED") forgetTokens(device.id);
      return ok(adminDevice(device));
    }),
  ],
  [
    "POST",
    /^\/v2\/admin\/devices\/([^/]+)\/secret$/,
    owner((_req, [deviceId]) => {
      const device = state.devices.find((d) => d.id === deviceId);
      if (!device) return notFound();
      device.secret = newSecret();
      forgetTokens(device.id);
      return ok({ device: adminDevice(device), deviceSecret: device.secret } satisfies S["DeviceCredentials"]);
    }),
  ],
];
