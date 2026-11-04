import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, listNumbers, readSettings, writeSettings } from "./sound";

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe("kitchen sound settings", () => {
  it("defaults to the bell, repeating, not yet asked", () => {
    expect(readSettings(memory())).toEqual({ enabled: null, sound: "sino", repeat: true });
  });

  it("keeps the tablet's choice", () => {
    const storage = memory();
    writeSettings(storage, { enabled: true, sound: "apito", repeat: false });
    expect(readSettings(storage)).toEqual({ enabled: true, sound: "apito", repeat: false });
  });

  it("falls back to the defaults on corrupt or blocked storage", () => {
    expect(readSettings({ getItem: () => "{nope" })).toEqual(DEFAULT_SETTINGS);
    expect(
      readSettings({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(readSettings({ getItem: () => '{"sound":"sirene"}' }).sound).toBe("sino");
  });
});

describe("listNumbers", () => {
  it("joins order numbers the Brazilian way", () => {
    expect(listNumbers(["44"])).toBe("44");
    expect(listNumbers(["44", "45"])).toBe("44 e 45");
    expect(listNumbers(["43", "44", "45"])).toBe("43, 44 e 45");
  });
});
