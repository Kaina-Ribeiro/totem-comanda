// In-memory state shared by the mock's routes: devices and their tokens, the
// owner, the clock, uploads and idempotency. The catalogue, menus, baskets,
// payments and orders are in ./v2/state.ts, which reseeds with this one.
// Shapes follow contract/openapi.yaml; anything extra is mock-only.

import type { Reply, Schemas } from "./http.ts";
import { todayAt } from "./schedule.ts";

export type MockDevice = Omit<Schemas["AdminDevice"], "online" | "paymentTerminalId"> & { secret: string };

/** The store's timezone in the seed (v2/seed.ts), for the scenarios' clock shifts. */
const TIME_ZONE = "America/Sao_Paulo";

function seed() {
  return {
    devices: [
      device("KIOSK-TBT-001", "KIOSK", "Totem da entrada", "s3cr3t-from-provisioning"),
      device("KITCHEN-TBT-001", "KITCHEN", "Tela da cozinha", "kitchen-s3cr3t"),
    ],
    /** The one owner account (test credentials, mock only). */
    owner: { email: "dono@padaria.test", password: "padaria-teste" },
    /** Opaque owner tokens: token → expiry (ms). */
    ownerTokens: new Map<string, number>(),
    /** Owner-edited UI strings per language (OP-START-02), merged over the kiosk's bundle. */
    languagePacks: { "pt-BR": {}, en: {} } as Record<
      Schemas["LanguageCode"],
      Record<string, string>
    >,
    /** Uploaded media by file name (POST /v2/admin/media); seed photos are in media.ts. */
    media: new Map<string, { bytes: Buffer; type: string }>(),
    /** Idempotency-Key → first body and reply. */
    idempotency: new Map<string, { body: string; reply: Reply }>(),
    /** Opaque device tokens: token → device id and expiry (ms). */
    tokens: new Map<string, { deviceId: string; expiresAt: number }>(),
    /** OP-KIOSK-04 reports, newest last. */
    statusReports: [] as Array<{ deviceId: string; at: string; report: Schemas["DeviceReport"] }>,
    /** Shifts the mock's clock, so a scenario can stand outside opening hours. */
    clockOffsetMs: 0,
    scenario: "normal" as ScenarioName,
  };
}

function device(id: string, kind: Schemas["DeviceKind"], name: string, secret: string): MockDevice {
  return {
    id,
    kind,
    name,
    secret,
    status: "ACTIVE",
    idleTimerIntervalMilliseconds: 30000,
    printerEnabled: false,
    maintenanceMode: false,
    atCapacityMode: false,
    appVersion: null,
    lastSeenAt: null,
    ip: null,
    screenResolution: null,
  };
}

export let state = seed();

export const now = () => new Date(Date.now() + state.clockOffsetMs);

/**
 * The id and secret of the first active device of `kind`, for the dev index
 * to pair a browser as that device (COM-139). Mock seeds only: these test
 * secrets are in this file already.
 */
export function seededCredentials(
  kind: Schemas["DeviceKind"],
): { deviceId: string; deviceSecret: string } | null {
  const device = state.devices.find((d) => d.kind === kind && d.status === "ACTIVE");
  return device ? { deviceId: device.id, deviceSecret: device.secret } : null;
}

/** Ids a self-registered device may use: they end up in /v2/admin/devices/{deviceId}. */
const AUTO_DEVICE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * The device signing in with this id and secret. With MOCK_AUTO_DEVICES=1
 * (production used as the test environment, where nobody can pair screens
 * through the back office yet) an unknown id registers itself with the secret
 * it sent: ids starting with KITCHEN or COZINHA become kitchen screens, any
 * other a kiosk. A known id with the wrong secret is still refused.
 */
export function signInDevice(
  deviceId: unknown,
  secret: unknown,
  autoRegister = process.env.MOCK_AUTO_DEVICES === "1",
): MockDevice | null {
  if (typeof deviceId !== "string" || typeof secret !== "string") return null;
  const known = state.devices.find((d) => d.id === deviceId);
  if (known) return known.secret === secret ? known : null;
  if (!autoRegister || !AUTO_DEVICE_ID.test(deviceId) || !secret) return null;
  const kitchen = /^(KITCHEN|COZINHA)/i.test(deviceId);
  const created = device(
    deviceId,
    kitchen ? "KITCHEN" : "KIOSK",
    `${kitchen ? "Cozinha" : "Totem"} ${deviceId} (automático)`,
    secret,
  );
  state.devices.push(created);
  console.log(`[mock] auto-registered ${created.kind} device ${deviceId}`);
  return created;
}

/**
 * Named states the BFF's /dev/mock page can switch to. Each starts from a fresh
 * seed, so they do not pile up.
 */
export const SCENARIOS = {
  normal: "Normal (horário de agora)",
  morning: "Aberto, cardápio da manhã (08:00)",
  afternoon: "Aberto, cardápio da tarde (15:00)",
  closed: "Fechado (21:00, volta às 06:00)",
  maintenance: "Totem em manutenção",
  "at-capacity": "Cozinha lotada",
  "device-disabled": "Totem desativado no back office",
  "secret-rotated": "Secret do totem trocado (401 no auth)",
} as const;
export type ScenarioName = keyof typeof SCENARIOS;

export function isScenario(value: unknown): value is ScenarioName {
  return typeof value === "string" && Object.hasOwn(SCENARIOS, value);
}

export function applyScenario(name: ScenarioName): void {
  state = seed();
  state.scenario = name;
  const kiosk = state.devices[0];
  const tz = TIME_ZONE;
  const shiftTo = (hhmm: string) => {
    state.clockOffsetMs = todayAt(hhmm, new Date(), tz).getTime() - Date.now();
  };
  switch (name) {
    case "morning":
      return shiftTo("08:00");
    case "afternoon":
      return shiftTo("15:00");
    case "closed":
      return shiftTo("21:00");
    case "maintenance":
      kiosk.maintenanceMode = true;
      return;
    case "at-capacity":
      kiosk.atCapacityMode = true;
      return;
    case "device-disabled":
      kiosk.status = "DISABLED";
      return;
    case "secret-rotated":
      kiosk.secret = "rotated-in-the-back-office";
      return;
    case "normal":
      return;
  }
}
