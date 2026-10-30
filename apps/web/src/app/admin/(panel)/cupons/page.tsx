import { revalidatePath } from "next/cache";
import { Suspense } from "react";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import {
  Badge,
  Card,
  Checkbox,
  Field,
  inputClass,
  LoadError,
  PageHeader,
} from "@/components/admin/ui";
import { attempt, cents, checked, type FormState, load, text } from "@/lib/admin/form";
import { AdminApiError, asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";
import { formatBRL } from "@/lib/format/money";

type Discount = components["schemas"]["AdminDiscount"];
type DiscountInput = components["schemas"]["DiscountInput"];

const PATH = "/admin/cupons";
/** Validity dates are whole days in the restaurant's timezone (São Paulo has no DST). */
const DAY_OFFSET = "-03:00";

const startOfDay = (date: string) =>
  date ? new Date(`${date}T00:00:00${DAY_OFFSET}`).toISOString() : null;
/** "Até 31/12" means through that day: the window closes at the next midnight. */
const endOfDay = (date: string) =>
  date ? new Date(Date.parse(`${date}T00:00:00${DAY_OFFSET}`) + 86_400_000).toISOString() : null;
const dayOf = (iso: string | null | undefined, end = false) => {
  if (!iso) return "";
  const at = new Date(Date.parse(iso) - (end ? 86_400_000 : 0));
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(at);
};

const localized = (form: FormData, name: string) => {
  const pt = text(form, `${name}.pt`);
  const en = text(form, `${name}.en`);
  return pt ? { "pt-BR": pt, ...(en ? { en } : {}) } : undefined;
};

function readDiscount(form: FormData): DiscountInput {
  const kind = text(form, "kind") === "FIXED" ? "FIXED" : "PERCENT";
  const value =
    kind === "FIXED" ? cents(text(form, "value")) : Math.round(Number(text(form, "value")));
  if (!value || value < 1) throw new AdminApiError("VALIDATION_FAILED", "valor");
  return {
    type: text(form, "type") === "RESTAURANT_DISCOUNT" ? "RESTAURANT_DISCOUNT" : "COMANDA_COUPON",
    code: text(form, "code").toUpperCase().replace(/\s/g, ""),
    title: localized(form, "title") ?? { "pt-BR": "" },
    description: localized(form, "description"),
    kind,
    value,
    validFrom: startOfDay(text(form, "validFrom")),
    validTo: endOfDay(text(form, "validTo")),
    active: checked(form, "active"),
  };
}

async function saveDiscount(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const discountId = text(form, "discountId");
  return attempt(async () => {
    const body = readDiscount(form);
    if (discountId) {
      await asOwner((headers) =>
        coreApi().PUT("/v1/admin/discounts/{discountId}", {
          headers,
          params: { path: { discountId } },
          body,
        }),
      );
    } else {
      await asOwner((headers) => coreApi().POST("/v1/admin/discounts", { headers, body }));
    }
    revalidatePath(PATH);
    return discountId ? "Desconto salvo." : `Cupom ${body.code} criado. Já vale no totem.`;
  });
}

async function deleteDiscount(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const discountId = text(form, "discountId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().DELETE("/v1/admin/discounts/{discountId}", {
        headers,
        params: { path: { discountId } },
      }),
    );
    revalidatePath(PATH);
    return "Desconto apagado.";
  });
}

export default function DiscountsPage() {
  return (
    <>
      <PageHeader
        title="Cupons e descontos"
        description="Códigos que o cliente digita no totem. Vale um por pedido; o desconto é calculado pelo sistema."
      />
      <Suspense>
        <DiscountList />
      </Suspense>
    </>
  );
}

async function DiscountList() {
  const loaded = await load(() =>
    asOwner((headers) => coreApi().GET("/v1/admin/discounts", { headers })),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  return (
    <>
      {loaded.data.map((discount) => (
        <DiscountForm key={discount.id} discount={discount} />
      ))}
      <DiscountForm discount={null} />
    </>
  );
}

/** Rendered per request (the owner's data), so reading the clock here is fine. */
function isExpired(validTo: string | null | undefined): boolean {
  return !!validTo && Date.parse(validTo) < Date.now();
}

function summary(discount: Discount): string {
  return discount.kind === "PERCENT"
    ? `${discount.value}% de desconto`
    : `${formatBRL(discount.value)} de desconto`;
}

function DiscountForm({ discount }: { discount: Discount | null }) {
  const expired = isExpired(discount?.validTo);
  return (
    <Card className="flex flex-col gap-4">
      {discount ? (
        <div className="flex flex-wrap items-center gap-2">
          <code className="font-display text-xl font-semibold">{discount.code}</code>
          <span className="text-sm text-muted">{summary(discount)}</span>
          {!discount.active && <Badge tone="danger">Inativo</Badge>}
          {expired && <Badge tone="warn">Vencido</Badge>}
        </div>
      ) : (
        <h2 className="font-display text-xl font-semibold">Novo cupom</h2>
      )}
      <ActionForm action={saveDiscount} resetOnSave={!discount} className="flex flex-col gap-4">
        <input type="hidden" name="discountId" value={discount?.id ?? ""} />
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Código" hint="Letras e números, sem espaço.">
            <input
              name="code"
              defaultValue={discount?.code}
              required
              pattern="[A-Za-z0-9]{3,20}"
              placeholder="BEMVINDO10"
              autoCapitalize="characters"
              className={`${inputClass} uppercase`}
            />
          </Field>
          <Field label="Tipo">
            <select
              name="type"
              defaultValue={discount?.type ?? "COMANDA_COUPON"}
              className={inputClass}
            >
              <option value="COMANDA_COUPON">Cupom</option>
              <option value="RESTAURANT_DISCOUNT">Desconto da loja</option>
            </select>
          </Field>
          <Field label="Desconto em">
            <select name="kind" defaultValue={discount?.kind ?? "PERCENT"} className={inputClass}>
              <option value="PERCENT">% do pedido</option>
              <option value="FIXED">R$ fixo</option>
            </select>
          </Field>
          <Field label="Valor" hint="% inteiro (1 a 100) ou reais.">
            <input
              name="value"
              defaultValue={
                discount
                  ? discount.kind === "FIXED"
                    ? (discount.value / 100).toFixed(2).replace(".", ",")
                    : discount.value
                  : ""
              }
              required
              inputMode="decimal"
              placeholder="10"
              className={inputClass}
            />
          </Field>
          <Field label="Título (PT)" hint="Aparece no carrinho.">
            <input
              name="title.pt"
              defaultValue={discount?.title["pt-BR"]}
              required
              placeholder="10% na primeira compra"
              className={inputClass}
            />
          </Field>
          <Field label="Título (EN)">
            <input name="title.en" defaultValue={discount?.title.en} className={inputClass} />
          </Field>
          <Field label="Vale de">
            <input
              name="validFrom"
              type="date"
              defaultValue={dayOf(discount?.validFrom)}
              className={inputClass}
            />
          </Field>
          <Field label="Vale até">
            <input
              name="validTo"
              type="date"
              defaultValue={dayOf(discount?.validTo, true)}
              className={inputClass}
            />
          </Field>
        </div>
        <Checkbox name="active" label="Ativo" defaultChecked={discount?.active ?? true} />
        <div>
          <SubmitButton>{discount ? "Salvar desconto" : "Criar cupom"}</SubmitButton>
        </div>
      </ActionForm>
      {discount && (
        <ActionForm action={deleteDiscount} className="border-t border-line pt-3">
          <input type="hidden" name="discountId" value={discount.id} />
          <div>
            <SubmitButton variant="danger" pendingLabel="Apagando…">
              Apagar desconto
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}
