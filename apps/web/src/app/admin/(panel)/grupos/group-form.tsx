import { redirect } from "next/navigation";

import { refreshAdmin } from "@/app/admin/(panel)/catalogue-actions";
import { DeleteButton, OptionRows, TextsFields } from "@/components/admin/catalogue-fields";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { Card, Field, inputClass } from "@/components/admin/ui";
import { attemptCatalogue, byId, type Catalogue, loadCatalogue, optionsPart, putGroup } from "@/lib/admin/catalogue";
import { type Group, type Item, readGroup } from "@/lib/admin/catalogue-form";
import { type FormState, saveBoth, text } from "@/lib/admin/form";

export const GROUP_LABEL = {
  MODIFIERS: "Opções do item",
  COMBO_MAIN: "Principal do combo",
  COMBO_SIDE: "Acompanhamento do combo",
} as const;

const MODIFIER_LABEL = {
  MODI: "Escolhas ou adicionais",
  SIZE: "Tamanho (aparece primeiro)",
  INGR: "Ingredientes (já vêm marcados, dá pra tirar)",
  SURC: "Taxa extra",
  INGM: "Ingredientes extras",
} as const;

export const groupLabel = (type: Group["type"]) => GROUP_LABEL[type as keyof typeof GROUP_LABEL] ?? type;

async function saveGroup(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const groupId = text(form, "groupId");
  let createdId: string | null = null;
  const state = await attemptCatalogue(async () => {
    const catalogue = await loadCatalogue();
    const current = groupId ? (catalogue.groups.find((g) => g.id === groupId) ?? null) : null;
    if (groupId && !current) return { error: "Esse grupo não existe mais. Recarregue a página." };
    const items = byId(catalogue.items);
    const { group, options } = readGroup(form, current, items);
    // Options are items: saved first, put back if the group fails (COM-129).
    await saveBoth(optionsPart(options, items), { label: "o grupo", save: () => putGroup(group) });
    await refreshAdmin();
    if (!current) createdId = group.id;
    return "Grupo salvo. Aparece no totem na próxima jornada.";
  });
  if (createdId) redirect(`/admin/grupos/${encodeURIComponent(createdId)}?novo=1`);
  return state;
}

/** Create or edit a group of options: kind, limits, and its options inline (SPEC 6). */
export function GroupForm({ group, catalogue }: { group: Group | null; catalogue: Catalogue }) {
  const items = byId(catalogue.items);
  const options = (group?.links ?? [])
    .filter((l) => l.type !== "IMAGE")
    .map((l) => items.get(l.id))
    .filter((i): i is Item => !!i && i.type !== "COMBO_MEAL");
  const nestable = catalogue.groups.filter((g) => g.id !== group?.id);
  return (
    <>
      <ActionForm action={saveGroup} className="flex flex-col gap-6">
        <input type="hidden" name="groupId" value={group?.id ?? ""} />
        <Card className="flex flex-col gap-5">
          <TextsFields entity={group} namePlaceholder="Escolha o molho" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Usado em">
              {group ? (
                <span className="flex h-11 items-center font-semibold">{groupLabel(group.type)}</span>
              ) : (
                <select name="type" defaultValue="MODIFIERS" className={inputClass}>
                  {Object.entries(GROUP_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Tipo de opção">
              <select name="modifierType" defaultValue={group?.modifierType ?? "MODI"} className={inputClass}>
                {Object.entries(MODIFIER_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mínimo de escolhas" hint="1 ou mais = obrigatório.">
              <input name="min" defaultValue={group?.min ?? 0} inputMode="numeric" required className={inputClass} />
            </Field>
            <Field label="Máximo de escolhas">
              <input name="max" defaultValue={group?.max ?? 1} inputMode="numeric" required className={inputClass} />
            </Field>
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-[-0.01em]">Opções</h2>
            <p className="text-sm text-muted">
              Na ordem do totem (Pos.). Preço vazio = grátis. “Começa com” 1 deixa a opção marcada. Para mais linhas, salve.
            </p>
          </div>
          <OptionRows options={options} groups={nestable} mode="options" blank={group ? 2 : 3} />
        </Card>
        <div>
          <SubmitButton>{group ? "Salvar grupo" : "Criar grupo"}</SubmitButton>
        </div>
      </ActionForm>
      {group && <DeleteButton kind="group" id={group.id} label="Apagar grupo" then="/admin/grupos" />}
    </>
  );
}
