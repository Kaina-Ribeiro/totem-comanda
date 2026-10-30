// In-memory state of the mock Core API, seeded with the prototype's bakery.
// Shapes follow contract/openapi.yaml; anything extra is mock-only.

import type { components } from "../src/lib/core-api.d.ts";
import { todayAt, type ScheduledMenu, type Weekday } from "./schedule.ts";

type Schemas = components["schemas"];

export type MockDevice = Omit<Schemas["AdminDevice"], "online"> & { secret: string };
export type MockMenu = ScheduledMenu & {
  name: Schemas["LocalizedText"];
  showCategoriesPrice: boolean;
};

const WEEK: Weekday[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const daily = (timeStart: string, timeEnd: string) =>
  WEEK.map((weekday) => ({ weekday, timeStart, timeEnd }));

function seed() {
  return {
    restaurant: {
      id: "rst-padaria-01",
      name: "[Nome da padaria]",
      logo: null,
      cnpj: "12345678000190",
      timezone: "America/Sao_Paulo",
      defaultLanguage: "pt-BR",
      supportedLanguages: ["pt-BR", "en"],
      isDineInAvailable: true,
      isTakeOutAvailable: true,
      closedMessage: {
        title: { "pt-BR": "Fechado agora", en: "Closed now" },
        description: { "pt-BR": "Volte no nosso horário.", en: "Come back during our hours." },
      },
      posCheckNumberDisplayLength: 2,
      receiptFooter: { "pt-BR": "Obrigado e volte sempre!", en: "Thank you!" },
    } satisfies Schemas["Restaurant"],
    devices: [
      device("KIOSK-TBT-001", "KIOSK", "Totem da entrada", "s3cr3t-from-provisioning"),
      device("KITCHEN-TBT-001", "KITCHEN", "Tela da cozinha", "kitchen-s3cr3t"),
    ],
    menus: [
      {
        id: "mnu-manha",
        name: { "pt-BR": "Manhã", en: "Morning" },
        showCategoriesPrice: false,
        schedules: daily("06:00", "11:00"),
        forcedUntil: null,
      },
      {
        id: "mnu-tarde",
        name: { "pt-BR": "Tarde", en: "Afternoon" },
        showCategoriesPrice: false,
        schedules: daily("11:00", "20:00"),
        forcedUntil: null,
      },
    ] as MockMenu[],
    /** Opaque device tokens: token → device id and expiry (ms). */
    tokens: new Map<string, { deviceId: string; expiresAt: number }>(),
    /** OP-KIOSK-04 reports, newest last. */
    statusReports: [] as Array<{ deviceId: string; at: string; report: Schemas["DeviceReport"] }>,
    /** Shifts the mock's clock, so a scenario can stand outside opening hours. */
    clockOffsetMs: 0,
    scenario: "normal" as ScenarioName,
  };
}

function device(
  id: string,
  kind: Schemas["DeviceKind"],
  name: string,
  secret: string,
): MockDevice {
  return {
    id,
    kind,
    name,
    secret,
    status: "ACTIVE",
    idleTimerIntervalMilliseconds: 20000,
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
  const tz = state.restaurant.timezone;
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
