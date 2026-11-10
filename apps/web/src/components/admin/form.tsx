"use client";

import {
  createContext,
  type FormEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
} from "react";

import type { FormState } from "@/lib/admin/form";

/** Whether the ActionForm around a SubmitButton is saving. */
const Saving = createContext(false);

/**
 * A back-office form bound to a Server Action that returns FormState: shows
 * the saved or error message under the fields. `resetOnSave` clears the form
 * after a successful create.
 *
 * It submits by itself instead of through `<form action>`, which resets the
 * fields after every action: a failed save must keep what the owner typed so
 * she can fix it (COM-138). A successful one still goes back to the saved
 * values, which the page has just re-rendered as the fields' defaults.
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
  const [state, formAction, saving] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.saved) formRef.current?.reset();
  }, [state]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(form));
  }

  return (
    <form
      ref={formRef}
      // Before hydration the plain Server Action form posts (and never puts
      // fields, a password included, in the URL); after it, `submit` takes over.
      action={formAction}
      onSubmit={submit}
      className={className}
      key={resetOnSave && state.saved ? JSON.stringify(state) : undefined}
    >
      <Saving value={saving}>{children}</Saving>
      {state.error && (
        <div role="alert" className="flex flex-col gap-1.5 text-sm font-semibold text-danger">
          <p>{state.error}</p>
          {state.problems && (
            <ul className="flex list-disc flex-col gap-1 pl-5 font-medium">
              {state.problems.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.reveal && (
        <div className="flex flex-col gap-1 rounded-[10px] border border-detail bg-butter p-3">
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
  const pending = useContext(Saving);
  const styles = {
    primary: "bg-accent text-on-accent",
    secondary: "bg-surface text-ink border border-line hover:bg-hover",
    danger: "bg-surface text-danger border border-line hover:bg-danger-bg",
  }[variant];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`h-10 rounded-[10px] px-4 text-sm font-bold whitespace-nowrap transition-[transform,background-color,opacity] active:scale-[.98] disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
