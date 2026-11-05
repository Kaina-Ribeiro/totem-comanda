import { revalidatePath } from "next/cache";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import {
  Badge,
  Card,
  Checkbox,
  Field,
  inputClass,
  LoadError,
  PageHeader,
} from "@/components/admin/ui";
import {
  attempt,
  checked,
  type FormState,
  load,
  sameText,
  saveBoth,
  text,
} from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

type Menu = components["schemas"]["AdminMenu"];
type MenuInput = components["schemas"]["MenuInput"];
type Window = components["schemas"]["MenuSchedule"];
type Weekday = Window["weekday"];

const PATH = "/admin/cardapios";
const DAYS: Array<[Weekday, string]> = [
  ["MON", "Segunda"],
  ["TUE", "Terça"],
  ["WED", "Quarta"],
  ["THU", "Quinta"],
  ["FRI", "Sexta"],
  ["SAT", "Sábado"],
  ["SUN", "Domingo"],
];
const FORCE_HOURS = [1, 2, 4, 8];

const menuName = (form: FormData) => {
  const en = text(form, "name.en");
  return { "pt-BR": text(form, "name.pt"), ...(en ? { en } : {}) };
};

async function createMenu(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().POST("/v1/admin/menus", {
        headers,
        body: { name: menuName(form), showCategoriesPrice: false },
      }),
    );
    revalidatePath(PATH);
    return "Cardápio criado. Defina os horários dele abaixo.";
  });
}

async function saveMenu(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const menuId = text(form, "menuId");
  const windows: Window[] = DAYS.filter(([day]) =>
    checked(form, `${day}.open`),
  ).map(([day]) => ({
    weekday: day,
    timeStart: text(form, `${day}.start`),
    timeEnd: text(form, `${day}.end`),
  }));
  const next: MenuInput = {
    name: menuName(form),
    showCategoriesPrice: checked(form, "showCategoriesPrice"),
  };
  return attempt(async () => {
    const putMenu = (body: MenuInput) =>
      asOwner((headers) =>
        coreApi().PUT("/v1/admin/menus/{menuId}", {
          headers,
          params: { path: { menuId } },
          body,
        }),
      );
    // Two calls, so the menu is put back if the hours fail (COM-129).
    const current = await asOwner((headers) =>
      coreApi().GET("/v1/admin/menus/{menuId}", {
        headers,
        params: { path: { menuId } },
      }),
    );
    const changed =
      !sameText(current.name, next.name) ||
      current.showCategoriesPrice !== next.showCategoriesPrice;
    await saveBoth(
      changed
        ? {
            label: "o nome do cardápio",
            save: () => putMenu(next),
            undo: () =>
              putMenu({
                name: current.name,
                showCategoriesPrice: current.showCategoriesPrice,
              }),
          }
        : null,
      {
        label: "os horários",
        save: () =>
          asOwner((headers) =>
            coreApi().PUT("/v1/admin/menus/{menuId}/schedules", {
              headers,
              params: { path: { menuId } },
              body: windows,
            }),
          ),
      },
    );
    revalidatePath(PATH);
    return "Salvo. O totem troca de cardápio sozinho em até 45 s.";
  });
}

async function forceMenu(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const menuId = text(form, "menuId");
  const intent = text(form, "intent");
  return attempt(async () => {
    if (intent === "clear") {
      await asOwner((headers) =>
        coreApi().DELETE("/v1/admin/menus/{menuId}/force", {
          headers,
          params: { path: { menuId } },
        }),
      );
      revalidatePath(PATH);
      return "De volta ao horário normal.";
    }
    const hours = Number(text(form, "hours")) || 1;
    await asOwner((headers) =>
      coreApi().POST("/v1/admin/menus/{menuId}/force", {
        headers,
        params: { path: { menuId } },
        body: { until: new Date(Date.now() + hours * 3_600_000).toISOString() },
      }),
    );
    revalidatePath(PATH);
    return `Forçado por ${hours} h. O totem troca em até 45 s.`;
  });
}

async function deleteMenu(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const menuId = text(form, "menuId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().DELETE("/v1/admin/menus/{menuId}", {
        headers,
        params: { path: { menuId } },
      }),
    );
    revalidatePath(PATH);
    return "Cardápio apagado.";
  });
}

export default function MenusPage() {
  return (
    <>
      <PageHeader
        title="Cardápios"
        description="Cada cardápio tem seus horários; o totem mostra sozinho o que vale agora. Fora de todos, mostra Fechado."
      />
      <Streamed fallback={<FormSkeleton />}>
        <MenuList />
      </Streamed>
      <Card>
        <h2 className="mb-4 text-lg font-bold tracking-[-0.01em]">
          Novo cardápio
        </h2>
        <ActionForm
          action={createMenu}
          resetOnSave
          className="grid gap-4 sm:grid-cols-3"
        >
          <Field label="Nome (PT)">
            <input
              name="name.pt"
              required
              placeholder="Noite"
              className={inputClass}
            />
          </Field>
          <Field label="Nome (EN)">
            <input
              name="name.en"
              placeholder="Evening"
              className={inputClass}
            />
          </Field>
          <div className="flex items-end">
            <SubmitButton pendingLabel="Criando…">Criar</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}

async function MenuList() {
  const loaded = await load(async () => {
    const menus = await asOwner((headers) =>
      coreApi().GET("/v1/admin/menus", { headers }),
    );
    const schedules = await Promise.all(
      menus.map((menu) =>
        asOwner((headers) =>
          coreApi().GET("/v1/admin/menus/{menuId}/schedules", {
            headers,
            params: { path: { menuId: menu.id } },
          }),
        ),
      ),
    );
    return menus.map((menu, i) => ({ menu, windows: schedules[i] }));
  });
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  return (
    <div className="flex flex-col gap-4">
      {loaded.data.map(({ menu, windows }) => (
        <MenuCard key={menu.id} menu={menu} windows={windows} />
      ))}
    </div>
  );
}

const untilFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

function MenuCard({ menu, windows }: { menu: Menu; windows: Window[] }) {
  // One window per day in this editor; the contract allows more.
  const byDay = new Map(windows.map((w) => [w.weekday, w]));
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold tracking-[-0.02em]">
          {menu.name["pt-BR"]}
        </h2>
        {menu.isActive && <Badge tone="ok">No totem agora</Badge>}
        {menu.forcedUntil && (
          <Badge tone="warn">
            Forçado até {untilFormat.format(new Date(menu.forcedUntil))}
          </Badge>
        )}
        {windows.length === 0 && <Badge tone="danger">Sem horário</Badge>}
      </div>

      <ActionForm action={saveMenu} className="flex flex-col gap-4">
        <input type="hidden" name="menuId" value={menu.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome (PT)">
            <input
              name="name.pt"
              defaultValue={menu.name["pt-BR"]}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Nome (EN)">
            <input
              name="name.en"
              defaultValue={menu.name.en}
              className={inputClass}
            />
          </Field>
        </div>
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-muted">
            Horários (fim antes do início passa da meia-noite)
          </legend>
          {DAYS.map(([day, label]) => {
            const w = byDay.get(day);
            return (
              <div
                key={day}
                className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3"
              >
                <div className="col-span-2 sm:col-span-1">
                  <Checkbox
                    name={`${day}.open`}
                    label={label}
                    defaultChecked={!!w}
                  />
                </div>
                <input
                  name={`${day}.start`}
                  type="time"
                  defaultValue={w?.timeStart ?? "06:00"}
                  aria-label={`${label}, abre`}
                  className={`${inputClass} min-w-0`}
                />
                <input
                  name={`${day}.end`}
                  type="time"
                  defaultValue={w?.timeEnd ?? "11:00"}
                  aria-label={`${label}, fecha`}
                  className={`${inputClass} min-w-0`}
                />
              </div>
            );
          })}
        </fieldset>
        <Checkbox
          name="showCategoriesPrice"
          label="Mostrar preço nas categorias"
          defaultChecked={menu.showCategoriesPrice}
        />
        <div>
          <SubmitButton>Salvar cardápio</SubmitButton>
        </div>
      </ActionForm>

      <ActionForm
        action={forceMenu}
        className="flex flex-wrap items-end gap-3 border-t border-line pt-4"
      >
        <input type="hidden" name="menuId" value={menu.id} />
        <Field label="Forçar este cardápio agora por">
          <select name="hours" defaultValue={2} className={inputClass}>
            {FORCE_HOURS.map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </Field>
        <SubmitButton variant="secondary" name="intent" value="force">
          Forçar
        </SubmitButton>
        {menu.forcedUntil && (
          <SubmitButton variant="secondary" name="intent" value="clear">
            Voltar ao horário
          </SubmitButton>
        )}
      </ActionForm>

      <ActionForm action={deleteMenu} className="border-t border-line pt-4">
        <input type="hidden" name="menuId" value={menu.id} />
        <div>
          <SubmitButton variant="danger" pendingLabel="Apagando…">
            Apagar cardápio e suas categorias
          </SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
