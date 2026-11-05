import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Request } from "./http.ts";
import { currentPace, paceRoutes } from "./pace.ts";
import { applyScenario, state } from "./state.ts";
import { addKitchenListener } from "./stream.ts";

/** Calls the kitchen's PUT /v1/kitchen/pace as a signed-in kitchen tablet. */
function putKitchenPace(body: object) {
  const [, , handler] = paceRoutes.find(([m, p]) => m === "PUT" && p.test("/v1/kitchen/pace"))!;
  const req = {
    method: "PUT",
    path: "/v1/kitchen/pace",
    headers: { authorization: "Bearer test-kitchen" },
    body,
  } as unknown as Request;
  return handler(req, [] as unknown as RegExpExecArray);
}

/** Events the kitchen stream received, parsed. */
let frames: string[];
let remove: () => void;
const events = () =>
  frames.map((f) => {
    const [, event, data] = /^event: (.+)\ndata: (.+)\n\n$/.exec(f)!;
    return { event, data: JSON.parse(data) as { pace: string; changedBy: string } };
  });

describe("store pace events (COM-121)", () => {
  beforeEach(() => {
    applyScenario("normal");
    state.tokens.set("test-kitchen", { deviceId: "KITCHEN-TBT-001", expiresAt: Date.now() + 60_000 });
    frames = [];
    remove = addKitchenListener({ write: (chunk: string) => frames.push(chunk) });
  });
  afterEach(() => {
    remove();
    putKitchenPace({ pace: "NORMAL" }); // the pace is module state: leave it as found
  });

  it("announces a pace set from the kitchen to every kitchen stream", () => {
    putKitchenPace({ pace: "BUSY" });
    expect(events()).toEqual([
      { event: "store.pace_changed", data: expect.objectContaining({ pace: "BUSY", changedBy: "KITCHEN" }) },
    ]);
  });

  it("announces the automatic resume when a pause is over", () => {
    putKitchenPace({ pace: "PAUSED", pauseMinutes: 15 });
    frames = [];

    state.clockOffsetMs += 16 * 60_000;
    expect(currentPace().pace).toBe("NORMAL");
    expect(events()).toEqual([
      { event: "store.pace_changed", data: expect.objectContaining({ pace: "NORMAL", changedBy: "SYSTEM" }) },
    ]);
  });

  it("does not announce when nothing changed", () => {
    currentPace();
    expect(frames).toEqual([]);
  });
});
