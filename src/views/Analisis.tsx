import { useData } from "../lib/data";
import { fmtDate, money, monthLabel, todayCO, unitPrice } from "../lib/util";
import type { Purchase } from "../lib/types";

function HBars({ entries }: { entries: [string, number][] }) {
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return (
    <div className="hbars">
      {entries.map(([k, v]) => (
        <div className="hbar" key={k}>
          <span>{k}</span>
          <span className="track"><i style={{ width: `${(v / max) * 100}%` }} /></span>
          <span className="v num">{money(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function Analisis() {
  const { purchases, trips } = useData();
  const ps = purchases.filter((x) => x.trip_id);
  if (!ps.length) {
    return (
      <div className="card">
        <h2>Análisis</h2>
        <p className="muted">Aparecerá aquí cuando guarden el primer mercado.</p>
      </div>
    );
  }
  const by = (key: (x: Purchase) => string) => {
    const m = new Map<string, number>();
    ps.forEach((x) => m.set(key(x) || "Sin dato", (m.get(key(x) || "Sin dato") ?? 0) + Number(x.price)));
    return m;
  };
  const byMonth = by((x) => x.purchased_on.slice(0, 7));
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => [monthLabel(k), v] as [string, number]);
  const places = [...by((x) => x.place).entries()].sort((a, b) => b[1] - a[1]);
  const groups = [...by((x) => x.grp).entries()].sort((a, b) => b[1] - a[1]);
  const thisMonth = byMonth.get(todayCO().slice(0, 7)) ?? 0;
  const total = ps.reduce((a, x) => a + Number(x.price), 0);

  const perItem = new Map<string, Purchase[]>();
  ps.forEach((x) => {
    const k = x.item_id ?? x.name;
    perItem.set(k, [...(perItem.get(k) ?? []), x]);
  });
  const rows = [...perItem.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => b.purchased_on.localeCompare(a.purchased_on));
      const withUnit = list.map((x) => ({ x, up: unitPrice(Number(x.price), Number(x.qty), x.unit) })).filter((r) => r.up);
      const best = withUnit.sort((a, b) => a.up!.value - b.up!.value)[0];
      return { last: sorted[0], best, n: list.length };
    })
    .sort((a, b) => a.last.name.localeCompare(b.last.name, "es"));

  return (
    <>
      <div className="card">
        <h2>Resumen</h2>
        <div className="summary">
          <div className="tile"><b className="num">{money(thisMonth)}</b><span>este mes</span></div>
          <div className="tile"><b className="num">{money(trips.length ? total / trips.length : 0)}</b><span>promedio por mercado</span></div>
          <div className="tile"><b className="num">{trips.length}</b><span>mercados</span></div>
        </div>
      </div>
      <div className="card"><h2>Gasto por mes</h2><HBars entries={months} /></div>
      <div className="card"><h2>Gasto por lugar</h2><HBars entries={places} /></div>
      <div className="card"><h2>Gasto por grupo</h2><HBars entries={groups} /></div>
      <div className="card">
        <h2>Precios por artículo</h2>
        <p className="muted small">Precio por kilo, litro o unidad, para comparar entre lugares aunque compren cantidades distintas.</p>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Artículo</th><th className="r">Último</th><th className="r">Más barato</th><th className="r">Veces</th></tr>
            </thead>
            <tbody>
              {rows.map(({ last, best, n }) => {
                const up = unitPrice(Number(last.price), Number(last.qty), last.unit);
                return (
                  <tr key={last.id}>
                    <td>{last.name}</td>
                    <td className="r num">
                      {up ? `${money(up.value)}${up.label}` : money(last.price)}
                      <br /><span className="muted small">{last.place}</span>
                    </td>
                    <td className="r num">
                      {best ? `${money(best.up!.value)}${best.up!.label}` : "—"}
                      <br /><span className="muted small">{best ? `${best.x.place} · ${fmtDate(best.x.purchased_on)}` : ""}</span>
                    </td>
                    <td className="r num">{n}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
