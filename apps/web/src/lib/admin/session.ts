import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { coreApi, problemCode, type ProblemCode } from "@/lib/core/client";
import { sealValue, unsealValue } from "@/lib/device/seal";

// Kept in sync with src/proxy.ts (the proxy stays free of server-only modules).
export const OWNER_COOKIE = "comanda_owner";
export const ADMIN_LOGIN = "/admin/login";

type OwnerSession = { token: string; expiresAt: number };

/**
 * The owner's Core API token lives sealed in an HttpOnly cookie; the browser
 * never sees it (contract: ownerLogin). Same key as the device cookie.
 */
function cookieKey(): string {
  const key = process.env.DEVICE_COOKIE_SECRET;
  if (!key) throw new Error("DEVICE_COOKIE_SECRET is not set (see apps/web/.env.example)");
  return key;
}

async function readSession(): Promise<OwnerSession | null> {
  const sealed = (await cookies()).get(OWNER_COOKIE)?.value;
  if (!sealed) return null;
  const value = unsealValue(sealed, cookieKey());
  if (
    typeof value !== "object" ||
    value === null ||
    !("token" in value) ||
    !("expiresAt" in value) ||
    typeof value.token !== "string" ||
    typeof value.expiresAt !== "number" ||
    value.expiresAt < Date.now()
  ) {
    return null;
  }
  return { token: value.token, expiresAt: value.expiresAt };
}

export type LoginResult =
  { ok: true } | { ok: false; code: "INVALID_CREDENTIALS" | "CORE_UNAVAILABLE" };

/** Signs the owner in and stores the token. Server Actions only. */
export async function signIn(email: string, password: string): Promise<LoginResult> {
  let result;
  try {
    result = await coreApi().POST("/v1/admin/auth/login", { body: { email, password } });
  } catch {
    return { ok: false, code: "CORE_UNAVAILABLE" };
  }
  if (!result.data) {
    const code = problemCode(result.error);
    return {
      ok: false,
      code:
        code === "INVALID_CREDENTIALS" || result.response.status === 401
          ? "INVALID_CREDENTIALS"
          : "CORE_UNAVAILABLE",
    };
  }
  const { accessToken, expiresIn } = result.data;
  (await cookies()).set(
    OWNER_COOKIE,
    sealValue({ token: accessToken, expiresAt: Date.now() + expiresIn * 1000 }, cookieKey()),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: expiresIn,
    },
  );
  return { ok: true };
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(OWNER_COOKIE);
}

export type OwnerHeaders = { Authorization: string };

/** Thrown for an answer the back office cannot use, with the Core API's `code`. */
export class AdminApiError extends Error {
  constructor(
    readonly code: ProblemCode | "CORE_UNAVAILABLE",
    readonly detail?: string,
  ) {
    super(`Core API: ${code}`);
    this.name = "AdminApiError";
  }
}

/**
 * Runs a Core API call as the owner and returns its data. No session, or a
 * 401 (expired token), sends the owner back to the login page; any other
 * failure throws AdminApiError with the problem's `code`.
 */
export async function asOwner<T>(
  call: (headers: OwnerHeaders) => Promise<{ response: Response; data?: T; error?: unknown }>,
): Promise<T> {
  const session = await readSession();
  if (!session) redirect(ADMIN_LOGIN);
  let result;
  try {
    result = await call({ Authorization: `Bearer ${session.token}` });
  } catch {
    throw new AdminApiError("CORE_UNAVAILABLE");
  }
  if (result.response.status === 401) redirect(`${ADMIN_LOGIN}?expired=1`);
  if (!result.response.ok) {
    const code = problemCode(result.error);
    throw new AdminApiError(
      code ?? "CORE_UNAVAILABLE",
      (result.error as { detail?: string } | undefined)?.detail,
    );
  }
  // 204 answers carry no data.
  return result.data as T;
}
