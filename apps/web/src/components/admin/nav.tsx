"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Icon paths from the second canvas (A1), 24 × 24, stroked. */
const ICON = {
  inicio: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  disponibilidade: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM5.6 5.6l12.8 12.8",
  relatorio: "M4 20h16M7 16v-5M12 16V7M17 16v-8",
  cardapios: "M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM9 8h6M9 12h4",
  categorias: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  itens: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  grupos: "M5 6h14M5 12h14M5 18h9M3 6h.01M3 12h.01M3 18h.01",
  selos: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  cupons: "M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10",
  aparelhos: "M4 5h16v11H4zM9 20h6M12 16v4",
  loja: "M4 9l1.5-5h13L20 9M4 9h16v11H4zM10 20v-6h4v6",
} as const;

type Section = { href: string; label: string; icon: keyof typeof ICON };

/**
 * Back-office sections in the prototype's groups (A1). Pedidos, Horários and
 * Tela do totem join when their contract changes are approved.
 */
export const ADMIN_GROUPS: { title: string; sections: Section[] }[] = [
  { title: "", sections: [{ href: "/admin", label: "Início", icon: "inicio" }] },
  {
    title: "Operação",
    sections: [
      { href: "/admin/disponibilidade", label: "Disponibilidade", icon: "disponibilidade" },
      { href: "/admin/relatorio", label: "Relatório", icon: "relatorio" },
    ],
  },
  {
    title: "Cardápio",
    sections: [
      { href: "/admin/cardapios", label: "Cardápios", icon: "cardapios" },
      { href: "/admin/categorias", label: "Categorias", icon: "categorias" },
      { href: "/admin/itens", label: "Itens", icon: "itens" },
      { href: "/admin/grupos", label: "Grupos de opções", icon: "grupos" },
      { href: "/admin/selos", label: "Selos e sugestões", icon: "selos" },
      { href: "/admin/cupons", label: "Cupons", icon: "cupons" },
    ],
  },
  {
    title: "Loja",
    sections: [
      { href: "/admin/aparelhos", label: "Aparelhos", icon: "aparelhos" },
      { href: "/admin/loja", label: "Loja", icon: "loja" },
    ],
  },
];

export const ADMIN_SECTIONS = ADMIN_GROUPS.flatMap((group) => group.sections);

const isActive = (href: string, path: string) =>
  href === "/admin" ? path === href : path.startsWith(href);

/**
 * Wide screens: the icon sidebar with group labels, active item in accent.
 * Up to 820 px: one row of chips that scrolls sideways, active in wheat (A10).
 */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Back office"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] min-[821px]:mx-0 min-[821px]:flex-col min-[821px]:gap-3.5 min-[821px]:overflow-visible min-[821px]:px-0"
    >
      {ADMIN_GROUPS.map((group) => (
        <div
          key={group.title || "home"}
          className="flex shrink-0 gap-1.5 min-[821px]:flex-col min-[821px]:gap-px"
        >
          {group.title && (
            <span className="hidden px-2.5 pb-1 text-xs font-semibold text-muted min-[821px]:block">
              {group.title}
            </span>
          )}
          {group.sections.map(({ href, label, icon }) => {
            const active = isActive(href, path);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 shrink-0 items-center gap-2.5 rounded-xl px-3.5 text-sm whitespace-nowrap transition-colors active:scale-[.98] min-[821px]:rounded-[9px] min-[821px]:px-2.5 ${
                  active
                    ? "bg-wheat font-extrabold text-ink min-[821px]:bg-accent min-[821px]:font-bold min-[821px]:text-on-accent"
                    : "font-bold text-[#4a3f38] hover:bg-hover hover:text-ink min-[821px]:font-semibold"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className={`hidden size-[18px] shrink-0 fill-none stroke-current stroke-[1.7] [stroke-linecap:round] [stroke-linejoin:round] min-[821px]:block ${
                    active ? "" : "opacity-75"
                  }`}
                >
                  <path d={ICON[icon]} />
                </svg>
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
