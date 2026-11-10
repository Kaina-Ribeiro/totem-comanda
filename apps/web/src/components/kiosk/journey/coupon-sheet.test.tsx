// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CouponRow, CouponSheet } from "./coupon-sheet";
import { strings } from "./test-journey";

const actions = vi.hoisted(() => ({ applyCoupon: vi.fn() }));
vi.mock("@/app/kiosk/actions", () => actions);

const items = [{ id: "2010", quantity: 1, uniqueId: 1, modifiers: [] }];

function renderSheet(current: string | null = null) {
  const on = { onClose: vi.fn(), onApplied: vi.fn() };
  render(<CouponSheet current={current} basketId="B-1" items={items} language="pt-BR" strings={strings} {...on} />);
  return on;
}

async function type(code: string) {
  const user = userEvent.setup();
  for (const key of code) await user.click(screen.getByRole("button", { name: key }));
  await user.click(screen.getByRole("button", { name: strings["coupon.apply"] }));
  return user;
}

describe("CouponSheet (v2)", () => {
  beforeEach(() => vi.resetAllMocks());

  it("applies the code on Go's basket and reports it", async () => {
    actions.applyCoupon.mockResolvedValue({ ok: true, data: { awards: [{ id: "CAFE5", type: "CODE" }] } });
    const on = renderSheet();
    await type("CAFE5");
    expect(actions.applyCoupon).toHaveBeenCalledWith({ basketId: "B-1", items, code: "CAFE5", language: "pt-BR" });
    expect(on.onApplied).toHaveBeenCalledWith("CAFE5");
  });

  it("shows Go's reason for DISCOUNT_INVALID", async () => {
    actions.applyCoupon.mockResolvedValue({ ok: false, code: "DISCOUNT_INVALID", detail: "Pedido mínimo de R$ 20,00" });
    renderSheet();
    await type("CAFE5");
    expect(await screen.findByText("Pedido mínimo de R$ 20,00")).toBeTruthy();
  });

  it("has its own copy for a used-up coupon and for the same coupon twice", async () => {
    actions.applyCoupon.mockResolvedValueOnce({ ok: false, code: "DISCOUNT_LIMIT_REACHED" });
    renderSheet();
    await type("A");
    expect(await screen.findByText(strings["coupon.limit"])).toBeTruthy();
    actions.applyCoupon.mockResolvedValueOnce({ ok: false, code: "COUPON_ALREADY_APPLIED" });
    await userEvent.setup().click(screen.getByRole("button", { name: strings["coupon.apply"] }));
    expect(await screen.findByText(strings["coupon.already"])).toBeTruthy();
  });

  it("asks before replacing the coupon already on the order", async () => {
    actions.applyCoupon.mockResolvedValue({ ok: true, data: { awards: [{ id: "CAFE5", type: "CODE" }] } });
    renderSheet("BEMVINDO10");
    await type("CAFE5");
    expect(actions.applyCoupon).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: strings["coupon.replaceConfirm"] }));
    expect(actions.applyCoupon).toHaveBeenCalled();
  });
});

describe("CouponRow", () => {
  it("says when Go no longer applies the coupon", () => {
    render(<CouponRow code="CAFE5" title={null} gone strings={strings} onOpen={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText(/O cupom CAFE5 não vale mais/)).toBeTruthy();
  });
});
