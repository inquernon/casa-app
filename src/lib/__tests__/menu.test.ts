import { describe, expect, it } from "vitest";
import { cycleDay, cycleLabel, needs, shortages } from "../menu";
import type { Item, RecipeIngredient } from "../types";

const item = (id: string, name: string): Item =>
  ({ id, name, household_id: "h", grp: "Otro", unit: "unidad", buy_qty: 0, buy_label: "", place: "", note: "", min_stock: 0, sort: 0, active: true, every_days: null, pocket: "mercado", running_low: false }) as unknown as Item;
const ri = (recipe_id: string, item_id: string, qty_m: number, qty_a: number): RecipeIngredient => ({ id: Math.random().toString(), household_id: "h", recipe_id, item_id, qty_m, qty_a });

describe("menu", () => {
  it("el lunes 30 nov es el día 1 y el ciclo da la vuelta a los 14 días", () => {
    expect(cycleDay("2026-11-30", "2026-11-30")).toBe(1);
    expect(cycleDay("2026-11-30", "2026-12-13")).toBe(14);
    expect(cycleDay("2026-11-30", "2026-12-14")).toBe(1);
    expect(cycleDay("2026-11-30", "2026-11-29")).toBe(14);
  });

  it("nombra la semana y el día", () => {
    expect(cycleLabel(1)).toBe("Semana 1 · lunes");
    expect(cycleLabel(10)).toBe("Semana 2 · miércoles");
  });

  it("suma las porciones según para quién se prepara", () => {
    const ing = [ri("r", "huevo", 1, 1), ri("r", "huevo", 1, 0), ri("r", "leche", 200, 200)];
    expect(needs("r", ing, "ambos").get("huevo")).toBe(3);
    expect(needs("r", ing, "alex").get("huevo")).toBe(1);
    expect(needs("r", ing, "mariana").get("leche")).toBe(200);
  });

  it("marca lo que no alcanza sumando varias recetas", () => {
    const items = [item("huevo", "Huevos"), item("leche", "Leche")];
    const ing = [ri("a", "huevo", 1, 1), ri("b", "huevo", 1.5, 1.5), ri("a", "leche", 200, 200)];
    const stock = new Map([["huevo", 4], ["leche", 1000]]);
    const s = shortages(["a", "b"], ing, items, stock);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ need: 5, have: 4 });
  });

  it("trata el stock negativo como cero", () => {
    const s = shortages(["a"], [ri("a", "huevo", 1, 0)], [item("huevo", "Huevos")], new Map([["huevo", -3]]));
    expect(s[0].have).toBe(0);
  });
});
