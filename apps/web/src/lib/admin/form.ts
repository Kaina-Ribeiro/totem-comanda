import "server-only";

import { unstable_rethrow } from "next/navigation";

import type { components } from "@/lib/core-api";

import { describeMenuErrors, type NameOf } from "./menu-errors";
import { AdminApiError } from "./session";

/** What a back-office form action returns to its form. */
export type FormState = {
  error?: string;
  saved?: string;
  /** Something shown once and never again, like a new device secret. */
  reveal?: { label: string; value: string };
  /** One line per broken rule of a `MENU_INVALID` save (Review Focus 3). */
  problems?: string[];
};

const MESSAGES: Partial<Record<AdminApiError["code"], string>> = {
  CORE_UNAVAILABLE: "Não foi possível falar com o servidor. Tente de novo.",
  VALIDATION_FAILED: "Algum campo está inválido. Confira e salve de novo.",
  NOT_FOUND: "Isso não existe mais. Recarregue a página.",
  SCHEDULE_OVERLAP:
    "Esse horário bate com o de outro cardápio. Só um cardápio pode estar ativo por vez.",
  DISCOUNT_CODE_TAKEN: "Já existe um desconto com esse código.",
  MENU_INVALID: "O cardápio ficaria quebrado. Corrija e salve de novo.",
};

/** A save that left its first part saved: it could not be put back (COM-129). */
export class PartialSaveError extends Error {
  constructor(
    readonly saved: string,
    readonly notSaved: string,
    readonly cause: unknown,
  ) {
    super(`Saved ${saved} but not ${notSaved}`);
    this.name = "PartialSaveError";
  }
}

/** The owner-facing message for a failed Core API call. */
export function errorMessage(error: unknown): string {
  if (error instanceof PartialSaveError) {
    return `Salvou ${error.saved}, mas não ${error.notSaved}. ${errorMessage(error.cause)}`;
  }
  if (error instanceof AdminApiError) {
    const base = MESSAGES[error.code] ?? `Não deu certo (${error.code}).`;
    return error.detail && error.code === "VALIDATION_FAILED"
      ? `${base} (${error.detail})`
      : base;
  }
  return MESSAGES.CORE_UNAVAILABLE!;
}

/**
 * Runs a form action's Core API work; failures become a message, redirects
 * pass through. A `MENU_INVALID` answer also lists each broken rule, naming
 * entities with `nameOf` (the id when it does not know them).
 */
export async function attempt(
  work: () => Promise<string | void | FormState>,
  nameOf: NameOf = () => undefined,
): Promise<FormState> {
  try {
    const result = await work();
    if (typeof result === "object") return result;
    return { saved: result ?? "Salvo." };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof AdminApiError && error.code === "MENU_INVALID" && error.errors?.length) {
      return { error: errorMessage(error), problems: describeMenuErrors(error.errors, nameOf) };
    }
    return { error: errorMessage(error) };
  }
}

type LocalizedText = components["schemas"]["LocalizedText"];

/** Whether two names read the same in both languages; an empty `en` is no `en`. */
export function sameText(a: LocalizedText, b: LocalizedText): boolean {
  return a["pt-BR"] === b["pt-BR"] && (a.en ?? "") === (b.en ?? "");
}

type Part = { label: string; save: () => Promise<unknown> };

/**
 * One form saved through two Core calls, which the contract cannot make one
 * (COM-129). `first` (null when it did not change) must be undoable: when
 * `second` fails, `first` is put back so nothing stays half saved, and the
 * owner sees why. If it cannot be put back either, the error says what saved.
 */
export async function saveBoth(
  first: (Part & { undo: () => Promise<unknown> }) | null,
  second: Part,
): Promise<void> {
  await first?.save();
  try {
    await second.save();
  } catch (error) {
    if (!first) throw error;
    try {
      await first.undo();
    } catch {
      throw new PartialSaveError(first.label, second.label, error);
    }
    throw error;
  }
}

export const text = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();
export const optionalText = (form: FormData, name: string) =>
  text(form, name) || undefined;
export const checked = (form: FormData, name: string) =>
  form.get(name) === "on";

// Reais with an optional "R$", "." between thousands and up to two decimals
// after "," or ".": "28", "9,5", "1.234,50", "13.90". Anything else is not a
// price ("1e3", "10,005", "-1"), and is refused rather than guessed (COM-128,
// Review Focus 5).
const PRICE = /^(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?$/;

/** "9,50", "9.50", "9,5" or "R$ 9,50" → 9.5 (decimal BRL, contract v2); null when not a price. */
export function readPrice(raw: string): number | null {
  const match = PRICE.exec(raw.trim());
  if (!match) return null;
  const [, reais, decimals = ""] = match;
  const cents = Number(reais.replaceAll(".", "")) * 100 + Number(decimals.padEnd(2, "0"));
  // Integer cents back to reais: 30 / 100 is 0.3, never 0.30000000000000004.
  return Number.isSafeInteger(cents) ? cents / 100 : null;
}

/**
 * A price field: the price when valid; null when an optional field is left
 * empty; otherwise a failed save naming `label`, so a typo never silently
 * drops a price (COM-128).
 */
export function priceField(
  form: FormData,
  name: string,
  label: string,
  { optional = false }: { optional?: boolean } = {},
): number | null {
  const value = text(form, name);
  if (!value && optional) return null;
  const parsed = readPrice(value);
  if (parsed === null) throw new AdminApiError("VALIDATION_FAILED", label);
  return parsed;
}

/**
 * Loads a page's data: the data, or the owner-facing error message. Redirects
 * (no session, expired token) pass through instead of becoming an error.
 */
export async function load<T>(
  work: () => Promise<T>,
): Promise<{ data: T } | { error: string }> {
  try {
    return { data: await work() };
  } catch (error) {
    unstable_rethrow(error);
    return { error: errorMessage(error) };
  }
}
