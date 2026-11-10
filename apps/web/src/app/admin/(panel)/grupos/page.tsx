import Link from "next/link";

import { ItemListSkeleton, Streamed } from "@/components/admin/skeleton";
import { Badge, Card, LoadError, PageHeader } from "@/components/admin/ui";
import { loadCatalogue, parentsOf } from "@/lib/admin/catalogue";
import { load } from "@/lib/admin/form";

import { groupLabel } from "./group-form";

export default function GroupsPage() {
  return (
    <>
      <PageHeader
        title="Grupos de opções"
        description="Escolhas de um item (molho, adicionais, ingredientes) e as partes de um combo. Um grupo entra num item pela página do item."
        actions={
          <Link
            href="/admin/grupos/novo"
            className="rounded-[10px] bg-accent px-4 py-2.5 text-sm font-bold text-on-accent transition-transform active:scale-[.98]"
          >
            Novo grupo
          </Link>
        }
      />
      <Streamed fallback={<ItemListSkeleton />}>
        <GroupList />
      </Streamed>
    </>
  );
}

const limits = (min: number, max: number) =>
  min === 0 ? `até ${max}` : min === max ? `${min} obrigatória${min > 1 ? "s" : ""}` : `${min} a ${max}`;

async function GroupList() {
  const loaded = await load(loadCatalogue);
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const catalogue = loaded.data;
  const parents = parentsOf(catalogue);
  const groups = [...catalogue.groups].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (!groups.length) {
    return (
      <Card>
        <p className="text-sm text-muted">Nenhum grupo ainda.</p>
      </Card>
    );
  }
  return (
    <Card className="p-0">
      <ul className="divide-y divide-line">
        {groups.map((group) => {
          const where = parents(group.type, group.id);
          const count = group.links.filter((l) => l.type !== "IMAGE").length;
          return (
            <li key={group.id}>
              <Link
                href={`/admin/grupos/${encodeURIComponent(group.id)}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-ground"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{group.name}</span>
                  <span className="text-xs text-muted">
                    {groupLabel(group.type)} · {count} {count === 1 ? "opção" : "opções"} · {limits(group.min, group.max)}
                  </span>
                </span>
                {where.length ? (
                  <span className="text-xs font-medium text-muted">em {where.join(", ")}</span>
                ) : (
                  <Badge tone="warn">Sem item</Badge>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
