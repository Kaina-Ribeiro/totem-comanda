import "server-only";

import createClient, { type Client } from "openapi-fetch";

import type { components, paths } from "@/lib/core-api";

export type CoreApi = Client<paths>;
export type Problem = components["schemas"]["Problem"];
export type ProblemCode = components["schemas"]["ProblemCode"];

/** Every Core API call gives up after this long (BFF BR-XC-04): reads and writes alike. */
export const CALL_TIMEOUT_MS = 5_000;
/** Image uploads and downloads carry bigger bodies. */
export const MEDIA_TIMEOUT_MS = 30_000;

/**
 * fetch that aborts after `ms`, or when the caller's own signal aborts first.
 * A timeout rejects with a TimeoutError, which callers map to CORE_UNAVAILABLE:
 * the answer is unknown, not refused.
 */
export function fetchWithTimeout(ms: number): (input: Request) => Promise<Response> {
  return (input) =>
    fetch(input, { signal: AbortSignal.any([input.signal, AbortSignal.timeout(ms)]) });
}

let client: CoreApi | undefined;

/**
 * The Core API client. Server-only: device and owner tokens must never reach
 * the browser. Created on first use so a missing `CORE_API_URL` fails the
 * request that needs it, not the build.
 */
export function coreApi(): CoreApi {
  if (!client) {
    const baseUrl = process.env.CORE_API_URL;
    if (!baseUrl) {
      throw new Error("CORE_API_URL is not set (see apps/web/.env.example)");
    }
    client = createClient<paths>({ baseUrl, fetch: fetchWithTimeout(CALL_TIMEOUT_MS) });
  }
  return client;
}

/**
 * The stable `code` of an `application/problem+json` error, if it is one.
 * Only a string counts: a thrown DOMException (a timeout) has a numeric `code`.
 */
export function problemCode(error: unknown): ProblemCode | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") return code as ProblemCode;
  }
  return undefined;
}

let mediaClient: CoreApi | undefined;

/**
 * Client for media: uploads (uploadMedia) and the /media files. Same Core API,
 * but CORE_MEDIA_URL may point past Prism, whose proxy re-encodes binary
 * bodies as UTF-8 and corrupts images. Falls back to CORE_API_URL.
 */
export function coreMediaApi(): CoreApi {
  if (!mediaClient) {
    const baseUrl = process.env.CORE_MEDIA_URL ?? process.env.CORE_API_URL;
    if (!baseUrl) throw new Error("CORE_API_URL is not set (see apps/web/.env.example)");
    mediaClient = createClient<paths>({ baseUrl, fetch: fetchWithTimeout(MEDIA_TIMEOUT_MS) });
  }
  return mediaClient;
}
