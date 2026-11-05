import { describe, expect, it } from "vitest";

import { faultCode, faultReply } from "./faults";

describe("faultCode", () => {
  it("defaults the problem code from the status where one fits", () => {
    expect(faultCode(401)).toEqual({ code: "UNAUTHORIZED" });
    expect(faultCode(404)).toEqual({ code: "NOT_FOUND" });
    expect(faultCode(422)).toEqual({ code: "VALIDATION_FAILED" });
  });

  it("takes the code it is given", () => {
    expect(faultCode(409, "STALE_ORDER_VERSION")).toEqual({ code: "STALE_ORDER_VERSION" });
    expect(faultCode(401, "INVALID_CREDENTIALS")).toEqual({ code: "INVALID_CREDENTIALS" });
  });

  it("asks for a code on a 4xx it cannot guess", () => {
    expect(faultCode(409)).toEqual({ error: "code is required for status 409" });
  });

  it("needs no code for a 5xx or a delay-only fault", () => {
    expect(faultCode(503)).toEqual({});
    expect(faultCode(undefined)).toEqual({});
  });
});

describe("faultReply", () => {
  it("answers a 4xx with a contract Problem, so Prism lets it through (COM-105)", () => {
    expect(faultReply(401, "UNAUTHORIZED")).toEqual({
      status: 401,
      body: {
        type: "/problems/unauthorized",
        title: "Injected fault",
        status: 401,
        code: "UNAUTHORIZED",
      },
      headers: { "Content-Type": "application/problem+json" },
    });
  });

  it("answers a 5xx without a code, as the contract defines none", () => {
    expect(faultReply(503)).toEqual({
      status: 503,
      body: { type: "about:blank", title: "Injected fault", status: 503 },
      headers: { "Content-Type": "application/problem+json" },
    });
  });
});
