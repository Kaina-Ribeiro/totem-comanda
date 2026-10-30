import { useState } from "react";

import { isValidTaxId, maskTaxId, TAX_ID_MAX_DIGITS } from "@/lib/kiosk/tax-id";
import type { Strings } from "@/lib/kiosk/strings";

/** Prototype 09-Cpf: keypad sheet for the CPF or CNPJ on the receipt (F-BASKET-10). */
export function TaxIdSheet({
  initial,
  strings,
  onSkip,
  onConfirm,
}: {
  initial: string | null;
  strings: Strings;
  onSkip: () => void;
  onConfirm: (digits: string | null) => void;
}) {
  const [digits, setDigits] = useState(initial ?? "");
  const [invalid, setInvalid] = useState(false);

  const press = (key: string) => {
    setInvalid(false);
    if (key === "clear") setDigits("");
    else if (key === "back") setDigits((d) => d.slice(0, -1));
    else setDigits((d) => (d.length < TAX_ID_MAX_DIGITS ? d + key : d));
  };

  const confirm = () => {
    // Confirming an empty field clears a stored document.
    if (digits === "") return onConfirm(null);
    if (!isValidTaxId(digits)) return setInvalid(true);
    onConfirm(digits);
  };

  const keyClass =
    "flex h-[120px] items-center justify-center rounded-[24px] border-[3px] border-line bg-surface font-bold";

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-[#2b211c]/75" role="dialog" aria-modal>
      <div className="flex w-full flex-col gap-9 rounded-t-[60px] bg-surface px-[66px] pt-[72px] pb-12 text-ink">
        <div className="flex flex-col gap-3">
          <h2 className="font-display text-[69px] leading-none font-semibold tracking-[-0.02em]">
            {strings["taxId.title"]}
          </h2>
          <p className="text-[28.5px] text-muted">{strings["taxId.body"]}</p>
        </div>
        <div className="flex flex-col gap-3">
          <span className="text-[24px] font-bold text-muted">{strings["taxId.label"]}</span>
          <div
            className={`flex h-[138px] items-center rounded-[24px] border-b-[4.5px] bg-ground px-9 font-display text-[60px] font-semibold tracking-[0.01em] ${
              invalid ? "border-danger" : "border-detail"
            }`}
            aria-live="polite"
          >
            {maskTaxId(digits) || <span className="text-muted/50">000.000.000-00</span>}
          </div>
          {invalid && (
            <span className="text-[25.5px] font-bold text-danger">{strings["taxId.invalid"]}</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-[18px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((key) => (
            <button key={key} onClick={() => press(key)} className={`${keyClass} text-[42px]`}>
              {key}
            </button>
          ))}
          <button onClick={() => press("clear")} className={`${keyClass} text-[28.5px] text-muted`}>
            {strings["taxId.clear"]}
          </button>
          <button onClick={() => press("0")} className={`${keyClass} text-[42px]`}>
            0
          </button>
          <button
            onClick={() => press("back")}
            className={keyClass}
            aria-label={strings["taxId.erase"]}
          >
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
        </div>
        <div className="flex gap-[30px] pt-3">
          <button
            onClick={onSkip}
            className="h-[138px] flex-1 rounded-full bg-ground text-[31.5px] font-bold"
          >
            {strings["taxId.skip"]}
          </button>
          <button
            onClick={confirm}
            className="h-[138px] flex-1 rounded-full bg-accent text-[31.5px] font-bold text-on-accent"
          >
            {strings["taxId.confirm"]}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The basket row under the lines (05-Cart): "CPF na nota? Opcional · Adicionar". */
export function TaxIdRow({
  digits,
  strings,
  onOpen,
}: {
  digits: string | null;
  strings: Strings;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="flex h-[120px] items-center justify-between rounded-[36px] bg-butter px-[42px] text-[28.5px]"
    >
      <span>
        <span className="font-bold">
          {digits ? (digits.length === 11 ? "CPF" : "CNPJ") : strings["taxId.row"]}
        </span>{" "}
        <span className="text-muted">{digits ? maskTaxId(digits) : strings["item.optional"]}</span>
      </span>
      <span className="font-bold text-detail-text">
        {digits ? strings["taxId.change"] : strings["taxId.add"]}
      </span>
    </button>
  );
}
