"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Back-office sections. Order follows how the owner sets the shop up. */
export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Início" },
  { href: "/admin/esgotados", label: "Esgotados" },
  { href: "/admin/relatorio", label: "Relatório" },
  { href: "/admin/cardapios", label: "Cardápios" },
  { href: "/admin/categorias", label: "Categorias" },
  { href: "/admin/itens", label: "Itens" },
  { href: "/admin/selos", label: "Selos e sugestões" },
  { href: "/admin/cupons", label: "Cupons" },
  { href: "/admin/aparelhos", label: "Aparelhos" },
  { href: "/admin/loja", label: "Loja" },
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ADMIN_SECTIONS.map(({ href, label }) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold ${
              active ? "bg-wheat text-ink" : "text-muted hover:bg-ground"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
