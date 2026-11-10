import { refreshAdmin } from "@/app/admin/(panel)/catalogue-actions";
import { DeleteButton, HoursFields, LinkRows, TextsFields } from "@/components/admin/catalogue-fields";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { Badge, Card, Field, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import { attemptCatalogue } from "@/lib/admin/catalogue";
import { type AdminMenu, type Hours, readHours, readMenu, type Section } from "@/lib/admin/catalogue-form";
import { type FormState, load, saveBoth, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

const FORCE_HOURS = [1, 2, 4, 8];

const putMenu = (body: AdminMenu) =>
  asOwner((headers) => coreApi().PUT("/v2/admin/menus/{menuId}", { headers, params: { path: { menuId: body.id } }, body }));

const getMenu = async (menuId: string) => {
  const menus = await asOwner((headers) => coreApi().GET("/v2/admin/menus", { headers }));
  return menus.find((m) => m.id === menuId) ?? null;
};

async function createMenu(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  return attemptCatalogue(async () => {
    await putMenu(readMenu(form, null));
    await refreshAdmin();
    return "Cardápio criado. Escolha as categorias e os horários dele abaixo.";
  });
}

async function saveMenu(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const menuId = text(form, "menuId");
  return attemptCatalogue(async () => {
    const current = await getMenu(menuId);
    if (!current) return { error: "Esse cardápio não existe mais. Recarregue a página." };
    const next = readMenu(form, current);
    const windows = readHours(form);
    const before: AdminMenu = { id: current.id, name: current.name, translations: current.translations, root: current.root };
    // Two calls: the menu is put back if the hours fail (COM-129).
    await saveBoth(
      JSON.stringify(before) === JSON.stringify(next)
        ? null
        : { label: "o cardápio", save: () => putMenu(next), undo: () => putMenu(before) },
      {
        label: "os horários",
        save: () =>
          asOwner((headers) =>
            coreApi().PUT("/v2/admin/menus/{menuId}/schedules", { headers, params: { path: { menuId } }, body: windows }),
          ),
      },
    );
    await refreshAdmin();
    return "Salvo. O totem troca de cardápio sozinho em até 45 s.";
  });
}

async function forceMenu(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const menuId = text(form, "menuId");
  return attemptCatalogue(async () => {
    if (text(form, "intent") === "clear") {
      await asOwner((headers) =>
        coreApi().DELETE("/v2/admin/menus/{menuId}/force", { headers, params: { path: { menuId } } }),
      );
      await refreshAdmin();
      return "De volta ao horário normal.";
    }
    const hours = Number(text(form, "hours")) || 1;
    await asOwner((headers) =>
      coreApi().POST("/v2/admin/menus/{menuId}/force", {
        headers,
        params: { path: { menuId } },
        body: { until: new Date(Date.now() + hours * 3_600_000).toISOString() },
      }),
    );
    await refreshAdmin();
    return `Forçado por ${hours} h. O totem troca em até 45 s.`;
  });
}

export default function MenusPage() {
  return (
    <>
      <PageHeader
        title="Cardápios"
        description="Cada cardápio mostra suas categorias nos horários dele; o totem troca sozinho. Fora de todos, mostra Fechado."
      />
      <Streamed fallback={<FormSkeleton />}>
        <MenuList />
      </Streamed>
      <Card>
        <h2 className="mb-4 text-lg font-bold tracking-[-0.01em]">Novo cardápio</h2>
        <ActionForm action={createMenu} resetOnSave className="flex flex-col gap-4">
          <TextsFields entity={null} namePlaceholder="Noite" />
          <div>
            <SubmitButton pendingLabel="Criando…">Criar cardápio</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}

async function MenuList() {
  const loaded = await load(async () => {
    const [menus, sections] = await Promise.all([
      asOwner((headers) => coreApi().GET("/v2/admin/menus", { headers })),
      asOwner((headers) => coreApi().GET("/v2/admin/sections", { headers })),
    ]);
    const schedules = await Promise.all(
      menus.map((menu) =>
        asOwner((headers) =>
          coreApi().GET("/v2/admin/menus/{menuId}/schedules", { headers, params: { path: { menuId: menu.id } } }),
        ),
      ),
    );
    return { sections, menus: menus.map((menu, i) => ({ menu, windows: schedules[i] })) };
  });
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const { menus, sections } = loaded.data;
  return (
    <div className="flex flex-col gap-4">
      {menus.map(({ menu, windows }) => (
        <MenuCard key={menu.id} menu={menu} windows={windows} sections={sections} />
      ))}
    </div>
  );
}

const untilFormat = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

function MenuCard({ menu, windows, sections }: { menu: AdminMenu; windows: Hours[]; sections: Section[] }) {
  const names = new Map(sections.map((s) => [s.id, s.name]));
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold tracking-[-0.02em]">{menu.name}</h2>
        {menu.isActive && <Badge tone="ok">No totem agora</Badge>}
        {menu.forcedUntil && <Badge tone="warn">Forçado até {untilFormat.format(new Date(menu.forcedUntil))}</Badge>}
        {windows.length === 0 && <Badge tone="danger">Sem horário</Badge>}
        {menu.root.length === 0 && <Badge tone="danger">Sem categorias</Badge>}
      </div>

      <ActionForm action={saveMenu} className="flex flex-col gap-5">
        <input type="hidden" name="menuId" value={menu.id} />
        <TextsFields entity={menu} />
        <LinkRows
          name="root"
          legend="Categorias, na ordem do totem"
          links={menu.root}
          nameOf={(l) => names.get(l.id) ?? l.id}
          choices={sections.map((s) => ({ value: `CATEGORY:${s.id}`, label: s.name }))}
          addLabel="Adicionar categoria…"
          empty="Nenhuma categoria: o totem não teria o que mostrar."
        />
        <HoursFields hours={windows} legend="Horários (fim antes do início passa da meia-noite)" />
        <div>
          <SubmitButton>Salvar cardápio</SubmitButton>
        </div>
      </ActionForm>

      <ActionForm action={forceMenu} className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
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

      <div className="border-t border-line pt-4">
        <DeleteButton kind="menu" id={menu.id} label="Apagar cardápio" />
        <p className="mt-2 text-xs text-muted">As categorias continuam existindo e podem estar em outros cardápios.</p>
      </div>
    </Card>
  );
}
