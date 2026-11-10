import "server-only";

import createClient, { type Client } from "openapi-fetch";

import type { components, paths } from "@/lib/core-api-v2";

import { CALL_TIMEOUT_MS, fetchWithTimeout, MEDIA_TIMEOUT_MS } from "./client";

/**
 * Core API client for contract v2 (pilot, docs/pilot-v2/SPEC.md). Lives next to
 * the v1 client until phase 5 (COM-149) removes v1; then this becomes client.ts.
 * Shared by the kiosk (COM-146), back office (COM-147) and kitchen (COM-148).
 */
export type CoreApiV2 = Client<paths>;
export type ProblemV2 = components["schemas"]["Problem"];
export type ProblemCodeV2 = components["schemas"]["ProblemCode"];

/**
 * Where the v2 contract is served. With the mock (npm run mock) that is the
 * second Prism on 4011; with the Go API it is the same server as v1.
 */
export function coreApiV2Url(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const baseUrl = env.CORE_API_V2_URL;
  if (!baseUrl)
    throw new Error("CORE_API_V2_URL is not set (see apps/web/.env.example)");
  return baseUrl;
}

let client: CoreApiV2 | undefined;

/**
 * The v2 Core API client. Server-only, created on first use so a missing
 * `CORE_API_V2_URL` fails the request that needs it, not the build. Same
 * timeout budget as v1 (BFF BR-XC-04).
 */
export function coreApiV2(): CoreApiV2 {
  client ??= createClient<paths>({
    baseUrl: coreApiV2Url(),
    fetch: fetchWithTimeout(CALL_TIMEOUT_MS),
  });
  return client;
}

let mediaClient: CoreApiV2 | undefined;

/**
 * v2 client for image uploads: CORE_MEDIA_URL may point past Prism, whose
 * proxy corrupts binary bodies (see coreMediaApi). Falls back to CORE_API_V2_URL.
 */
export function coreMediaApiV2(): CoreApiV2 {
  mediaClient ??= createClient<paths>({
    baseUrl: process.env.CORE_MEDIA_URL ?? coreApiV2Url(),
    fetch: fetchWithTimeout(MEDIA_TIMEOUT_MS),
  });
  return mediaClient;
}
