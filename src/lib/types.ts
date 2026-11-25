export type Unit = "g" | "ml" | "unidad";
export type Cadence = "quincenal" | "semanal";

export const GROUPS = ["Proteína", "Sustituto", "Lácteo", "Harina", "Verdura", "Fruta", "Grasa", "Despensa", "Aseo", "Otro"] as const;
export const PLACES = ["D1", "Supermu", "Makro", "PriceSmart", "Éxito", "Olímpica"];

/** Posición del grupo en GROUPS (los desconocidos van al final). */
export const groupIndex = (g: string) => {
  const i = (GROUPS as readonly string[]).indexOf(g);
  return i < 0 ? GROUPS.length : i;
};

export interface Household {
  id: string;
  name: string;
  invite_code: string;
  budget_quincena: number;
  quincena_start: string;
  menu_start: string;
}

export interface Member {
  household_id: string;
  user_id: string;
  display_name: string;
}

export interface Item {
  id: string;
  household_id: string;
  name: string;
  grp: string;
  unit: Unit;
  buy_qty: number;
  buy_label: string;
  cadence: Cadence;
  place: string;
  note: string;
  min_stock: number;
  sort: number;
  active: boolean;
}

export interface Purchase {
  id: string;
  household_id: string;
  trip_id: string | null;
  item_id: string | null;
  name: string;
  grp: string;
  qty: number;
  unit: Unit;
  price: number;
  place: string;
  purchased_on: string;
  created_by: string | null;
  created_at: string;
}

export interface Trip {
  id: string;
  household_id: string;
  trip_date: string;
  total: number;
  item_count: number;
  places: string[];
  created_by: string | null;
  created_at: string;
}

export interface Movement {
  id: string;
  household_id: string;
  item_id: string;
  delta: number;
  reason: "compra" | "preparacion" | "consumo" | "ajuste";
  ref_id: string | null;
  note: string;
  created_by: string | null;
  created_at: string;
}
