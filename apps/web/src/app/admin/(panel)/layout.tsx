import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/nav";
import { load } from "@/lib/admin/form";
import { ADMIN_LOGIN, asOwner, signOut } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

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
      <aside className="flex shrink-0 flex-col gap-2.5 border-b border-line bg-surface px-4 pt-3.5 pb-2.5 min-[821px]:sticky min-[821px]:top-0 min-[821px]:h-dvh min-[821px]:w-[236px] min-[821px]:gap-4 min-[821px]:overflow-y-auto min-[821px]:border-r min-[821px]:border-b-0 min-[821px]:px-3 min-[821px]:py-5">
        <div className="flex items-center justify-between gap-3 min-[821px]:flex-col min-[821px]:items-start min-[821px]:gap-px min-[821px]:px-2.5">
          <span className="font-display text-[22px] font-medium tracking-[-0.01em] italic">
            Comanda
          </span>
          <Suspense fallback={<StoreName name="Back office" />}>
            <Store />
          </Suspense>
        </div>
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
  const restaurant = await load(() =>
    asOwner((headers) => coreApi().GET("/v1/admin/restaurant", { headers })),
  );
  return <StoreName name={"data" in restaurant ? restaurant.data.name : "Back office"} />;
}

function StoreName({ name }: { name: string }) {
  return (
    <span className="truncate text-[12.5px] font-semibold text-muted min-[821px]:max-w-full">
      {name}
    </span>
  );
}
