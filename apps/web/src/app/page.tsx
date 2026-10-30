import Link from "next/link";

// Placeholder index while the three areas are empty. Each device opens its own
// area directly, so this page is only a convenience for development.
const areas = [
  { href: "/kiosk", label: "Totem" },
  { href: "/kitchen", label: "Cozinha" },
  { href: "/admin", label: "Back office" },
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-8 p-12">
      <h1 className="font-display text-6xl font-semibold">Comanda</h1>
      <ul className="flex flex-col gap-4 text-2xl font-semibold">
        {areas.map((area) => (
          <li key={area.href}>
            <Link href={area.href} className="text-detail-text">
              {area.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
