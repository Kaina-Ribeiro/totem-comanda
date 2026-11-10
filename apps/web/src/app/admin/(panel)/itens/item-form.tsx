import { redirect } from "next/navigation";

import { refreshAdmin } from "@/app/admin/(panel)/catalogue-actions";
import {
  AllergenFields,
  CheckList,
  type Choice,
  DeleteButton,
  ImageField,
  LinkRows,
  OptionRows,
  TextsFields,
} from "@/components/admin/catalogue-fields";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { Card, Checkbox, Field, inputClass } from "@/components/admin/ui";
import {
  attemptCatalogue,
  byId,
  type Catalogue,
  imageOf,
  loadCatalogue,
  nextComboId,
  optionIds,
  optionsPart,
  putItem,
} from "@/lib/admin/catalogue";
import { type AdminItem, type Item, readItem, readOptionRows } from "@/lib/admin/catalogue-form";
import { type FormState, saveBoth, text } from "@/lib/admin/form";
import { uploadImage } from "@/lib/admin/media";

const reais = (value: number | null | undefined) => (value == null ? "" : value.toFixed(2).replace(".", ","));

async function saveItem(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const itemId = text(form, "itemId");
  let createdId: string | null = null;
  const state = await attemptCatalogue(async () => {
    const catalogue = await loadCatalogue();
    const items = byId(catalogue.items);
    const current = itemId ? (items.get(itemId) ?? null) : null;
    if (itemId && !current) return { error: "Esse item não existe mais. Recarregue a página." };
    const uploaded = await uploadImage(form, "imageFile");
    if (uploaded) form.set("image", uploaded);
    const item = readItem(form, current, { nextComboId: nextComboId(catalogue.items) });
    if (item.type === "SIZED_ITEM" && form.has("sizes")) {
      // Sizes are items too: saved first and put back if the sized item fails (COM-129).
      const { links: sizes, options } = readOptionRows(form, "opt", items);
      const images = item.links.filter((l) => l.type === "IMAGE");
      item.links = [...images, ...sizes, ...item.links.filter((l) => l.type !== "IMAGE")];
      await saveBoth(optionsPart(options, items), { label: "o item", save: () => putItem(item) });
    } else {
      await putItem(item);
    }
    await refreshAdmin();
    if (!current) createdId = item.id;
    return "Item salvo. Aparece no totem na próxima jornada.";
  });
  // A new item goes to its page, where it gets groups, sizes, allergens and a category.
  if (createdId) redirect(`/admin/itens/${encodeURIComponent(createdId)}?novo=1`);
  return state;
}

/** Create: the kind of item, its name and price (and a combo's parts). The rest is on its page. */
export function NewItemForm({ catalogue }: { catalogue: Catalogue }) {
  const comboParts = [
    ...catalogue.groups.filter((g) => g.type === "COMBO_MAIN"),
    ...catalogue.groups.filter((g) => g.type === "COMBO_SIDE"),
  ].map((g) => ({
    value: `${g.type}:${g.id}`,
    label: `${g.type === "COMBO_MAIN" ? "Principal" : "Acompanhamento"} · ${g.name}`,
  }));
  return (
    <ActionForm action={saveItem} className="flex flex-col gap-6">
      <input type="hidden" name="itemId" value="" />
      <input type="hidden" name="available" value="on" />
      <Card className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-muted">Tipo</legend>
          {(
            [
              ["ITEM", "Item", "Um produto ou uma opção de grupo (ex.: pão de queijo, queijo extra)."],
              ["SIZED_ITEM", "Com tamanhos", "O preço vem de cada tamanho (ex.: café P, M, G)."],
              ["COMBO_MEAL", "Combo", "Um principal e acompanhamentos, a um preço."],
            ] as const
          ).map(([value, label, hint], i) => (
            <label key={value} className="flex items-start gap-3 rounded-[10px] border border-line p-3">
              <input type="radio" name="type" value={value} defaultChecked={i === 0} className="mt-0.5 size-5 accent-[#4e3426]" />
              <span className="flex flex-col">
                <span className="font-semibold">{label}</span>
                <span className="text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <TextsFields entity={null} />
        <Field label="Preço (R$)" hint="Itens com tamanhos ignoram este preço.">
          <input name="price" inputMode="decimal" placeholder="9,50" className={inputClass} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-muted">Partes do combo (só para combo)</legend>
          {comboParts.length ? (
            <CheckList name="links.add" choices={comboParts} selected={[]} columns="sm:grid-cols-2" />
          ) : (
            <p className="text-sm text-muted">
              Crie antes um grupo “Principal do combo” e um “Acompanhamento do combo” em Grupos de opções.
            </p>
          )}
        </fieldset>
      </Card>
      <div>
        <SubmitButton pendingLabel="Criando…">Criar item</SubmitButton>
      </div>
    </ActionForm>
  );
}

const sortByName = (choices: Choice[]) => choices.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

/** Edit every part of a product, option, size, sized item or combo (SPEC 6). */
export function ItemForm({ item, catalogue }: { item: AdminItem; catalogue: Catalogue }) {
  const items = byId(catalogue.items);
  const groups = byId(catalogue.groups);
  const swaps = byId(catalogue.swapSells);
  const nameOf = (type: string, id: string) =>
    (type === "SWAP_SELL" ? swaps.get(id)?.name : type === "ITEM" || type === "SIZED_ITEM" ? items.get(id)?.name : groups.get(id)?.name) ?? id;
  const isOption = optionIds(catalogue).has(item.id);
  const sizes = item.type === "SIZED_ITEM" ? item.links.filter((l) => l.type === "ITEM").map((l) => items.get(l.id)).filter((i): i is Item => i?.type === "ITEM") : [];
  const linkRows = item.links.filter((l) => l.type !== "IMAGE" && !(item.type === "SIZED_ITEM" && l.type === "ITEM"));
  const groupChoices =
    item.type === "COMBO_MEAL"
      ? catalogue.groups
          .filter((g) => g.type === "COMBO_MAIN" || g.type === "COMBO_SIDE")
          .map((g) => ({ value: `${g.type}:${g.id}`, label: `${g.type === "COMBO_MAIN" ? "Principal" : "Acompanhamento"} · ${g.name}` }))
      : [
          ...sortByName(catalogue.groups.filter((g) => g.type === "MODIFIERS").map((g) => ({ value: `MODIFIERS:${g.id}`, label: g.name }))),
          ...(item.type === "ITEM"
            ? catalogue.swapSells.map((s) => ({ value: `SWAP_SELL:${s.id}`, label: `Oferta de troca · ${s.name}` }))
            : []),
        ];
  const options = optionIds(catalogue);
  const productChoices = sortByName(
    catalogue.items
      .filter((i) => i.id !== item.id && !(i.type === "ITEM" && options.has(i.id)))
      .map((i) => ({ value: i.id, label: i.name })),
  );
  const optionItem = item as Item;
  return (
    <>
      <ActionForm action={saveItem} className="flex flex-col gap-6">
        <input type="hidden" name="itemId" value={item.id} />
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold tracking-[-0.01em]">Textos</h2>
          <TextsFields entity={item} description />
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold tracking-[-0.01em]">Preço e venda</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {item.type !== "SIZED_ITEM" && (
              <>
                <Field label="Preço (R$)" hint={isOption ? "Numa opção, quanto ela soma. 0 = grátis." : undefined}>
                  <input name="price" defaultValue={reais(item.price)} required inputMode="decimal" placeholder="9,50" className={inputClass} />
                </Field>
                <Field label="Preço para comer aqui (R$)" hint="Vazio usa o preço.">
                  <input name="dineInPrice" defaultValue={reais(item.dineInPriceOverride)} inputMode="decimal" className={inputClass} />
                </Field>
              </>
            )}
            <Field label="Nome na cozinha" hint="Curto, para o pedido. Vazio usa o nome.">
              <input name="internalName" defaultValue={item.internalName ?? ""} className={inputClass} />
            </Field>
            <Field label="Código (PLU)">
              <input name="plu" defaultValue={item.plu ?? ""} className={inputClass} />
            </Field>
            <Field label="Calorias" hint="Ex.: 320 kcal">
              <input name="calories" defaultValue={item.calories ?? ""} className={inputClass} />
            </Field>
            <Field label="Idade mínima" hint="Vazio = livre.">
              <input name="ageRestriction" defaultValue={item.ageRestriction ?? ""} inputMode="numeric" className={inputClass} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox name="available" label="Disponível" defaultChecked={item.available} />
            <Checkbox name="alcoholic" label="Bebida alcoólica" defaultChecked={item.alcoholic ?? false} />
          </div>
        </Card>

        {item.type === "SIZED_ITEM" && (
          <Card className="flex flex-col gap-4">
            <input type="hidden" name="sizes" value="on" />
            <div>
              <h2 className="text-lg font-bold tracking-[-0.01em]">Tamanhos</h2>
              <p className="text-sm text-muted">O totem pede o tamanho primeiro; o preço de cada um é o preço do item.</p>
            </div>
            <OptionRows options={sizes} mode="sizes" />
          </Card>
        )}

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold tracking-[-0.01em]">
            {item.type === "COMBO_MEAL" ? "Partes do combo" : "Grupos de opções"}
          </h2>
          <LinkRows
            name="links"
            legend={
              item.type === "COMBO_MEAL"
                ? "Um principal e pelo menos um acompanhamento, na ordem do totem"
                : "Na ordem do totem; uma oferta de troca aparece depois de adicionar"
            }
            links={linkRows}
            nameOf={(l) => nameOf(l.type, l.id)}
            choices={groupChoices}
            addLabel={item.type === "COMBO_MEAL" ? "Adicionar parte…" : "Adicionar grupo ou oferta…"}
            empty={item.type === "COMBO_MEAL" ? "Sem partes: um combo precisa delas." : "Sem opções: o item vai direto para a sacola."}
          />
        </Card>

        {item.type === "ITEM" && (
          <details open={isOption} className="rounded-[14px] border border-line bg-surface px-5 py-[18px]">
            <summary className="cursor-pointer text-lg font-bold tracking-[-0.01em]">Quando é opção de um grupo</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Começa com" hint="1 = já vem marcado (ingredientes).">
                <input name="defaultQuantity" defaultValue={optionItem.defaultQuantity ?? ""} inputMode="numeric" placeholder="0" className={inputClass} />
              </Field>
              <Field label="Mínimo desta opção">
                <input name="minChoices" defaultValue={optionItem.minChoices ?? ""} inputMode="numeric" placeholder="0" className={inputClass} />
              </Field>
              <Field label="Máximo desta opção">
                <input name="maxChoices" defaultValue={optionItem.maxChoices ?? ""} inputMode="numeric" placeholder="1" className={inputClass} />
              </Field>
            </div>
          </details>
        )}

        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-bold tracking-[-0.01em]">Alergênicos</h2>
          <AllergenFields allergens={item.allergens} traces={item.allergenTraces} declared={item.allergensDeclared} />
        </Card>

        <Card className="flex flex-col gap-5">
          <h2 className="text-lg font-bold tracking-[-0.01em]">Selos e sugestões</h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-muted">Selos</legend>
            {catalogue.badges.length ? (
              <CheckList name="badgeIds" choices={catalogue.badges.map((b) => ({ value: b.id, label: b.name }))} selected={item.badgeIds ?? []} />
            ) : (
              <p className="text-sm text-muted">Nenhum selo criado.</p>
            )}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold text-muted">Sugerir depois de adicionar (“Que tal…?”)</legend>
            <CheckList name="crossSellIds" choices={productChoices} selected={item.crossSellIds ?? []} />
          </fieldset>
        </Card>

        <Card>
          <ImageField current={imageOf(item.links)} images={catalogue.images} />
        </Card>

        <div>
          <SubmitButton>Salvar item</SubmitButton>
        </div>
      </ActionForm>

      <DeleteButton kind="item" id={item.id} label="Apagar item" then="/admin/itens" />
    </>
  );
}
