import { describe, expect, it } from "vitest";
import { buildList } from "../listLogic";
import { periods } from "../util";
import type { Item, Purchase } from "../types";

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, household_id: "h", name: id, grp: "Despensa", unit: "unidad", buy_qty: 1, buy_label: "", cadence: "quincenal",
  place: "D1", note: "", min_stock: 0, sort: 1, active: true, ...over,
});
let n = 0;
const buy = (item_id: string | null, purchased_on: string, over: Partial<Purchase> = {}): Purchase => ({
  id: `p${++n}`, household_id: "h", trip_id: "t1", item_id, name: item_id ?? "extra", grp: "Despensa", qty: 1, unit: "unidad",
  price: 1000, place: "D1", purchased_on, created_by: null, created_at: `${purchased_on}T10:00:${String(n).padStart(2, "0")}Z`, ...over,
});
const p = periods("2026-11-12", "2026-11-20"); // quincena desde 12 nov, semana desde 19 nov
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

describe("lista de mercado", () => {
  it("lo no comprado en su periodo está por comprar", () => {
    const s = buildList([item("arroz"), item("leche")], [], new Map(), p);
    expect(ids(s.toBuy)).toEqual(["arroz", "leche"]);
    expect(s.already).toEqual([]);
    expect(s.remaining).toBe(2);
  });

  it("lo quincenal comprado en la quincena sale de la lista", () => {
    const s = buildList([item("arroz")], [buy("arroz", "2026-11-13")], new Map([["arroz", 1]]), p);
    expect(s.toBuy).toEqual([]);
    expect(ids(s.already)).toEqual(["arroz"]);
  });

  it("lo semanal comprado la semana pasada vuelve a la lista", () => {
    const tomate = item("tomate", { cadence: "semanal" });
    const s = buildList([tomate], [buy("tomate", "2026-11-14")], new Map([["tomate", 5]]), p);
    expect(ids(s.toBuy)).toEqual(["tomate"]);
  });

  it("lo comprado antes de la quincena vuelve a la lista", () => {
    const s = buildList([item("arroz")], [buy("arroz", "2026-11-10")], new Map([["arroz", 1]]), p);
    expect(ids(s.toBuy)).toEqual(["arroz"]);
  });

  it("lo comprado que se agotó en la despensa vuelve a la lista", () => {
    const s = buildList([item("huevos", { min_stock: 5 })], [buy("huevos", "2026-11-13", { qty: 30 })], new Map([["huevos", 4]]), p);
    expect(ids(s.toBuy)).toEqual(["huevos"]);
    expect(s.ranOut(s.toBuy[0])).toBe(true);
  });

  it("una compra sin cantidad no dispara el 'se acabó'", () => {
    const s = buildList([item("arroz")], [buy("arroz", "2026-11-13", { qty: 0 })], new Map(), p);
    expect(s.toBuy).toEqual([]);
  });

  it("los artículos pausados no aparecen", () => {
    const s = buildList([item("milo", { active: false })], [], new Map(), p);
    expect(s.toBuy).toEqual([]);
    expect(s.already).toEqual([]);
  });

  it("lo marcado sin guardar sigue en la lista, tachado, y no cuenta como faltante", () => {
    const marcado = buy("arroz", "2026-11-20", { trip_id: null, price: 9000 });
    const s = buildList([item("arroz"), item("leche")], [marcado], new Map(), p);
    expect(ids(s.toBuy)).toEqual(["arroz", "leche"]);
    expect(s.pendingByItem.get("arroz")).toBe(marcado);
    expect(s.remaining).toBe(1);
    expect(s.pendingTotal).toBe(9000);
  });

  it("separa los extras y suma el gasto de la quincena", () => {
    const s = buildList(
      [item("arroz")],
      [buy("arroz", "2026-11-13", { price: 5000 }), buy("arroz", "2026-11-01", { price: 99999 }), buy(null, "2026-11-20", { trip_id: null, price: 3000, place: "Supermu" })],
      new Map([["arroz", 1]]),
      p,
    );
    expect(s.extras).toHaveLength(1);
    expect(s.spent).toBe(8000);
    expect(s.lastPlace).toBe("Supermu");
  });

  it("los artículos inactivos marcados no descuadran el conteo", () => {
    const s = buildList([item("milo", { active: false }), item("leche")], [buy("milo", "2026-11-20", { trip_id: null })], new Map(), p);
    expect(s.remaining).toBe(1);
  });
});
