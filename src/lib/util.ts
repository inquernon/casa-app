import type { Cadence, Unit } from "./types";

export const money = (n: number) => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

/** Fecha de hoy en Medellín, formato YYYY-MM-DD */
export function todayCO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];

export function addDays(iso: string, n: number): string {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = parts(a);
  const [y2, m2, d2] = parts(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 864e5);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = parts(iso.slice(0, 10));
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** "14 nov" a partir de una marca de tiempo, en hora de Colombia */
export const fmtDay = (ts: string) =>
  new Date(ts).toLocaleDateString("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" });

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
};

export interface Periods {
  q: string; // inicio de la quincena actual
  qEnd: string; // último día de la quincena
  w: string; // inicio de la semana actual (semana 1: días 0-6; semana 2: días 7-14)
}

/** Quincenas de 15 días contadas desde `start`. */
export function periods(start: string, today = todayCO()): Periods {
  if (today < start) return { q: start, w: start, qEnd: addDays(start, 14) };
  const q = addDays(start, 15 * Math.floor(daysBetween(start, today) / 15));
  const w = daysBetween(q, today) >= 7 ? addDays(q, 7) : q;
  return { q, w, qEnd: addDays(q, 14) };
}

export const periodStart = (cadence: Cadence, p: Periods) => (cadence === "semanal" ? p.w : p.q);

export function fmtQty(qty: number, unit: Unit): string {
  const n = Number(qty) || 0;
  if (unit === "g") return n >= 1000 ? `${(n / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} kg` : `${n.toLocaleString("es-CO")} g`;
  if (unit === "ml") return n >= 1000 ? `${(n / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} L` : `${n.toLocaleString("es-CO")} ml`;
  return `${n.toLocaleString("es-CO")} ${n === 1 ? "unidad" : "unidades"}`;
}

/** Precio por kg, por litro o por unidad */
export function unitPrice(price: number, qty: number, unit: Unit): { value: number; label: string } | null {
  if (!qty || qty <= 0) return null;
  if (unit === "g") return { value: (price / qty) * 1000, label: "/kg" };
  if (unit === "ml") return { value: (price / qty) * 1000, label: "/L" };
  return { value: price / qty, label: "/u" };
}

export const unitLabel = (u: Unit) => (u === "g" ? "gramos" : u === "ml" ? "mililitros" : "unidades");

/** Valor en pesos: acepta "12500", "12.500" o "$ 12.500". */
export function parseMoney(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  return digits ? Number(digits) : NaN;
}

/** Cantidad: acepta "1000", "1.000" (mil), "1,5" y "1.5". */
export function parseQty(s: string): number {
  let t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export function errorText(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/duplicate key/i.test(msg)) return "Ese artículo ya está marcado en este mercado.";
  if (/JWT|session/i.test(msg)) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Sin conexión. Revisa el internet y vuelve a intentar.";
  return msg;
}
