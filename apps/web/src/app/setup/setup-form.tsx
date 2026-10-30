"use client";

import { useActionState } from "react";

import { provisionDevice, type SetupState } from "./actions";

const inputClass =
  "h-[96px] w-full rounded-card-sm border border-line bg-surface px-8 text-[32px] font-semibold text-ink outline-none focus:border-detail";

export function SetupForm() {
  const [state, action, pending] = useActionState<SetupState, FormData>(provisionDevice, {});

  return (
    <form action={action} className="flex flex-col gap-8">
      <label className="flex flex-col gap-3">
        <span className="text-[24px] font-semibold text-muted">ID do aparelho</span>
        <input
          name="deviceId"
          defaultValue={state.deviceId}
          placeholder="KIOSK-TBT-001"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-3">
        <span className="text-[24px] font-semibold text-muted">Código secreto</span>
        <input
          name="deviceSecret"
          type="password"
          autoComplete="off"
          required
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="text-[26px] font-semibold text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-button w-full rounded-full bg-accent text-[36px] font-semibold text-on-accent disabled:opacity-60"
      >
        {pending ? "Conectando…" : "Conectar aparelho"}
      </button>
    </form>
  );
}
