import Image from "next/image";
import Link from "next/link";

import { TYPE_LABEL } from "@/components/admin/catalogue-fields";
import { ItemListSkeleton, Streamed } from "@/components/admin/skeleton";
import { Badge, Card, LoadError, PageHeader } from "@/components/admin/ui";
import { imageOf, loadCatalogue, optionIds } from "@/lib/admin/catalogue";
import type { AdminItem } from "@/lib/admin/catalogue-form";
import { load } from "@/lib/admin/form";
import { formatMoney } from "@/lib/format/money";

const TABS = [
  ["", "Produtos"],
  ["opcoes", "Opções e tamanhos"],
] as const;

export default function ItemsPage({ searchParams }: PageProps<"/admin/itens">) {
  return (
    <>
      <PageHeader
        title="Itens"
        description="Produtos, tamanhos, combos e as opções dos grupos. Um produto entra no cardápio pelas categorias."
        actions={
          <Link
            href="/admin/itens/novo"
            className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-bold text-on-accent transition-transform active:scale-[.98]"
          >
            Novo item
          </Link>
        }
      />
      <Streamed fallback={<ItemListSkeleton />}>
        <ItemList searchParams={searchParams} />
      </Streamed>
    </>
  );
}

/** What the list shows as the price: Go's "a partir de" when it sent one. */
function priceLabel(item: AdminItem): string {
  if (item.type === "SIZED_ITEM") return item.displayPrice ? `a partir de ${formatMoney(item.displayPrice)}` : "por tamanho";
  return formatMoney(item.dineInPriceOverride ?? item.price);
}

async function ItemList({ searchParams }: Pick<PageProps<"/admin/itens">, "searchParams">) {
  const { ver } = await searchParams;
  const tab = ver === "opcoes" ? "opcoes" : "";
  const loaded = await load(loadCatalogue);
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const catalogue = loaded.data;
  const options = optionIds(catalogue);
  const isOption = (i: AdminItem) => i.type === "ITEM" && options.has(i.id);
  const images = new Map(catalogue.images.map((i) => [i.id, i.url]));
  const items = catalogue.items
    .filter((i) => (tab === "opcoes" ? isOption(i) : !isOption(i)))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return (
    <>
      <nav aria-label="Tipo de item" className="flex gap-1.5">
        {TABS.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/admin/itens?ver=${value}` : "/admin/itens"}
            aria-current={tab === value ? "page" : undefined}
            className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
              tab === value ? "bg-accent text-on-accent" : "bg-surface text-ink hover:bg-hover"
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">Nada aqui ainda.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const image = images.get(imageOf(item.links) ?? "");
              return (
                <li key={item.id}>
                  <Link href={`/admin/itens/${encodeURIComponent(item.id)}`} className="flex items-center gap-4 px-5 py-3 hover:bg-ground">
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-wheat">
                      {image && <Image src={image} alt="" fill sizes="48px" className="object-cover" />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{item.name}</span>
                      <span className="text-xs text-muted">{TYPE_LABEL[item.type]}</span>
                    </span>
                    {!item.available && <Badge tone="danger">Indisponível</Badge>}
                    <span className="shrink-0 text-sm font-semibold text-price">{priceLabel(item)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
