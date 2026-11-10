import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";

import { AdminNav } from "@/components/admin/nav";
import { NavProgress } from "@/components/admin/nav-progress";
import { load } from "@/lib/admin/form";
import { ADMIN_LOGIN, asOwner, signOut } from "@/lib/admin/session";
import { kioskState } from "@/lib/admin/home";
import { loadStoreStatus } from "@/lib/admin/store-status";
import { coreApiV2 } from "@/lib/core/client-v2";

import "./admin.css";

async function logout() {
  "use server";
  await signOut();
  redirect(ADMIN_LOGIN);
}

/**
 * The back office shell (second canvas, A1 and A10): the icon sidebar on wide
 * screens, a top bar with a row of sections up to 820 px.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-ground text-ink tabular-nums min-[821px]:flex-row">
      <NavProgress />
      <aside className="flex shrink-0 flex-col gap-2.5 border-b border-line bg-surface px-4 pt-3.5 pb-2.5 min-[821px]:sticky min-[821px]:top-0 min-[821px]:h-dvh min-[821px]:w-[236px] min-[821px]:gap-4 min-[821px]:overflow-y-auto min-[821px]:border-r min-[821px]:border-b-0 min-[821px]:px-3 min-[821px]:py-5">
        <div className="flex items-center justify-between gap-3 min-[821px]:flex-col min-[821px]:items-start min-[821px]:gap-px min-[821px]:px-2.5">
          <span className="font-display text-[22px] font-medium tracking-[-0.01em] italic">
            Comanda
          </span>
          <Suspense fallback={<StoreName name="Back office" />}>
            <Store />
          </Suspense>
          <Suspense>
            <StatusPill className="inline-flex min-[821px]:hidden" />
          </Suspense>
        </div>
        <Suspense>
          <StatusPill className="mx-1.5 hidden min-[821px]:inline-flex" />
        </Suspense>
        {/* The active link reads the URL: render it per request. */}
        <Suspense>
          <AdminNav />
        </Suspense>
        <form action={logout} className="hidden min-[821px]:mt-auto min-[821px]:block">
          <button className="px-2.5 text-[13.5px] font-bold text-muted transition-colors hover:text-ink">
            Sair
          </button>
        </form>
      </aside>
      <main className="flex w-full max-w-[1160px] min-w-0 flex-1 flex-col gap-[18px] px-4 pt-5 pb-10 min-[821px]:px-9 min-[821px]:pt-7 min-[821px]:pb-12">
        {children}
        {/* Up to 820 px the sidebar is a top bar without room for this. */}
        <form action={logout} className="mt-4 min-[821px]:hidden">
          <button className="text-[13.5px] font-bold text-muted">Sair do back office</button>
        </form>
      </main>
    </div>
  );
}

/** The store's name under the wordmark, as in A1. */
async function Store() {
  const store = await load(() =>
    asOwner((headers) => coreApiV2().GET("/v2/admin/store", { headers })),
  );
  return <StoreName name={"data" in store ? store.data.locationName : "Back office"} />;
}

function StoreName({ name }: { name: string }) {
  return (
    <span className="hidden truncate text-[12.5px] font-semibold text-muted min-[821px]:block min-[821px]:max-w-full">
      {name}
    </span>
  );
}

// One status per request for both pills.
const storeStatus = cache(async () => {
  await connection();
  return load(() => loadStoreStatus(new Date()));
});

/** "Totem aberto" under the brand (A1) or beside it on phones (A10); nothing when Go cannot answer. */
/** Sidebar pill per kiosk state (A1). */
const PILL_LABEL = {
  maintenance: "Em manutenção",
  closed: "Totem fechado",
  paused: "Totem pausado",
  busy: "Aberto, movimentado",
  open: "Totem aberto",
} as const;

async function StatusPill({ className }: { className: string }) {
  const loaded = await storeStatus();
  if ("error" in loaded) return null;
  const state = kioskState(loaded.data);
  const selling = state === "open" || state === "busy";
  return (
    <span
      className={`h-7 items-center gap-1.5 self-start rounded-full px-2.5 text-xs font-bold whitespace-nowrap ${className} ${
        selling ? "bg-sage text-leaf" : "bg-butter text-detail-text"
      }`}
    >
      <span className={`size-2 rounded-full ${selling ? "bg-leaf" : "bg-detail"}`} />
      {PILL_LABEL[state]}
    </span>
  );
}
