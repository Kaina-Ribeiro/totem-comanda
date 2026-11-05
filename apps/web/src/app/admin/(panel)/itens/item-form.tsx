import Image from "next/image";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { Card, Checkbox, Field, inputClass } from "@/components/admin/ui";
import {
  attempt,
  cents,
  checked,
  type FormState,
  optionalPrice,
  optionalText,
  text,
} from "@/lib/admin/form";
import { uploadImage } from "@/lib/admin/media";
import { AdminApiError, asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

type Item = components["schemas"]["AdminItem"];
type ItemInput = components["schemas"]["ItemInput"];
type CrossSell = components["schemas"]["AdminCrossSellGroup"];

const reais = (value: number | undefined | null) =>
  value == null ? "" : (value / 100).toFixed(2).replace(".", ",");

const localized = (form: FormData, name: string) => {
  const pt = text(form, `${name}.pt`);
  const en = text(form, `${name}.en`);
  return pt ? { "pt-BR": pt, ...(en ? { en } : {}) } : undefined;
};

async function readItem(form: FormData, current: Item | null): Promise<ItemInput> {
  const price = cents(text(form, "price"));
  if (price === null) throw new AdminApiError("VALIDATION_FAILED", "preço");
  const dineIn = optionalPrice(form, "price.DINEIN", "preço para comer aqui");
  const takeOut = optionalPrice(form, "price.TAKE_OUT", "preço para viagem");
  const image =
    (await uploadImage(form, "image")) ??
    (checked(form, "removeImage") ? null : (current?.image ?? null));
  return {
    plu: optionalText(form, "plu") ?? null,
    name: localized(form, "name") ?? { "pt-BR": "" },
    shortName: localized(form, "shortName"),
    description: localized(form, "description"),
    image,
    price,
    servicePriceOverride: {
      ...(dineIn !== null ? { DINEIN: dineIn } : {}),
      ...(takeOut !== null ? { TAKE_OUT: takeOut } : {}),
    },
    serviceAvailability: { DINEIN: checked(form, "dineIn"), TAKE_OUT: checked(form, "takeOut") },
    calories: optionalText(form, "calories") ?? null,
    itemLabels: current?.itemLabels ?? [],
    defaultEntity: current?.defaultEntity ?? null,
    crossSellGroupId: optionalText(form, "crossSellGroupId") ?? null,
    fiscal: current?.fiscal ?? null,
  };
}

async function saveItem(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const itemId = text(form, "itemId");
  let createdId: string | null = null;
  const state = await attempt(async () => {
    if (itemId) {
      const current = await asOwner((headers) =>
        coreApi().GET("/v1/admin/items/{itemId}", { headers, params: { path: { itemId } } }),
      );
      const body = await readItem(form, current);
      await asOwner((headers) =>
        coreApi().PUT("/v1/admin/items/{itemId}", { headers, params: { path: { itemId } }, body }),
      );
      revalidatePath("/admin/itens");
      return "Item salvo. Aparece no totem na próxima jornada.";
    }
    const created = await asOwner(async (headers) =>
      coreApi().POST("/v1/admin/items", { headers, body: await readItem(form, null) }),
    );
    createdId = created.id;
  });
  // A new item goes to its page, where it can join categories and get options.
  if (createdId) redirect(`/admin/itens/${createdId}?novo=1`);
  return state;
}

async function deleteItem(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const itemId = text(form, "itemId");
  const state = await attempt(() =>
    asOwner((headers) =>
      coreApi().DELETE("/v1/admin/items/{itemId}", { headers, params: { path: { itemId } } }),
    ),
  );
  if (state.error) return state;
  revalidatePath("/admin/itens");
  redirect("/admin/itens");
}

/** Create or edit an item: texts PT/EN, photo, price, prices per order type, availability. */
export function ItemForm({ item, crossSells }: { item: Item | null; crossSells: CrossSell[] }) {
  return (
    <>
      <ActionForm action={saveItem} className="flex flex-col gap-6">
        <input type="hidden" name="itemId" value={item?.id ?? ""} />
        <Card className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome (PT)">
            <input
              name="name.pt"
              defaultValue={item?.name["pt-BR"]}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Nome (EN)">
            <input name="name.en" defaultValue={item?.name.en} className={inputClass} />
          </Field>
          <Field label="Nome curto (PT)" hint="Opcional, para espaços pequenos.">
            <input
              name="shortName.pt"
              defaultValue={item?.shortName?.["pt-BR"]}
              className={inputClass}
            />
          </Field>
          <Field label="Nome curto (EN)">
            <input name="shortName.en" defaultValue={item?.shortName?.en} className={inputClass} />
          </Field>
          <Field label="Descrição (PT)">
            <textarea
              name="description.pt"
              defaultValue={item?.description?.["pt-BR"]}
              rows={2}
              className={`${inputClass} h-auto py-2`}
            />
          </Field>
          <Field label="Descrição (EN)">
            <textarea
              name="description.en"
              defaultValue={item?.description?.en}
              rows={2}
              className={`${inputClass} h-auto py-2`}
            />
          </Field>
        </Card>

        <Card className="grid gap-5 sm:grid-cols-3">
          <Field
            label="Preço (R$)"
            hint="Preço base. Cada cardápio pode ter o seu, nas categorias."
          >
            <input
              name="price"
              defaultValue={reais(item?.price ?? null)}
              required
              inputMode="decimal"
              placeholder="28,00"
              className={inputClass}
            />
          </Field>
          <Field label="Preço para comer aqui (R$)" hint="Vazio usa o preço base.">
            <input
              name="price.DINEIN"
              defaultValue={reais(item?.servicePriceOverride?.DINEIN)}
              inputMode="decimal"
              className={inputClass}
            />
          </Field>
          <Field label="Preço para viagem (R$)" hint="Vazio usa o preço base.">
            <input
              name="price.TAKE_OUT"
              defaultValue={reais(item?.servicePriceOverride?.TAKE_OUT)}
              inputMode="decimal"
              className={inputClass}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-muted">Disponível para</span>
            <Checkbox
              name="dineIn"
              label="Comer aqui"
              defaultChecked={item?.serviceAvailability.DINEIN ?? true}
            />
            <Checkbox
              name="takeOut"
              label="Para viagem"
              defaultChecked={item?.serviceAvailability.TAKE_OUT ?? true}
            />
          </div>
          <Field label="Código (PLU)">
            <input name="plu" defaultValue={item?.plu ?? ""} className={inputClass} />
          </Field>
          <Field label="Calorias" hint="Ex.: 320 kcal">
            <input name="calories" defaultValue={item?.calories ?? ""} className={inputClass} />
          </Field>
        </Card>

        <Card className="grid gap-5 sm:grid-cols-2">
          <Field label="Foto" hint="JPEG ou PNG até 5 MB; o totem recorta para o quadro.">
            <div className="flex items-center gap-3">
              {item?.image && (
                <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-ground">
                  <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
                </span>
              )}
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="text-sm"
              />
            </div>
            {item?.image && <Checkbox name="removeImage" label="Tirar a foto" />}
          </Field>
          <Field label="Sugestão ao adicionar" hint="Grupo de “Que tal um café?”.">
            <select
              name="crossSellGroupId"
              defaultValue={item?.crossSellGroupId ?? ""}
              className={inputClass}
            >
              <option value="">Nenhuma</option>
              {crossSells.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name["pt-BR"]}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <div>
          <SubmitButton>{item ? "Salvar item" : "Criar item"}</SubmitButton>
        </div>
      </ActionForm>

      {item && (
        <ActionForm action={deleteItem} className="flex flex-col gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <div>
            <SubmitButton variant="danger" pendingLabel="Apagando…">
              Apagar item
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </>
  );
}
