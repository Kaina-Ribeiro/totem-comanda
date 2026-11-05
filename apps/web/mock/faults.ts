// Answers for /__mock/fault. Prism checks every response against the contract, so an
// injected 4xx must be a contract Problem with a `code`, or Prism turns it into a 500
// (COM-105). The contract defines no code for a 5xx, so those carry none.

import { problem, type Reply, type Schemas } from "./http.ts";

type ProblemCode = Schemas["ProblemCode"];

/** The code a 4xx fault gets when the caller names none. */
const DEFAULT_CODES: Partial<Record<number, ProblemCode>> = {
  401: "UNAUTHORIZED",
  404: "NOT_FOUND",
  422: "VALIDATION_FAILED",
};

/**
 * The problem code an injected fault answers with. A 4xx needs one: the given
 * `code`, else the default for its status. Prism still rejects a code outside
 * the contract's ProblemCode list, or a status the operation does not declare.
 */
export function faultCode(
  status: number | undefined,
  code?: string,
): { code?: ProblemCode } | { error: string } {
  if (status === undefined || status < 400 || status >= 500) return {};
  const chosen = (code as ProblemCode | undefined) ?? DEFAULT_CODES[status];
  return chosen ? { code: chosen } : { error: `code is required for status ${status}` };
}

/** The response of a fault with a status. */
export function faultReply(status: number, code?: ProblemCode): Reply {
  if (code) return problem(status, code, "Injected fault");
  return {
    status,
    body: { type: "about:blank", title: "Injected fault", status },
    headers: { "Content-Type": "application/problem+json" },
  };
}
