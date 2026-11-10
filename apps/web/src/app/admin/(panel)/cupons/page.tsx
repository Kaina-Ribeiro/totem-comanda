import { refreshAdmin } from "@/app/admin/(panel)/catalogue-actions";
import { DeleteButton, TextsFields } from "@/components/admin/catalogue-fields";
import { ActionForm, SubmitButton } from "@/components/admin/form";
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import { Badge, Card, Checkbox, Field, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import { type DiscountRule, readDiscountRule } from "@/lib/admin/catalogue-form";
import { attempt, type FormState, load, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApiV2 } from "@/lib/core/client-v2";
import { formatMoney } from "@/lib/format/money";

const reais = (value: number | null | undefined) => (value == null ? "" : value.toFixed(2).replace(".", ","));

async function saveCoupon(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const ruleId = text(form, "ruleId");
  return attempt(async () => {
    const rules = await asOwner((headers) => coreApiV2().GET("/v2/admin/discount-rules", { headers }));
    const current = ruleId ? (rules.find((r) => r.id === ruleId) ?? null) : null;
    const body = readDiscountRule(form, current);
    await asOwner((headers) =>
      coreApiV2().PUT("/v2/admin/discount-rules/{discountRuleId}", {
        headers,
        params: { path: { discountRuleId: body.id } },
        body,
      }),
    );
    await refreshAdmin();
    return current ? "Cupom salvo." : `Cupom ${body.code} criado.`;
  });
}

/** "10% (até R$ 15,00)" or "R$ 5,00", for the list. */
function describe(rule: DiscountRule): string {
  const value = rule.type === "PERCENT" ? `${rule.value}%` : formatMoney(rule.value);
  const parts = [
    rule.maxDiscount != null && rule.type === "PERCENT" ? `até ${formatMoney(rule.maxDiscount)}` : null,
    rule.minOrderTotal != null ? `pedido a partir de ${formatMoney(rule.minOrderTotal)}` : null,
  ].filter(Boolean);
  return parts.length ? `${value} · ${parts.join(" · ")}` : value;
}

export default function CouponsPage() {
  return (
    <>
      <PageHeader
        title="Cupons"
        description="O cliente digita o código no totem; vale um cupom por pedido. O desconto é calculado pelo servidor, item por item."
      />
      <Streamed fallback={<FormSkeleton cards={2} />}>
        <CouponList />
      </Streamed>
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold tracking-[-0.01em]">Novo cupom</h2>
        <CouponForm rule={null} />
      </Card>
    </>
  );
}

async function CouponList() {
  const loaded = await load(() => asOwner((headers) => coreApiV2().GET("/v2/admin/discount-rules", { headers })));
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const rules = [...loaded.data].sort((a, b) => a.code.localeCompare(b.code));
  return (
    <div className="flex flex-col gap-3">
      {rules.map((rule) => {
        const usedUp = rule.maxUses != null && (rule.usesCount ?? 0) >= rule.maxUses;
        return (
          <details key={rule.id} className="rounded-[14px] border border-line bg-surface">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="font-mono text-lg font-bold tracking-wide">{rule.code}</span>
              {!rule.active && <Badge tone="muted">Desligado</Badge>}
              {usedUp && <Badge tone="danger">Esgotado</Badge>}
              <span className="w-full text-sm font-medium text-muted sm:ml-auto sm:w-auto">
                {describe(rule)} · {rule.usesCount ?? 0}
                {rule.maxUses != null ? ` de ${rule.maxUses}` : ""} usos
              </span>
            </summary>
            <div className="flex flex-col gap-4 border-t border-line px-5 py-5">
              <CouponForm rule={rule} />
              <DeleteButton kind="coupon" id={rule.id} label="Apagar cupom" />
            </div>
          </details>
        );
      })}
    </div>
  );
}

function CouponForm({ rule }: { rule: DiscountRule | null }) {
  return (
    <ActionForm action={saveCoupon} resetOnSave={!rule} className="flex flex-col gap-4">
      <input type="hidden" name="ruleId" value={rule?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Código" hint="3 a 20 letras ou números.">
          <input
            name="code"
            defaultValue={rule?.code}
            required
            placeholder="BEMVINDO10"
            autoCapitalize="characters"
            className={`${inputClass} font-mono uppercase`}
          />
        </Field>
        <Field label="Tipo">
          <select name="type" defaultValue={rule?.type ?? "PERCENT"} className={inputClass}>
            <option value="PERCENT">Porcentagem</option>
            <option value="FIXED">Valor fixo (R$)</option>
          </select>
        </Field>
        <Field label="Desconto" hint="10 = 10%; ou 5,00 = R$ 5,00.">
          <input
            name="value"
            defaultValue={rule ? (rule.type === "PERCENT" ? String(rule.value) : reais(rule.value)) : ""}
            required
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Pedido mínimo (R$)" hint="Vazio = qualquer valor.">
          <input name="minOrderTotal" defaultValue={reais(rule?.minOrderTotal)} inputMode="decimal" className={inputClass} />
        </Field>
        <Field label="Desconto máximo (R$)" hint="Vazio = sem teto.">
          <input name="maxDiscount" defaultValue={reais(rule?.maxDiscount)} inputMode="decimal" className={inputClass} />
        </Field>
        <Field label="Limite de usos" hint="Vazio = sem limite.">
          <input name="maxUses" defaultValue={rule?.maxUses ?? ""} inputMode="numeric" className={inputClass} />
        </Field>
      </div>
      <TextsFields entity={rule} namePlaceholder="10% de boas-vindas" />
      <Checkbox name="active" label="Ligado" defaultChecked={rule?.active ?? true} />
      <div>
        <SubmitButton>{rule ? "Salvar cupom" : "Criar cupom"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
