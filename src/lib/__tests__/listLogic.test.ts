import { describe, expect, it } from "vitest";
import { buildList, spentByPocket } from "../listLogic";
import type { Item, Purchase } from "../types";

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, household_id: "h", name: id, grp: "Despensa", unit: "unidad", buy_qty: 1, buy_label: "", every_days: 15, pocket: "mercado",
  running_low: false, place: "D1", note: "", min_stock: 0, sort: 1, active: true, ...over,
});
let n = 0;
const buy = (item_id: string | null, purchased_on: string, over: Partial<Purchase> = {}): Purchase => ({
  id: `p${++n}`, household_id: "h", trip_id: "t1", item_id, name: item_id ?? "extra", grp: "Despensa", qty: 1, unit: "unidad",
  price: 1000, pocket: "mercado", place: "D1", purchased_on, created_by: null, created_at: `${purchased_on}T10:00:${String(n).padStart(2, "0")}Z`, ...over,
});
const TODAY = "2026-11-25";
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).sort();

describe("lista de mercado por frecuencia", () => {
  it("con frecuencia y sin compras: entra como 'nunca'", () => {
    const s = buildList([item("leche")], [], new Map(), TODAY);
    expect(ids(s.toBuy)).toEqual(["leche"]);
    expect(s.reason(s.toBuy[0])).toBe("nunca");
  });

  it("comprado hace menos días que su frecuencia: al día, con fecha siguiente", () => {
    const s = buildList([item("cafe")], [buy("cafe", "2026-11-15")], new Map([["cafe", 1]]), TODAY);
    expect(s.toBuy).toEqual([]);
    expect(ids(s.upToDate)).toEqual(["cafe"]);
    expect(s.nextDue(s.upToDate[0])).toBe("2026-11-30");
  });

  it("cuando pasan sus días vuelve a la lista ('toca')", () => {
    const tomate = item("tomate", { every_days: 7 });
    const s = buildList([tomate], [buy("tomate", "2026-11-15")], new Map([["tomate", 3]]), TODAY);
    expect(s.reason(tomate)).toBe("toca");
  });

  it("justo en el día que toca, entra", () => {
    const s = buildList([item("x", { every_days: 10 })], [buy("x", "2026-11-15")], new Map([["x", 1]]), TODAY);
    expect(s.toBuy).toHaveLength(1);
  });

  it("'cuando se acabe' no entra solo; con 'se está acabando' sí", () => {
    const soya = item("soya", { every_days: null });
    expect(ids(buildList([soya], [], new Map(), TODAY).whenOut)).toEqual(["soya"]);
    const s = buildList([{ ...soya, running_low: true }], [], new Map(), TODAY);
    expect(s.reason(s.toBuy[0])).toBe("acabando");
  });

  it("lo comprado que se agotó en la despensa vuelve a la lista aunque no toque", () => {
    const s = buildList([item("huevos", { min_stock: 5, every_days: 30 })], [buy("huevos", "2026-11-20", { qty: 30 })], new Map([["huevos", 4]]), TODAY);
    expect(s.reason(s.toBuy[0])).toBe("agotado");
  });

  it("una compra sin cantidad no dispara 'agotado'", () => {
    const s = buildList([item("arroz", { every_days: 30 })], [buy("arroz", "2026-11-20", { qty: 0 })], new Map(), TODAY);
    expect(s.toBuy).toEqual([]);
  });

  it("los pausados no aparecen en ninguna sección", () => {
    const s = buildList([item("milo", { active: false })], [], new Map(), TODAY);
    expect([...s.toBuy, ...s.upToDate, ...s.whenOut]).toEqual([]);
  });

  it("lo marcado sin guardar sigue en la lista y no cuenta como faltante", () => {
    const marcado = buy("arroz", TODAY, { trip_id: null, price: 9000 });
    const s = buildList([item("arroz", { every_days: null }), item("leche")], [marcado], new Map(), TODAY);
    expect(ids(s.toBuy)).toEqual(["arroz", "leche"]);
    expect(s.reason(s.toBuy.find((i) => i.id === "arroz")!)).toBe("marcado");
    expect(s.remaining).toBe(1);
    expect(s.pendingTotal).toBe(9000);
  });

  it("separa los extras y recuerda el último lugar marcado", () => {
    const s = buildList([], [buy(null, TODAY, { trip_id: null, place: "Supermu" })], new Map(), TODAY);
    expect(s.extras).toHaveLength(1);
    expect(s.lastPlace).toBe("Supermu");
  });

  it("la última compra es la más reciente aunque llegue desordenada", () => {
    const s = buildList([item("x", { every_days: 5 })], [buy("x", "2026-11-22"), buy("x", "2026-11-01")], new Map([["x", 1]]), TODAY);
    expect(s.toBuy).toEqual([]);
  });
});

describe("gasto por bolsillo", () => {
  it("suma por bolsillo dentro del mes, incluidas las compras sin guardar", () => {
    const ps = [
      buy("a", "2026-11-15", { price: 500000 }),
      buy("b", "2026-11-20", { price: 60000, pocket: "mascotas" }),
      buy("c", "2026-10-30", { price: 99999 }),
      buy(null, "2026-11-25", { trip_id: null, price: 1000 }),
    ];
    expect(spentByPocket(ps, "2026-11-01", "2026-11-30")).toEqual({ mercado: 501000, mascotas: 60000 });
  });
});
