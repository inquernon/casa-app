export type Unit = "g" | "ml" | "unidad";
export type Cadence = "quincenal" | "semanal";

export const GROUPS = ["Proteína", "Sustituto", "Lácteo", "Harina", "Verdura", "Fruta", "Grasa", "Despensa", "Aseo", "Otro"] as const;
export const PLACES = ["Makro", "D1", "PriceSmart", "Supermu", "Ara", "Éxito", "Olímpica"];

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
