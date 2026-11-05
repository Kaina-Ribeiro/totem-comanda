
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { LoadError, PageHeader } from "@/components/admin/ui";
import { load } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

import { ItemForm } from "../item-form";

export default function NewItemPage() {
  return (
    <>
      <PageHeader title="Novo item" description="Depois de criar, coloque o item numa categoria." />
      <Streamed fallback={<FormSkeleton cards={1} />}>
        <NewItem />
      </Streamed>
    </>
  );
}

async function NewItem() {
  const loaded = await load(() =>
    asOwner((headers) => coreApi().GET("/v1/admin/cross-sells", { headers })),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  return <ItemForm item={null} crossSells={loaded.data} />;
}
