import { describe, expect, it, vi } from "vitest";

import { DeviceTokenCache, type IssuedToken } from "./token-cache";

const credentials = { deviceId: "KIOSK-TBT-001", deviceSecret: "s3cr3t" };

function setup(expiresIn = 900) {
  let now = 0;
  let issued = 0;
  const authenticate = vi.fn(async (): Promise<IssuedToken> => {
    issued += 1;
    return { accessToken: `token-${issued}`, expiresIn };
  });
  const cache = new DeviceTokenCache(authenticate, () => now);
  return { cache, authenticate, advance: (ms: number) => (now += ms) };
}

describe("DeviceTokenCache", () => {
  it("reuses a token while it is valid", async () => {
    const { cache, authenticate } = setup();
    expect(await cache.get(credentials)).toBe("token-1");
    expect(await cache.get(credentials)).toBe("token-1");
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it("renews 60 s before the token expires", async () => {
    const { cache, advance } = setup(900);
    await cache.get(credentials);
    advance(839_000);
    expect(await cache.get(credentials)).toBe("token-1");
    advance(1_000);
    expect(await cache.get(credentials)).toBe("token-2");
  });

  it("shares one exchange between concurrent requests", async () => {
    const { cache, authenticate } = setup();
    const tokens = await Promise.all([cache.get(credentials), cache.get(credentials)]);
    expect(tokens).toEqual(["token-1", "token-1"]);
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it("keeps tokens apart per secret, so a wrong secret never reuses a token", async () => {
    const { cache, authenticate } = setup();
    await cache.get(credentials);
    expect(await cache.get({ ...credentials, deviceSecret: "other" })).toBe("token-2");
    expect(authenticate).toHaveBeenCalledTimes(2);
  });

  it("gets a fresh token after invalidate", async () => {
    const { cache } = setup();
    await cache.get(credentials);
    cache.invalidate(credentials);
    expect(await cache.get(credentials)).toBe("token-2");
  });

  it("does not cache a failed exchange", async () => {
    const { cache, authenticate } = setup();
    authenticate.mockRejectedValueOnce(new Error("down"));
    await expect(cache.get(credentials)).rejects.toThrow("down");
    expect(await cache.get(credentials)).toBe("token-1");
  });
});
