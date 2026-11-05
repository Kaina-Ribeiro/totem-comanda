
import { ReportSkeleton, Streamed } from "@/components/admin/skeleton";
import { Card, inputClass, LoadError, PageHeader } from "@/components/admin/ui";
import { load } from "@/lib/admin/form";
import { asOwner } from "@/lib/admin/session";
import { coreApi } from "@/lib/core/client";
import { formatBRL } from "@/lib/format/money";

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

async function Report({
  searchParams,
}: {
  searchParams: PageProps<"/admin/relatorio">["searchParams"];
}) {
  const { date: asked } = await searchParams;
  const loaded = await load(async () => {
    const restaurant = await asOwner((headers) =>
      coreApi().GET("/v1/admin/restaurant", { headers }),
    );
    // The business date in the store's timezone, unless the owner picked another day.
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: restaurant.timezone }).format(
      new Date(),
    );
    const date = typeof asked === "string" && DATE.test(asked) ? asked : today;
    const report = await asOwner((headers) =>
      coreApi().GET("/v1/admin/reports/daily", { headers, params: { query: { date } } }),
    );
    return { report, today };
  });
  if ("error" in loaded) return <LoadError message={loaded.error} />;
  const { report, today } = loaded.data;
  const share = (n: number) =>
    report.ordersCount ? Math.round((n / report.ordersCount) * 100) : 0;

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
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Pedidos" value={String(report.ordersCount)} />
        <Stat label="Faturamento" value={formatBRL(report.revenue)} />
        <Stat label="Ticket médio" value={formatBRL(report.averageTicket)} />
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold tracking-[-0.01em]">Comer aqui × para viagem</h2>
        {(
          [
            ["DINEIN", "Comer aqui"],
            ["TAKE_OUT", "Para viagem"],
          ] as const
        ).map(([type, label]) => {
          const totals = report.byOrderType[type];
          return (
            <div key={type} className="flex flex-col gap-1">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">{label}</span>
                <span className="text-muted">
                  {totals.orders === 1 ? "1 pedido" : `${totals.orders} pedidos`} ·{" "}
                  {formatBRL(totals.revenue)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ground">
                <div
                  className="h-full rounded-full bg-detail"
                  style={{ width: `${share(totals.orders)}%` }}
                />
              </div>
            </div>
          );
        })}
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
                <tr key={seller.itemId} className="border-t border-line">
                  <td className="px-5 py-2 font-semibold">{seller.name}</td>
                  <td className="px-5 py-2 text-right">{seller.quantity}</td>
                  <td className="px-5 py-2 text-right text-price">{formatBRL(seller.revenue)}</td>
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
