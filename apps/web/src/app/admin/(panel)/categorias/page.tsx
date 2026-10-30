import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { Card, Checkbox, Field, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import { attempt, cents, checked, type FormState, load, text } from "@/lib/admin/form";
import { AdminApiError, asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";
import { formatBRL } from "@/lib/format/money";

type Category = components["schemas"]["AdminCategory"];
type Item = components["schemas"]["AdminItem"];
type Link = components["schemas"]["CategoryItemLink"];

const PATH = "/admin/categorias";

const categoryName = (form: FormData) => {
  const en = text(form, "name.en");
  return { "pt-BR": text(form, "name.pt"), ...(en ? { en } : {}) };
};

async function createCategory(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().POST("/v1/admin/categories", {
        headers,
        body: {
          menuId: text(form, "menuId"),
          name: categoryName(form),
          displayOrder: Number(text(form, "displayOrder")) || 1,
        },
      }),
    );
    revalidatePath(PATH);
    return "Categoria criada.";
  });
}

/** The links a category form describes: kept rows plus the one being added. */
function readLinks(form: FormData): Link[] {
  const links: Link[] = form
    .getAll("linked")
    .map(String)
    .filter((itemId) => !checked(form, `${itemId}.remove`))
    .map((itemId) => {
      const override = text(form, `${itemId}.price`);
      const priceOverride = override ? cents(override) : null;
      if (override && priceOverride === null) throw new AdminApiError("VALIDATION_FAILED", "preço");
      return { itemId, displayOrder: Number(text(form, `${itemId}.order`)) || 0, priceOverride };
    });
  const added = text(form, "add.itemId");
  if (added) {
    const override = text(form, "add.price");
    links.push({
      itemId: added,
      displayOrder: Number(text(form, "add.order")) || links.length + 1,
      priceOverride: override ? cents(override) : null,
    });
  }
  return links;
}

async function saveCategory(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const categoryId = text(form, "categoryId");
  return attempt(async () => {
    const links = readLinks(form);
    await asOwner((headers) =>
      coreApi().PUT("/v1/admin/categories/{categoryId}", {
        headers,
        params: { path: { categoryId } },
        body: {
          menuId: text(form, "menuId"),
          name: categoryName(form),
          displayOrder: Number(text(form, "displayOrder")) || 1,
        },
      }),
    );
    await asOwner((headers) =>
      coreApi().PUT("/v1/admin/categories/{categoryId}/items", {
        headers,
        params: { path: { categoryId } },
        body: links,
      }),
    );
    revalidatePath(PATH);
    return "Categoria salva. O totem mostra na próxima jornada.";
  });
}

async function deleteCategory(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const categoryId = text(form, "categoryId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().DELETE("/v1/admin/categories/{categoryId}", {
        headers,
        params: { path: { categoryId } },
      }),
    );
    revalidatePath(PATH);
    return "Categoria apagada. Os itens continuam em Itens.";
  });
}

export default function CategoriesPage({ searchParams }: PageProps<"/admin/categorias">) {
  return (
    <>
      <PageHeader
        title="Categorias"
        description="As categorias de cada cardápio e os itens de cada uma, com o preço nesse cardápio."
      />
      <Suspense>
        <Categories searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Categories({
  searchParams,
}: {
  searchParams: PageProps<"/admin/categorias">["searchParams"];
}) {
  const { menu: wanted } = await searchParams;
  const loaded = await load(async () => {
    const [menus, items] = await Promise.all([
      asOwner((headers) => coreApi().GET("/v1/admin/menus", { headers })),
      asOwner((headers) => coreApi().GET("/v1/admin/items", { headers })),
    ]);
    const menu = menus.find((m) => m.id === wanted) ?? menus[0];
    const categories = menu
      ? await asOwner((headers) =>
          coreApi().GET("/v1/admin/categories", {
            headers,
            params: { query: { menuId: menu.id } },
          }),
        )
      : [];
    return { menus, items, menu, categories };
  });
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const { menus, items, menu, categories } = loaded.data;
  if (!menu) return <LoadError message="Crie um cardápio primeiro, em Cardápios." />;

  return (
    <>
      <nav className="flex flex-wrap gap-2" aria-label="Cardápio">
        {menus.map((m) => (
          <Link
            key={m.id}
            href={`${PATH}?menu=${m.id}`}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              m.id === menu.id ? "bg-accent text-on-accent" : "bg-surface text-ink"
            }`}
          >
            {m.name["pt-BR"]}
          </Link>
        ))}
      </nav>
      {categories.map((category) => (
        <CategoryCard
          key={category.id}
          category={category}
          items={items}
          links={categoryLinks(category)}
        />
      ))}
      <Card>
        <h2 className="mb-4 font-display text-xl font-semibold">
          Nova categoria em {menu.name["pt-BR"]}
        </h2>
        <ActionForm action={createCategory} resetOnSave className="grid gap-4 sm:grid-cols-4">
          <input type="hidden" name="menuId" value={menu.id} />
          <Field label="Nome (PT)">
            <input name="name.pt" required className={inputClass} />
          </Field>
          <Field label="Nome (EN)">
            <input name="name.en" className={inputClass} />
          </Field>
          <Field label="Ordem">
            <input
              name="displayOrder"
              type="number"
              defaultValue={categories.length + 1}
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

/**
 * The items of a category, with their price in its menu. OPEN QUESTION
 * (docs/backlog-pending.md, COM-28): the contract writes them
 * (replaceCategoryItems) but has no read. The mock sends them as an extra
 * `items` field on AdminCategory; the proposal is to add it to the contract.
 * Only this function knows where they come from.
 */
function categoryLinks(category: Category): Link[] {
  const items = (category as Category & { items?: unknown }).items;
  return Array.isArray(items) ? (items as Link[]) : [];
}

function CategoryCard({
  category,
  items,
  links,
}: {
  category: Category;
  items: Item[];
  links: Link[];
}) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const sorted = [...links].sort((a, b) => a.displayOrder - b.displayOrder);
  const free = items.filter((i) => !links.some((l) => l.itemId === i.id));
  return (
    <Card className="flex flex-col gap-4">
      <ActionForm action={saveCategory} className="flex flex-col gap-4">
        <input type="hidden" name="categoryId" value={category.id} />
        <input type="hidden" name="menuId" value={category.menuId} />
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
          <Field label="Categoria (PT)">
            <input
              name="name.pt"
              defaultValue={category.name["pt-BR"]}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Categoria (EN)">
            <input name="name.en" defaultValue={category.name.en} className={inputClass} />
          </Field>
          <Field label="Ordem">
            <input
              name="displayOrder"
              type="number"
              defaultValue={category.displayOrder}
              className={inputClass}
            />
          </Field>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-1 font-semibold">Item</th>
              <th className="w-20 font-semibold">Ordem</th>
              <th className="w-36 font-semibold">Preço aqui (R$)</th>
              <th className="w-16 font-semibold">Tirar</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((link) => {
              const item = byId.get(link.itemId);
              return (
                <tr key={link.itemId} className="border-t border-line">
                  <td className="py-2">
                    <input type="hidden" name="linked" value={link.itemId} />
                    <Link
                      href={`/admin/itens/${link.itemId}`}
                      className="font-semibold hover:underline"
                    >
                      {item?.name["pt-BR"] ?? link.itemId}
                    </Link>
                    {item && (
                      <span className="ml-2 text-xs text-muted">base {formatBRL(item.price)}</span>
                    )}
                  </td>
                  <td>
                    <input
                      name={`${link.itemId}.order`}
                      type="number"
                      defaultValue={link.displayOrder}
                      aria-label="Ordem"
                      className={`${inputClass} h-9`}
                    />
                  </td>
                  <td>
                    <input
                      name={`${link.itemId}.price`}
                      defaultValue={
                        link.priceOverride == null
                          ? ""
                          : (link.priceOverride / 100).toFixed(2).replace(".", ",")
                      }
                      placeholder="base"
                      inputMode="decimal"
                      aria-label="Preço neste cardápio"
                      className={`${inputClass} h-9`}
                    />
                  </td>
                  <td className="text-center">
                    <Checkbox name={`${link.itemId}.remove`} label="" />
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-line">
              <td className="py-2 pr-2">
                <select
                  name="add.itemId"
                  defaultValue=""
                  aria-label="Adicionar item"
                  className={`${inputClass} h-9`}
                >
                  <option value="">Adicionar item…</option>
                  {free.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name["pt-BR"]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  name="add.order"
                  type="number"
                  placeholder={String(links.length + 1)}
                  aria-label="Ordem"
                  className={`${inputClass} h-9`}
                />
              </td>
              <td>
                <input
                  name="add.price"
                  placeholder="base"
                  inputMode="decimal"
                  aria-label="Preço neste cardápio"
                  className={`${inputClass} h-9`}
                />
              </td>
              <td />
            </tr>
          </tbody>
        </table>
        <div>
          <SubmitButton>Salvar categoria</SubmitButton>
        </div>
      </ActionForm>
      <ActionForm action={deleteCategory} className="border-t border-line pt-3">
        <input type="hidden" name="categoryId" value={category.id} />
        <div>
          <SubmitButton variant="danger" pendingLabel="Apagando…">
            Apagar categoria
          </SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
