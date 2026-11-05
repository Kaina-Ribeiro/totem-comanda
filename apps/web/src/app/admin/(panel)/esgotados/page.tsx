import Image from "next/image";
import { revalidatePath } from "next/cache";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { SoldOutSkeleton, Streamed } from "@/components/admin/skeleton";
import { LoadError, PageHeader } from "@/components/admin/ui";
import { attempt, type FormState, load, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

type Item = components["schemas"]["AdminItem"];

const PATH = "/admin/esgotados";

async function toggleSoldOut(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const itemId = text(form, "itemId");
  const soldOut = text(form, "intent") === "soldOut";
  return attempt(async () => {
    await asOwner((headers) =>
      soldOut
        ? coreApi().POST("/v1/admin/items/{itemId}/sold-out", {
            headers,
            params: { path: { itemId } },
          })
        : coreApi().DELETE("/v1/admin/items/{itemId}/sold-out", {
            headers,
            params: { path: { itemId } },
          }),
    );
    revalidatePath(PATH);
    return soldOut ? "Saiu do totem até o fim do dia." : "Voltou para o totem.";
  });
}

/** Today's business date in the restaurant's timezone (`soldOutDate` is one). */
function businessToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export default function SoldOutPage() {
  return (
    <>
      <PageHeader
        title="Esgotados"
        description="Acabou? Um toque tira o item do totem até o fim do dia. Amanhã ele volta sozinho."
      />
      <Streamed fallback={<SoldOutSkeleton />}>
        <SoldOutList />
      </Streamed>
    </>
  );
}

async function SoldOutList() {
  const loaded = await load(() =>
    Promise.all([
      asOwner((headers) => coreApi().GET("/v1/admin/items", { headers })),
      asOwner((headers) => coreApi().GET("/v1/admin/restaurant", { headers })),
    ]),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const [items, restaurant] = loaded.data;
  const today = businessToday(restaurant.timezone);
  const isOut = (item: Item) => item.soldOutDate !== null && item.soldOutDate >= today;
  // Sold-out items first, so "voltou" is one tap away.
  const sorted = [...items].sort(
    (a, b) =>
      Number(isOut(b)) - Number(isOut(a)) ||
      a.name["pt-BR"].localeCompare(b.name["pt-BR"], "pt-BR"),
  );
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((item) => {
        const out = isOut(item);
        return (
          <li
            key={item.id}
            className={`flex items-center gap-3 rounded-[14px] border p-3 ${
              out ? "border-danger/30 bg-danger/5" : "border-line bg-surface"
            }`}
          >
            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-wheat">
              {item.image && (
                <Image src={item.image} alt="" fill sizes="48px" className="object-cover" />
              )}
            </span>
            <span className="flex flex-1 flex-col">
              <span className={`font-semibold ${out ? "text-muted line-through" : ""}`}>
                {item.name["pt-BR"]}
              </span>
              {out && <span className="text-xs font-bold text-danger">Esgotado hoje</span>}
            </span>
            <ActionForm action={toggleSoldOut} className="flex flex-col items-end gap-1 text-right">
              <input type="hidden" name="itemId" value={item.id} />
              <SubmitButton
                name="intent"
                value={out ? "back" : "soldOut"}
                variant={out ? "primary" : "danger"}
                pendingLabel="…"
              >
                {out ? "Voltou" : "Esgotou"}
              </SubmitButton>
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}
