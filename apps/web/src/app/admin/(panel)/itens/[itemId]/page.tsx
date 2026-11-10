import Link from "next/link";
import { notFound } from "next/navigation";

import { TitledFormSkeleton, Streamed } from "@/components/admin/skeleton";
import { Badge, Card, LoadError, PageHeader } from "@/components/admin/ui";
import { loadCatalogue, parentsOf } from "@/lib/admin/catalogue";
import { load } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

import { TYPE_LABEL } from "@/components/admin/catalogue-fields";

import { ItemForm } from "../item-form";

export default function EditItemPage({ params, searchParams }: PageProps<"/admin/itens/[itemId]">) {
  return (
    <Streamed fallback={<TitledFormSkeleton />}>
      <EditItem params={params} searchParams={searchParams} />
    </Streamed>
  );
}

async function EditItem({ params, searchParams }: PageProps<"/admin/itens/[itemId]">) {
  const [{ itemId: rawId }, { novo }] = await Promise.all([params, searchParams]);
  const itemId = decodeURIComponent(rawId);
  const loaded = await load(() =>
    Promise.all([loadCatalogue(), asOwner((headers) => coreApi().GET("/v2/admin/menus", { headers }))]),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const [catalogue, menus] = loaded.data;
  const item = catalogue.items.find((i) => i.id === itemId);
  if (!item) notFound();
  const where = parentsOf(catalogue, menus)(item.type, item.id);
  return (
    <>
      <PageHeader
        title={item.name}
        description={TYPE_LABEL[item.type]}
        actions={
          <Link href="/admin/itens" className="text-sm font-bold text-detail-text">
            ← Itens
          </Link>
        }
      />
      {novo && (
        <Card className="bg-butter">
          <p className="text-sm font-semibold">
            Item criado. Complete abaixo e coloque ele numa categoria em{" "}
            <Link href="/admin/categorias" className="underline">
              Categorias
            </Link>{" "}
            (ou como opção em{" "}
            <Link href="/admin/grupos" className="underline">
              Grupos de opções
            </Link>
            ) para aparecer no totem.
          </p>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-muted">Aparece em:</span>
        {where.length ? where.map((name) => <Badge key={name}>{name}</Badge>) : <Badge tone="danger">Nenhum lugar</Badge>}
      </div>
      <ItemForm item={item} catalogue={catalogue} />
    </>
  );
}
