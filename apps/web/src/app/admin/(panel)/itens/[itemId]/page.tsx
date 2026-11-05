import Link from "next/link";
import { notFound } from "next/navigation";

import { FormSkeleton, Streamed, TitledFormSkeleton } from "@/components/admin/skeleton";
import { Card, LoadError, PageHeader } from "@/components/admin/ui";
import { load } from "@/lib/admin/form";
import { AdminApiError, asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

import { ItemForm } from "../item-form";
import { OptionGroups } from "./option-groups";

export default function EditItemPage({ params, searchParams }: PageProps<"/admin/itens/[itemId]">) {
  return (
    <Streamed fallback={<TitledFormSkeleton />}>
      <EditItem params={params} searchParams={searchParams} />
    </Streamed>
  );
}

async function EditItem({ params, searchParams }: PageProps<"/admin/itens/[itemId]">) {
  const [{ itemId }, { novo }] = await Promise.all([params, searchParams]);
  const loaded = await load(async () => {
    try {
      return await Promise.all([
        asOwner((headers) =>
          coreApi().GET("/v1/admin/items/{itemId}", { headers, params: { path: { itemId } } }),
        ),
        asOwner((headers) => coreApi().GET("/v1/admin/cross-sells", { headers })),
      ]);
    } catch (error) {
      if (error instanceof AdminApiError && error.code === "NOT_FOUND") notFound();
      throw error;
    }
  });
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const [item, crossSells] = loaded.data;
  return (
    <>
      <PageHeader
        title={item.name["pt-BR"]}
        actions={
          <Link href="/admin/itens" className="text-sm font-bold text-detail-text">
            ← Itens
          </Link>
        }
      />
      {novo && (
        <Card className="bg-butter">
          <p className="text-sm font-semibold">
            Item criado. Coloque ele numa categoria em{" "}
            <Link href="/admin/categorias" className="underline">
              Categorias
            </Link>{" "}
            para aparecer no totem.
          </p>
        </Card>
      )}
      <ItemForm item={item} crossSells={crossSells} />
      <Streamed fallback={<FormSkeleton cards={1} fields={3} />}>
        <OptionGroups itemId={item.id} />
      </Streamed>
    </>
  );
}
