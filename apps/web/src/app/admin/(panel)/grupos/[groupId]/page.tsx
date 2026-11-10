import Link from "next/link";
import { notFound } from "next/navigation";

import { Streamed, TitledFormSkeleton } from "@/components/admin/skeleton";
import { Badge, Card, LoadError, PageHeader } from "@/components/admin/ui";
import { loadCatalogue, parentsOf } from "@/lib/admin/catalogue";
import { load } from "@/lib/admin/form";

import { groupLabel, GroupForm } from "../group-form";

export default function EditGroupPage({ params, searchParams }: PageProps<"/admin/grupos/[groupId]">) {
  return (
    <Streamed fallback={<TitledFormSkeleton />}>
      <EditGroup params={params} searchParams={searchParams} />
    </Streamed>
  );
}

async function EditGroup({ params, searchParams }: PageProps<"/admin/grupos/[groupId]">) {
  const [{ groupId: rawId }, { novo }] = await Promise.all([params, searchParams]);
  const groupId = decodeURIComponent(rawId);
  const loaded = await load(loadCatalogue);
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const catalogue = loaded.data;
  const group = catalogue.groups.find((g) => g.id === groupId);
  if (!group) notFound();
  const where = parentsOf(catalogue)(group.type, group.id);
  return (
    <>
      <PageHeader
        title={group.name}
        description={groupLabel(group.type)}
        actions={
          <Link href="/admin/grupos" className="text-sm font-bold text-detail-text">
            ← Grupos
          </Link>
        }
      />
      {novo && (
        <Card className="bg-butter">
          <p className="text-sm font-semibold">
            Grupo criado. Ligue ele a um item em{" "}
            <Link href="/admin/itens" className="underline">
              Itens
            </Link>{" "}
            para aparecer no totem.
          </p>
        </Card>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-muted">Aparece em:</span>
        {where.length ? where.map((name) => <Badge key={name}>{name}</Badge>) : <Badge tone="warn">Nenhum item</Badge>}
      </div>
      <GroupForm group={group} catalogue={catalogue} />
    </>
  );
}
