import { revalidatePath } from "next/cache";
import Image from "next/image";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { FormSkeleton, Streamed } from "@/components/admin/skeleton";
import {
  Card,
  Checkbox,
  Field,
  inputClass,
  LoadError,
  PageHeader,
} from "@/components/admin/ui";
import { attempt, checked, type FormState, load, text } from "@/lib/admin/form";
import { uploadImage } from "@/lib/admin/media";
import { asOwner } from "@/lib/admin/session";
import { coreApiV2 } from "@/lib/core/client-v2";
import type { components } from "@/lib/core-api-v2";

type Language = components["schemas"]["LanguageCode"];
type Store = components["schemas"]["StoreConfigurationResponse"];

const CUTOFF = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Store settings (SPEC 6): name, logo, languages, closed message, invoice
 * notice, timezone and business-day cutoff. Dine-in only, so no order-type
 * toggles. Fields of the store this form does not show are sent back as read.
 */
async function saveStore(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const cutoff = text(form, "cutoff");
  if (!CUTOFF.test(cutoff)) return { error: "Use a hora no formato 04:00." };
  if (!text(form, "invoice.pt")) return { error: "Escreva o aviso de nota fiscal em português." };
  return attempt(async () => {
    const current = await asOwner((headers) => coreApiV2().GET("/v2/admin/store", { headers }));
    const logo =
      (await uploadImage(form, "logo")) ?? (checked(form, "removeLogo") ? null : (current.logo ?? null));
    const languages: Language[] = checked(form, "english") ? ["pt-BR", "en"] : ["pt-BR"];
    const defaultLanguage =
      text(form, "defaultLanguage") === "en" && languages.includes("en") ? "en" : "pt-BR";
    const localized = (name: string) => {
      const en = text(form, `${name}.en`);
      return { "pt-BR": text(form, `${name}.pt`), ...(en ? { en } : {}) };
    };
    // Pace and wait minutes are read only here (they have their own endpoints).
    const { pace: _pace, waitMinutes: _wait, ...kept } = current;
    const body: Store = {
      ...kept,
      locationName: text(form, "name"),
      logo,
      languages,
      defaultLanguage,
      timezone: text(form, "timezone") || current.timezone,
      businessDayCutoff: cutoff,
      closedMessage: { title: localized("closedTitle"), description: localized("closedBody") },
      invoiceNotice: localized("invoice"),
    };
    await asOwner((headers) => coreApiV2().PUT("/v2/admin/store", { headers, body }));
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
      coreApiV2().PUT("/v2/admin/pace/wait-minutes", { headers, body: { NORMAL, BUSY } }),
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
        description="Nome, logo, idiomas, o dia de funcionamento e os avisos do totem."
      />
      <Streamed fallback={<FormSkeleton cards={1} />}>
        <StoreForm />
      </Streamed>
      <Streamed fallback={<FormSkeleton cards={1} fields={3} />}>
        <WaitTimesForm />
      </Streamed>
    </>
  );
}

/** "Tempo de espera" per pace level; the kitchen and Início pick the level. */
async function WaitTimesForm() {
  const loaded = await load(() => asOwner((headers) => coreApiV2().GET("/v2/admin/pace", { headers })));
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
    asOwner((headers) => coreApiV2().GET("/v2/admin/store", { headers })),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const r = loaded.data;
  return (
    <ActionForm action={saveStore} className="flex flex-col gap-6">
      <Card className="grid gap-5 sm:grid-cols-2">
        <Field label="Nome da loja">
          <input name="name" defaultValue={r.locationName} required className={inputClass} />
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
              className="min-w-0 text-sm"
            />
          </div>
          {r.logo && <Checkbox name="removeLogo" label="Tirar o logo" />}
        </Field>
        <Field label="Fuso horário">
          <input name="timezone" defaultValue={r.timezone} className={inputClass} />
        </Field>
        <Field
          label="O dia começa às"
          hint="Antes dessa hora, o pedido conta no dia anterior: número e relatório."
        >
          <input
            name="cutoff"
            type="time"
            required
            defaultValue={r.businessDayCutoff}
            className={inputClass}
          />
        </Field>
      </Card>

      <Card className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-muted">Idiomas do totem</span>
          <Checkbox
            name="english"
            label="Oferecer inglês"
            defaultChecked={r.languages.includes("en")}
          />
        </div>
        <Field label="Idioma padrão">
          <select name="defaultLanguage" defaultValue={r.defaultLanguage} className={inputClass}>
            <option value="pt-BR">Português</option>
            <option value="en">English</option>
          </select>
        </Field>
      </Card>

      <Card className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <h2 className="text-lg font-bold tracking-[-0.01em]">Aviso de nota fiscal</h2>
          <p className="text-sm text-muted">
            Aparece na tela do número do pedido. O totem não emite nota fiscal no piloto.
          </p>
        </div>
        <Field label="Aviso (PT)">
          <textarea
            name="invoice.pt"
            defaultValue={r.invoiceNotice["pt-BR"]}
            required
            rows={2}
            className={`${inputClass} h-auto py-2`}
          />
        </Field>
        <Field label="Aviso (EN)">
          <textarea
            name="invoice.en"
            defaultValue={r.invoiceNotice.en}
            rows={2}
            className={`${inputClass} h-auto py-2`}
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

      <div>
        <SubmitButton>Salvar configurações</SubmitButton>
      </div>
    </ActionForm>
  );
}
