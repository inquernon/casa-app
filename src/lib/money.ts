import type { MoneyTx } from "./types";

export interface MoneySummary {
  ingresos: number;
  gastos: number;
  balance: number;
  /** Gastos por categoría, de mayor a menor */
  byCategory: { category: string; total: number }[];
}

/** Resumen de los movimientos con fecha entre start y end (incluidos). */
export function summarize(txs: MoneyTx[], start: string, end: string): MoneySummary {
  let ingresos = 0, gastos = 0;
  const cats = new Map<string, number>();
  for (const t of txs) {
    if (t.tx_date < start || t.tx_date > end) continue;
    const a = Number(t.amount) || 0;
    if (t.kind === "ingreso") ingresos += a;
    else {
      gastos += a;
      cats.set(t.category, (cats.get(t.category) ?? 0) + a);
    }
  }
  const byCategory = [...cats].map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  return { ingresos, gastos, balance: ingresos - gastos, byCategory };
}

/** Claves "AAAA-MM" de los últimos n meses hasta el mes de `month` (incluido), de la más antigua a la más reciente. */
export function lastMonths(month: string, n: number): string[] {
  const [y, m] = month.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** Ingresos y gastos por mes para las claves dadas. */
export function byMonth(txs: MoneyTx[], keys: string[]): { key: string; ingresos: number; gastos: number }[] {
  const map = new Map(keys.map((k) => [k, { key: k, ingresos: 0, gastos: 0 }]));
  for (const t of txs) {
    const row = map.get(t.tx_date.slice(0, 7));
    if (!row) continue;
    if (t.kind === "ingreso") row.ingresos += Number(t.amount) || 0;
    else row.gastos += Number(t.amount) || 0;
  }
  return keys.map((k) => map.get(k)!);
}

/** Primer y último día del mes "AAAA-MM". */
export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${key}-01`, end: `${key}-${String(days).padStart(2, "0")}` };
}
