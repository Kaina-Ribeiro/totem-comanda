// The store's pace (contract 0.2.0, plan G-K5 and decisions 3 and 4): one
// level for the whole store, set from the kitchen or the back office.
// PAUSED puts every kiosk at capacity until `pausedUntil`, when the mock (like
// Go) goes back to NORMAL by itself; `waitTime` is the minutes for the level.

import {
  authDevice,
  authOwner,
  ok,
  problem,
  type Reply,
  type Request,
  type Route,
  type Schemas,
} from "./http.ts";
import { now } from "./state.ts";
import { broadcastKitchenEvent } from "./v2/orders.ts";

const pace: Schemas["StorePace"] = {
  pace: "NORMAL",
  pausedUntil: null,
  changedAt: new Date(0).toISOString(),
  changedBy: "SYSTEM",
  waitMinutes: { NORMAL: 8, BUSY: 15 },
};

const snapshot = (): Schemas["StorePace"] => ({ ...pace, waitMinutes: { ...pace.waitMinutes } });

/** Tells every kitchen stream the pace changed (contract: `store.pace_changed`). */
const announce = () => broadcastKitchenEvent("store.pace_changed", snapshot());

/** The pace now, after the automatic resume if the pause is over (announced, like Go). */
export function currentPace(): Schemas["StorePace"] {
  if (pace.pace === "PAUSED" && pace.pausedUntil && Date.parse(pace.pausedUntil) <= now().getTime()) {
    Object.assign(pace, {
      pace: "NORMAL",
      pausedUntil: null,
      changedAt: pace.pausedUntil,
      changedBy: "SYSTEM",
    });
    announce();
  }
  return snapshot();
}

let resumeTimer: ReturnType<typeof setTimeout> | undefined;

/** Resumes by itself when a pause ends, so the kitchen hears it without asking. */
function scheduleResume() {
  clearTimeout(resumeTimer);
  if (pace.pace !== "PAUSED" || !pace.pausedUntil) return;
  const ms = Math.max(0, Date.parse(pace.pausedUntil) - now().getTime());
  resumeTimer = setTimeout(currentPace, ms);
  resumeTimer.unref?.();
}

/**
 * Minutes the guest is told on the success screen (decision 4). A guest who
 * was already paying when the store paused gets the BUSY minutes.
 */
export function waitTimeNow(): number {
  const p = currentPace();
  return p.waitMinutes[p.pace === "PAUSED" ? "BUSY" : p.pace];
}

function setPace(req: Request, by: "KITCHEN" | "OWNER"): Reply {
  const body = req.body as Partial<Schemas["StorePaceUpdate"]> | null;
  const level = body?.pace;
  if (level !== "NORMAL" && level !== "BUSY" && level !== "PAUSED") {
    return problem(422, "VALIDATION_FAILED", "Validation failed", "pace");
  }
  if (level === "PAUSED" && body?.pauseMinutes !== 15 && body?.pauseMinutes !== 30) {
    return problem(422, "VALIDATION_FAILED", "pauseMinutes must be 15 or 30", "pauseMinutes");
  }
  const at = now();
  Object.assign(pace, {
    pace: level,
    pausedUntil:
      level === "PAUSED" ? new Date(at.getTime() + body!.pauseMinutes! * 60_000).toISOString() : null,
    changedAt: at.toISOString(),
    changedBy: by,
  });
  announce();
  scheduleResume();
  return ok(currentPace());
}

const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 120;

export const kitchenPaceRoutes: Route[] = [
  ["GET", /^\/v2\/kitchen\/pace$/, (req) => authDevice(req).error ?? ok(currentPace())],
  ["PUT", /^\/v2\/kitchen\/pace$/, (req) => authDevice(req).error ?? setPace(req, "KITCHEN")],
];

export const adminPaceRoutes: Route[] = [
  ["GET", /^\/v2\/admin\/pace$/, (req) => authOwner(req) ?? ok(currentPace())],
  ["PUT", /^\/v2\/admin\/pace$/, (req) => authOwner(req) ?? setPace(req, "OWNER")],
  [
    "PUT",
    /^\/v2\/admin\/pace\/wait-minutes$/,
    (req) => {
      const denied = authOwner(req);
      if (denied) return denied;
      const body = req.body as Partial<Schemas["PaceWaitMinutes"]> | null;
      if (!whole(body?.NORMAL) || !whole(body?.BUSY)) {
        return problem(422, "VALIDATION_FAILED", "Minutes from 1 to 120", "NORMAL");
      }
      pace.waitMinutes = { NORMAL: body!.NORMAL!, BUSY: body!.BUSY! };
      return ok(currentPace());
    },
  ],
];
