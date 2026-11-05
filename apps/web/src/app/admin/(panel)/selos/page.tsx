import { revalidatePath } from "next/cache";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { Card, Checkbox, Field, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import { attempt, checked, type FormState, load, optionalText, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

type Tag = components["schemas"]["AdminTag"];
type TagsPage = components["schemas"]["TagsPage"];
type CrossSell = components["schemas"]["AdminCrossSellGroup"];
type Item = components["schemas"]["AdminItem"];

const PATH = "/admin/selos";
const PAGES: Array<[TagsPage, string]> = [
  ["ITEM_MENU", "Na grade do cardápio"],
  ["ITEM_PAGE", "Na página do item"],
  ["BASKET", "No carrinho"],
];

const localized = (form: FormData, name: string) => {
  const en = text(form, `${name}.en`);
  return { "pt-BR": text(form, `${name}.pt`), ...(en ? { en } : {}) };
};

async function saveTag(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const tagId = text(form, "tagId");
  const startDate = optionalText(form, "startDate") ?? null;
  const endDate = optionalText(form, "endDate") ?? null;
  const body = {
    badgeName: localized(form, "badge"),
    textColour: text(form, "textColour"),
    backgroundColour: text(form, "backgroundColour"),
    tagsPages: PAGES.filter(([page]) => checked(form, page)).map(([page]) => page),
    scheduleEnabled: !!(startDate || endDate),
    startDate,
    endDate,
    links: form
      .getAll("items")
      .map((id) => ({ menuItemId: String(id), categoryId: null, enabled: true })),
  };
  return attempt(async () => {
    if (tagId) {
      await asOwner((headers) =>
        coreApi().PUT("/v1/admin/tags/{tagId}", { headers, params: { path: { tagId } }, body }),
      );
    } else {
      await asOwner((headers) => coreApi().POST("/v1/admin/tags", { headers, body }));
    }
    revalidatePath(PATH);
    return tagId ? "Selo salvo." : "Selo criado.";
  });
}

async function deleteTag(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const tagId = text(form, "tagId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().DELETE("/v1/admin/tags/{tagId}", { headers, params: { path: { tagId } } }),
    );
    revalidatePath(PATH);
    return "Selo apagado.";
  });
}

async function saveCrossSell(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const groupId = text(form, "groupId");
  const body = { name: localized(form, "name"), crossSells: form.getAll("items").map(String) };
  return attempt(async () => {
    if (groupId) {
      await asOwner((headers) =>
        coreApi().PUT("/v1/admin/cross-sells/{crossSellGroupId}", {
          headers,
          params: { path: { crossSellGroupId: groupId } },
          body,
        }),
      );
    } else {
      await asOwner((headers) => coreApi().POST("/v1/admin/cross-sells", { headers, body }));
    }
    revalidatePath(PATH);
    return groupId
      ? "Sugestão salva."
      : "Sugestão criada. Escolha em cada item, na página dele, quando sugerir.";
  });
}

async function deleteCrossSell(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const groupId = text(form, "groupId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().DELETE("/v1/admin/cross-sells/{crossSellGroupId}", {
        headers,
        params: { path: { crossSellGroupId: groupId } },
      }),
    );
    revalidatePath(PATH);
    return "Sugestão apagada.";
  });
}

export default function TagsPage() {
  return (
    <>
      <PageHeader
        title="Selos e sugestões"
        description="Selos como “Mais pedido” nos itens, e as sugestões que o totem faz ao adicionar um item."
      />
      <Streamed fallback={<FormSkeleton />}>
        <Lists />
      </Streamed>
    </>
  );
}

async function Lists() {
  const loaded = await load(() =>
    Promise.all([
      asOwner((headers) => coreApi().GET("/v1/admin/tags", { headers })),
      asOwner((headers) => coreApi().GET("/v1/admin/cross-sells", { headers })),
      asOwner((headers) => coreApi().GET("/v1/admin/items", { headers })),
    ]),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const [tags, crossSells, unsorted] = loaded.data;
  const items = [...unsorted].sort((a, b) =>
    a.name["pt-BR"].localeCompare(b.name["pt-BR"], "pt-BR"),
  );
  return (
    <>
      <h2 className="text-xl font-bold tracking-[-0.02em]">Selos</h2>
      {tags.map((tag) => (
        <TagForm key={tag.id} tag={tag} items={items} />
      ))}
      <TagForm tag={null} items={items} />
      <h2 className="mt-4 text-xl font-bold tracking-[-0.02em]">Sugestões ao adicionar</h2>
      {crossSells.map((group) => (
        <CrossSellForm key={group.id} group={group} items={items} />
      ))}
      <CrossSellForm group={null} items={items} />
    </>
  );
}

function ItemPicker({ items, chosen }: { items: Item[]; chosen: Set<string> }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-muted">Itens</legend>
      <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-[10px] border border-line p-3 sm:grid-cols-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="items"
              value={item.id}
              defaultChecked={chosen.has(item.id)}
              className="size-4 accent-[#4e3426]"
            />
            {item.name["pt-BR"]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TagForm({ tag, items }: { tag: Tag | null; items: Item[] }) {
  const chosen = new Set(tag?.links.filter((l) => l.enabled).map((l) => l.menuItemId ?? "") ?? []);
  return (
    <Card className="flex flex-col gap-4">
      <ActionForm action={saveTag} resetOnSave={!tag} className="flex flex-col gap-4">
        <input type="hidden" name="tagId" value={tag?.id ?? ""} />
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Selo (PT)">
            <input
              name="badge.pt"
              defaultValue={tag?.badgeName["pt-BR"]}
              required
              placeholder="Mais pedido"
              className={inputClass}
            />
          </Field>
          <Field label="Selo (EN)">
            <input
              name="badge.en"
              defaultValue={tag?.badgeName.en}
              placeholder="Most ordered"
              className={inputClass}
            />
          </Field>
          <Field label="Texto">
            <input
              name="textColour"
              type="color"
              defaultValue={tag?.textColour ?? "#2B211C"}
              className="h-11 w-16 rounded-[10px] border border-line"
            />
          </Field>
          <Field label="Fundo">
            <input
              name="backgroundColour"
              type="color"
              defaultValue={tag?.backgroundColour ?? "#FFFFFF"}
              className="h-11 w-16 rounded-[10px] border border-line"
            />
          </Field>
          {tag && (
            <span
              className="mb-2 rounded-lg px-3 py-1 text-sm font-bold"
              style={{ color: tag.textColour, backgroundColor: tag.backgroundColour }}
            >
              {tag.badgeName["pt-BR"]}
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-muted">Onde aparece</span>
            {PAGES.map(([page, label]) => (
              <Checkbox
                key={page}
                name={page}
                label={label}
                defaultChecked={tag ? tag.tagsPages.includes(page) : true}
              />
            ))}
          </div>
          <Field label="De (opcional)">
            <input
              name="startDate"
              type="date"
              defaultValue={tag?.startDate ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Até (opcional)">
            <input
              name="endDate"
              type="date"
              defaultValue={tag?.endDate ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
        <ItemPicker items={items} chosen={chosen} />
        <div>
          <SubmitButton>{tag ? "Salvar selo" : "Criar selo"}</SubmitButton>
        </div>
      </ActionForm>
      {tag && (
        <ActionForm action={deleteTag} className="border-t border-line pt-3">
          <input type="hidden" name="tagId" value={tag.id} />
          <div>
            <SubmitButton variant="danger" pendingLabel="Apagando…">
              Apagar selo
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}

function CrossSellForm({ group, items }: { group: CrossSell | null; items: Item[] }) {
  return (
    <Card className="flex flex-col gap-4">
      <ActionForm action={saveCrossSell} resetOnSave={!group} className="flex flex-col gap-4">
        <input type="hidden" name="groupId" value={group?.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pergunta (PT)">
            <input
              name="name.pt"
              defaultValue={group?.name["pt-BR"]}
              required
              placeholder="Que tal um café?"
              className={inputClass}
            />
          </Field>
          <Field label="Pergunta (EN)">
            <input
              name="name.en"
              defaultValue={group?.name.en}
              placeholder="How about a coffee?"
              className={inputClass}
            />
          </Field>
        </div>
        <ItemPicker items={items} chosen={new Set(group?.crossSells ?? [])} />
        <p className="text-xs text-muted">
          Para o totem sugerir, escolha esta sugestão na página de cada item que a dispara.
        </p>
        <div>
          <SubmitButton>{group ? "Salvar sugestão" : "Criar sugestão"}</SubmitButton>
        </div>
      </ActionForm>
      {group && (
        <ActionForm action={deleteCrossSell} className="border-t border-line pt-3">
          <input type="hidden" name="groupId" value={group.id} />
          <div>
            <SubmitButton variant="danger" pendingLabel="Apagando…">
              Apagar sugestão
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}
