import "server-only";

import createClient, { type Client } from "openapi-fetch";

import type { components, paths } from "@/lib/core-api";
import { mockPreferFor } from "@/lib/core/mock-scenarios";

export type CoreApi = Client<paths>;
export type Problem = components["schemas"]["Problem"];
export type ProblemCode = components["schemas"]["ProblemCode"];

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
    client = createClient<paths>({ baseUrl });
    if (process.env.NODE_ENV === "development") {
      client.use({
        async onRequest({ request, schemaPath }) {
          const prefer = await mockPreferFor(schemaPath);
          if (prefer) request.headers.set("Prefer", prefer);
          return request;
        },
      });
    }
  }
  return client;
}

/** The stable `code` of an `application/problem+json` error, if it is one. */
export function problemCode(error: unknown): ProblemCode | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as Problem).code;
  }
  return undefined;
}
