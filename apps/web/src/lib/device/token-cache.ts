import { createHash } from "node:crypto";

import type { DeviceCredentials } from "./seal";

export type IssuedToken = { accessToken: string; expiresIn: number };

/** Renew this long before the token expires, so a request never carries a dying token. */
const RENEW_BEFORE_MS = 60_000;

type Entry = { accessToken: string; expiresAt: number };

/**
 * Device tokens kept in server memory. Keyed by device id AND secret, so a
 * cookie with a valid id and a wrong secret can never pick up another
 * device's token. One exchange at a time per key.
 */
export class DeviceTokenCache {
  private tokens = new Map<string, Entry>();
  private inFlight = new Map<string, Promise<string>>();

  constructor(
    private authenticate: (credentials: DeviceCredentials) => Promise<IssuedToken>,
    private now: () => number = Date.now,
  ) {}

  async get(credentials: DeviceCredentials): Promise<string> {
    const key = cacheKey(credentials);
    const cached = this.tokens.get(key);
    if (cached && cached.expiresAt - RENEW_BEFORE_MS > this.now()) {
      return cached.accessToken;
    }

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const exchange = this.authenticate(credentials)
      .then(({ accessToken, expiresIn }) => {
        this.tokens.set(key, { accessToken, expiresAt: this.now() + expiresIn * 1000 });
        return accessToken;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, exchange);
    return exchange;
  }

  invalidate(credentials: DeviceCredentials): void {
    this.tokens.delete(cacheKey(credentials));
  }

  clear(): void {
    this.tokens.clear();
  }
}

function cacheKey({ deviceId, deviceSecret }: DeviceCredentials): string {
  return createHash("sha256").update(deviceId).update("\0").update(deviceSecret).digest("hex");
}
