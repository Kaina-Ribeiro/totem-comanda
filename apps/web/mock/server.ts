// Stateful mock of the Comanda Core API for front-end work before the Go API
// exists. Runs on MOCK_PORT (4020); Prism runs in front on PRISM_PORT (4010) in
// proxy mode and checks every request and response against contract/openapi.yaml,
// so the BFF keeps CORE_API_URL=http://localhost:4010. Run with `npm run mock`.
// Routes live in ./v2 (the contract's /v2 paths).
//
// Mock-only control endpoints (not in the contract, called on 4020 directly):
//   GET  /__mock            current scenario, scenarios, device health, reports
//   POST /__mock/scenario   {"name": "<scenario>"} resets the state to it
//   POST /__mock/fault      {"path": "<regex>", "method"?, "status"?, "code"?, "delayMs"?, "times"?}
//                           makes the next matching Core API calls slow or fail
//                           (timeouts, 4xx, 5xx, a lost answer); DELETE clears them.
//                           A 4xx answers a contract Problem: `code` defaults for 401,
//                           404 and 422 and is required for other 4xx (faults.ts)
//   POST /__mock/kitchen/backdate {"number": "20261110-0001", "minutes": 12}
//                           moves an order's placedAt and status history back, to see waiting colours
//   POST /__mock/clock     {"minutes": 16} moves the mock's clock forward (a pause's automatic resume)
//   GET  /__mock/device-credentials?kind=KITCHEN  id and secret of a seeded device, for the
//                           dev index to pair a browser as the kiosk or the kitchen (COM-139)
//   POST /__mock/payments/{id} {"outcome": "APPROVED" | "DECLINED" | "EXPIRED"}  decides a
//                           Mercado Pago session; a late approval is listed under v2.refunds
//
// MOCK_PAYMENT_OUTCOME, MOCK_PAYMENT_DELAY_MS and MOCK_WEBHOOK_PLACE_MS: see v2/payments.ts.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";

import { faultCode, faultReply } from "./faults.ts";
import { problem, type Reply, type Request, type Route, type Schemas } from "./http.ts";
import { mediaType, SEED_MEDIA } from "./media.ts";
import { currentPace } from "./pace.ts";
import { forceOutcome, publicSession, sweep } from "./v2/payments.ts";
import { adminRoutes } from "./v2/routes-admin.ts";
import { guestRoutes } from "./v2/routes-guest.ts";
import { kitchenRoutes, serveKitchenStream } from "./v2/routes-kitchen.ts";
import { v2 } from "./v2/state.ts";
import {
  applyScenario,
  isScenario,
  now,
  SCENARIOS,
  seededCredentials,
  state,
} from "./state.ts";

const MOCK_PORT = Number(process.env.MOCK_PORT ?? 4020);
const PRISM_PORT = Number(process.env.PRISM_PORT ?? 4010);

const routes: Route[] = [
  ...guestRoutes,
  ...kitchenRoutes,
  ...adminRoutes,
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
        v2: {
          refunds: v2().refunds,
          payments: [...v2().payments.values()].slice(-10).map(publicSession),
        },
      },
    }),
  ],
  [
    "POST",
    /^\/__mock\/payments\/([^/]+)$/,
    (req, [paymentId]) => {
      const session = v2().payments.get(paymentId);
      if (!session) return { status: 404, body: { error: "payment" } };
      return forceOutcome(session, (req.body as { outcome?: unknown } | null)?.outcome);
    },
  ],
  [
    "POST",
    /^\/__mock\/fault$/,
    (req) => {
      const body = (req.body ?? {}) as Partial<Fault> & { path?: unknown; code?: unknown };
      if (typeof body.path !== "string") return { status: 400, body: { error: "path is required" } };
      const status = typeof body.status === "number" ? body.status : undefined;
      const coded = faultCode(status, typeof body.code === "string" ? body.code : undefined);
      if ("error" in coded) return { status: 400, body: { error: coded.error } };
      const fault: Fault = {
        path: new RegExp(body.path),
        method: typeof body.method === "string" ? body.method.toUpperCase() : undefined,
        status,
        code: coded.code,
        delayMs: typeof body.delayMs === "number" ? body.delayMs : 0,
        times: typeof body.times === "number" ? body.times : 1,
      };
      faults.push(fault);
      console.log(`[mock] fault: ${fault.method ?? "*"} ${body.path} ×${fault.times}`);
      return { status: 200, body: { faults: faults.length } };
    },
  ],
  [
    "POST",
    /^\/__mock\/kitchen\/backdate$/,
    (req) => {
      const body = (req.body ?? {}) as { number?: unknown; minutes?: unknown };
      const order = v2().orders.get(String(body.number));
      if (!order || typeof body.minutes !== "number") {
        return { status: 400, body: { error: "number of a placed order and minutes" } };
      }
      const back = (at: string) => new Date(Date.parse(at) - (body.minutes as number) * 60_000).toISOString();
      order.placedAt = back(order.placedAt);
      for (const change of order.history) change.at = back(change.at);
      return { status: 200, body: { number: order.number, placedAt: order.placedAt } };
    },
  ],
  [
    "GET",
    /^\/__mock\/device-credentials$/,
    (req) => {
      const kind = req.query.get("kind");
      if (kind !== "KIOSK" && kind !== "KITCHEN") return { status: 400, body: { error: "kind" } };
      const credentials = seededCredentials(kind);
      return credentials
        ? { status: 200, body: credentials }
        : { status: 404, body: { error: kind } };
    },
  ],
  [
    "POST",
    /^\/__mock\/clock$/,
    (req) => {
      const minutes = (req.body as { minutes?: unknown } | null)?.minutes;
      if (typeof minutes !== "number") return { status: 400, body: { error: "minutes" } };
      state.clockOffsetMs += minutes * 60_000;
      currentPace(); // A clock moved past a pause's end resumes now, and says so.
      return { status: 200, body: { now: now().toISOString() } };
    },
  ],
  [
    "DELETE",
    /^\/__mock\/fault$/,
    () => {
      faults.length = 0;
      return { status: 204 };
    },
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

/** A Core API call made slow or failing on purpose, for the next `times` matches. */
type Fault = {
  path: RegExp;
  method?: string;
  /** Answer with this status instead of the route's answer. */
  status?: number;
  /** The problem code of a 4xx answer (see faults.ts). */
  code?: Schemas["ProblemCode"];
  /** Wait this long first; with no status the route then answers normally. */
  delayMs: number;
  times: number;
};
const faults: Fault[] = [];

/** Applies the first matching fault; true when it already answered. */
async function applyFault(req: Request, res: ServerResponse): Promise<boolean> {
  if (req.path.startsWith("/__mock")) return false;
  const fault = faults.find(
    (f) => f.times > 0 && f.path.test(req.path) && (!f.method || f.method === req.method),
  );
  if (!fault) return false;
  fault.times -= 1;
  if (fault.times === 0) faults.splice(faults.indexOf(fault), 1);
  if (fault.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, fault.delayMs));
  if (fault.status === undefined) return false;
  send(res, faultReply(fault.status, fault.code));
  return true;
}

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
    const seed = file instanceof URL;
    const bytes = seed ? await readFile(file) : file.bytes;
    const type = seed ? mediaType(name) : file.type;
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
  if (await applyFault(req, res)) return;
  if (serveKitchenStream(req, res)) return;
  if (req.path.startsWith("/v2/")) sweep();
  for (const [method, pattern, handler] of routes) {
    const match = pattern.exec(req.path);
    if (match && method === req.method) return send(res, handler(req, match.slice(1)));
  }
  send(res, problem(404, "NOT_FOUND", `Not mocked yet: ${req.method} ${req.path}`));
});

// Malformed requests get Node's bare 400; log why, since Prism only sees the status.
server.on("clientError", (error: NodeJS.ErrnoException & { rawPacket?: Buffer }, socket) => {
  // A client hanging up (e.g. a closed event stream) is not a bad request.
  if (error.code === "ECONNRESET") return socket.destroy();
  console.warn(`[mock] bad request: ${error.code} ${error.message}`);
  if (error.rawPacket) console.warn(error.rawPacket.toString("latin1").slice(0, 600));
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

server.listen(MOCK_PORT, () => {
  console.log(
    `[mock] Core API mock on http://localhost:${MOCK_PORT} (scenario: ${state.scenario})`,
  );
  // v2 Mercado Pago sessions move on with the clock (expiry, outcome, webhook placement).
  setInterval(() => sweep(), 1000).unref();
  if (process.env.MOCK_NO_PRISM) return;
  // Prism validates every request and response against the contract.
  const prismCli = fileURLToPath(
    new URL("../node_modules/@stoplight/prism-cli/dist/index.js", import.meta.url),
  );
  const prism = spawn(
    process.execPath,
    [
      prismCli,
      "proxy",
      fileURLToPath(new URL("../../../contract/openapi.yaml", import.meta.url)),
      `http://localhost:${MOCK_PORT}`,
      "-p",
      String(PRISM_PORT),
      // 0.0.0.0 when the BFF runs in another container (deploy/cubeship).
      "-h",
      process.env.PRISM_HOST ?? "127.0.0.1",
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
