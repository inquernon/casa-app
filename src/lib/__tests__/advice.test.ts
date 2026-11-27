import { describe, expect, it } from "vitest";
import { buildAdvice } from "../advice";
import type { Household, Item, Movement, Purchase } from "../types";

const hh: Household = { id: "h", name: "Casa", invite_code: "x", budget_food: 850000, budget_pets: 120000, menu_start: "2026-11-12" };
const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, household_id: "h", name: id, grp: "Despensa", unit: "unidad", buy_qty: 1, buy_label: "", every_days: 30, pocket: "mercado",
  running_low: false, place: "D1", note: "", min_stock: 0, sort: 1, active: true, ...over,
});
let n = 0;
const buy = (item_id: string, over: Partial<Purchase> = {}): Purchase => ({
  id: `p${++n}`, household_id: "h", trip_id: "t1", item_id, name: item_id, grp: "Despensa", qty: 1, unit: "unidad", price: 1000,
  pocket: "mercado", place: "Supermu", purchased_on: "2026-11-15", created_by: null, created_at: "2026-11-15T20:00:00Z", ...over,
});
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("sugerencias", () => {
  it("sin datos no inventa nada", () => {
    expect(buildAdvice(hh, [], [], [], new Map(), "2026-11-25")).toEqual([]);
  });

  it("alerta cuando el gasto va más rápido que el mes", () => {
    const a = buildAdvice(hh, [], [buy("x", { price: 680070 })], [], new Map(), "2026-11-10");
    const r = a.find((x) => x.id === "ritmo-mercado")!;
    expect(r.level).toBe("alerta");
    expect(r.title).toContain("80 %");
  });

  it("alerta cuando se pasan del presupuesto", () => {
    const a = buildAdvice(hh, [], [buy("x", { price: 900000 })], [], new Map(), "2026-11-25");
    expect(a.find((x) => x.id === "ritmo-mercado")!.title).toContain("se pasaron por $50.000");
  });

  it("señala cuando la despensa supera a la proteína y nombra lo más caro", () => {
    const ps = [buy("pulpas", { price: 41700 }), buy("milo", { price: 20000 }), buy("carne", { grp: "Proteína", price: 31917 })];
    const d = buildAdvice(hh, [], ps, [], new Map(), "2026-11-25").find((x) => x.id === "despensa")!;
    expect(d.level).toBe("ahorro");
    expect(d.detail).toContain("pulpas $41.700");
  });

  it("calcula la proteína por kilo comestible y ajusta los cortes con hueso", () => {
    const ps = [
      buy("pollo", { name: "Pollo sin hueso", grp: "Proteína", unit: "g", qty: 1000, price: 14526 }),
      buy("osobuco", { name: "Osobuco", grp: "Proteína", unit: "g", qty: 1000, price: 8652 }),
      buy("tabla", { name: "Tabla", grp: "Proteína", unit: "g", qty: 1000, price: 38128 }),
    ];
    const p = buildAdvice(hh, [], ps, [], new Map(), "2026-11-25").find((x) => x.id === "proteina")!;
    expect(p.title).toContain("Pollo sin hueso");
    expect(p.detail).toContain("Osobuco $17.304/kg*");
  });

  it("compara lugares por precio por unidad", () => {
    const ps = [
      buy("pasta", { unit: "g", qty: 500, price: 4000, place: "D1", purchased_on: "2026-11-01" }),
      buy("pasta", { unit: "g", qty: 1500, price: 23250, place: "Supermu", purchased_on: "2026-11-15" }),
    ];
    const l = buildAdvice(hh, [], ps, [], new Map(), "2026-11-25").find((x) => x.id === "lugar-pasta")!;
    expect(l.title).toBe("pasta: más barato en D1");
  });

  it("avisa de subidas de precio en el mismo lugar", () => {
    const ps = [buy("cafe", { price: 18000, purchased_on: "2026-10-15" }), buy("cafe", { price: 22000 })];
    expect(ids(buildAdvice(hh, [], ps, [], new Map(), "2026-11-25"))).toContain("sube-cafe");
  });

  it("lista los básicos que nunca se han comprado", () => {
    const items = [item("Huevos", { grp: "Sustituto" }), item("Leche", { grp: "Lácteo" }), item("Soya", { every_days: null })];
    const a = buildAdvice(hh, items, [buy("otro")], [], new Map(), "2026-11-25").find((x) => x.id === "nunca")!;
    expect(a.detail).toContain("Huevos, Leche");
    expect(a.detail).not.toContain("Soya");
  });

  it("estima lo que cuesta lo que toca comprar con el último precio", () => {
    const items = [item("cafe", { every_days: 7 })];
    const a = buildAdvice(hh, items, [buy("cafe", { price: 22000 })], [], new Map([["cafe", 1]]), "2026-11-25").find((x) => x.id === "por-comprar")!;
    expect(a.title).toContain("$22.000");
  });

  it("recuerda registrar consumo si la despensa está quieta", () => {
    const mv: Movement[] = [{ id: "m", household_id: "h", item_id: "x", delta: -1, reason: "consumo", ref_id: null, note: "", created_by: null, created_at: "2026-11-24T10:00:00Z" }];
    expect(ids(buildAdvice(hh, [], [buy("x")], [], new Map(), "2026-11-25"))).toContain("despensa-quieta");
    expect(ids(buildAdvice(hh, [], [buy("x")], mv, new Map(), "2026-11-25"))).not.toContain("despensa-quieta");
  });

  it("ordena alertas antes que ahorro y datos", () => {
    const ps = [buy("pulpas", { price: 600000 }), buy("carne", { grp: "Proteína", price: 30000 })];
    const levels = buildAdvice(hh, [], ps, [], new Map(), "2026-11-05").map((x) => x.level);
    expect(levels).toEqual([...levels].sort((a, b) => ["alerta", "ahorro", "info"].indexOf(a) - ["alerta", "ahorro", "info"].indexOf(b)));
  });
});
