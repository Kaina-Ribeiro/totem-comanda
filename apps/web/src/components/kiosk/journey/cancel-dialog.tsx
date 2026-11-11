import { format, type Strings } from "@/lib/kiosk/strings";

/** Prototype 10-Cancel: confirm before throwing the order away (F-BASKET-04). */
export function CancelDialog({
  units,
  strings,
  onKeep,
  onConfirm,
}: {
  units: number;
  strings: Strings;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#2b211c]/75 px-[72px]"
      role="dialog"
      aria-modal
    >
      <div className="flex w-full flex-col gap-[54px] rounded-[54px] bg-surface p-[72px] text-ink">
        <div className="flex flex-col gap-[24px]">
          <h2 className="font-display text-[72px] leading-none font-semibold tracking-[-0.02em]">
            {strings["cancel.title"]}
          </h2>
          <p className="text-[30px] leading-[1.45] text-muted">
            {units === 1 ? strings["cancel.bodyOne"] : format(strings["cancel.body"], { n: units })}
          </p>
        </div>
        <div className="flex flex-col gap-[21px]">
          <button
            onClick={onKeep}
            className="h-[150px] rounded-full bg-ink text-[33px] font-bold text-on-accent"
          >
            {strings["cancel.keep"]}
          </button>
          <button
            onClick={onConfirm}
            className="h-[150px] rounded-full bg-ground text-[33px] font-bold text-danger"
          >
            {strings["cancel.confirm"]}
          </button>
        </div>
      </div>
    </div>
  );
}
