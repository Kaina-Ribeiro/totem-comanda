import type { ReactNode } from "react";

// Back-office building blocks: a landscape/phone admin, not the kiosk, so it
// uses normal type sizes with the same "Café e trigo" tokens.

export const inputClass =
  "h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-base text-ink outline-none focus:border-detail";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-[1.15] font-bold tracking-[-0.02em] min-[821px]:text-[28px]">
          {title}
        </h1>
        {description && <p className="text-sm font-medium text-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-line bg-surface px-5 py-[18px] ${className}`}>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Checkbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-5 accent-[#4e3426]"
      />
      {label}
    </label>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "ok" | "warn" | "danger";
}) {
  const tones = {
    muted: "bg-ground text-muted",
    ok: "bg-sage text-ink",
    warn: "bg-butter text-detail-text",
    danger: "bg-danger-bg text-danger",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Suspense fallback while a page's data streams in. It fades in only after 300 ms
 * (`.page-loading` in app/admin/(panel)/admin.css), so a quick load never flashes it.
 */
export function PageLoading({ label = "Carregando…" }: { label?: string }) {
  return (
    <p role="status" className="page-loading text-sm text-muted">
      {label}
    </p>
  );
}

/** Error box for a page whose data could not load. */
export function LoadError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-[14px] bg-danger-bg p-5 text-sm font-semibold text-danger">
      {message}
    </p>
  );
}
