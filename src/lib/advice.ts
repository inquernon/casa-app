import type { Household, Item, Movement, Purchase } from "./types";
import { buildList, spentByPocket } from "./listLogic";
import { daysBetween, money, monthOf, unitPrice } from "./util";

export type AdviceLevel = "alerta" | "ahorro" | "info";

export interface Advice {
  id: string;
  level: AdviceLevel;
  title: string;
  detail: string;
}

const pct = (n: number) => `${Math.round(n * 100)} %`;
const BONY = /osobuco|espinazo|costilla|con hueso|\balas\b/i;
const isBony = (name: string) => BONY.test(name) && !/sin hueso/i.test(name);
/** Fracción comestible aproximada de los cortes con hueso */
export const BONY_YIELD = 0.5;

/**
 * Sugerencias a partir de las compras, la despensa y el presupuesto.
 * Solo reglas con números verificables: no inventa precios de otras tiendas.
 */
export function buildAdvice(
  household: Household,
  items: Item[],
  purchases: Purchase[],
  movements: Movement[],
  stock: Map<string, number>,
  today: string,
): Advice[] {
  const out: Advice[] = [];
  const m = monthOf(today);
  const monthPurchases = purchases.filter((x) => x.purchased_on >= m.start && x.purchased_on <= m.end);
  const spent = spentByPocket(purchases, m.start, m.end);
  const elapsed = m.day / m.days;
  const daysLeft = m.days - m.day + 1;

  // 1. Ritmo del presupuesto por bolsillo
  const pockets: [keyof typeof spent, string, number][] = [
    ["mercado", "Comida y aseo", Number(household.budget_food) || 0],
    ["mascotas", "Mascotas", Number(household.budget_pets) || 0],
  ];
  for (const [key, label, budget] of pockets) {
    if (!budget) continue;
    const used = spent[key] / budget;
    const left = budget - spent[key];
    if (left < 0) {
      out.push({ id: `ritmo-${key}`, level: "alerta", title: `${label}: se pasaron por ${money(-left)}`, detail: `Gastado ${money(spent[key])} de ${money(budget)} este mes.` });
    } else if (spent[key] > 0 && used > elapsed + 0.25) {
      out.push({
        id: `ritmo-${key}`,
        level: "alerta",
        title: `${label}: llevan ${pct(used)} del presupuesto y va ${pct(elapsed)} del mes`,
        detail: `Quedan ${money(left)} para ${daysLeft} días: unos ${money(left / daysLeft)} por día.`,
      });
    } else if (spent[key] > 0) {
      out.push({ id: `ritmo-${key}`, level: "info", title: `${label}: ${pct(used)} del presupuesto usado`, detail: `Quedan ${money(left)} para ${daysLeft} días.` });
    }
  }

  // 2. Lo que toca comprar vs. lo que queda
  const list = buildList(items, purchases, stock, today);
  const lastPrice = (i: Item) => list.lastBought(i)?.price ?? null;
  const due = list.toBuy.filter((i) => !list.pendingByItem.has(i.id) && i.pocket === "mercado");
  const priced = due.filter((i) => lastPrice(i) != null);
  if (priced.length) {
    const est = priced.reduce((a, i) => a + Number(lastPrice(i)), 0);
    const left = (Number(household.budget_food) || 0) - spent.mercado;
    const unpriced = due.length - priced.length;
    out.push({
      id: "por-comprar",
      level: est > left ? "alerta" : "info",
      title: `Lo que toca comprar cuesta unos ${money(est)}`,
      detail:
        `${priced.length} artículos con precio conocido` +
        (unpriced ? ` y ${unpriced} sin precio todavía` : "") +
        `. Quedan ${money(Math.max(0, left))} del presupuesto de comida y aseo.` +
        (est > left ? " No alcanza: prioricen proteína, harinas, lácteos y verduras." : ""),
    });
  }

  // 3. Artículos con frecuencia que nunca se han registrado
  const never = list.toBuy.filter((i) => list.reason(i) === "nunca" && i.pocket === "mercado");
  const basics = never.filter((i) => ["Proteína", "Sustituto", "Lácteo", "Harina"].includes(i.grp));
  if (basics.length) {
    out.push({
      id: "nunca",
      level: "alerta",
      title: `${basics.length} básicos sin ninguna compra registrada`,
      detail: `${basics.slice(0, 8).map((i) => i.name).join(", ")}${basics.length > 8 ? "…" : ""}. Si ya los tienen en casa, regístrenlos en la despensa; si no, van en el próximo mercado.`,
    });
  }

  // 4. Grupos: despensa por encima de la proteína
  const byGroup = new Map<string, number>();
  monthPurchases.filter((x) => x.pocket === "mercado").forEach((x) => byGroup.set(x.grp, (byGroup.get(x.grp) ?? 0) + Number(x.price)));
  const despensa = byGroup.get("Despensa") ?? 0;
  const proteina = byGroup.get("Proteína") ?? 0;
  if (spent.mercado > 0 && despensa > proteina) {
    const top = monthPurchases.filter((x) => x.grp === "Despensa").sort((a, b) => b.price - a.price).slice(0, 4);
    out.push({
      id: "despensa",
      level: "ahorro",
      title: `La despensa (${pct(despensa / spent.mercado)}) supera a la proteína (${pct(proteina / spent.mercado)})`,
      detail: `Lo más caro: ${top.map((x) => `${x.name} ${money(x.price)}`).join(", ")}. Es el primer lugar donde recortar si el mes no alcanza.`,
    });
  }

  // 5. Artículos más caros del mes
  if (monthPurchases.length >= 5) {
    const top = [...monthPurchases].sort((a, b) => b.price - a.price).slice(0, 5);
    const total = monthPurchases.reduce((a, x) => a + Number(x.price), 0);
    const topSum = top.reduce((a, x) => a + Number(x.price), 0);
    out.push({
      id: "top",
      level: "info",
      title: `5 artículos son el ${pct(topSum / total)} del gasto del mes`,
      detail: top.map((x) => `${x.name} ${money(x.price)}`).join(" · "),
    });
  }

  // 6. Proteína: precio por kilo comestible
  const protein = new Map<string, { name: string; perKg: number; bony: boolean; on: string }>();
  for (const x of purchases) {
    if (x.grp !== "Proteína" || x.unit !== "g") continue;
    const up = unitPrice(Number(x.price), Number(x.qty), x.unit);
    if (!up) continue;
    const bony = isBony(x.name);
    const key = x.item_id ?? x.name;
    const prev = protein.get(key);
    // el precio vigente es el de la compra más reciente
    if (!prev || x.purchased_on >= prev.on) protein.set(key, { name: x.name, perKg: bony ? up.value / BONY_YIELD : up.value, bony, on: x.purchased_on });
  }
  if (protein.size >= 2) {
    const ranked = [...protein.values()].sort((a, b) => a.perKg - b.perKg);
    out.push({
      id: "proteina",
      level: "ahorro",
      title: `Proteína más barata por kilo comestible: ${ranked[0].name}`,
      detail:
        ranked.map((r) => `${r.name} ${money(r.perKg)}/kg${r.bony ? "*" : ""}`).join(" · ") +
        (ranked.some((r) => r.bony) ? ". *Con hueso: se calcula con un rendimiento aprox. del 50 %." : ""),
    });
  }

  // 7. Mismo artículo, distinto lugar: dónde estuvo más barato
  const byItem = new Map<string, Purchase[]>();
  purchases.filter((x) => x.trip_id && x.qty > 0).forEach((x) => {
    const k = x.item_id ?? x.name;
    byItem.set(k, [...(byItem.get(k) ?? []), x]);
  });
  for (const [k, list2] of byItem) {
    const places = new Set(list2.map((x) => x.place));
    const sorted = [...list2].sort((a, b) => b.purchased_on.localeCompare(a.purchased_on));
    const last = sorted[0];
    const upLast = unitPrice(Number(last.price), Number(last.qty), last.unit);
    if (!upLast) continue;
    const ups = list2.map((x) => ({ x, up: unitPrice(Number(x.price), Number(x.qty), x.unit)! })).filter((r) => r.up);
    const best = ups.sort((a, b) => a.up.value - b.up.value)[0];
    if (places.size >= 2 && best.x.place !== last.place && upLast.value > best.up.value * 1.1) {
      out.push({
        id: `lugar-${k}`,
        level: "ahorro",
        title: `${last.name}: más barato en ${best.x.place}`,
        detail: `Última compra ${money(upLast.value)}${upLast.label} en ${last.place}; en ${best.x.place} estuvo a ${money(best.up.value)}${best.up.label}.`,
      });
    } else if (sorted.length >= 2) {
      const prev = unitPrice(Number(sorted[1].price), Number(sorted[1].qty), sorted[1].unit);
      if (prev && upLast.value > prev.value * 1.15) {
        out.push({
          id: `sube-${k}`,
          level: "info",
          title: `${last.name} subió ${pct(upLast.value / prev.value - 1)}`,
          detail: `De ${money(prev.value)}${prev.label} a ${money(upLast.value)}${upLast.label}. Comparen en otro lugar la próxima vez.`,
        });
      }
    }
  }

  // 8. Despensa sin registrar consumo
  const hasPurchases = purchases.some((x) => x.trip_id);
  const lastUse = movements.filter((x) => x.reason === "consumo" || x.reason === "preparacion").map((x) => x.created_at.slice(0, 10)).sort().pop();
  const idle = lastUse ? daysBetween(lastUse, today) : null;
  if (hasPurchases && (idle === null || idle >= 5)) {
    out.push({
      id: "despensa-quieta",
      level: "info",
      title: idle === null ? "No han registrado ningún consumo" : `${idle} días sin registrar consumo`,
      detail: "La despensa de la app asume que todo sigue intacto. Usen \"Consumí\" o hagan un conteo para que la lista sepa qué se acabó.",
    });
  }

  const order: Record<AdviceLevel, number> = { alerta: 0, ahorro: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
