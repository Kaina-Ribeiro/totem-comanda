import { ReportSkeleton, Streamed } from "@/components/admin/skeleton";
import { Card, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import { load } from "@/lib/admin/form";
import { businessDate } from "@/lib/admin/home";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import { formatMoney } from "@/lib/format/money";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function ReportPage({ searchParams }: PageProps<"/admin/relatorio">) {
  return (
    <>
      <PageHeader
        title="Relatório do dia"
        description="Pedidos pagos no totem, por dia de funcionamento."
      />
      <Streamed fallback={<ReportSkeleton />}>
        <Report searchParams={searchParams} />
      </Streamed>
    </>
  );
}

const pedidos = (n: number) => (n === 1 ? "1 pedido" : `${n} pedidos`);

async function Report({
  searchParams,
}: {
  searchParams: PageProps<"/admin/relatorio">["searchParams"];
}) {
  const { date: asked } = await searchParams;
  const loaded = await load(async () => {
    const store = await asOwner((headers) => coreApi().GET("/v2/admin/store", { headers }));
    // The business day in the store's timezone (it starts at the cutoff),
    // unless the owner picked another day.
    const today = businessDate(new Date(), store.timezone, store.businessDayCutoff);
    const date = typeof asked === "string" && DATE.test(asked) ? asked : today;
    const report = await asOwner((headers) =>
      coreApi().GET("/v2/admin/reports/daily", { headers, params: { query: { date } } }),
    );
    return { report, today, cutoff: store.businessDayCutoff };
  });
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const { report, today, cutoff } = loaded.data;

  return (
    <>
      <form className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-muted">Dia</span>
          <input
            name="date"
            type="date"
            defaultValue={report.date}
            max={today}
            className={inputClass}
          />
        </label>
        <button className="h-10 rounded-[10px] bg-accent px-4 text-sm font-bold text-on-accent transition-transform active:scale-[.98]">
          Ver
        </button>
        <span className="pb-2.5 text-[13px] font-medium text-muted">
          O dia começa às {cutoff}.
        </span>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pedidos" value={String(report.ordersCount)} />
        <Stat label="Faturamento" value={formatMoney(report.revenue)} />
        <Stat label="Ticket médio" value={formatMoney(report.averageTicket)} />
      </div>

      {/* Cancelled orders never count in revenue (contract DailyReport). */}
      <Card className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Line
          label="Descontos de cupom"
          value={formatMoney(report.discountTotal)}
          hint="Já descontados do faturamento."
        />
        <Line
          label="Cancelados"
          value={pedidos(report.cancelledCount)}
          hint="Estorno no painel do Mercado Pago."
        />
        <Line
          label="Não retirados"
          value={pedidos(report.notCollectedCount)}
          hint="Abertos quando a cozinha encerrou o dia."
        />
      </Card>

      <Card className="p-0">
        <h2 className="px-5 pt-5 text-lg font-bold tracking-[-0.01em]">Mais vendidos</h2>
        {report.bestSellers.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nenhum pedido pago neste dia.</p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2 font-semibold">Item</th>
                <th className="px-5 py-2 text-right font-semibold">Unidades</th>
                <th className="px-5 py-2 text-right font-semibold">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {report.bestSellers.map((seller) => (
                <tr key={seller.id} className="border-t border-line">
                  <td className="px-5 py-2 font-semibold">{seller.name}</td>
                  <td className="px-5 py-2 text-right">{seller.quantity}</td>
                  <td className="px-5 py-2 text-right whitespace-nowrap text-price">
                    {formatMoney(seller.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="text-3xl font-extrabold tracking-[-0.03em]">{value}</span>
    </Card>
  );
}

function Line({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="text-lg font-bold">{value}</span>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );
}
