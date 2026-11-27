import { describe, expect, it } from "vitest";
import { byMonth, lastMonths, monthRange, summarize } from "../money";
import type { MoneyTx } from "../types";

const tx = (kind: MoneyTx["kind"], amount: number, tx_date: string, category = "Otro"): MoneyTx => ({
  id: Math.random().toString(), household_id: "h", user_id: "u", kind, amount, category, method: "efectivo", note: "", tx_date, trip_id: null, created_at: "",
});

describe("money", () => {
  const txs = [
    tx("ingreso", 3_000_000, "2026-11-01", "Salario"),
    tx("gasto", 680_070, "2026-11-15", "Mercado"),
    tx("gasto", 50_000, "2026-11-20", "Transporte"),
    tx("gasto", 20_000, "2026-11-21", "Mercado"),
    tx("gasto", 99_000, "2026-10-31", "Ocio"),
  ];

  it("resume solo el rango pedido y ordena categorías", () => {
    const s = summarize(txs, "2026-11-01", "2026-11-30");
    expect(s.ingresos).toBe(3_000_000);
    expect(s.gastos).toBe(750_070);
    expect(s.balance).toBe(2_249_930);
    expect(s.byCategory).toEqual([{ category: "Mercado", total: 700_070 }, { category: "Transporte", total: 50_000 }]);
  });

  it("acepta montos que llegan como texto desde Postgres", () => {
    const s = summarize([{ ...txs[0], amount: "1500" as unknown as number }], "2026-11-01", "2026-11-30");
    expect(s.ingresos).toBe(1500);
  });

  it("lista meses cruzando el año", () => {
    expect(lastMonths("2027-02", 4)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });

  it("agrupa por mes", () => {
    expect(byMonth(txs, ["2026-10", "2026-11"])).toEqual([
      { key: "2026-10", ingresos: 0, gastos: 99_000 },
      { key: "2026-11", ingresos: 3_000_000, gastos: 750_070 },
    ]);
  });

  it("calcula el rango del mes, incluido febrero bisiesto", () => {
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });
});
