import { UnavailableScreen } from "@/components/kiosk/unavailable-screen";

import { OFFLINE_COPY, type OfflineArea } from "./offline-copy";

/**
 * "Temporarily offline": the server cannot be reached. No offline order queue
 * in the MVP. The kiosk and the kitchen tablet use the kiosk's full-screen
 * scale; any other page (back office, setup) may be a phone, so it gets a
 * scale that fits from 375 px up (COM-91).
 */
export function OfflineScreen({ area }: { area: OfflineArea }) {
  if (area !== "page") return <UnavailableScreen {...OFFLINE_COPY[area]} />;
  const { title, body } = OFFLINE_COPY.page;
  return (
    <main className="flex flex-1 flex-col justify-end gap-4 bg-[#2a1c16] px-6 pb-16 text-on-accent sm:px-12 sm:pb-24">
      <h1 className="font-display text-5xl leading-[0.95] font-semibold tracking-[-0.03em] text-balance sm:text-7xl">
        {title}
      </h1>
      <p className="max-w-[36rem] text-lg leading-[1.45] text-[#e6dacb] sm:text-xl">{body}</p>
    </main>
  );
}
