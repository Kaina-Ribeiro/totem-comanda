import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  CORE_DOWN_COOKIE,
  decideMockPayment,
  isCoreDownSimulated,
  PAYMENT_OUTCOMES,
  type PaymentOutcome,
  pendingPayment,
  readMockState,
  setMockScenario,
} from "@/lib/core/mock-scenarios";
import { forgetDeviceTokens } from "@/lib/device/session";
import { formatMoney } from "@/lib/format/money";

// Development only: switch the stateful mock's scenario (apps/web/mock) and
// simulate the Core API being down.
async function chooseScenario(form: FormData) {
  "use server";
  if (process.env.NODE_ENV !== "development") return;
  const scenario = form.get("scenario");
  if (typeof scenario === "string") await setMockScenario(scenario);
  // The mock starts fresh on each scenario, so tokens it issued are gone.
  forgetDeviceTokens();
}

async function toggleCoreDown() {
  "use server";
  if (process.env.NODE_ENV !== "development") return;
  const jar = await cookies();
  if (jar.get(CORE_DOWN_COOKIE)?.value === "1") jar.delete(CORE_DOWN_COOKIE);
  else jar.set(CORE_DOWN_COOKIE, "1", { httpOnly: true, path: "/" });
}

/** Decides the waiting Mercado Pago session (run the mock with MOCK_PAYMENT_OUTCOME=NONE to keep it waiting). */
async function decidePayment(form: FormData) {
  "use server";
  if (process.env.NODE_ENV !== "development") return;
  const paymentId = form.get("paymentId");
  const outcome = form.get("outcome");
  if (typeof paymentId === "string" && PAYMENT_OUTCOMES.includes(outcome as PaymentOutcome)) {
    await decideMockPayment(paymentId, outcome as PaymentOutcome);
  }
}

const PAYMENT_LABELS: Record<PaymentOutcome, string> = {
  APPROVED: "Mercado Pago: aprova",
  DECLINED: "Mercado Pago: recusa",
  EXPIRED: "Mercado Pago: expira",
};

const buttonClass = (active: boolean) =>
  `h-[96px] rounded-card-sm px-8 text-left text-[28px] font-semibold ${
    active ? "bg-accent text-on-accent" : "bg-surface text-ink"
  }`;

export default function MockScenarioPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto flex w-full max-w-[880px] flex-col gap-8 p-12">
      <h1 className="font-display text-6xl font-semibold">Cenário do mock</h1>
      <Suspense>
        <Controls />
      </Suspense>
    </main>
  );
}

async function Controls() {
  const [mock, coreDown] = await Promise.all([readMockState(), isCoreDownSimulated()]);
  const payment = mock && pendingPayment(mock);
  return (
    <>
      {mock ? (
        <form action={chooseScenario} className="flex flex-col gap-4">
          {Object.entries(mock.scenarios).map(([id, label]) => (
            <button
              key={id}
              name="scenario"
              value={id}
              className={buttonClass(id === mock.scenario)}
            >
              {label}
            </button>
          ))}
        </form>
      ) : (
        <p className="text-[26px] text-danger">
          Mock fora do ar ou MOCK_CONTROL_URL vazio. Rode `npm run mock` em apps/web.
        </p>
      )}
      {payment ? (
        <form action={decidePayment} className="flex flex-col gap-4">
          <p className="text-[26px]">
            Pagamento esperando: {payment.method === "PIX" ? "Pix" : "cartão"} de {formatMoney(payment.amount)}
          </p>
          <input type="hidden" name="paymentId" value={payment.id} />
          {PAYMENT_OUTCOMES.map((outcome) => (
            <button key={outcome} name="outcome" value={outcome} className={buttonClass(false)}>
              {PAYMENT_LABELS[outcome]}
            </button>
          ))}
        </form>
      ) : (
        <p className="text-[26px] text-muted">
          Nenhum pagamento esperando. Com MOCK_PAYMENT_OUTCOME=NONE o Pix ou o cartão espera aqui até
          você decidir.
        </p>
      )}
      <form action={toggleCoreDown}>
        <button className={buttonClass(coreDown)}>
          {coreDown ? "Core API fora do ar (ligado)" : "Simular Core API fora do ar"}
        </button>
      </form>
    </>
  );
}
