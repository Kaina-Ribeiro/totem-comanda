import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type DeviceCredentials = { deviceId: string; deviceSecret: string };

const IV_BYTES = 12;
const TAG_BYTES = 16;

function keyBytes(key: string): Buffer {
  const bytes = Buffer.from(key, "base64");
  if (bytes.length !== 32) {
    throw new Error("The device cookie key must be 32 bytes, base64-encoded");
  }
  return bytes;
}

/** Encrypts and authenticates any JSON value (AES-256-GCM) into a base64url string. */
export function sealValue(value: unknown, key: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(key), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The value in a sealed string, or null if it was tampered with or sealed with another key. */
export function unsealValue(sealed: string, key: string): unknown {
  const raw = Buffer.from(sealed, "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyBytes(key), raw.subarray(0, IV_BYTES));
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const json = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

/** Encrypts and authenticates the credentials into a base64url string. */
export function sealCredentials(credentials: DeviceCredentials, key: string): string {
  return sealValue(credentials, key);
}

/** The credentials in a sealed value, or null if it was tampered with or sealed with another key. */
export function unsealCredentials(sealed: string, key: string): DeviceCredentials | null {
  const value = unsealValue(sealed, key);
  if (
    typeof value === "object" &&
    value !== null &&
    "deviceId" in value &&
    "deviceSecret" in value &&
    typeof value.deviceId === "string" &&
    typeof value.deviceSecret === "string"
  ) {
    return { deviceId: value.deviceId, deviceSecret: value.deviceSecret };
  }
  return null;
}
