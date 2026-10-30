import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.fn();
const credentials = { deviceId: "KIOSK-TBT-001", deviceSecret: "s3cr3t" };
const getDeviceCredentials = vi.fn(async () => credentials as typeof credentials | null);

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/core/client", () => ({
  coreApi: () => ({ POST: post }),
  problemCode: (error: { code?: string } | undefined) => error?.code,
}));
vi.mock("./credentials", () => ({ getDeviceCredentials }));

const { asDevice, DeviceAuthError, forgetDeviceTokens } = await import("./session");

function authAnswers(...answers: Array<{ status: number; data?: object; error?: object }>) {
  for (const { status, data, error } of answers) {
    post.mockResolvedValueOnce({ data, error, response: new Response(null, { status }) });
  }
}

const token = (accessToken: string) => ({
  status: 200,
  data: { accessToken, tokenType: "Bearer", expiresIn: 900 },
});

describe("asDevice", () => {
  beforeEach(() => {
    post.mockReset();
    getDeviceCredentials.mockResolvedValue(credentials);
    forgetDeviceTokens();
  });

  it("sends the device token", async () => {
    authAnswers(token("t1"));
    const call = vi.fn(async () => ({ response: new Response(null, { status: 200 }) }));
    await asDevice(call);
    expect(call).toHaveBeenCalledWith({ Authorization: "Bearer t1" });
  });

  it("re-authenticates and repeats the call once after a 401", async () => {
    authAnswers(token("t1"), token("t2"));
    const call = vi
      .fn()
      .mockResolvedValueOnce({ response: new Response(null, { status: 401 }) })
      .mockResolvedValueOnce({ response: new Response(null, { status: 200 }) });
    const result = await asDevice(call);
    expect(result.response.status).toBe(200);
    expect(call).toHaveBeenNthCalledWith(2, { Authorization: "Bearer t2" });
  });

  it("does not loop when the retry is a 401 too", async () => {
    authAnswers(token("t1"), token("t2"));
    const call = vi.fn(async () => ({ response: new Response(null, { status: 401 }) }));
    expect((await asDevice(call)).response.status).toBe(401);
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("fails with NOT_PROVISIONED without credentials", async () => {
    getDeviceCredentials.mockResolvedValue(null);
    await expect(asDevice(vi.fn())).rejects.toMatchObject({ code: "NOT_PROVISIONED" });
  });

  it.each([
    [403, "DEVICE_DISABLED", "DEVICE_DISABLED"],
    [401, "INVALID_CREDENTIALS", "INVALID_CREDENTIALS"],
    [500, undefined, "CORE_UNAVAILABLE"],
  ])("maps an auth %i to %s", async (status, code, expected) => {
    authAnswers({ status, error: code ? { code } : undefined });
    const failure = asDevice(vi.fn());
    await expect(failure).rejects.toBeInstanceOf(DeviceAuthError);
    await expect(failure).rejects.toMatchObject({ code: expected });
  });

  it("maps a network failure to CORE_UNAVAILABLE", async () => {
    post.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(asDevice(vi.fn())).rejects.toMatchObject({ code: "CORE_UNAVAILABLE" });
  });
});
