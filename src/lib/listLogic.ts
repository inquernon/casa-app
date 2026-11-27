import type { Item, Pocket, Purchase } from "./types";
import { addDays, daysBetween } from "./util";

/** Por qué un artículo está en la lista */
export type DueReason = "marcado" | "acabando" | "agotado" | "toca" | "nunca";

export const REASON_LABEL: Record<DueReason, string> = {
  marcado: "",
  acabando: "se está acabando",
  agotado: "se acabó en la despensa",
  toca: "ya toca",
  nunca: "sin compras registradas",
};

export interface ListState {
  /** Compras marcadas en el mercado abierto (aún sin "Guardar mercado") */
  pending: Purchase[];
  pendingByItem: Map<string, Purchase>;
  /** Compras marcadas que no son del catálogo */
  extras: Purchase[];
  /** Artículos que hay que comprar, con el motivo */
  toBuy: Item[];
  reason: (i: Item) => DueReason | null;
  /** Artículos con frecuencia que todavía no tocan */
  upToDate: Item[];
  /** Artículos sin frecuencia ("cuando se acabe") que nadie ha marcado */
  whenOut: Item[];
  /** Cuántos de toBuy faltan por marcar */
  remaining: number;
  lastBought: (i: Item) => Purchase | null;
  /** Fecha en que vuelve a tocar comprar el artículo */
  nextDue: (i: Item) => string | null;
  /** Lugar de la última compra marcada, para sugerirlo en la siguiente */
  lastPlace: string;
  pendingTotal: number;
}

/**
 * Reglas de la lista de mercado. Sin React ni Supabase para poder probarlas.
 * Un artículo entra a la lista si: alguien lo marcó como "se está acabando"; la despensa llegó al mínimo
 * después de una compra; pasaron sus días desde la última compra; o tiene frecuencia y nunca se ha comprado.
 */
export function buildList(items: Item[], purchases: Purchase[], stock: Map<string, number>, today: string): ListState {
  const pending = purchases.filter((x) => x.trip_id === null);
  const pendingByItem = new Map(pending.filter((x) => x.item_id).map((x) => [x.item_id as string, x]));

  const lastMap = new Map<string, Purchase>();
  for (const x of purchases) {
    if (!x.trip_id || !x.item_id) continue;
    const prev = lastMap.get(x.item_id);
    if (!prev || x.purchased_on > prev.purchased_on) lastMap.set(x.item_id, x);
  }
  const lastBought = (i: Item) => lastMap.get(i.id) ?? null;
  const nextDue = (i: Item) => {
    const last = lastBought(i);
    return last && i.every_days ? addDays(last.purchased_on, i.every_days) : null;
  };

  const reason = (i: Item): DueReason | null => {
    if (pendingByItem.has(i.id)) return "marcado";
    if (i.running_low) return "acabando";
    const last = lastBought(i);
    if (last && Number(last.qty) > 0 && (stock.get(i.id) ?? 0) <= Number(i.min_stock)) return "agotado";
    if (i.every_days == null) return null;
    if (!last) return "nunca";
    return daysBetween(last.purchased_on, today) >= i.every_days ? "toca" : null;
  };

  const active = items.filter((i) => i.active);
  const toBuy = active.filter((i) => reason(i) !== null);
  const rest = active.filter((i) => reason(i) === null);
  const sum = (xs: Purchase[]) => xs.reduce((a, x) => a + Number(x.price), 0);

  return {
    pending,
    pendingByItem,
    extras: pending.filter((x) => !x.item_id),
    toBuy,
    reason,
    upToDate: rest.filter((i) => i.every_days != null),
    whenOut: rest.filter((i) => i.every_days == null),
    remaining: toBuy.filter((i) => !pendingByItem.has(i.id)).length,
    lastBought,
    nextDue,
    lastPlace: [...pending].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.place ?? "",
    pendingTotal: sum(pending),
  };
}

/** Gasto del periodo [start, end] por bolsillo, incluidas las compras marcadas sin guardar. */
export function spentByPocket(purchases: Purchase[], start: string, end: string): Record<Pocket, number> {
  const out: Record<Pocket, number> = { mercado: 0, mascotas: 0 };
  for (const x of purchases) {
    if (x.purchased_on < start || x.purchased_on > end) continue;
    out[x.pocket ?? "mercado"] += Number(x.price);
  }
  return out;
}
