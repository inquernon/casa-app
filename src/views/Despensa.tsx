import { useState } from "react";
import { useData } from "../lib/store";
import { GROUPS, type Item } from "../lib/types";
import { fmtDay, fmtQty } from "../lib/util";
import { MoveSheet, type MoveMode } from "../components/MoveSheet";

const REASON: Record<string, string> = { compra: "Compra", preparacion: "Preparación", consumo: "Consumo", ajuste: "Conteo" };

export function Despensa() {
  const { items, stock, movements, memberName } = useData();
  const [act, setAct] = useState<{ item: Item; mode: MoveMode } | null>(null);
  const [onlyLow, setOnlyLow] = useState(false);

  const active = items.filter((i) => i.active);
  const qtyOf = (i: Item) => stock.get(i.id) ?? 0;
  const stateOf = (i: Item) => (qtyOf(i) <= 0 ? "out" : Number(i.min_stock) > 0 && qtyOf(i) <= Number(i.min_stock) ? "low" : "ok");
  const out = active.filter((i) => stateOf(i) === "out").length;
  const low = active.filter((i) => stateOf(i) === "low").length;
  const shown = onlyLow ? active.filter((i) => stateOf(i) !== "ok") : active;
  const byId = new Map(items.map((i) => [i.id, i]));
  const recent = [...movements].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 20);

  return (
    <>
      <div className="card">
        <h2>Despensa</h2>
        <div className="summary">
          <div className="tile"><b className="num">{active.length - out - low}</b><span>con stock</span></div>
          <div className="tile"><b className="num" style={{ color: low ? "var(--warn)" : undefined }}>{low}</b><span>por acabarse</span></div>
          <div className="tile"><b className="num" style={{ color: out ? "var(--bad)" : undefined }}>{out}</b><span>agotados</span></div>
        </div>
        {!movements.length && (
          <p className="banner">Primer uso: toca "Contar" en cada cosa que tengan en casa y escribe cuánto hay. Desde ahí, los mercados suman solos y ustedes registran lo que consumen.</p>
        )}
        <div className="row">
          <button onClick={() => setOnlyLow(!onlyLow)}>{onlyLow ? "Ver todo" : "Ver solo lo que falta"}</button>
        </div>
      </div>

      {GROUPS.map((g) => {
        const rows = shown.filter((i) => (i.grp || "Otro") === g).sort((a, b) => a.sort - b.sort);
        if (!rows.length) return null;
        return (
          <div className="card tight" key={g}>
            <h3>{g}</h3>
            {rows.map((i) => {
              const st = stateOf(i);
              return (
                <div className="edit-row" key={i.id}>
                  <div className="row spread">
                    <b>{i.name}</b>
                    <span className="num">
                      {fmtQty(Math.max(0, qtyOf(i)), i.unit)}{" "}
                      {st !== "ok" && <span className={`pill ${st === "out" ? "bad" : "warn"}`}>{st === "out" ? "Agotado" : "Poco"}</span>}
                    </span>
                  </div>
                  <div className="row">
                    <button className="link" onClick={() => setAct({ item: i, mode: "consumo" })}>Consumí</button>
                    <button className="link" onClick={() => setAct({ item: i, mode: "ajuste" })}>Contar</button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {!shown.length && <div className="card"><p className="muted">No falta nada.</p></div>}

      {recent.length > 0 && (
        <details className="card">
          <summary className="row spread"><b>Últimos movimientos</b><span className="muted small">Ver</span></summary>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Fecha</th><th>Artículo</th><th>Tipo</th><th className="r">Cantidad</th></tr></thead>
              <tbody>
                {recent.map((m) => {
                  const it = byId.get(m.item_id);
                  const who = memberName(m.created_by);
                  return (
                    <tr key={m.id}>
                      <td className="num">{fmtDay(m.created_at)}</td>
                      <td>{it?.name ?? "—"}{m.note ? <><br /><span className="muted small">{m.note}</span></> : null}</td>
                      <td>{REASON[m.reason] ?? m.reason}{who ? <><br /><span className="muted small">{who}</span></> : null}</td>
                      <td className="r num">{Number(m.delta) > 0 ? "+" : "−"}{fmtQty(Math.abs(Number(m.delta)), it?.unit ?? "unidad")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {act && <MoveSheet item={act.item} mode={act.mode} current={qtyOf(act.item)} onClose={() => setAct(null)} />}
    </>
  );
}
