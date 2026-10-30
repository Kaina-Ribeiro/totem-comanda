import { revalidatePath } from "next/cache";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { Card, Checkbox, Field, inputClass, LoadError } from "@/components/admin/ui";
import { attempt, cents, checked, type FormState, load, text } from "@/lib/admin/form";
import { AdminApiError, asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

type Group = components["schemas"]["AdminOptionGroup"];
type GroupInput = components["schemas"]["OptionGroupInput"];
type Option = components["schemas"]["AdminOption"];
type Role = components["schemas"]["OptionGroupRole"];

/** Roles the owner picks from; the others (combos, surcharges) come later. */
const ROLES: Array<[Role, string]> = [
  ["REQUIRED-MODIFIER", "Escolha obrigatória"],
  ["MODIFIERS", "Adicionais"],
  ["UPSELLS", "Sugestão opcional"],
  ["INGREDIENTS", "Ingredientes que dá pra tirar"],
];

const reais = (value: number) => (value / 100).toFixed(2).replace(".", ",");

function localized(form: FormData, name: string) {
  const en = text(form, `${name}.en`);
  return { "pt-BR": text(form, `${name}.pt`), ...(en ? { en } : {}) };
}

function price(form: FormData, name: string): number {
  const value = text(form, name);
  if (!value) return 0;
  const parsed = cents(value);
  if (parsed === null) throw new AdminApiError("VALIDATION_FAILED", "preço");
  return parsed;
}

function option(form: FormData, prefix: string, order: number, defaults: Partial<Option>): Option {
  return {
    ...(text(form, `${prefix}.id`) ? { id: text(form, `${prefix}.id`) } : {}),
    name: localized(form, prefix),
    price: price(form, `${prefix}.price`),
    servicePriceOverride: {},
    maximumQuantity: Math.max(1, Number(text(form, `${prefix}.max`)) || 1),
    defaultQuantity: 0,
    supersede: false,
    displayOrder: order,
    ...defaults,
  };
}

/** The group a form describes: kept rows, minus removed ones, plus the new blank row if filled. */
function readGroup(form: FormData, itemId: string): GroupInput {
  const role = text(form, "role") as Role;
  const rows = Number(text(form, "rows"));
  const options: Option[] = [];
  const compositeOptions: NonNullable<GroupInput["compositeOptions"]> = [];
  for (let i = 0; i <= rows; i++) {
    const prefix = `o${i}`;
    if (!text(form, `${prefix}.pt`) || checked(form, `${prefix}.remove`)) continue;
    if (role === "INGREDIENTS") {
      const without =
        text(form, `${prefix}.without.pt`) || `Sem ${text(form, `${prefix}.pt`).toLowerCase()}`;
      compositeOptions.push({
        positiveOption: option(form, prefix, i + 1, { price: 0 }),
        negativeOption: {
          ...(text(form, `${prefix}.negId`) ? { id: text(form, `${prefix}.negId`) } : {}),
          name: { "pt-BR": without },
          price: 0,
          servicePriceOverride: {},
          maximumQuantity: 1,
          defaultQuantity: 0,
          supersede: false,
          displayOrder: i + 1,
        },
        defaultChoice: checked(form, `${prefix}.off`) ? "NEGATIVE" : "POSITIVE",
      });
    } else {
      options.push(option(form, prefix, i + 1, {}));
    }
  }
  const required = role === "REQUIRED-MODIFIER";
  const defaultOption = text(form, "defaultOption") || null;
  return {
    itemId,
    parentOptionId: null,
    name: localized(form, "name"),
    role,
    minimum: required ? 1 : Number(text(form, "minimum")) || 0,
    maximum: required ? 1 : role === "INGREDIENTS" ? 0 : Number(text(form, "maximum")) || 0,
    defaultOption: options.some((o) => o.id === defaultOption) ? defaultOption : null,
    displayOrder: Number(text(form, "displayOrder")) || 1,
    options: options.map((o) => ({
      ...o,
      defaultQuantity: o.id && o.id === defaultOption ? 1 : 0,
    })),
    compositeOptions,
  };
}

async function saveGroup(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const groupId = text(form, "groupId");
  const itemId = text(form, "itemId");
  return attempt(async () => {
    const body = readGroup(form, itemId);
    if (groupId) {
      await asOwner((headers) =>
        coreApi().PUT("/v1/admin/option-groups/{optionGroupId}", {
          headers,
          params: { path: { optionGroupId: groupId } },
          body,
        }),
      );
    } else {
      await asOwner((headers) => coreApi().POST("/v1/admin/option-groups", { headers, body }));
    }
    revalidatePath(`/admin/itens/${itemId}`);
    return groupId ? "Grupo salvo." : "Grupo criado.";
  });
}

async function deleteGroup(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const groupId = text(form, "groupId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().DELETE("/v1/admin/option-groups/{optionGroupId}", {
        headers,
        params: { path: { optionGroupId: groupId } },
      }),
    );
    revalidatePath(`/admin/itens/${text(form, "itemId")}`);
    return "Grupo apagado.";
  });
}

/** "Opções e adicionais" on the item page (F-MENU-07, 08). */
export async function OptionGroups({ itemId }: { itemId: string }) {
  const loaded = await load(() =>
    asOwner((headers) =>
      coreApi().GET("/v1/admin/option-groups", { headers, params: { query: { itemId } } }),
    ),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const groups = loaded.data.filter((g) => !g.parentOptionId);
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-2xl font-semibold">Opções e adicionais</h2>
      {groups.map((group) => (
        <GroupForm key={group.id} itemId={itemId} group={group} />
      ))}
      <GroupForm itemId={itemId} group={null} order={groups.length + 1} />
    </section>
  );
}

function GroupForm({
  itemId,
  group,
  order = 1,
}: {
  itemId: string;
  group: Group | null;
  order?: number;
}) {
  const ingredients = group?.role === "INGREDIENTS";
  const rows = ingredients
    ? (group?.compositeOptions ?? []).map((c) => ({
        id: c.positiveOption.id,
        negId: c.negativeOption.id,
        name: c.positiveOption.name,
        without: c.negativeOption.name["pt-BR"],
        off: c.defaultChoice === "NEGATIVE",
        price: 0,
        max: 1,
      }))
    : (group?.options ?? []).map((o) => ({
        id: o.id,
        negId: undefined,
        name: o.name,
        without: "",
        off: false,
        price: o.price,
        max: o.maximumQuantity,
      }));
  return (
    <Card className="flex flex-col gap-4">
      {!group && <h3 className="font-display text-lg font-semibold">Novo grupo</h3>}
      <ActionForm action={saveGroup} resetOnSave={!group} className="flex flex-col gap-4">
        <input type="hidden" name="groupId" value={group?.id ?? ""} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="rows" value={rows.length} />
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Nome (PT)">
            <input
              name="name.pt"
              defaultValue={group?.name["pt-BR"]}
              required
              placeholder="Pão"
              className={inputClass}
            />
          </Field>
          <Field label="Nome (EN)">
            <input
              name="name.en"
              defaultValue={group?.name.en}
              placeholder="Bread"
              className={inputClass}
            />
          </Field>
          <Field label="Tipo">
            <select
              name="role"
              defaultValue={group?.role ?? "REQUIRED-MODIFIER"}
              className={inputClass}
            >
              {ROLES.map(([role, label]) => (
                <option key={role} value={role}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ordem">
            <input
              name="displayOrder"
              type="number"
              defaultValue={group?.displayOrder ?? order}
              className={inputClass}
            />
          </Field>
          <Field label="Mínimo" hint="Escolha obrigatória é sempre 1.">
            <input
              name="minimum"
              type="number"
              min={0}
              defaultValue={group?.minimum ?? 0}
              className={inputClass}
            />
          </Field>
          <Field label="Máximo" hint="0 = sem limite.">
            <input
              name="maximum"
              type="number"
              min={0}
              defaultValue={group?.maximum ?? 0}
              className={inputClass}
            />
          </Field>
          {!ingredients && group && (
            <Field label="Já vem marcado">
              <select
                name="defaultOption"
                defaultValue={group.defaultOption ?? ""}
                className={inputClass}
              >
                <option value="">Nenhum</option>
                {group.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name["pt-BR"]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-semibold">
                {ingredients ? "Ingrediente (PT)" : "Opção (PT)"}
              </th>
              <th className="font-semibold">EN</th>
              {ingredients ? (
                <>
                  <th className="font-semibold">Quando tira (PT)</th>
                  <th className="w-20 font-semibold">Vem sem</th>
                </>
              ) : (
                <>
                  <th className="w-28 font-semibold">+ R$</th>
                  <th className="w-20 font-semibold">Até</th>
                </>
              )}
              <th className="w-14 font-semibold">Tirar</th>
            </tr>
          </thead>
          <tbody>
            {[...rows, null].map((row, i) => (
              <tr key={row?.id ?? "new"} className="border-t border-line">
                <td className="py-1.5 pr-2">
                  {row?.id && <input type="hidden" name={`o${i}.id`} value={row.id} />}
                  {row?.negId && <input type="hidden" name={`o${i}.negId`} value={row.negId} />}
                  <input
                    name={`o${i}.pt`}
                    defaultValue={row?.name["pt-BR"]}
                    placeholder={row ? "" : ingredients ? "Novo ingrediente" : "Nova opção"}
                    aria-label="Nome em português"
                    className={`${inputClass} h-9`}
                  />
                </td>
                <td className="pr-2">
                  <input
                    name={`o${i}.en`}
                    defaultValue={row?.name.en}
                    aria-label="Nome em inglês"
                    className={`${inputClass} h-9`}
                  />
                </td>
                {ingredients ? (
                  <>
                    <td className="pr-2">
                      <input
                        name={`o${i}.without.pt`}
                        defaultValue={row?.without}
                        placeholder="Sem …"
                        aria-label="Nome quando tira"
                        className={`${inputClass} h-9`}
                      />
                    </td>
                    <td className="text-center">
                      <Checkbox name={`o${i}.off`} label="" defaultChecked={row?.off} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="pr-2">
                      <input
                        name={`o${i}.price`}
                        defaultValue={row && row.price > 0 ? reais(row.price) : ""}
                        placeholder="0,00"
                        inputMode="decimal"
                        aria-label="Preço a mais"
                        className={`${inputClass} h-9`}
                      />
                    </td>
                    <td className="pr-2">
                      <input
                        name={`o${i}.max`}
                        type="number"
                        min={1}
                        defaultValue={row?.max ?? 1}
                        aria-label="Quantidade máxima"
                        className={`${inputClass} h-9`}
                      />
                    </td>
                  </>
                )}
                <td className="text-center">
                  {row && <Checkbox name={`o${i}.remove`} label="" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted">
          A última linha em branco adiciona {ingredients ? "um ingrediente" : "uma opção"}. Mude o
          tipo e salve para ver as colunas do tipo novo.
        </p>
        <div>
          <SubmitButton>{group ? "Salvar grupo" : "Criar grupo"}</SubmitButton>
        </div>
      </ActionForm>
      {group && (
        <ActionForm action={deleteGroup} className="border-t border-line pt-3">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="itemId" value={itemId} />
          <div>
            <SubmitButton variant="danger" pendingLabel="Apagando…">
              Apagar grupo
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}
