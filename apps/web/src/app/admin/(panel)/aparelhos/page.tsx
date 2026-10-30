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
import { attempt, checked, type FormState, load, text } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import type { components } from "@/lib/core-api";

type Device = components["schemas"]["AdminDevice"];
type DeviceInput = components["schemas"]["DeviceInput"];

const PATH = "/admin/aparelhos";

function deviceInput(form: FormData): DeviceInput {
  const seconds = Number(text(form, "idleSeconds"));
  return {
    name: text(form, "name"),
    kind: text(form, "kind") === "KITCHEN" ? "KITCHEN" : "KIOSK",
    status: checked(form, "active") ? "ACTIVE" : "DISABLED",
    idleTimerIntervalMilliseconds: Number.isFinite(seconds)
      ? Math.max(0, Math.round(seconds * 1000))
      : 0,
    // Phase 4: no printer yet.
    printerEnabled: false,
    maintenanceMode: checked(form, "maintenance"),
    atCapacityMode: checked(form, "atCapacity"),
  };
}

async function createDevice(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  return attempt(async () => {
    const created = await asOwner((headers) =>
      coreApi().POST("/v1/admin/devices", {
        headers,
        body: { ...deviceInput(form), status: "ACTIVE" },
      }),
    );
    revalidatePath(PATH);
    return {
      saved: `Aparelho ${created.device.id} cadastrado. Use o ID e o código no /setup do aparelho.`,
      reveal: { label: "Código secreto (aparece só agora)", value: created.deviceSecret },
    };
  });
}

async function saveDevice(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const deviceId = text(form, "deviceId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().PUT("/v1/admin/devices/{deviceId}", {
        headers,
        params: { path: { deviceId } },
        body: deviceInput(form),
      }),
    );
    revalidatePath(PATH);
    return "Salvo. O aparelho segue a mudança na próxima conferida (até 45 s).";
  });
}

async function rotateSecret(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const deviceId = text(form, "deviceId");
  return attempt(async () => {
    const rotated = await asOwner((headers) =>
      coreApi().POST("/v1/admin/devices/{deviceId}/secret", {
        headers,
        params: { path: { deviceId } },
      }),
    );
    return {
      saved: "O código antigo parou de valer. Configure o aparelho de novo no /setup.",
      reveal: { label: "Novo código secreto (aparece só agora)", value: rotated.deviceSecret },
    };
  });
}

export default function DevicesPage() {
  return (
    <>
      <PageHeader
        title="Aparelhos"
        description="Totens e telas da cozinha: quem está online, manutenção, lotado e acesso."
      />
      <Suspense>
        <DeviceList />
      </Suspense>
      <Card>
        <h2 className="mb-4 font-display text-xl font-semibold">Cadastrar aparelho</h2>
        <ActionForm action={createDevice} resetOnSave className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome">
            <input name="name" required placeholder="Totem do balcão" className={inputClass} />
          </Field>
          <Field label="Tipo">
            <select name="kind" className={inputClass}>
              <option value="KIOSK">Totem</option>
              <option value="KITCHEN">Cozinha</option>
            </select>
          </Field>
          <Field label="Aviso de inatividade (s)" hint="0 desliga.">
            <input
              name="idleSeconds"
              type="number"
              min={0}
              defaultValue={20}
              className={inputClass}
            />
          </Field>
          <div className="sm:col-span-3">
            <SubmitButton pendingLabel="Cadastrando…">Cadastrar</SubmitButton>
          </div>
        </ActionForm>
      </Card>
    </>
  );
}

async function DeviceList() {
  const loaded = await load(() =>
    asOwner((headers) => coreApi().GET("/v1/admin/devices", { headers })),
  );
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const devices = loaded.data;
  return (
    <div className="flex flex-col gap-4">
      {devices.map((device) => (
        <DeviceCard key={device.id} device={device} />
      ))}
    </div>
  );
}

const lastSeenFormat = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function lastSeen(at: string | null): string {
  if (!at) return "nunca conectou";
  const minutes = Math.round((Date.parse(at) - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return `visto ${lastSeenFormat.format(minutes, "minute")}`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return `visto ${lastSeenFormat.format(hours, "hour")}`;
  return `visto ${lastSeenFormat.format(Math.round(hours / 24), "day")}`;
}

function DeviceCard({ device }: { device: Device }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl font-semibold">{device.name}</h2>
        <code className="text-xs text-muted">{device.id}</code>
        <Badge>{device.kind === "KIOSK" ? "Totem" : "Cozinha"}</Badge>
        {device.status === "DISABLED" ? (
          <Badge tone="danger">Desativado</Badge>
        ) : device.online ? (
          <Badge tone="ok">Online</Badge>
        ) : (
          <Badge tone="warn">Offline</Badge>
        )}
        {device.maintenanceMode && <Badge tone="warn">Manutenção</Badge>}
        {device.atCapacityMode && <Badge tone="warn">Lotado</Badge>}
      </div>
      <p className="text-xs text-muted">
        {lastSeen(device.lastSeenAt)}
        {device.appVersion && ` · versão ${device.appVersion}`}
        {device.ip && ` · IP ${device.ip}`}
        {device.screenResolution && ` · tela ${device.screenResolution}`}
      </p>
      <ActionForm action={saveDevice} className="grid gap-4 sm:grid-cols-3">
        <input type="hidden" name="deviceId" value={device.id} />
        <input type="hidden" name="kind" value={device.kind} />
        <Field label="Nome">
          <input name="name" defaultValue={device.name} required className={inputClass} />
        </Field>
        <Field label="Aviso de inatividade (s)" hint="0 desliga.">
          <input
            name="idleSeconds"
            type="number"
            min={0}
            defaultValue={device.idleTimerIntervalMilliseconds / 1000}
            className={inputClass}
          />
        </Field>
        <div className="flex flex-col justify-center gap-2">
          <Checkbox name="active" label="Ativo" defaultChecked={device.status === "ACTIVE"} />
          <Checkbox
            name="maintenance"
            label="Em manutenção"
            defaultChecked={device.maintenanceMode}
          />
          {device.kind === "KIOSK" && (
            <Checkbox
              name="atCapacity"
              label="Cozinha lotada"
              defaultChecked={device.atCapacityMode}
            />
          )}
        </div>
        <div className="sm:col-span-3">
          <SubmitButton>Salvar</SubmitButton>
        </div>
      </ActionForm>
      <ActionForm action={rotateSecret} className="flex flex-col gap-2 border-t border-line pt-4">
        <input type="hidden" name="deviceId" value={device.id} />
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trocando…">
            Trocar código secreto
          </SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}
