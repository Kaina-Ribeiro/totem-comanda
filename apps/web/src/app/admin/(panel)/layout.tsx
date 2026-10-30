import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/nav";
import { ADMIN_LOGIN, signOut } from "@/lib/admin/session";

async function logout() {
  "use server";
  await signOut();
  redirect(ADMIN_LOGIN);
}

/** The back office shell: navigation and sign-out around every signed-in page. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-ground text-ink lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b border-line bg-surface p-4 lg:w-60 lg:border-r lg:border-b-0 lg:p-6">
        <div className="flex items-center justify-between lg:flex-col lg:items-start lg:gap-1">
          <span className="font-display text-xl italic">Comanda</span>
          <span className="text-xs font-semibold text-muted">Back office</span>
        </div>
        {/* The active link reads the URL: render it per request. */}
        <Suspense>
          <AdminNav />
        </Suspense>
        <form action={logout} className="lg:mt-auto">
          <button className="text-sm font-bold text-muted hover:text-ink">Sair</button>
        </form>
      </aside>
      <main className="flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-8">{children}</main>
    </div>
  );
}
