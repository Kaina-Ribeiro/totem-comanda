import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { LoadError, PageHeader } from "@/components/admin/ui";
import { loadCatalogue } from "@/lib/admin/catalogue";
import { load } from "@/lib/admin/form";

import { NewItemForm } from "../item-form";

export default function NewItemPage() {
  return (
    <>
      <PageHeader title="Novo item" description="Depois de criar, complete o item e coloque ele numa categoria." />
      <Streamed fallback={<FormSkeleton cards={1} />}>
        <NewItem />
      </Streamed>
    </>
  );
}

async function NewItem() {
  const loaded = await load(loadCatalogue);
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  return <NewItemForm catalogue={loaded.data} />;
}
