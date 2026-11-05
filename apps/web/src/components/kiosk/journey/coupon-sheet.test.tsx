// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiscountItem } from "@/app/kiosk/actions";
import type { BasketLine } from "@/lib/kiosk/menu-view";

import { CouponSheet } from "./coupon-sheet";
import { line, strings } from "./test-journey";

const { validateCoupon } = vi.hoisted(() => ({ validateCoupon: vi.fn() }));

vi.mock("@/app/kiosk/actions", () => ({ validateCoupon }));

const BASKET: BasketLine[] = [line("itm-baguete", 2)];

const discount = {
  type: "PERCENT",
  value: "BEMVINDO10",
  entryMethod: "MANUAL",
  title: "10% na primeira compra",
  amount: { value: 150, currency: "BRL" },
} as unknown as DiscountItem;

function renderSheet(current: string | null = null) {
  const on = { onClose: vi.fn(), onApplied: vi.fn() };
  render(
    <CouponSheet
      current={current}
      orderType="TAKE_OUT"
      basket={BASKET}
      strings={strings}
      {...on}
    />,
  );
  return on;
}

const key = (label: string) => screen.getByRole("button", { name: label });
const apply = () => screen.getByRole<HTMLButtonElement>("button", { name: strings["coupon.apply"] });

async function typeCode(code: string) {
  for (const char of code) await userEvent.click(key(char));
}

describe("CouponSheet", () => {
  beforeEach(() => {
    validateCoupon.mockReset();
  });

  it("keeps Aplicar disabled until a code is typed", async () => {
    renderSheet();
    expect(apply().disabled).toBe(true);

    await typeCode("B");
    expect(apply().disabled).toBe(false);
  });

  it("checks the typed code against this basket and applies it on success", async () => {
    validateCoupon.mockResolvedValue({ ok: true, data: discount });
    const on = renderSheet();

    await typeCode("BEMVINDO10");
    await userEvent.click(apply());

    expect(validateCoupon).toHaveBeenCalledWith({
      code: "BEMVINDO10",
      orderType: "TAKE_OUT",
      orderItems: BASKET,
      currentDiscountCode: null,
    });
    await vi.waitFor(() => expect(on.onApplied).toHaveBeenCalledWith(discount));
  });

  it("erases the last letter", async () => {
    renderSheet();
    await typeCode("NATAL");
    await userEvent.click(key(strings["coupon.erase"]));
    expect(screen.getByText("NATA")).toBeTruthy();
  });

  it("shows the invalid-coupon message and keeps the sheet open", async () => {
    validateCoupon.mockResolvedValue({ ok: false, code: "INVALID_COUPON" });
    const on = renderSheet();

    await typeCode("XXXX");
    await userEvent.click(apply());

    expect(await screen.findByText(strings["coupon.invalid"])).toBeTruthy();
    expect(on.onApplied).not.toHaveBeenCalled();
    expect(on.onClose).not.toHaveBeenCalled();
  });

  it("tells the guest when the coupon is already on the order", async () => {
    validateCoupon.mockResolvedValue({ ok: false, code: "COUPON_ALREADY_APPLIED" });
    renderSheet();

    await typeCode("BEMVINDO10");
    await userEvent.click(apply());

    expect(await screen.findByText(strings["coupon.already"])).toBeTruthy();
  });

  it("shows the generic error when the check itself fails", async () => {
    validateCoupon.mockResolvedValue({ ok: false, code: "CORE_UNAVAILABLE" });
    renderSheet();

    await typeCode("BEMVINDO10");
    await userEvent.click(apply());

    expect(await screen.findByText(strings["coupon.error"])).toBeTruthy();
  });

  it("asks before replacing the coupon already on the order, and keeps it if asked", async () => {
    const on = renderSheet("BEMVINDO10");

    await typeCode("NATAL");
    await userEvent.click(apply());

    expect(screen.getByText(strings["coupon.replaceTitle"])).toBeTruthy();
    expect(screen.getByText(/O BEMVINDO10 sai e entra o NATAL/)).toBeTruthy();
    expect(validateCoupon).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Manter o BEMVINDO10" }));
    expect(screen.queryByText(strings["coupon.replaceTitle"])).toBeNull();
    expect(validateCoupon).not.toHaveBeenCalled();
    expect(on.onApplied).not.toHaveBeenCalled();
  });

  it("replaces the current coupon: the check sends the old code along", async () => {
    validateCoupon.mockResolvedValue({ ok: true, data: { ...discount, value: "NATAL" } });
    const on = renderSheet("BEMVINDO10");

    await typeCode("NATAL");
    await userEvent.click(apply());
    await userEvent.click(screen.getByRole("button", { name: strings["coupon.replaceConfirm"] }));

    expect(validateCoupon).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NATAL", currentDiscountCode: "BEMVINDO10" }),
    );
    await vi.waitFor(() =>
      expect(on.onApplied).toHaveBeenCalledWith(expect.objectContaining({ value: "NATAL" })),
    );
  });

  it("closes without checking when the guest taps Voltar", async () => {
    const on = renderSheet();
    await userEvent.click(screen.getByRole("button", { name: strings["coupon.cancel"] }));
    expect(on.onClose).toHaveBeenCalledOnce();
    expect(validateCoupon).not.toHaveBeenCalled();
  });
});
