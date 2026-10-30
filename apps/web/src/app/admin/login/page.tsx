import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ActionForm, SubmitButton } from "@/components/admin/form";
import { Field, inputClass } from "@/components/admin/ui";
import { type FormState, text } from "@/lib/admin/form";
import { signIn } from "@/lib/admin/session";

async function login(_: FormState, form: FormData): Promise<FormState> {
  "use server";
  const result = await signIn(
    text(form, "email").toLowerCase(),
    String(form.get("password") ?? ""),
  );
  if (!result.ok) {
    return {
      error:
        result.code === "INVALID_CREDENTIALS"
          ? "E-mail ou senha incorretos."
          : "Não foi possível falar com o servidor. Tente de novo.",
    };
  }
  redirect("/admin");
}

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="font-display text-xl italic">Comanda</span>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.02em]">Back office</h1>
          <Suspense>
            <ExpiredNote searchParams={searchParams} />
          </Suspense>
        </div>
        <ActionForm action={login}>
          <Field label="E-mail">
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className={inputClass}
            />
          </Field>
          <Field label="Senha">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
            />
          </Field>
          <SubmitButton pendingLabel="Entrando…">Entrar</SubmitButton>
        </ActionForm>
      </div>
    </main>
  );
}

async function ExpiredNote({
  searchParams,
}: {
  searchParams: PageProps<"/admin/login">["searchParams"];
}) {
  const { expired } = await searchParams;
  return expired ? <p className="text-sm text-muted">Sua sessão expirou. Entre de novo.</p> : null;
}
