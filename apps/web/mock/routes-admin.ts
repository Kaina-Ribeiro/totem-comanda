// Back office (owner) routes. Every route but login needs the owner's token.

import { randomBytes } from "node:crypto";

import {
  authOwner,
  ok,
  problem,
  type Reply,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
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
