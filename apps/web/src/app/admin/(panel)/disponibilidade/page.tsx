import Image from "next/image";
import Link from "next/link";

import { refreshAdmin } from "@/app/admin/(panel)/catalogue-actions";
import { TYPE_LABEL } from "@/components/admin/catalogue-fields";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { SoldOutSkeleton, Streamed } from "@/components/admin/skeleton";
import { LoadError, PageHeader } from "@/components/admin/ui";
import { byId, imageOf, loadCatalogue, optionIds } from "@/lib/admin/catalogue";
import type { AdminItem } from "@/lib/admin/catalogue-form";
import { attempt, type FormState, load, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

async function setAvailable(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const itemId = text(form, "itemId");
  const available = text(form, "intent") === "on";
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().PUT("/v2/admin/items/{itemId}/availability", {
        headers,
        params: { path: { itemId } },
        body: { available },
      }),
    );
    await refreshAdmin();
    return available ? "Voltou para o totem." : "Indisponível no totem até você ligar de novo.";
  });
}

const FILTERS = [
  ["", "Todos"],
  ["indisponiveis", "Só indisponíveis"],
] as const;

export default function AvailabilityPage({ searchParams }: PageProps<"/admin/disponibilidade">) {
  return (
    <>
      <PageHeader
        title="Disponibilidade"
        description="Acabou? Desligue o item ou a opção: o totem mostra “Indisponível” e não deixa pedir. Fica assim até você ligar de novo."
      />
      <Streamed fallback={<SoldOutSkeleton />}>
        <AvailabilityList searchParams={searchParams} />
      </Streamed>
    </>
  );
}

type Row = { item: AdminItem; context: string };

async function AvailabilityList({ searchParams }: Pick<PageProps<"/admin/disponibilidade">, "searchParams">) {
  const { filtro } = await searchParams;
  const onlyOff = filtro === "indisponiveis";
  const loaded = await load(loadCatalogue);
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const catalogue = loaded.data;
  const items = byId(catalogue.items);
  const options = optionIds(catalogue);
  const images = new Map(catalogue.images.map((i) => [i.id, i.url]));
  const byName = (a: Row, b: Row) => a.item.name.localeCompare(b.item.name, "pt-BR");

  const products: Row[] = catalogue.items
    .filter((i) => !(i.type === "ITEM" && options.has(i.id)))
    .map((item) => ({ item, context: TYPE_LABEL[item.type] ?? "" }))
    .sort(byName);
  // Options and sizes, under the group or sized item they belong to.
  const parents = [
    ...catalogue.groups.map((g) => ({ name: g.name, links: g.links })),
    ...catalogue.items.filter((i) => i.type === "SIZED_ITEM").map((i) => ({ name: `Tamanhos de ${i.name}`, links: i.links })),
  ].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const sections = [
    { title: "Produtos", rows: products },
    ...parents.map((p) => ({
      title: p.name,
      rows: p.links
        .filter((l) => l.type === "ITEM" || l.type === "SIZED_ITEM")
        .map((l) => items.get(l.id))
        .filter((i): i is AdminItem => !!i)
        .map((item) => ({ item, context: "Opção" })),
    })),
  ]
    .map((s) => ({ ...s, rows: onlyOff ? s.rows.filter((r) => !r.item.available) : s.rows }))
    .filter((s) => s.rows.length);

  return (
    <>
      <nav aria-label="Filtro" className="flex gap-1.5">
        {FILTERS.map(([value, label]) => {
          const active = (value === "indisponiveis") === onlyOff;
          return (
            <Link
              key={value}
              href={value ? `/admin/disponibilidade?filtro=${value}` : "/admin/disponibilidade"}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ${
                active ? "bg-accent text-on-accent" : "bg-surface text-ink hover:bg-hover"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {sections.length === 0 && (
        <p className="rounded-[14px] border border-line bg-surface p-5 text-sm font-semibold text-muted">
          {onlyOff ? "Tudo disponível agora." : "Nenhum item ainda."}
        </p>
      )}
      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-muted">{section.title}</h2>
          <ul className="flex flex-col gap-2">
            {section.rows.map(({ item }) => {
              const off = !item.available;
              const image = images.get(imageOf(item.links) ?? "");
              return (
                <li
                  key={`${section.title}:${item.id}`}
                  className={`flex items-center gap-3 rounded-[14px] border p-3 ${
                    off ? "border-danger/30 bg-danger/5" : "border-line bg-surface"
                  }`}
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-wheat">
                    {image && <Image src={image} alt="" fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`truncate font-semibold ${off ? "text-muted line-through" : ""}`}>{item.name}</span>
                    {off && <span className="text-xs font-bold text-danger">Indisponível</span>}
                  </span>
                  <ActionForm action={setAvailable} className="flex flex-col items-end gap-1 text-right">
                    <input type="hidden" name="itemId" value={item.id} />
                    <SubmitButton name="intent" value={off ? "on" : "off"} variant={off ? "primary" : "danger"} pendingLabel="…">
                      {off ? "Ligar" : "Desligar"}
                    </SubmitButton>
                  </ActionForm>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
