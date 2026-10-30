// Stateful mock of the Comanda Core API for front-end work before the Go API
// exists. Runs on MOCK_PORT (4020); Prism runs in front on 4010 in proxy mode
// and checks every request and response against contract/openapi.yaml, so the
// BFF keeps CORE_API_URL=http://localhost:4010. Run with `npm run mock`.
//
// Mock-only control endpoints (not in the contract, called on 4020 directly):
//   GET  /__mock            current scenario, scenarios, device health, reports
//   POST /__mock/scenario   {"name": "<scenario>"} resets the state to it

import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

import { SEED_MEDIA } from "./catalogue.ts";
import { authDevice, problem, type Reply, type Request, type Route, type Schemas } from "./http.ts";
import { adminRoutes } from "./routes-admin.ts";
import { catalogueRoutes } from "./routes-catalogue.ts";
import { optionRoutes } from "./routes-options.ts";
import { kioskRoutes } from "./routes-kiosk.ts";
import { orderRoutes } from "./routes-orders.ts";
import { activeMenu, nextOpening } from "./schedule.ts";
import { applyScenario, isScenario, now, SCENARIOS, state } from "./state.ts";

const MOCK_PORT = Number(process.env.MOCK_PORT ?? 4020);
const PRISM_PORT = Number(process.env.PRISM_PORT ?? 4010);
const TOKEN_TTL_S = Number(process.env.MOCK_TOKEN_TTL ?? 900);
const ASSETS = new URL("../../../docs/prototype/assets/", import.meta.url);

function deviceConfig(device: (typeof state.devices)[number]): Schemas["DeviceConfig"] {
  const r = state.restaurant;
  const at = now();
  const active = activeMenu(state.menus, at, r.timezone);
  return {
    kioskID: device.id,
    kind: device.kind,
    idleTimerIntervalMilliseconds: device.idleTimerIntervalMilliseconds,
    printerEnabled: device.printerEnabled,
    maintenanceMode: device.maintenanceMode,
    atCapacityMode: device.atCapacityMode,
    isOpen: active !== null && (r.isDineInAvailable || r.isTakeOutAvailable),
    restaurant: {
      locationId: r.id,
      name: r.name,
      logo: r.logo ?? null,
      currency: "BRL",
      timezone: r.timezone,
      defaultLanguage: r.defaultLanguage,
      supportedLanguages: r.supportedLanguages.map((code) => ({
        code,
        name: code === "pt-BR" ? "Português" : "English",
      })),
      isDineInAvailable: r.isDineInAvailable,
      isTakeOutAvailable: r.isTakeOutAvailable,
      closedMessage: r.closedMessage,
      posCheckNumberDisplayLength: r.posCheckNumberDisplayLength,
    },
    activeMenu: active
      ? {
          id: active.menu.id,
          name: (active.menu as (typeof state.menus)[number]).name["pt-BR"],
          until: active.until.toISOString(),
        }
      : null,
    nextOpeningAt: active
      ? null
      : (nextOpening(state.menus, at, r.timezone)?.toISOString() ?? null),
    serverTime: at.toISOString(),
  };
}

const routes: Route[] = [
  ...kioskRoutes,
  ...orderRoutes,
  ...adminRoutes,
  ...catalogueRoutes,
  ...optionRoutes,
  [
    "POST",
    /^\/v1\/devices\/auth$/,
    (req) => {
      const { deviceId, deviceSecret } = (req.body ?? {}) as Partial<Schemas["DeviceAuthRequest"]>;
      const device = state.devices.find((d) => d.id === deviceId);
      if (!device || device.secret !== deviceSecret) {
        return problem(401, "INVALID_CREDENTIALS", "Invalid credentials");
      }
      if (device.status === "DISABLED") return problem(403, "DEVICE_DISABLED", "Device disabled");
      const accessToken = randomBytes(24).toString("base64url");
      state.tokens.set(accessToken, {
        deviceId: device.id,
        expiresAt: Date.now() + TOKEN_TTL_S * 1000,
      });
      return { status: 200, body: { accessToken, tokenType: "Bearer", expiresIn: TOKEN_TTL_S } };
    },
  ],
  [
    "GET",
    /^\/v1\/devices\/me\/config$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      const config = deviceConfig(device);
      const { serverTime: _, ...versioned } = config;
      const etag = `"cfg-${createHash("sha1").update(JSON.stringify(versioned)).digest("hex").slice(0, 16)}"`;
      if (req.headers["if-none-match"] === etag) return { status: 304, headers: { ETag: etag } };
      return { status: 200, body: config, headers: { ETag: etag } };
    },
  ],
  [
    "POST",
    /^\/v1\/devices\/heartbeat$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      const beat = req.body as Schemas["Heartbeat"];
      device.appVersion = beat.appVersion;
      device.screenResolution = beat.screenResolution;
      device.ip = beat.ip ?? req.ip;
      device.lastSeenAt = new Date().toISOString();
      return { status: 204 };
    },
  ],
  [
    "POST",
    /^\/v1\/devices\/status$/,
    (req) => {
      const { device, error } = authDevice(req);
      if (error) return error;
      state.statusReports.push({
        deviceId: device.id,
        at: new Date().toISOString(),
        report: req.body as Schemas["DeviceReport"],
      });
      state.statusReports.splice(0, state.statusReports.length - 50);
      return { status: 204 };
    },
  ],
  [
    "GET",
    /^\/__mock$/,
    () => ({
      status: 200,
      body: {
        scenario: state.scenario,
        scenarios: SCENARIOS,
        mockTime: now().toISOString(),
        devices: state.devices.map(({ secret: _, ...d }) => d),
        statusReports: state.statusReports.slice(-10),
      },
    }),
  ],
  [
    "POST",
    /^\/__mock\/scenario$/,
    (req) => {
      const name = (req.body as { name?: unknown } | null)?.name;
      if (!isScenario(name)) return { status: 400, body: { error: "unknown scenario" } };
      applyScenario(name);
      console.log(`[mock] scenario: ${name}`);
      return { status: 200, body: { scenario: name } };
    },
  ],
];

async function readRaw(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

function parseJson(raw: Buffer): unknown {
  if (raw.length === 0) return null;
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    return null;
  }
}

function send(res: ServerResponse, reply: Reply) {
  const headers = { ...reply.headers };
  if (reply.body !== undefined && !headers["Content-Type"])
    headers["Content-Type"] = "application/json";
  res.writeHead(reply.status, headers);
  res.end(reply.body === undefined ? undefined : JSON.stringify(reply.body));
}

/**
 * Media the Core API serves under /media (not in the contract: MediaAsset.url
 * points here). The BFF fetches it directly from the mock, not through Prism.
 */
async function serveMedia(path: string, res: ServerResponse): Promise<boolean> {
  const name = /^\/media\/([\w.-]+)$/.exec(path)?.[1];
  const file = name && (state.media.get(name) ?? SEED_MEDIA[name]);
  if (!file) return false;
  try {
    const bytes = typeof file === "string" ? await readFile(new URL(file, ASSETS)) : file.bytes;
    const type = typeof file === "string" ? "image/jpeg" : file.type;
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "public, max-age=3600" });
    res.end(bytes);
    return true;
  } catch {
    return false;
  }
}

// Prism forwards some BFF requests (those Next.js sends chunked, e.g. from Route
// Handlers) with both Content-Length and Transfer-Encoding. Node's strict
// parser rejects that with a bare 400; Go's net/http accepts it, so the mock does too.
const server = createServer({ insecureHTTPParser: true }, async (incoming, res) => {
  const url = new URL(incoming.url ?? "/", "http://mock");
  if (incoming.method === "GET" && (await serveMedia(url.pathname, res))) return;
  const raw = await readRaw(incoming);
  const req: Request = {
    method: incoming.method ?? "GET",
    path: url.pathname,
    query: url.searchParams,
    headers: incoming.headers,
    raw,
    body: parseJson(raw),
    ip: incoming.socket.remoteAddress ?? "",
  };
  for (const [method, pattern, handler] of routes) {
    const match = pattern.exec(req.path);
    if (match && method === req.method) return send(res, handler(req, match.slice(1)));
  }
  send(res, problem(404, "NOT_FOUND", `Not mocked yet: ${req.method} ${req.path}`));
});

// Malformed requests get Node's bare 400; log why, since Prism only sees the status.
server.on("clientError", (error: NodeJS.ErrnoException & { rawPacket?: Buffer }, socket) => {
  console.warn(`[mock] bad request: ${error.code} ${error.message}`);
  if (error.rawPacket) console.warn(error.rawPacket.toString("latin1").slice(0, 600));
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.listen(MOCK_PORT, () => {
  console.log(
    `[mock] Core API mock on http://localhost:${MOCK_PORT} (scenario: ${state.scenario})`,
  );
  if (process.env.MOCK_NO_PRISM) return;
  // Prism validates every request and response against the contract.
  const prismCli = fileURLToPath(
    new URL("../node_modules/@stoplight/prism-cli/dist/index.js", import.meta.url),
  );
  const contract = fileURLToPath(new URL("../../../contract/openapi.yaml", import.meta.url));
  const prism = spawn(
    process.execPath,
    [
      prismCli,
      "proxy",
      contract,
      `http://localhost:${MOCK_PORT}`,
      "-p",
      String(PRISM_PORT),
      "--errors",
    ],
    { stdio: "inherit" },
  );
  const stop = () => {
    prism.kill();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
});
