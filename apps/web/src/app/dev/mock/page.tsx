import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  CORE_DOWN_COOKIE,
  isCoreDownSimulated,
  readMockState,
  setMockScenario,
} from "@/lib/core/mock-scenarios";
import { forgetDeviceTokens } from "@/lib/device/session";

// Development only: switch the stateful mock's scenario (apps/web/mock) and
// simulate the Core API being down.
async function chooseScenario(form: FormData) {
  "use server";
  if (process.env.NODE_ENV !== "development") return;
  const scenario = form.get("scenario");
  if (typeof scenario === "string") await setMockScenario(scenario);
  // The mock starts fresh on each scenario, so tokens it issued are gone.
  forgetDeviceTokens();
}

async function toggleCoreDown() {
  "use server";
  if (process.env.NODE_ENV !== "development") return;
  const jar = await cookies();
  if (jar.get(CORE_DOWN_COOKIE)?.value === "1") jar.delete(CORE_DOWN_COOKIE);
  else jar.set(CORE_DOWN_COOKIE, "1", { httpOnly: true, path: "/" });
}

const buttonClass = (active: boolean) =>
  `h-[96px] rounded-card-sm px-8 text-left text-[28px] font-semibold ${
    active ? "bg-accent text-on-accent" : "bg-surface text-ink"
  }`;

export default function MockScenarioPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-8 p-12">
      <h1 className="font-display text-6xl font-semibold">Cenário do mock</h1>
      <Suspense>
        <Controls />
      </Suspense>
    </main>
  );
}

async function Controls() {
  const [mock, coreDown] = await Promise.all([readMockState(), isCoreDownSimulated()]);
  return (
    <>
      {mock ? (
        <form action={chooseScenario} className="flex flex-col gap-4">
          {Object.entries(mock.scenarios).map(([id, label]) => (
            <button key={id} name="scenario" value={id} className={buttonClass(id === mock.scenario)}>
              {label}
            </button>
          ))}
        </form>
      ) : (
        <p className="text-[26px] text-danger">
          Mock fora do ar ou MOCK_CONTROL_URL vazio. Rode `npm run mock` em apps/web.
        </p>
      )}
      <form action={toggleCoreDown}>
        <button className={buttonClass(coreDown)}>
          {coreDown ? "Core API fora do ar (ligado)" : "Simular Core API fora do ar"}
        </button>
      </form>
    </>
  );
}
