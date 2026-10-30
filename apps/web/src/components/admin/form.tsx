"use client";

import { type ReactNode, useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/lib/admin/form";

/**
 * A back-office form bound to a Server Action that returns FormState: shows
 * the saved or error message under the fields. `resetOnSave` clears the form
 * after a successful create.
 */
export function ActionForm({
  action,
  children,
  className = "flex flex-col gap-5",
  resetOnSave = false,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  resetOnSave?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form
      action={formAction}
      className={className}
      key={resetOnSave && state.saved ? JSON.stringify(state) : undefined}
    >
      {children}
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      )}
      {state.reveal && (
        <div className="flex flex-col gap-1 rounded-xl border border-detail bg-butter p-3">
          <span className="text-xs font-bold text-detail-text">{state.reveal.label}</span>
          <code className="text-base font-bold break-all select-all">{state.reveal.value}</code>
        </div>
      )}
      {state.saved && (
        <p role="status" className="text-sm font-semibold text-detail-text">
          {state.saved}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Salvando…",
  variant = "primary",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-accent text-on-accent",
    secondary: "bg-surface text-ink border border-line",
    danger: "bg-surface text-danger border border-line",
  }[variant];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`h-11 rounded-full px-5 text-sm font-bold transition-opacity disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
