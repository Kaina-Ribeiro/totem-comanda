import { refreshAdmin } from "@/app/admin/(panel)/catalogue-actions";
import { DeleteButton, LinkRows, TextsFields } from "@/components/admin/catalogue-fields";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { Card, Field, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import {
  attemptCatalogue,
  byId,
  type Catalogue,
  loadCatalogue,
  optionIds,
  putSwapSell,
} from "@/lib/admin/catalogue";
import { type Badge, readBadge, readSwapSell, type SwapSell } from "@/lib/admin/catalogue-form";
import { type FormState, load, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

async function saveBadge(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const badgeId = text(form, "badgeId");
  return attemptCatalogue(async () => {
    const badges = await asOwner((headers) => coreApi().GET("/v2/admin/badges", { headers }));
    const current = badgeId ? (badges.find((b) => b.id === badgeId) ?? null) : null;
    const body = readBadge(form, current);
    await asOwner((headers) =>
      coreApi().PUT("/v2/admin/badges/{badgeId}", { headers, params: { path: { badgeId: body.id } }, body }),
    );
    await refreshAdmin();
    return current ? "Selo salvo." : "Selo criado. Marque nos itens que devem mostrar ele.";
  });
}

async function saveSwapSell(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const swapSellId = text(form, "swapSellId");
  return attemptCatalogue(async () => {
    const swaps = await asOwner((headers) => coreApi().GET("/v2/admin/swap-sells", { headers }));
    const current = swapSellId ? (swaps.find((s) => s.id === swapSellId) ?? null) : null;
    await putSwapSell(readSwapSell(form, current));
    await refreshAdmin();
    return current ? "Oferta salva." : "Oferta criada. Ligue ela a um item na página do item.";
  });
}

export default function BadgesPage() {
  return (
    <>
      <PageHeader
        title="Selos e sugestões"
        description="Selos aparecem no item (“Novidade”). Ofertas de troca aparecem depois de adicionar (“Turbine seu hambúrguer”). As sugestões “Que tal…?” ficam na página de cada item."
      />
      <Streamed fallback={<FormSkeleton cards={2} fields={4} />}>
        <BadgesAndSwaps />
      </Streamed>
    </>
  );
}

async function BadgesAndSwaps() {
  const loaded = await load(loadCatalogue);
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const catalogue = loaded.data;
  return (
    <>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-[-0.02em]">Selos</h2>
        {catalogue.badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
        <BadgeCard badge={null} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold tracking-[-0.02em]">Ofertas de troca</h2>
        {catalogue.swapSells.map((swap) => (
          <SwapCard key={swap.id} swap={swap} catalogue={catalogue} />
        ))}
        <SwapCard swap={null} catalogue={catalogue} />
      </section>
    </>
  );
}

function BadgeCard({ badge }: { badge: Badge | null }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {badge ? (
          <span
            className="rounded-full px-3 py-1 text-sm font-bold"
            style={{ color: badge.textColour, backgroundColor: badge.backgroundColour }}
          >
            {badge.name}
          </span>
        ) : (
          <h3 className="text-lg font-bold tracking-[-0.01em]">Novo selo</h3>
        )}
      </div>
      <ActionForm action={saveBadge} resetOnSave={!badge} className="flex flex-col gap-4">
        <input type="hidden" name="badgeId" value={badge?.id ?? ""} />
        <TextsFields entity={badge} namePlaceholder="Novidade" />
        <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
          <Field label="Cor do texto">
            <input name="textColour" type="color" defaultValue={badge?.textColour ?? "#FAF6F0"} className={`${inputClass} p-1`} />
          </Field>
          <Field label="Cor do fundo">
            <input
              name="backgroundColour"
              type="color"
              defaultValue={badge?.backgroundColour ?? "#4E3426"}
              className={`${inputClass} p-1`}
            />
          </Field>
        </div>
        <div>
          <SubmitButton>{badge ? "Salvar selo" : "Criar selo"}</SubmitButton>
        </div>
      </ActionForm>
      {badge && <DeleteButton kind="badge" id={badge.id} label="Apagar selo" />}
    </Card>
  );
}

function SwapCard({ swap, catalogue }: { swap: SwapSell | null; catalogue: Catalogue }) {
  const items = byId(catalogue.items);
  const options = optionIds(catalogue);
  const choices = catalogue.items
    .filter((i) => !(i.type === "ITEM" && options.has(i.id)))
    .map((i) => ({ value: `${i.type}:${i.id}`, label: i.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const usedBy = swap ? catalogue.items.filter((i) => i.links.some((l) => l.type === "SWAP_SELL" && l.id === swap.id)) : [];
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold tracking-[-0.01em]">{swap?.name ?? "Nova oferta de troca"}</h3>
        {swap && (
          <p className="text-xs font-medium text-muted">
            {usedBy.length ? `Oferecida depois de: ${usedBy.map((i) => i.name).join(", ")}` : "Nenhum item oferece ainda."}
          </p>
        )}
      </div>
      <ActionForm action={saveSwapSell} resetOnSave={!swap} className="flex flex-col gap-4">
        <input type="hidden" name="swapSellId" value={swap?.id ?? ""} />
        <TextsFields entity={swap} namePlaceholder="Turbine seu hambúrguer" />
        <LinkRows
          name="links"
          legend="Trocar por"
          links={swap?.links ?? []}
          nameOf={(l) => items.get(l.id)?.name ?? l.id}
          choices={choices}
          addLabel="Adicionar produto…"
          empty="Escolha pelo menos um produto."
        />
        <div>
          <SubmitButton>{swap ? "Salvar oferta" : "Criar oferta"}</SubmitButton>
        </div>
      </ActionForm>
      {swap && <DeleteButton kind="swapSell" id={swap.id} label="Apagar oferta" />}
    </Card>
  );
}
