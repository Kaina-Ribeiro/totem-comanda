import { refreshAdmin } from "@/app/admin/(panel)/catalogue-actions";
import {
  type Choice,
  DeleteButton,
  HoursFields,
  ImageField,
  LinkRows,
  TextsFields,
} from "@/components/admin/catalogue-fields";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { Badge, Card, Checkbox, LoadError, PageHeader } from "@/components/admin/ui";
import {
  attemptCatalogue,
  type Catalogue,
  imageOf,
  loadCatalogue,
  optionIds,
  parentsOf,
  putSection,
} from "@/lib/admin/catalogue";
import { readSection, type Section } from "@/lib/admin/catalogue-form";
import { type FormState, load, text } from "@/lib/admin/form";
import { uploadImage } from "@/lib/admin/media";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";

async function saveSection(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const sectionId = text(form, "sectionId");
  return attemptCatalogue(async () => {
    const sections = await asOwner((headers) => coreApi().GET("/v2/admin/sections", { headers }));
    const current = sectionId ? (sections.find((s) => s.id === sectionId) ?? null) : null;
    const uploaded = await uploadImage(form, "imageFile");
    if (uploaded) form.set("image", uploaded);
    await putSection(readSection(form, current));
    await refreshAdmin();
    return current ? "Categoria salva. Aparece no totem na próxima jornada." : "Categoria criada. Coloque ela num cardápio ou dentro de outra categoria.";
  });
}

export default function SectionsPage() {
  return (
    <>
      <PageHeader
        title="Categorias"
        description="Categorias guardam itens e outras categorias. Um cardápio mostra as categorias de cima; as de dentro aparecem ao tocar."
      />
      <Streamed fallback={<FormSkeleton cards={3} fields={3} />}>
        <SectionList />
      </Streamed>
    </>
  );
}

async function SectionList() {
  const loaded = await load(() =>
    Promise.all([loadCatalogue(), asOwner((headers) => coreApi().GET("/v2/admin/menus", { headers }))]),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const [catalogue, menus] = loaded.data;
  const parents = parentsOf(catalogue, menus);
  // Sections on a menu first, then the ones inside others, then the loose ones.
  const rank = (s: Section) => {
    const where = parents("CATEGORY", s.id);
    return where.some((p) => p.startsWith("Cardápio ")) ? 0 : where.length ? 1 : 2;
  };
  const sections = [...catalogue.sections].sort(
    (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "pt-BR"),
  );
  return (
    <>
      <div className="flex flex-col gap-3">
        {sections.map((section) => (
          <SectionCard key={section.id} section={section} catalogue={catalogue} where={parents("CATEGORY", section.id)} />
        ))}
      </div>
      <Card>
        <h2 className="mb-4 text-lg font-bold tracking-[-0.01em]">Nova categoria</h2>
        <ActionForm action={saveSection} resetOnSave className="flex flex-col gap-4">
          <input type="hidden" name="sectionId" value="" />
          <input type="hidden" name="available" value="on" />
          <TextsFields entity={null} namePlaceholder="Doces" />
          <div>
            <SubmitButton pendingLabel="Criando…">Criar categoria</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}

function contentChoices(catalogue: Catalogue, self: string): Choice[] {
  const options = optionIds(catalogue);
  const sections = catalogue.sections
    .filter((s) => s.id !== self)
    .map((s) => ({ value: `CATEGORY:${s.id}`, label: `Categoria · ${s.name}` }));
  const products = catalogue.items
    .filter((i) => !options.has(i.id) || i.type !== "ITEM")
    .map((i) => ({ value: `${i.type}:${i.id}`, label: i.name }));
  return [...products.sort((a, b) => a.label.localeCompare(b.label, "pt-BR")), ...sections];
}

function SectionCard({ section, catalogue, where }: { section: Section; catalogue: Catalogue; where: string[] }) {
  const names = new Map<string, string>(
    [...catalogue.sections, ...catalogue.items].map((e) => [`${e.type}:${e.id}`, e.name]),
  );
  const contents = section.links.filter((l) => l.type !== "IMAGE");
  const products = contents.filter((l) => l.type !== "CATEGORY").length;
  const subsections = contents.length - products;
  return (
    <details className="group rounded-[14px] border border-line bg-surface">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0 fill-none stroke-current stroke-2 text-muted transition-transform group-open:rotate-90"><path d="M9 6l6 6-6 6" /></svg>
        <span className="text-lg font-bold tracking-[-0.01em]">{section.name}</span>
        {section.available === false && <Badge tone="danger">Oculta</Badge>}
        {(section.availableHours?.length ?? 0) > 0 && <Badge tone="warn">Com horário</Badge>}
        {where.length === 0 && <Badge tone="danger">Fora do cardápio</Badge>}
        <span className="w-full text-xs font-medium text-muted sm:ml-auto sm:w-auto">
          {products} {products === 1 ? "item" : "itens"}
          {subsections > 0 && ` · ${subsections} ${subsections === 1 ? "subcategoria" : "subcategorias"}`}
          {where.length > 0 && ` · em ${where.join(", ")}`}
        </span>
      </summary>
      <div className="flex flex-col gap-5 border-t border-line px-5 py-5">
        <ActionForm action={saveSection} className="flex flex-col gap-5">
          <input type="hidden" name="sectionId" value={section.id} />
          <TextsFields entity={section} description />
          <Checkbox name="available" label="Mostrar no totem" defaultChecked={section.available !== false} />
          <ImageField current={imageOf(section.links)} images={catalogue.images} />
          <LinkRows
            name="links"
            legend="Itens e subcategorias, na ordem do totem"
            links={contents}
            nameOf={(l) => names.get(`${l.type}:${l.id}`) ?? l.id}
            choices={contentChoices(catalogue, section.id)}
            addLabel="Adicionar item ou subcategoria…"
            empty="Vazia: o totem não mostra categoria sem itens."
          />
          <HoursFields hours={section.availableHours ?? []} toggle legend="Horário da categoria" />
          <div>
            <SubmitButton>Salvar categoria</SubmitButton>
          </div>
        </ActionForm>
        <div className="border-t border-line pt-4">
          <DeleteButton kind="section" id={section.id} label="Apagar categoria" />
        </div>
      </div>
    </details>
  );
}
