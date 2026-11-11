import Link from "next/link";
import { revalidatePath } from "next/cache";
import { connection } from "next/server";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { PaceSwitch } from "@/components/admin/pace-switch";
import { HomeSkeleton, Streamed } from "@/components/admin/skeleton";
import { LoadError } from "@/components/admin/ui";
import { attempt, type FormState, load, text } from "@/lib/admin/form";
import {
  businessDate,
  dayIsOver,
  greeting,
  kioskState,
  localNow,
  signalLabel,
  totalVersusLastWeek,
  unavailable,
  versusLastWeek,
  weekBefore,
  whenLabel,
} from "@/lib/admin/home";
import { asOwner } from "@/lib/admin/session";
import { loadStoreStatus, type StoreStatus } from "@/lib/admin/store-status";
import type { AdminItem } from "@/lib/admin/catalogue-form";
import { coreApi } from "@/lib/core/client";
import { formatMoney } from "@/lib/format/money";

/** "Ligar" on the home's off-items card: the same switch as Disponibilidade (SPEC 6). */
async function turnOn(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const itemId = text(form, "itemId");
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().PUT("/v2/admin/items/{itemId}/availability", {
        headers,
        params: { path: { itemId } },
        body: { available: true },
      }),
    );
    revalidatePath("/admin");
    return "Voltou para o totem.";
  });
}

/** "Ritmo da cozinha" on the band: the store pace (decision 3); Pausar is 15 min. */
async function setPace(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const pace = text(form, "pace");
  if (pace !== "NORMAL" && pace !== "BUSY" && pace !== "PAUSED") {
    return { error: "Escolha um ritmo." };
  }
  return attempt(async () => {
    await asOwner((headers) =>
      coreApi().PUT("/v2/admin/pace", {
        headers,
        body: pace === "PAUSED" ? { pace, pauseMinutes: 15 } : { pace },
      }),
    );
    revalidatePath("/admin");
    return pace === "PAUSED" ? "Totem pausado por 15 min." : "Ritmo salvo.";
  });
}

/** Início (plan G-A1, prototypes A1 and A10): how the day is going, at a glance. */
export default function AdminHomePage() {
  return (
    <Streamed fallback={<HomeSkeleton />}>
      <Home />
    </Streamed>
  );
}

async function Home() {
  // The home is about now: render it per request.
  await connection();
  const now = new Date();
  const loaded = await load(async () => {
    const store = await asOwner((headers) => coreApi().GET("/v2/admin/store", { headers }));
    // Today's report is the business day's (cutoff 04:00): at 01:30 it is still yesterday's.
    const today = businessDate(now, store.timezone, store.businessDayCutoff);
    const report = (date: string) =>
      asOwner((headers) =>
        coreApi().GET("/v2/admin/reports/daily", { headers, params: { query: { date } } }),
      );
    const devices = await asOwner((headers) => coreApi().GET("/v2/admin/devices", { headers }));
    const [status, todayReport, lastWeek, items] = await Promise.all([
      loadStoreStatus(now, { store, devices }),
      report(today),
      report(weekBefore(today)),
      asOwner((headers) => coreApi().GET("/v2/admin/items", { headers })),
    ]);
    return { store, status, todayReport, lastWeek, devices, items };
  });
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const { store, status, todayReport, lastWeek, devices, items } = loaded.data;
  const clock = localNow(now, store.timezone);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: store.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat("pt-BR", {
    timeZone: store.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const final = dayIsOver(status);
  const off = unavailable(items);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl leading-[1.15] font-bold tracking-[-0.02em] min-[821px]:text-[28px]">
            {greeting(clock.hour)}
          </h1>
          <p className="text-sm font-medium text-muted">
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}. Atualizado às {timeLabel}
          </p>
        </div>
        <Link href="/admin/relatorio" className={BUTTON}>
          Ver relatório do dia
        </Link>
      </header>

      <StatusBand status={status} />

      <section
        aria-label="Hoje"
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-px overflow-hidden rounded-[14px] border border-line bg-line"
      >
        <Kpi
          label="Faturamento hoje"
          value={formatMoney(todayReport.revenue)}
          delta={totalVersusLastWeek(
            todayReport.revenue,
            lastWeek.revenue,
            clock.day,
            final,
            formatMoney,
          )}
        />
        <Kpi
          label="Pedidos"
          value={String(todayReport.ordersCount)}
          delta={totalVersusLastWeek(
            todayReport.ordersCount,
            lastWeek.ordersCount,
            clock.day,
            final,
            (count) => `${count} ${count === 1 ? "pedido" : "pedidos"}`,
          )}
        />
        {/* A ratio, so a partial day compares fairly with a whole one. */}
        <Kpi
          label="Ticket médio"
          value={formatMoney(todayReport.averageTicket)}
          delta={versusLastWeek(todayReport.averageTicket, lastWeek.averageTicket, clock.day)}
        />
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-3.5">
        <section aria-labelledby="devices" className={CARD}>
          <div className={CARD_HEAD}>
            <h2 id="devices" className={H2}>
              Aparelhos agora
            </h2>
            <Link href="/admin/aparelhos" className={LINK}>
              Ver aparelhos
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {devices.length === 0 && (
              <li className="py-2 text-sm text-muted">Nenhum aparelho cadastrado.</li>
            )}
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex min-h-[42px] items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2.5 font-bold">
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      device.status === "DISABLED"
                        ? "bg-muted"
                        : device.online
                          ? "bg-leaf"
                          : "bg-danger"
                    }`}
                  />
                  <span className="truncate">{device.name}</span>
                </span>
                <span className="shrink-0 text-right font-medium text-muted">
                  {device.status === "DISABLED"
                    ? "desativado"
                    : device.maintenanceMode
                      ? "em manutenção"
                      : signalLabel(device.online, device.lastSeenAt, now, store.timezone)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="soldout" className={CARD}>
          <div className={CARD_HEAD}>
            <h2 id="soldout" className={H2}>
              Indisponíveis agora
            </h2>
            <Link href="/admin/disponibilidade?filtro=indisponiveis" className={LINK}>
              Ver todos
            </Link>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {off.length === 0 && (
              <li className="py-2 text-sm text-muted">Nada desligado. Tudo à venda no totem.</li>
            )}
            {off.map((item) => (
              <OffRow key={item.id} item={item} />
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

const CARD = "flex flex-col gap-2.5 rounded-[14px] border border-line bg-surface px-5 py-[18px]";
const CARD_HEAD = "flex min-h-7 items-center justify-between gap-3";
const H2 = "text-base font-bold tracking-[-0.01em]";
const LINK =
  "text-[13.5px] font-bold whitespace-nowrap text-detail-text transition-colors hover:text-accent";
const BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-sm font-bold whitespace-nowrap transition-[transform,background-color] hover:bg-hover active:scale-[.98]";

/** The dark band (A1): is the kiosk selling, which menu, until when, and the kitchen's pace. */
function StatusBand({ status }: { status: StoreStatus }) {
  const { open, live, next, day, pace, timeZone } = status;
  const state = kioskState(status);
  const resumeAt =
    pace.pausedUntil &&
    new Intl.DateTimeFormat("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit" }).format(
      new Date(pace.pausedUntil),
    );
  const kicker = {
    maintenance: "Totem em manutenção",
    closed: "Totem fechado",
    paused: "Totem pausado",
    busy: "Totem aberto, cozinha movimentada",
    open: "Totem aberto",
  }[state];
  const title =
    state === "paused"
      ? `Pausado até ${resumeAt}`
      : open && live
        ? live.forcedUntil
          ? `${live.name}, forçado no ar`
          : live.until
            ? `${live.name} no ar até ${live.until}`
            : `${live.name} no ar`
        : "Fechado agora";
  const text =
    state === "paused"
      ? "O totem mostra “Estamos com muitos pedidos” e indica o balcão. Volta sozinho no horário."
      : next
        ? open
          ? `Depois: ${next.menu}, ${whenLabel(next, day)}.`
          : `Abre ${whenLabel(next, day)} com ${next.menu}.`
        : open
          ? "Nenhum outro cardápio programado nesta semana."
          : "Nenhum cardápio programado. Configure os horários em Cardápios.";
  const dot =
    state === "open" || state === "busy"
      ? "bg-[#8fbf8a]"
      : state === "closed"
        ? "bg-[#cdbfb2]"
        : "bg-detail-light";
  return (
    <section
      aria-label="Totem e ritmo da cozinha"
      className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-2xl bg-night px-[22px] py-5 text-on-accent"
    >
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-[#cdbfb2]">
          <span className={`size-2 rounded-full ${dot}`} />
          {kicker}
        </span>
        <span className="text-[26px] leading-[1.15] font-bold tracking-[-0.02em]">{title}</span>
        <span className="text-sm leading-[1.45] font-medium text-[#cdbfb2]">{text}</span>
      </div>
      <div className="min-w-0 flex-[1_1_360px]">
        <PaceSwitch pace={pace.pace} waitMinutes={pace.waitMinutes} action={setPace} />
      </div>
    </section>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta: string | null }) {
  const up = delta?.startsWith("+");
  return (
    <Link
      href="/admin/relatorio"
      className="flex flex-col gap-1 bg-surface px-5 py-4 transition-colors hover:bg-[#fbf8f3]"
    >
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span className="text-[clamp(24px,2.3vw,30px)] leading-[1.2] font-extrabold tracking-[-0.03em] whitespace-nowrap">
        {value}
      </span>
      <span className={`text-[12.5px] ${up ? "font-bold text-leaf" : "font-semibold text-muted"}`}>
        {delta ?? "Sem dado da semana passada"}
      </span>
    </Link>
  );
}

function OffRow({ item }: { item: AdminItem }) {
  return (
    <li className="flex min-h-14 items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-sm font-bold">{item.name}</span>
        <span className="text-[13px] font-medium text-muted">Desligado até você ligar</span>
      </span>
      <ActionForm action={turnOn} className="flex flex-col items-end gap-1">
        <input type="hidden" name="itemId" value={item.id} />
        <SubmitButton variant="secondary" pendingLabel="Ligando…">
          Ligar
        </SubmitButton>
      </ActionForm>
    </li>
  );
}
