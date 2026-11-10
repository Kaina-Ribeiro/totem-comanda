import { useState, useTransition } from "react";

import { applyCoupon, type OrderItem } from "@/app/kiosk/actions";
import type { ResultCode } from "@/lib/kiosk/core-v2";
import { format, type Language, type Strings } from "@/lib/kiosk/strings";

const ROWS = ["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const MAX_CODE = 20;

type CouponError = { code: ResultCode; detail?: string };

/**
 * Coupon entry. Not drawn in the prototype: same sheet as 09-Cpf with an
 * on-screen keyboard, since the kiosk has none. Replacing a code on the order
 * asks first; Go puts the new one in place of the old (one coupon per order)
 * and decides if and how much it discounts (`POST /v2/discounts/apply`).
 */
export function CouponSheet({
  current,
  basketId,
  items,
  language,
  strings,
  onClose,
  onApplied,
}: {
  current: string | null;
  basketId: string;
  items: OrderItem[];
  language: Language;
  strings: Strings;
  onClose: () => void;
  onApplied: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<CouponError | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [checking, startChecking] = useTransition();

  const press = (key: string) => {
    setError(null);
    if (key === "back") setCode((c) => c.slice(0, -1));
    else setCode((c) => (c.length < MAX_CODE ? c + key : c));
  };

  const check = () => {
    setConfirmReplace(false);
    startChecking(async () => {
      // A Server Action that never reached the BFF (kiosk offline) is a failure too.
      const result = await applyCoupon({ basketId, items, code, language }).catch(() => null);
      if (result?.ok) onApplied(result.data.awards[0]?.id ?? code);
      else setError(result && !result.ok ? { code: result.code, detail: result.detail } : { code: "CORE_UNAVAILABLE" });
    });
  };

  const apply = () => {
    if (!code) return;
    if (current && current !== code) setConfirmReplace(true);
    else check();
  };

  const message = couponMessage(error, strings);
  const keyClass =
    "flex h-[108px] flex-1 items-center justify-center rounded-[21px] border-[3px] border-line bg-surface text-[36px] font-bold";

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-[#2b211c]/75" role="dialog" aria-modal>
      <div className="flex w-full flex-col gap-9 rounded-t-[60px] bg-surface px-[54px] pt-[72px] pb-12 text-ink">
        <div className="flex flex-col gap-3 px-3">
          <h2 className="font-display text-[69px] leading-none font-semibold tracking-[-0.02em]">{strings["coupon.title"]}</h2>
          <p className="text-[28.5px] text-muted">{strings["coupon.body"]}</p>
        </div>
        <div className="flex flex-col gap-3 px-3">
          <span className="text-[24px] font-bold text-muted">{strings["coupon.label"]}</span>
          <div
            className={`flex h-[138px] items-center rounded-[24px] border-b-[4.5px] bg-ground px-9 font-display text-[60px] font-semibold tracking-[0.04em] ${
              message ? "border-danger" : "border-detail"
            }`}
            aria-live="polite"
          >
            {code || <span className="text-muted/50">BEMVINDO10</span>}
          </div>
          {message && <span className="text-[25.5px] font-bold text-danger">{message}</span>}
        </div>
        <div className="flex flex-col gap-[15px]">
          {ROWS.map((row, index) => (
            <div key={row} className="flex gap-[12px]">
              {row.split("").map((key) => (
                <button key={key} onClick={() => press(key)} className={keyClass}>
                  {key}
                </button>
              ))}
              {index === ROWS.length - 1 && (
                <button onClick={() => press("back")} aria-label={strings["coupon.erase"]} className={`${keyClass} flex-[1.6]`}>
                  <svg
                    width="45"
                    height="45"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 5H9l-6 7 6 7h12V5z" />
                    <path d="M12 9l6 6M18 9l-6 6" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-[30px] px-3 pt-3">
          <button onClick={onClose} className="h-[138px] flex-1 rounded-full bg-ground text-[31.5px] font-bold">
            {strings["coupon.cancel"]}
          </button>
          <button
            onClick={apply}
            disabled={!code || checking}
            className="h-[138px] flex-1 rounded-full bg-accent text-[31.5px] font-bold text-on-accent disabled:opacity-50"
          >
            {checking ? strings["coupon.checking"] : strings["coupon.apply"]}
          </button>
        </div>
      </div>

      {confirmReplace && current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b211c]/60 px-[72px]">
          <div className="flex w-full flex-col gap-[54px] rounded-[54px] bg-surface p-[72px]">
            <div className="flex flex-col gap-[24px]">
              <h2 className="font-display text-[72px] leading-none font-semibold tracking-[-0.02em]">
                {strings["coupon.replaceTitle"]}
              </h2>
              <p className="text-[30px] leading-[1.45] text-muted">
                {format(strings["coupon.replaceBody"], { current, next: code })}
              </p>
            </div>
            <div className="flex flex-col gap-[21px]">
              <button onClick={check} className="h-[150px] rounded-full bg-ink text-[33px] font-bold text-on-accent">
                {strings["coupon.replaceConfirm"]}
              </button>
              <button onClick={() => setConfirmReplace(false)} className="h-[150px] rounded-full bg-ground text-[33px] font-bold">
                {format(strings["coupon.replaceKeep"], { current })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Go's words for a refused coupon (`detail`, e.g. "Pedido mínimo de R$ 20,00"), else ours. */
export function couponMessage(error: CouponError | null, strings: Strings): string | null {
  if (!error) return null;
  switch (error.code) {
    case "DISCOUNT_INVALID":
      return error.detail ?? strings["coupon.invalid"];
    case "DISCOUNT_LIMIT_REACHED":
      return strings["coupon.limit"];
    case "COUPON_ALREADY_APPLIED":
      return strings["coupon.already"];
    default:
      return strings["coupon.error"];
  }
}

/**
 * The basket row for the coupon: add, or the applied code with its name. A
 * code Go no longer applies (the basket fell under its minimum) says so.
 */
export function CouponRow({
  code,
  title,
  gone,
  strings,
  onOpen,
  onRemove,
}: {
  code: string | null;
  title: string | null;
  gone: boolean;
  strings: Strings;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-[120px] items-center justify-between rounded-[36px] bg-sage px-[42px] text-[28.5px]">
        <button onClick={onOpen} className="flex flex-1 items-center gap-3 text-left">
          <span className="font-bold">{code ?? strings["coupon.row"]}</span>
          <span className="text-muted">{code ? title : strings["item.optional"]}</span>
        </button>
        {code ? (
          <span className="flex gap-[30px] font-bold">
            <button onClick={onOpen} className="text-detail-text">
              {strings["coupon.change"]}
            </button>
            <button onClick={onRemove} className="text-muted">
              {strings["coupon.remove"]}
            </button>
          </span>
        ) : (
          <button onClick={onOpen} className="font-bold text-detail-text">
            {strings["coupon.add"]}
          </button>
        )}
      </div>
      {code && gone && (
        <p className="px-[42px] text-[25.5px] font-semibold text-danger">
          {format(strings["basket.couponGone"], { code })}
        </p>
      )}
    </div>
  );
}
