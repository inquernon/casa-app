import type { Item, MenuEntry, Meal, Recipe, RecipeIngredient, Who } from "./types";
import { daysBetween } from "./util";

export const CYCLE = 14;

/** Día del ciclo (1..14) para una fecha. Funciona también con fechas anteriores al inicio. */
export function cycleDay(start: string, date: string): number {
  const d = daysBetween(start, date);
  return (((d % CYCLE) + CYCLE) % CYCLE) + 1;
}

/** "Semana 1 · lunes" a partir del día del ciclo (el ciclo empieza un lunes). */
export function cycleLabel(day: number): string {
  const names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  return `Semana ${day <= 7 ? 1 : 2} · ${names[(day - 1) % 7]}`;
}

export function recipeFor(plan: MenuEntry[], recipes: Recipe[], day: number, meal: Meal): Recipe | undefined {
  const e = plan.find((p) => p.day === day && p.meal === meal);
  return e ? recipes.find((r) => r.id === e.recipe_id) : undefined;
}

export const portion = (ri: RecipeIngredient, who: Who) =>
  who === "mariana" ? Number(ri.qty_m) : who === "alex" ? Number(ri.qty_a) : Number(ri.qty_m) + Number(ri.qty_a);

/** Lo que pide la receta por artículo, sumado (un artículo puede aparecer dos veces). */
export function needs(recipeId: string, ingredients: RecipeIngredient[], who: Who): Map<string, number> {
  const m = new Map<string, number>();
  for (const ri of ingredients) {
    if (ri.recipe_id !== recipeId) continue;
    const q = portion(ri, who);
    if (q > 0) m.set(ri.item_id, (m.get(ri.item_id) ?? 0) + q);
  }
  return m;
}

export interface Shortage {
  item: Item;
  need: number;
  have: number;
}

/** Artículos que no alcanzan para las recetas dadas (se suman entre recetas). */
export function shortages(recipeIds: string[], ingredients: RecipeIngredient[], items: Item[], stock: Map<string, number>, who: Who = "ambos"): Shortage[] {
  const total = new Map<string, number>();
  for (const id of recipeIds) for (const [k, v] of needs(id, ingredients, who)) total.set(k, (total.get(k) ?? 0) + v);
  const out: Shortage[] = [];
  for (const [itemId, need] of total) {
    const item = items.find((i) => i.id === itemId);
    const have = Math.max(0, stock.get(itemId) ?? 0);
    if (item && have + 1e-9 < need) out.push({ item, need, have });
  }
  return out.sort((a, b) => a.item.name.localeCompare(b.item.name));
}
