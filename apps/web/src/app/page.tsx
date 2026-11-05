import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import {
  type MockDevice,
  mockDeviceCredentials,
  needsPairing,
  readMockState,
} from "@/lib/core/mock-scenarios";
import { getDeviceCredentials, saveDeviceCredentials } from "@/lib/device/credentials";

// Placeholder index while the three areas are empty. Each device opens its own
// area directly, so this page is only a convenience for development.
const areas = [
  { href: "/kiosk", label: "Totem", kind: "KIOSK" },
  { href: "/kitchen", label: "Cozinha", kind: "KITCHEN" },
  { href: "/admin", label: "Back office", kind: null },
] as const;

const LINK = "text-detail-text";

/**
 * Development only: opens the kiosk or the kitchen in this browser, pairing it
 * first as the mock's device of that kind when it is the other one. A device
 * opens only its own area, so without this "Cozinha" on a kiosk browser lands
 * back on the kiosk (COM-139).
 */
async function openArea(form: FormData) {
  "use server";
  if (process.env.NODE_ENV !== "development") return;
  const kind = form.get("kind") === "KITCHEN" ? "KITCHEN" : "KIOSK";
  const [current, mock] = await Promise.all([getDeviceCredentials(), readMockState()]);
  if (needsPairing(current?.deviceId, mock?.devices ?? [], kind)) {
    const credentials = await mockDeviceCredentials(kind);
    if (credentials) await saveDeviceCredentials(credentials);
  }
  redirect(kind === "KITCHEN" ? "/kitchen" : "/kiosk");
}

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-8 p-12">
      <h1 className="font-display text-6xl font-semibold">Comanda</h1>
      <Suspense fallback={<AreaLinks />}>
        <Areas />
      </Suspense>
    </main>
  );
}

function AreaLinks() {
  return (
    <ul className="flex flex-col gap-4 text-2xl font-semibold">
      {areas.map((area) => (
        <li key={area.href}>
          <Link href={area.href} className={LINK}>
            {area.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Plain links, or in development with the mock the switch that pairs this browser. */
async function Areas() {
  // Per request: which device this browser is and whether a mock is running.
  await connection();
  const mock = await readMockState();
  if (!mock) return <AreaLinks />;
  const current = await getDeviceCredentials();
  const device = mock.devices.find((d) => d.id === current?.deviceId);
  return (
    <>
      <ul className="flex flex-col gap-4 text-2xl font-semibold">
        {areas.map((area) => (
          <li key={area.href}>
            {area.kind ? (
              <form action={openArea}>
                <input type="hidden" name="kind" value={area.kind} />
                <button type="submit" className={`${LINK} cursor-pointer`}>
                  {area.label}
                </button>
              </form>
            ) : (
              <Link href={area.href} className={LINK}>
                {area.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="max-w-[640px] text-lg text-muted">
        Este navegador é {deviceLabel(device, current?.deviceId)}. Em desenvolvimento, Totem e
        Cozinha trocam o aparelho deste navegador pelo do mock.
      </p>
    </>
  );
}

function deviceLabel(device: MockDevice | undefined, deviceId: string | undefined): string {
  if (device) return `“${device.name}” (${device.kind === "KITCHEN" ? "cozinha" : "totem"})`;
  return deviceId ? `o aparelho ${deviceId}, que o mock não conhece` : "nenhum aparelho ainda";
}
