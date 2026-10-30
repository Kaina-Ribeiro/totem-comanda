import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  getMockScenario,
  isMockScenario,
  MOCK_SCENARIO_COOKIE,
  MOCK_SCENARIOS,
} from "@/lib/core/mock-scenarios";
import { forgetDeviceTokens } from "@/lib/device/session";

// Development only: pick how the Prism mock answers (see mock-scenarios.ts).
async function chooseScenario(form: FormData) {
  "use server";
  if (process.env.NODE_ENV !== "development") return;
  const scenario = form.get("scenario");
  if (isMockScenario(scenario)) {
    (await cookies()).set(MOCK_SCENARIO_COOKIE, scenario, { httpOnly: true, path: "/" });
    // Cached tokens would hide auth scenarios until they expire.
    forgetDeviceTokens();
  }
}

export default function MockScenarioPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-8 p-12">
      <h1 className="font-display text-6xl font-semibold">Cenário do mock</h1>
      <Suspense>
        <ScenarioList />
      </Suspense>
    </main>
  );
}

async function ScenarioList() {
  const active = await getMockScenario();
  return (
    <form action={chooseScenario} className="flex flex-col gap-4">
      {Object.entries(MOCK_SCENARIOS).map(([id, { label }]) => (
        <button
          key={id}
          name="scenario"
          value={id}
          className={`h-[96px] rounded-card-sm px-8 text-left text-[28px] font-semibold ${
            id === active ? "bg-accent text-on-accent" : "bg-surface text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </form>
  );
}
