import "server-only";

import { unstable_rethrow } from "next/navigation";

import { AdminApiError } from "./session";

/** What a back-office form action returns to its form. */
export type FormState = {
  error?: string;
  saved?: string;
  /** Something shown once and never again, like a new device secret. */
  reveal?: { label: string; value: string };
};

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
export async function attempt(work: () => Promise<string | void | FormState>): Promise<FormState> {
  try {
    const result = await work();
    if (typeof result === "object") return result;
    return { saved: result ?? "Salvo." };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}

export const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
export const optionalText = (form: FormData, name: string) => text(form, name) || undefined;
export const checked = (form: FormData, name: string) => form.get(name) === "on";

/**
 * Why the store's order types cannot be saved, or null when they can. A kiosk
 * with "Comer aqui" and "Para viagem" both off has nothing to sell (BR-041).
 */
export function orderTypesError(dineIn: boolean, takeOut: boolean): string | null {
  if (dineIn || takeOut) return null;
  return "Deixe pelo menos um ligado: Comer aqui ou Para viagem. Sem os dois, o totem não tem o que vender.";
}

// Reais with an optional "R$", "." between thousands and up to two decimals
// after "," or ".": "28", "28,5", "1.234,50", "13.90". Anything else is not a
// price ("1e3", "10,005"), and is refused rather than guessed (COM-128).
const PRICE = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?$/;

/** "28,00" or "28.00" or "28" → 2800 cents; null for empty or invalid. */
export function cents(value: string): number | null {
  const match = PRICE.exec(value.trim());
  if (!match) return null;
  const [, reais, decimals = ""] = match;
  const total = Number(reais.replaceAll(".", "")) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * An optional price field: null when left empty, the cents when valid, and a
 * failed save naming `label` when it is not a price, so a typo never silently
 * drops an override (COM-128).
 */
export function optionalPrice(form: FormData, name: string, label: string): number | null {
  const value = text(form, name);
  if (!value) return null;
  const parsed = cents(value);
  if (parsed === null) throw new AdminApiError("VALIDATION_FAILED", label);
  return parsed;
}

/**
 * Loads a page's data: the data, or the owner-facing error message. Redirects
 * (no session, expired token) pass through instead of becoming an error.
 */
export async function load<T>(work: () => Promise<T>): Promise<{ data: T } | { error: string }> {
  try {
    return { data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
