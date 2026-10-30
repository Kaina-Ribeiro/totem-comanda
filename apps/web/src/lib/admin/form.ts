import "server-only";

import { unstable_rethrow } from "next/navigation";

import { AdminApiError } from "./session";

/** What a back-office form action returns to its form. */
export type FormState = { error?: string; saved?: string };

const MESSAGES: Partial<Record<AdminApiError["code"], string>> = {
  CORE_UNAVAILABLE: "Não foi possível falar com o servidor. Tente de novo.",
  VALIDATION_FAILED: "Algum campo está inválido. Confira e salve de novo.",
  NOT_FOUND: "Isso não existe mais. Recarregue a página.",
  SCHEDULE_OVERLAP:
    "Esse horário bate com o de outro cardápio. Só um cardápio pode estar ativo por vez.",
  DISCOUNT_CODE_TAKEN: "Já existe um desconto com esse código.",
};

/** The owner-facing message for a failed Core API call. */
export function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    const base = MESSAGES[error.code] ?? `Não deu certo (${error.code}).`;
    return error.detail && error.code === "VALIDATION_FAILED" ? `${base} (${error.detail})` : base;
  }
  return MESSAGES.CORE_UNAVAILABLE!;
}

/** Runs a form action's Core API work; failures become a message, redirects pass through. */
export async function attempt(work: () => Promise<string | void>): Promise<FormState> {
  try {
    const saved = await work();
    return { saved: saved ?? "Salvo." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}

export const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
export const optionalText = (form: FormData, name: string) => text(form, name) || undefined;
export const checked = (form: FormData, name: string) => form.get(name) === "on";

/** "28,00" or "28.00" or "28" → 2800 cents; null for empty or invalid. */
export function cents(value: string): number | null {
  const clean = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (clean === "") return null;
  const number = Number(clean);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}
