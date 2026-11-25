import { useData } from "../lib/store";
import { groupIndex } from "../lib/types";
import { fmtDate, fmtQty, money } from "../lib/util";

export function Historial() {
  const { trips, purchases, memberName } = useData();
  if (!trips.length) {
    return (
      <div className="card">
        <h2>Historial</h2>
        <p className="muted">Todavía no hay mercados guardados.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <h2>Historial de mercados</h2>
      {trips.map((t) => {
        const ps = purchases
          .filter((x) => x.trip_id === t.id)
          .sort((a, b) => groupIndex(a.grp) - groupIndex(b.grp));
        const who = memberName(t.created_by);
        return (
          <details key={t.id} className="trip">
            <summary className="row spread">
              <span>
                <b>{fmtDate(t.trip_date)}</b>
                <br />
                <span className="muted small">
                  {t.item_count} artículos{t.places.length ? ` · ${t.places.join(", ")}` : ""}
                  {who ? ` · guardó ${who}` : ""}
                </span>
              </span>
              <b className="num">{money(t.total)}</b>
            </summary>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>Artículo</th><th>Lugar</th><th className="r">Valor</th></tr>
                </thead>
                <tbody>
                  {ps.map((x) => (
                    <tr key={x.id}>
                      <td>{x.name}<br /><span className="muted small">{fmtQty(x.qty, x.unit)}</span></td>
                      <td>{x.place}</td>
                      <td className="r num">{money(x.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </div>
  );
}
