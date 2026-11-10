import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { LoadError, PageHeader } from "@/components/admin/ui";
import { loadCatalogue } from "@/lib/admin/catalogue";
import { load } from "@/lib/admin/form";

import { GroupForm } from "../group-form";

export default function NewGroupPage() {
  return (
    <>
      <PageHeader title="Novo grupo" description="Depois de criar, ligue o grupo a um item na página do item." />
      <Streamed fallback={<FormSkeleton cards={2} />}>
        <NewGroup />
      </Streamed>
    </>
  );
}

async function NewGroup() {
  const loaded = await load(loadCatalogue);
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  return <GroupForm group={null} catalogue={loaded.data} />;
}
