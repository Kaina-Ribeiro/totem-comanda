import { beforeEach, describe, expect, it, vi } from "vitest";

const { core, DeviceAuthError } = vi.hoisted(() => {
  class DeviceAuthError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return { core: { GET: vi.fn(), POST: vi.fn() }, DeviceAuthError };
});

vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => void task() }));
vi.mock("@/lib/device/session", () => ({
  DeviceAuthError,
  asDevice: (call: (headers: object, deviceId: string) => unknown) =>
    call({ Authorization: "Bearer t" }, "KIOSK-1"),
}));
vi.mock("@/lib/core/mock-scenarios", () => ({ isCoreDownSimulated: async () => false }));
vi.mock("@/lib/core/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/core/client")>()),
  coreApi: () => core,
}));

const actions = await import("./actions");

const answer = (status: number, data?: unknown, error?: unknown) => ({
  response: { ok: status < 400, status, headers: new Headers({ ETag: `"e${Math.random()}"` }) } as Response,
  data,
  error,
});

let kind: "KIOSK" | "KITCHEN" = "KIOSK";
beforeEach(() => {
  kind = "KIOSK";
  core.GET.mockReset();
  core.POST.mockReset();
  core.GET.mockImplementation(async (path: string) =>
    path === "/v2/devices/me/config" ? answer(200, { kind }) : answer(200, {}),
  );
  core.POST.mockImplementation(async () => answer(200, {}));
});

const items = [{ id: "1001", quantity: 1, uniqueId: 1, modifiers: [] }];
const session = {
  id: "pay-1",
  basketId: "B-1",
  method: "PIX",
  amount: 9.5,
  status: "APPROVED",
  tenderId: "MP_PIX",
  tenderRef: "1319876543",
  qrCode: null,
  copyPaste: null,
  expiresAt: null,
  terminalId: null,
  createdAt: "2026-11-10T12:00:00Z",
} as const;

// Every kiosk Server Action, called the way the journey calls it.
const calls: Record<string, () => Promise<unknown>> = {
  beginJourney: () => actions.beginJourney("pt-BR"),
  switchLanguage: () => actions.switchLanguage("en"),
  priceBasket: () => actions.priceBasket({ basketId: null, items, language: "pt-BR" }),
  applyCoupon: () => actions.applyCoupon({ basketId: "B-1", items, code: "bemvindo10", language: "pt-BR" }),
  removeCoupon: () => actions.removeCoupon({ basketId: "B-1", items, code: "BEMVINDO10" }),
  recordJourneyEvent: () => actions.recordJourneyEvent("nonce-1", "IDLE_TIMEOUT", null),
  startPayment: () => actions.startPayment({ basketId: "B-1", method: "PIX", amount: 9.5 }, "key-1"),
  pollPayment: () => actions.pollPayment("pay-1"),
  cancelPayment: () => actions.cancelPayment("pay-1"),
  submitOrder: () => actions.submitOrder({ basketId: "B-1", items, payment: session }, "key-2"),
};

const posts = (path: string) => core.POST.mock.calls.filter(([p]) => p === path);

describe("kiosk Server Actions (v2)", () => {
  it("covers every exported action", () => {
    const exported = Object.entries(actions)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(Object.keys(calls).sort()).toEqual(exported);
  });

  describe.each(Object.entries(calls))("%s", (name, call) => {
    it("refuses a device that is not a kiosk, before any other Core call", async () => {
      kind = "KITCHEN";
      const result = await call();
      if (name !== "recordJourneyEvent") expect(result).toEqual({ ok: false, code: "DEVICE_UNAVAILABLE" });
      expect(core.POST).not.toHaveBeenCalled();
      expect(core.GET.mock.calls.map(([path]) => path)).toEqual(["/v2/devices/me/config"]);
    });
  });

  describe("kitchen names", () => {
    const menuIn = (name: string) => ({
      menuId: "m",
      validUntil: null,
      root: [],
      badges: [],
      entities: [
        { id: "G", type: "MODIFIERS", name: "G", min: 0, max: 2, modifierType: "INGR", links: [{ type: "ITEM", id: "I-TOMATO" }] },
        { id: "I-TOMATO", type: "ITEM", name, price: 0, available: true, links: [] },
      ],
    });
    const menuCalls = () => core.GET.mock.calls.filter(([path]) => path === "/v2/menus/active");
    const answerMenus = (ptBr: () => ReturnType<typeof answer>) =>
      core.GET.mockImplementation(async (path: string, options: { params: { query: { language: string } } }) => {
        if (path === "/v2/devices/me/config") return answer(200, { kind });
        if (path !== "/v2/menus/active") return answer(200, { strings: {} });
        return options.params.query.language === "en" ? answer(200, menuIn("Tomato")) : ptBr();
      });

    it("come in pt-BR for a guest in English, at the start and on a switch", async () => {
      answerMenus(() => answer(200, menuIn("Tomate")));
      const names = { ok: true, data: { kitchenNames: { "I-TOMATO": "Tomate" } } };
      expect(await actions.beginJourney("en")).toMatchObject(names);
      expect(await actions.switchLanguage("en")).toMatchObject(names);
    });

    it("cost no second menu call for a guest in pt-BR", async () => {
      answerMenus(() => answer(200, menuIn("Tomate")));
      expect(await actions.beginJourney("pt-BR")).toMatchObject({ ok: true, data: { kitchenNames: {} } });
      expect(menuCalls()).toHaveLength(1);
    });

    it("never stop a journey when they cannot load", async () => {
      answerMenus(() => answer(500, undefined, { code: "INTERNAL" }));
      expect(await actions.beginJourney("en")).toMatchObject({ ok: true, data: { kitchenNames: {} } });
    });
  });

  it("prices a dine-in basket with ids only", async () => {
    await actions.priceBasket({ basketId: "B-1", items, language: "en" });
    expect(posts("/v2/totals")[0][1]).toMatchObject({
      params: { query: { language: "en" } },
      body: { basketId: "B-1", orderType: "DINEIN", items },
    });
  });

  it("sends the coupon as one CODE award, upper case", async () => {
    await calls.applyCoupon();
    expect(posts("/v2/discounts/apply")[0][1].body.awards).toEqual([{ id: "BEMVINDO10", type: "CODE" }]);
  });

  it("passes the problem code and detail through", async () => {
    core.POST.mockResolvedValue(
      answer(422, undefined, { code: "DISCOUNT_INVALID", detail: "Pedido mínimo de R$ 20,00" }),
    );
    expect(await calls.applyCoupon()).toEqual({
      ok: false,
      code: "DISCOUNT_INVALID",
      detail: "Pedido mínimo de R$ 20,00",
    });
  });

  it("submits a DINEIN order with the approved session's tender", async () => {
    await calls.submitOrder();
    const [, options] = posts("/v2/orders")[0];
    expect(options.params.header).toEqual({ "Idempotency-Key": "key-2" });
    expect(options.body).toEqual({
      basketId: "B-1",
      orderType: "DINEIN",
      items,
      payments: [{ tenderId: "MP_PIX", tenderRef: "1319876543", amount: 9.5 }],
    });
  });

  // Review Focus 1: paid, then the connection drops.
  it("retries an unknown submit with the same Idempotency-Key", async () => {
    core.POST.mockRejectedValueOnce(new DOMException("timeout", "TimeoutError")).mockResolvedValueOnce(
      answer(201, { number: "20261110-0042", customerCheckNumber: "42" }),
    );
    const result = await calls.submitOrder();
    expect(result).toMatchObject({ ok: true, data: { customerCheckNumber: "42" } });
    const keys = posts("/v2/orders").map(([, options]) => options.params.header["Idempotency-Key"]);
    expect(keys).toEqual(["key-2", "key-2"]);
  });

  it("does not retry an answer Go gave", async () => {
    core.POST.mockResolvedValue(answer(409, undefined, { code: "PAYMENT_NOT_APPROVED" }));
    expect(await calls.submitOrder()).toEqual({ ok: false, code: "PAYMENT_NOT_APPROVED" });
    expect(posts("/v2/orders")).toHaveLength(1);
  });
});
