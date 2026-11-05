import Image from "next/image";
import Link from "next/link";

import { ItemListSkeleton, Streamed } from "@/components/admin/skeleton";
import { Badge, Card, LoadError, PageHeader } from "@/components/admin/ui";
import { load } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import { formatBRL } from "@/lib/format/money";

export default function ItemsPage() {
  return (
    <>
      <PageHeader
        title="Itens"
        description="Tudo o que a padaria vende. Um item entra no cardápio pelas categorias."
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
        <ItemList />
      </Streamed>
    </>
  );
}

async function ItemList() {
  const loaded = await load(() =>
    asOwner((headers) => coreApi().GET("/v1/admin/items", { headers })),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const items = [...loaded.data].sort((a, b) =>
    a.name["pt-BR"].localeCompare(b.name["pt-BR"], "pt-BR"),
  );
  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/admin/itens/${item.id}`}
              className="flex items-center gap-4 px-5 py-3 hover:bg-ground"
            >
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-wheat">
                {item.image && (
                  <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
                )}
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">{item.name["pt-BR"]}</span>
                <span className="text-xs text-muted">
                  {!item.serviceAvailability.DINEIN && "Só para viagem"}
                  {!item.serviceAvailability.TAKE_OUT && "Só para comer aqui"}
                </span>
              </span>
              {item.soldOutDate && <Badge tone="danger">Esgotado</Badge>}
              <span className="text-sm font-semibold text-price">{formatBRL(item.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
