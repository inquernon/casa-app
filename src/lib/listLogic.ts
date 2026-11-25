import type { Item, Purchase } from "./types";
import { periodStart, type Periods } from "./util";

export interface ListState {
  /** Compras marcadas en el mercado abierto (aún sin "Guardar mercado") */
  pending: Purchase[];
  pendingByItem: Map<string, Purchase>;
  /** Compras marcadas que no son del catálogo */
  extras: Purchase[];
  /** Artículos activos que se muestran en la lista */
  toBuy: Item[];
  /** Artículos activos ya comprados en su periodo y que aún hay en despensa */
  already: Item[];
  /** Cuántos de toBuy faltan por marcar */
  remaining: number;
  /** Última compra guardada del artículo dentro de su periodo */
  boughtInPeriod: (i: Item) => Purchase | null;
  /** Comprado en el periodo, pero la despensa ya llegó al mínimo */
  ranOut: (i: Item) => boolean;
  /** Gastado desde el inicio de la quincena, incluido lo marcado */
  spent: number;
  pendingTotal: number;
  /** Lugar de la última compra marcada, para sugerirlo en la siguiente */
  lastPlace: string;
}

/** Reglas de la lista de mercado. Sin React ni Supabase para poder probarlas. */
export function buildList(items: Item[], purchases: Purchase[], stock: Map<string, number>, p: Periods): ListState {
  const pending = purchases.filter((x) => x.trip_id === null);
  const pendingByItem = new Map(pending.filter((x) => x.item_id).map((x) => [x.item_id as string, x]));

  const lastBought = new Map<string, Purchase>();
  for (const x of purchases) {
    if (!x.trip_id || !x.item_id) continue;
    const prev = lastBought.get(x.item_id);
    if (!prev || x.purchased_on > prev.purchased_on) lastBought.set(x.item_id, x);
  }

  const boughtInPeriod = (i: Item) => {
    const last = lastBought.get(i.id);
    return last && last.purchased_on >= periodStart(i.cadence, p) ? last : null;
  };
  const ranOut = (i: Item) => {
    const last = boughtInPeriod(i);
    return !!last && Number(last.qty) > 0 && (stock.get(i.id) ?? 0) <= Number(i.min_stock);
  };

  const active = items.filter((i) => i.active);
  const toBuy = active.filter((i) => pendingByItem.has(i.id) || !boughtInPeriod(i) || ranOut(i));
  const already = active.filter((i) => !pendingByItem.has(i.id) && boughtInPeriod(i) && !ranOut(i));
  const sum = (xs: Purchase[]) => xs.reduce((a, x) => a + Number(x.price), 0);

  return {
    pending,
    pendingByItem,
    extras: pending.filter((x) => !x.item_id),
    toBuy,
    already,
    remaining: toBuy.filter((i) => !pendingByItem.has(i.id)).length,
    boughtInPeriod,
    ranOut,
    spent: sum(purchases.filter((x) => x.purchased_on >= p.q)),
    pendingTotal: sum(pending),
    lastPlace: [...pending].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.place ?? "",
  };
}
