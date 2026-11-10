import type { components } from "@/lib/core-api";

// The kitchen's order on contract v2 (pilot, COM-148): Go's SubmitOrderResponse.
// `number` is the key, `customerCheckNumber` the short number people call out,
// and the lines are `orderItems` (CheckItem) with options nested in `modifiers`.

export type KitchenOrder = components["schemas"]["SubmitOrderResponse"];
export type KitchenStatusChange = components["schemas"]["OrderStatusChange"];
type CheckItem = components["schemas"]["CheckItem"];

/** One line as the kitchen reads it: "2× Cappuccino", "Grande · Leite de aveia". */
export type KitchenLine = {
  /** Same for identical lines (same item, options and note). */
  key: string;
  /** Same for the same options at every depth, whatever the note. */
  variant: string;
  /** The product's id, for "Acabou" (an ITEM, SIZED_ITEM or COMBO_MEAL). */
  id: string;
  name: string;
  quantity: number;
  /** Option names, depth-first, "2× Queijo" when more than one. */
  options: string[];
  /** Each chosen option once, at any depth, for "Acabou". */
  choices: { id: string; name: string }[];
  /** The guest's note for this line. */
  note: string | null;
};

const shape = (item: CheckItem): string =>
  `${item.id}×${item.quantity}(${(item.modifiers ?? []).map(shape).join(",")})`;

function walk(modifiers: CheckItem[] | undefined, line: KitchenLine) {
  for (const m of modifiers ?? []) {
    const name = m.name ?? m.id;
    line.options.push(m.quantity > 1 ? `${m.quantity}× ${name}` : name);
    if (!line.choices.some((c) => c.id === m.id)) line.choices.push({ id: m.id, name });
    walk(m.modifiers, line);
  }
}

/**
 * The order's lines for the screens. The kiosk sends one product line per
 * unit, so identical lines are merged and their quantities added up (a count
 * of units, never an amount of money).
 */
export function kitchenLines(order: KitchenOrder): KitchenLine[] {
  const lines: KitchenLine[] = [];
  for (const item of order.orderItems ?? []) {
    const note = item.specialNotes?.trim() || null;
    const variant = (item.modifiers ?? []).map(shape).join(",");
    const key = `${item.id}|${variant}|${note ?? ""}`;
    const same = lines.find((l) => l.key === key);
    if (same) {
      same.quantity += item.quantity;
      continue;
    }
    const line: KitchenLine = {
      key,
      variant,
      id: item.id,
      name: item.name ?? item.id,
      quantity: item.quantity,
      options: [],
      choices: [],
      note,
    };
    walk(item.modifiers, line);
    lines.push(line);
  }
  return lines;
}

/** When the order last changed status. */
export const updatedAt = (order: KitchenOrder): string => order.history.at(-1)?.at ?? order.placedAt;

/** When a ready order became ready; null while it is not ready. */
export const readyAt = (order: KitchenOrder): string | null =>
  order.status === "READY" ? (order.history.findLast((c) => c.status === "READY")?.at ?? null) : null;
