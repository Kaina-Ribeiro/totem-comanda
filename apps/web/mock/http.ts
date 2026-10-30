// Request, reply and auth helpers shared by the mock's route modules.

import type { IncomingMessage } from "node:http";

import type { components } from "../src/lib/core-api.d.ts";
import { state } from "./state.ts";

export type Schemas = components["schemas"];

export type Reply = { status: number; body?: unknown; headers?: Record<string, string> };
export type Request = {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: IncomingMessage["headers"];
  body: unknown;
  ip: string;
};
export type Route = [string, RegExp, (req: Request, params: string[]) => Reply];

export function problem(
  status: number,
  code: Schemas["ProblemCode"],
  title: string,
  detail?: string,
): Reply {
  return {
    status,
    body: {
      type: `/problems/${code.toLowerCase().replaceAll("_", "-")}`,
      title,
      status,
      code,
      ...(detail ? { detail } : {}),
    },
    headers: { "Content-Type": "application/problem+json" },
  };
}

export const ok = (body: unknown, status = 200): Reply => ({ status, body });
export const notFound = () => problem(404, "NOT_FOUND", "Not found");

/** The device behind the bearer token, or a 401. */
export function authDevice(req: Request) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  const entry = token ? state.tokens.get(token) : undefined;
  const device = entry && state.devices.find((d) => d.id === entry.deviceId);
  if (!entry || entry.expiresAt < Date.now() || !device || device.status !== "ACTIVE") {
    return { error: problem(401, "UNAUTHORIZED", "Unauthorized") } as const;
  }
  return { device } as const;
}

/** The owner behind the bearer token, or a 401. */
export function authOwner(req: Request): Reply | null {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  const expiresAt = token ? state.ownerTokens.get(token) : undefined;
  if (!expiresAt || expiresAt < Date.now()) return problem(401, "UNAUTHORIZED", "Unauthorized");
  return null;
}

/**
 * Idempotency-Key handling: same key and same body replays the first reply,
 * same key and another body is 409 IDEMPOTENCY_KEY_REUSED.
 */
export function idempotent(req: Request, scope: string, run: () => Reply): Reply {
  const key = req.headers["idempotency-key"];
  if (typeof key !== "string" || key === "") {
    return problem(422, "VALIDATION_FAILED", "Idempotency-Key header is required");
  }
  const id = `${scope}:${key}`;
  const body = JSON.stringify(req.body ?? null);
  const seen = state.idempotency.get(id);
  if (seen) {
    if (seen.body !== body) {
      return problem(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key reused with a different body");
    }
    return seen.reply;
  }
  const reply = run();
  // Only successes are remembered, so a rejected attempt can be fixed and retried.
  if (reply.status < 400) state.idempotency.set(id, { body, reply });
  return reply;
}
