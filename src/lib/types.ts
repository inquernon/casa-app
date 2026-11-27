export type Unit = "g" | "ml" | "unidad";
export type Pocket = "mercado" | "mascotas";

export const GROUPS = ["Proteína", "Sustituto", "Lácteo", "Harina", "Verdura", "Fruta", "Grasa", "Despensa", "Aseo", "Mascotas", "Otro"] as const;
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
  budget_food: number;
  budget_pets: number;
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
  /** Cada cuántos días se compra; null = "cuando se acabe" */
  every_days: number | null;
  pocket: Pocket;
  /** Alguien lo marcó como "se está acabando" */
  running_low: boolean;
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
  pocket: Pocket;
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

/** Bolsillo del presupuesto según el grupo (para artículos extra) */
export const pocketForGroup = (grp: string): Pocket => (grp === "Mascotas" ? "mascotas" : "mercado");

export type TxKind = "ingreso" | "gasto";
export type TxMethod = "efectivo" | "debito" | "credito" | "transferencia";
export const METHODS: { id: TxMethod; label: string }[] = [
  { id: "credito", label: "Tarjeta de crédito" },
  { id: "debito", label: "Débito" },
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
];
export const EXPENSE_CATS = ["Mercado", "Vivienda", "Servicios", "Transporte", "Vehículo", "Salud", "Educación", "Ocio", "Ropa", "Mascotas", "Deudas", "Regalos", "Otro"];
export const INCOME_CATS = ["Salario", "Honorarios", "Ventas", "Otro"];

export interface MoneyTx {
  id: string;
  household_id: string;
  user_id: string;
  kind: TxKind;
  amount: number;
  category: string;
  method: TxMethod;
  note: string;
  tx_date: string;
  trip_id: string | null;
  created_at: string;
}

/** Totales por persona que devuelve household_money (sin detalle). */
export interface MemberTotals {
  user_id: string;
  display_name: string;
  ingresos: number;
  gastos: number;
}
