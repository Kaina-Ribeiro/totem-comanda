import { revalidatePath } from "next/cache";
import Image from "next/image";
import { Suspense } from "react";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { Card, Checkbox, Field, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import { attempt, checked, type FormState, load, orderTypesError, text } from "@/lib/admin/form";
import { uploadImage } from "@/lib/admin/media";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

type Language = components["schemas"]["LanguageCode"];

async function saveRestaurant(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  // Both off leaves the kiosk with nothing to sell (dashboard BR-041). Go should refuse it too.
  const orderTypes = orderTypesError(checked(form, "dineIn"), checked(form, "takeOut"));
  if (orderTypes) return { error: orderTypes };
  return attempt(async () => {
    const current = await asOwner((headers) => coreApi().GET("/v1/admin/restaurant", { headers }));
    const logo =
      (await uploadImage(form, "logo")) ?? (checked(form, "removeLogo") ? null : current.logo);
    const supportedLanguages: Language[] = checked(form, "english") ? ["pt-BR", "en"] : ["pt-BR"];
    const defaultLanguage =
      text(form, "defaultLanguage") === "en" && supportedLanguages.includes("en") ? "en" : "pt-BR";
    const localized = (name: string) => {
      const en = text(form, `${name}.en`);
      return { "pt-BR": text(form, `${name}.pt`), ...(en ? { en } : {}) };
    };
    await asOwner((headers) =>
      coreApi().PUT("/v1/admin/restaurant", {
        headers,
        body: {
          name: text(form, "name"),
          logo,
          cnpj: text(form, "cnpj").replace(/\D/g, ""),
          timezone: text(form, "timezone") || current.timezone,
          defaultLanguage,
          supportedLanguages,
          isDineInAvailable: checked(form, "dineIn"),
          isTakeOutAvailable: checked(form, "takeOut"),
          closedMessage: { title: localized("closedTitle"), description: localized("closedBody") },
          posCheckNumberDisplayLength: Number(text(form, "digits")),
          receiptFooter: localized("footer"),
        },
      }),
    );
    // React resets the form after the action: re-render it with what was saved.
    revalidatePath("/admin", "layout");
    return "Configurações salvas. O totem atualiza em até 45 s.";
  });
}

/** Minutes per pace level (decision 4): what the success screen says about the wait. */
async function saveWaitMinutes(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const minutes = (name: string) => Number(text(form, name));
  const NORMAL = minutes("waitNormal");
  const BUSY = minutes("waitBusy");
  const valid = (n: number) => Number.isInteger(n) && n >= 1 && n <= 120;
  if (!valid(NORMAL) || !valid(BUSY)) return { error: "Use minutos inteiros de 1 a 120." };
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().PUT("/v1/admin/pace/wait-minutes", { headers, body: { NORMAL, BUSY } }),
    );
    // The form resets after the action: re-render it (and Início's hints) with the saved minutes.
    revalidatePath("/admin", "layout");
    return "Tempo de espera salvo.";
  });
}

export default function StorePage() {
  return (
    <>
      <PageHeader
        title="Loja"
        description="Nome, logo, idiomas e o que o totem mostra quando está fechado."
      />
      <Suspense>
        <StoreForm />
      </Suspense>
      <Suspense>
        <WaitTimesForm />
      </Suspense>
    </>
  );
}

/** "Tempo de espera" per pace level; the kitchen and Início pick the level. */
async function WaitTimesForm() {
  const loaded = await load(() => asOwner((headers) => coreApi().GET("/v1/admin/pace", { headers })));
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const { waitMinutes } = loaded.data;
  return (
    <ActionForm action={saveWaitMinutes} className="flex flex-col gap-4">
      <Card className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <h2 className="text-lg font-bold tracking-[-0.01em]">Tempo de espera</h2>
          <p className="text-sm text-muted">
            O que a tela de sucesso do totem diz ao cliente. A cozinha escolhe o ritmo; no
            Pausado, o totem não vende.
          </p>
        </div>
        <Field label="Normal (minutos)">
          <input
            name="waitNormal"
            type="number"
            min={1}
            max={120}
            required
            defaultValue={waitMinutes.NORMAL}
            className={inputClass}
          />
        </Field>
        <Field label="Movimentado (minutos)">
          <input
            name="waitBusy"
            type="number"
            min={1}
            max={120}
            required
            defaultValue={waitMinutes.BUSY}
            className={inputClass}
          />
        </Field>
      </Card>
      <div>
        <SubmitButton>Salvar tempo de espera</SubmitButton>
      </div>
    </ActionForm>
  );
}

async function StoreForm() {
  const loaded = await load(() =>
    asOwner((headers) => coreApi().GET("/v1/admin/restaurant", { headers })),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const restaurant = loaded.data;
  const r = restaurant;
  return (
    <ActionForm action={saveRestaurant} className="flex flex-col gap-6">
      <Card className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome da loja">
          <input name="name" defaultValue={r.name} required className={inputClass} />
        </Field>
        <Field label="CNPJ" hint="Só números, 14 dígitos.">
          <input
            name="cnpj"
            defaultValue={r.cnpj}
            required
            inputMode="numeric"
            pattern="\d{14}"
            className={inputClass}
          />
        </Field>
        <Field label="Logo" hint="PNG ou JPEG até 5 MB. Sem logo, o totem mostra o nome.">
          <div className="flex items-center gap-3">
            {r.logo && (
              <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-ground">
                <Image src={r.logo} alt="" fill sizes="48px" className="object-contain" />
              </span>
            )}
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm"
            />
          </div>
          {r.logo && <Checkbox name="removeLogo" label="Tirar o logo" />}
        </Field>
        <Field label="Fuso horário">
          <input name="timezone" defaultValue={r.timezone} className={inputClass} />
        </Field>
      </Card>

      <Card className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-muted">Como o cliente pode pedir</span>
          <Checkbox name="dineIn" label="Comer aqui" defaultChecked={r.isDineInAvailable} />
          <Checkbox name="takeOut" label="Para viagem" defaultChecked={r.isTakeOutAvailable} />
          <span className="text-xs text-muted">Pelo menos um fica ligado.</span>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-muted">Idiomas do totem</span>
          <Checkbox
            name="english"
            label="Oferecer inglês"
            defaultChecked={r.supportedLanguages.includes("en")}
          />
          <Field label="Idioma padrão">
            <select name="defaultLanguage" defaultValue={r.defaultLanguage} className={inputClass}>
              <option value="pt-BR">Português</option>
              <option value="en">English</option>
            </select>
          </Field>
        </div>
        <Field
          label="Dígitos do número do pedido"
          hint="De 1 a 6. Com 2, o pedido 142 aparece como 42."
        >
          <input
            name="digits"
            type="number"
            min={1}
            max={6}
            defaultValue={r.posCheckNumberDisplayLength}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="grid gap-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold tracking-[-0.01em] sm:col-span-2">Mensagem de fechado</h2>
        <Field label="Título (PT)">
          <input
            name="closedTitle.pt"
            defaultValue={r.closedMessage.title["pt-BR"]}
            required
            className={inputClass}
          />
        </Field>
        <Field label="Título (EN)">
          <input
            name="closedTitle.en"
            defaultValue={r.closedMessage.title.en}
            className={inputClass}
          />
        </Field>
        <Field label="Texto (PT)">
          <textarea
            name="closedBody.pt"
            defaultValue={r.closedMessage.description["pt-BR"]}
            required
            rows={2}
            className={`${inputClass} h-auto py-2`}
          />
        </Field>
        <Field label="Texto (EN)">
          <textarea
            name="closedBody.en"
            defaultValue={r.closedMessage.description.en}
            rows={2}
            className={`${inputClass} h-auto py-2`}
          />
        </Field>
      </Card>

      <Card className="grid gap-5 sm:grid-cols-2">
        <h2 className="text-lg font-bold tracking-[-0.01em] sm:col-span-2">Rodapé do comprovante</h2>
        <Field label="Rodapé (PT)" hint="Sai impresso a partir da fase 4.">
          <input
            name="footer.pt"
            defaultValue={r.receiptFooter?.["pt-BR"]}
            className={inputClass}
          />
        </Field>
        <Field label="Rodapé (EN)">
          <input name="footer.en" defaultValue={r.receiptFooter?.en} className={inputClass} />
        </Field>
      </Card>

      <div>
        <SubmitButton>Salvar configurações</SubmitButton>
      </div>
    </ActionForm>
  );
}
