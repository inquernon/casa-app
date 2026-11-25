import { describe, expect, it } from "vitest";
import { addDays, daysBetween, fmtQty, parseMoney, parseQty, periodStart, periods, unitPrice } from "../util";

describe("fechas", () => {
  it("suma días cruzando mes y año", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("cuenta días entre fechas", () => {
    expect(daysBetween("2026-11-12", "2026-11-27")).toBe(15);
    expect(daysBetween("2026-11-27", "2026-11-12")).toBe(-15);
  });
});

describe("periodos (quincena de 15 días, semana 1 = días 0-6)", () => {
  const start = "2026-11-12";
  it.each([
    ["2026-11-12", "2026-11-12", "2026-11-12", "2026-11-26"],
    ["2026-11-18", "2026-11-12", "2026-11-12", "2026-11-26"],
    ["2026-11-19", "2026-11-12", "2026-11-19", "2026-11-26"],
    ["2026-11-26", "2026-11-12", "2026-11-19", "2026-11-26"],
    ["2026-11-27", "2026-11-27", "2026-11-27", "2026-12-11"],
    ["2026-12-04", "2026-11-27", "2026-12-04", "2026-12-11"],
  ])("hoy %s → quincena %s, semana %s, fin %s", (today, q, w, qEnd) => {
    expect(periods(start, today)).toEqual({ q, w, qEnd });
  });
  it("antes del inicio usa el inicio", () => {
    expect(periods(start, "2026-11-01")).toEqual({ q: start, w: start, qEnd: "2026-11-26" });
  });
  it("periodStart según frecuencia", () => {
    const p = periods(start, "2026-11-20");
    expect(periodStart("quincenal", p)).toBe("2026-11-12");
    expect(periodStart("semanal", p)).toBe("2026-11-19");
  });
});

describe("lectura de números escritos por la persona", () => {
  it.each([
    ["12500", 12500],
    ["12.500", 12500],
    ["$ 12.500", 12500],
    ["8990", 8990],
    ["", NaN],
    ["abc", NaN],
  ])("valor %j → %d", (s, n) => {
    expect(parseMoney(s)).toEqual(n);
  });
  it.each([
    ["1000", 1000],
    ["1.000", 1000],
    ["1,5", 1.5],
    ["1.5", 1.5],
    [" 30 ", 30],
    ["", NaN],
    ["x", NaN],
  ])("cantidad %j → %d", (s, n) => {
    expect(parseQty(s)).toEqual(n);
  });
});

describe("formato de cantidades y precio por unidad", () => {
  it("formatea gramos, mililitros y unidades", () => {
    expect(fmtQty(500, "g")).toBe("500 g");
    expect(fmtQty(2500, "g")).toBe("2,5 kg");
    expect(fmtQty(12000, "ml")).toBe("12 L");
    expect(fmtQty(1, "unidad")).toBe("1 unidad");
    expect(fmtQty(30, "unidad")).toBe("30 unidades");
  });
  it("calcula precio por kilo, litro o unidad", () => {
    expect(unitPrice(24000, 1500, "g")).toEqual({ value: 16000, label: "/kg" });
    expect(unitPrice(4200, 1000, "ml")).toEqual({ value: 4200, label: "/L" });
    expect(unitPrice(9000, 30, "unidad")).toEqual({ value: 300, label: "/u" });
    expect(unitPrice(5000, 0, "g")).toBeNull();
  });
});
