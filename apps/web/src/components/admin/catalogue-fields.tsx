import Image from "next/image";
import Link from "next/link";

import { deleteEntity } from "@/app/admin/(panel)/catalogue-actions";

import { ANVISA_ALLERGENS, type Allergen, OTHER_ALLERGENS } from "@/lib/admin/allergens";
import {
  DAYS,
  type EntityType,
  type Group,
  type Hours,
  type Item,
  type Link as EntityLink,
} from "@/lib/admin/catalogue-form";

import { ActionForm, SubmitButton } from "./form";
import { Checkbox, Field, inputClass } from "./ui";

// Server-rendered fields shared by the v2 menu editor (COM-147). No client
// code: every field posts with its form and is read by lib/admin/catalogue-form.

export const TYPE_LABEL: Partial<Record<EntityType, string>> = {
  CATEGORY: "Categoria",
  ITEM: "Item",
  SIZED_ITEM: "Com tamanhos",
  COMBO_MEAL: "Combo",
  MODIFIERS: "Grupo de opções",
  COMBO_MAIN: "Principal do combo",
  COMBO_SIDE: "Acompanhamento do combo",
  SWAP_SELL: "Oferta de troca",
  IMAGE: "Foto",
};

type Texts = {
  name?: string;
  description?: string | null;
  translations?: { en?: { name?: string; description?: string } };
};

/** Name and (optionally) description, PT and EN. */
export function TextsFields({
  entity,
  description = false,
  namePlaceholder,
}: {
  entity: Texts | null;
  description?: boolean;
  namePlaceholder?: string;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome (PT)">
        <input
          name="name.pt"
          defaultValue={entity?.name}
          required
          placeholder={namePlaceholder}
          className={inputClass}
        />
      </Field>
      <Field label="Nome (EN)">
        <input name="name.en" defaultValue={entity?.translations?.en?.name} className={inputClass} />
      </Field>
      {description && (
        <>
          <Field label="Descrição (PT)">
            <textarea
              name="description.pt"
              defaultValue={entity?.description ?? ""}
              rows={2}
              className={`${inputClass} h-auto py-2`}
            />
          </Field>
          <Field label="Descrição (EN)">
            <textarea
              name="description.en"
              defaultValue={entity?.translations?.en?.description}
              rows={2}
              className={`${inputClass} h-auto py-2`}
            />
          </Field>
        </>
      )}
    </div>
  );
}

export type Choice = { value: string; label: string };

/**
 * Ordered links (`${name}.N.*`): a position number, the name and kind, and
 * "tirar"; then one select to add another. Lower numbers come first.
 */
export function LinkRows({
  name,
  links,
  nameOf,
  choices,
  legend,
  addLabel = "Adicionar…",
  empty = "Nada ainda.",
}: {
  name: string;
  links: EntityLink[];
  nameOf: (link: EntityLink) => string;
  choices: Choice[];
  legend: string;
  addLabel?: string;
  empty?: string;
}) {
  const taken = new Set(links.map((l) => `${l.type}:${l.id}`));
  const free = choices.filter((c) => !taken.has(c.value));
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-muted">{legend}</legend>
      {links.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      {links.length > 0 && (
        <ol className="flex flex-col divide-y divide-line rounded-[10px] border border-line">
          {links.map((link, i) => (
            <li key={`${link.type}:${link.id}`} className="flex items-center gap-3 px-3 py-2">
              <input type="hidden" name={`${name}.${i}.type`} value={link.type} />
              <input type="hidden" name={`${name}.${i}.id`} value={link.id} />
              <input
                name={`${name}.${i}.order`}
                defaultValue={i + 1}
                inputMode="numeric"
                aria-label={`Posição de ${nameOf(link)}`}
                className={`${inputClass.replace("w-full", "w-14")} h-9 shrink-0 px-2 text-center`}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-semibold">{nameOf(link)}</span>
                <span className="text-xs text-muted">{TYPE_LABEL[link.type] ?? link.type}</span>
              </span>
              <label className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-danger">
                <input type="checkbox" name={`${name}.${i}.remove`} className="size-4 accent-[#a3472f]" />
                Tirar
              </label>
            </li>
          ))}
        </ol>
      )}
      {free.length > 0 && (
        <select name={`${name}.add`} defaultValue="" aria-label={addLabel} className={inputClass}>
          <option value="">{addLabel}</option>
          {free.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      )}
    </fieldset>
  );
}

/** One window per day; `toggle` adds "só em certos horários" (`hours.on`) for sections. */
export function HoursFields({
  hours,
  toggle = false,
  legend,
}: {
  hours: Hours[];
  toggle?: boolean;
  legend: string;
}) {
  // One window per day in this editor; the contract allows more.
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
  const days = (
    <div className="flex flex-col gap-2">
      {DAYS.map(([day, label]) => {
        const w = byDay.get(day);
        return (
          <div
            key={day}
            className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3"
          >
            <div className="col-span-2 sm:col-span-1">
              <Checkbox name={`${day}.open`} label={label} defaultChecked={!!w} />
            </div>
            <input
              name={`${day}.start`}
              type="time"
              defaultValue={w?.open.slice(0, 5) ?? "06:00"}
              aria-label={`${label}, abre`}
              className={`${inputClass} min-w-0`}
            />
            <input
              name={`${day}.end`}
              type="time"
              defaultValue={w?.close.slice(0, 5) ?? "11:00"}
              aria-label={`${label}, fecha`}
              className={`${inputClass} min-w-0`}
            />
          </div>
        );
      })}
    </div>
  );
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold text-muted">{legend}</legend>
      {toggle ? (
        <>
          <Checkbox name="hours.on" label="Só em certos horários" defaultChecked={hours.length > 0} />
          {days}
        </>
      ) : (
        days
      )}
    </fieldset>
  );
}

export type Picture = { id: string; url: string; name: string; altText?: string | null };

/** The picture: keep one already uploaded, pick another, upload a new one, or none. */
export function ImageField({ current, images }: { current: string | null; images: Picture[] }) {
  const shown = images.find((i) => i.id === current);
  return (
    <Field label="Foto" hint="JPEG ou PNG até 5 MB. Uma foto nova substitui a escolhida.">
      <div className="flex items-center gap-3">
        <span className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-wheat">
          {shown && <Image src={shown.url} alt={shown.altText ?? ""} fill sizes="64px" className="object-cover" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <select name="image" defaultValue={current ?? ""} aria-label="Foto escolhida" className={inputClass}>
            <option value="">Sem foto</option>
            {images.map((image) => (
              <option key={image.id} value={image.id}>
                {image.altText || image.name}
              </option>
            ))}
          </select>
          <input
            name="imageFile"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Enviar foto nova"
            className="text-sm"
          />
        </div>
      </div>
    </Field>
  );
}

/** Checkboxes posting `name` once per ticked value. */
export function CheckList({
  name,
  choices,
  selected,
  columns = "grid-cols-2 sm:grid-cols-3",
}: {
  name: string;
  choices: Choice[];
  selected: readonly string[];
  columns?: string;
}) {
  const on = new Set(selected);
  return (
    <div className={`grid gap-x-4 gap-y-2 ${columns}`}>
      {choices.map((c) => (
        <label key={c.value} className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name={name}
            value={c.value}
            defaultChecked={on.has(c.value)}
            className="size-5 shrink-0 accent-[#4e3426]"
          />
          <span className="min-w-0">{c.label}</span>
        </label>
      ))}
    </div>
  );
}

const toChoices = (list: Array<[Allergen, string]>): Choice[] => list.map(([value, label]) => ({ value, label }));

/** Allergens (SPEC 6): declared or not, "contém" and "pode conter", ANVISA groups first. */
export function AllergenFields({
  allergens = [],
  traces = [],
  declared = false,
}: {
  allergens?: readonly Allergen[];
  traces?: readonly Allergen[];
  declared?: boolean;
}) {
  const otherPicked = [...allergens, ...traces].some((a) => OTHER_ALLERGENS.some(([v]) => v === a));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Checkbox name="allergensDeclared" label="Alergênicos informados" defaultChecked={declared} />
        <span className="text-xs text-muted">
          Desligado, o totem mostra “não informado”: uma lista vazia nunca quer dizer “sem alergênicos”.
        </span>
      </div>
      {(
        [
          ["allergens", "Contém", allergens],
          ["traces", "Pode conter", traces],
        ] as const
      ).map(([name, title, selected]) => (
        <fieldset key={name} className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold text-muted">{title}</legend>
          <CheckList name={name} choices={toChoices(ANVISA_ALLERGENS)} selected={selected} />
          <details open={otherPicked} className="group">
            <summary className="cursor-pointer text-sm font-bold text-detail-text">
              Outros (gergelim, vegano, picância…)
            </summary>
            <div className="pt-3">
              <CheckList name={name} choices={toChoices(OTHER_ALLERGENS)} selected={selected} />
            </div>
          </details>
        </fieldset>
      ))}
    </div>
  );
}

/** "Apagar" for one entity; Go refuses while something links it, and says what. */
export function DeleteButton({
  kind,
  id,
  label,
  then = "",
}: {
  kind: "section" | "item" | "group" | "swapSell" | "badge" | "coupon" | "menu";
  id: string;
  label: string;
  then?: string;
}) {
  return (
    <ActionForm action={deleteEntity} className="flex flex-col gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="then" value={then} />
      <div>
        <SubmitButton variant="danger" pendingLabel="Apagando…">
          {label}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

const reais = (value: number | null | undefined) => (value == null ? "" : value.toFixed(2).replace(".", ","));

/**
 * Inline options of a group (`mode="options"`) or sizes of a sized item
 * (`mode="sizes"`): rows `opt.N.*` read by readOptionRows, plus `blank` empty
 * rows for new ones. An option is an item: the same one may sit in several
 * groups, and a change here changes it everywhere.
 */
export function OptionRows({
  options,
  groups = [],
  mode,
  blank = 2,
}: {
  options: Item[];
  groups?: Group[];
  mode: "options" | "sizes";
  blank?: number;
}) {
  const rows: Array<Item | null> = [...options, ...Array.from({ length: blank }, () => null)];
  const noun = mode === "sizes" ? "tamanho" : "opção";
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((option, i) => {
        const p = `opt.${i}.`;
        const nested = option?.links.find((l) => l.type === "MODIFIERS")?.id ?? "";
        return (
          <li key={option?.id ?? `new-${i}`} className="flex flex-col gap-3 rounded-[10px] border border-line p-3">
            <input type="hidden" name={`${p}id`} value={option?.id ?? ""} />
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_7rem]">
              <Field label="Pos.">
                <input
                  name={`${p}order`}
                  defaultValue={option ? i + 1 : ""}
                  inputMode="numeric"
                  className={`${inputClass} px-2 text-center`}
                />
              </Field>
              <Field label={option ? `Nome (PT)` : `Nova ${noun} (PT)`}>
                <input name={`${p}name.pt`} defaultValue={option?.name} className={inputClass} />
              </Field>
              <Field label="Nome (EN)" className="col-span-2 sm:col-span-1">
                <input name={`${p}name.en`} defaultValue={option?.translations?.en?.name} className={inputClass} />
              </Field>
              <Field label="Preço (R$)" className="col-span-2 sm:col-span-1">
                <input
                  name={`${p}price`}
                  defaultValue={reais(option?.price)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className={inputClass}
                />
              </Field>
            </div>
            {mode === "options" && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-[repeat(3,minmax(0,7rem))_minmax(0,1fr)]">
                <Field label="Inicial">
                  <input name={`${p}defaultQuantity`} defaultValue={option?.defaultQuantity ?? ""} inputMode="numeric" placeholder="0" className={inputClass} />
                </Field>
                <Field label="Mín.">
                  <input name={`${p}minChoices`} defaultValue={option?.minChoices ?? ""} inputMode="numeric" placeholder="0" className={inputClass} />
                </Field>
                <Field label="Máx.">
                  <input name={`${p}maxChoices`} defaultValue={option?.maxChoices ?? ""} inputMode="numeric" placeholder="1" className={inputClass} />
                </Field>
                <Field label="Abre outro grupo" className="col-span-3 sm:col-span-1">
                  <select name={`${p}nested`} defaultValue={nested} className={inputClass}>
                    <option value="">Nenhum</option>
                    {groups
                      .filter((g) => g.type === "MODIFIERS")
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Checkbox name={`${p}available`} label="Disponível" defaultChecked={option?.available ?? true} />
              {option && (
                <>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-danger">
                    <input type="checkbox" name={`${p}remove`} className="size-4 accent-[#a3472f]" />
                    Tirar daqui
                  </label>
                  <Link href={`/admin/itens/${encodeURIComponent(option.id)}`} className="text-sm font-bold text-detail-text">
                    Alergênicos e mais →
                  </Link>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
