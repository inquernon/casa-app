import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../lib/store";
import { useTable } from "../lib/useTable";
import { byMonth, lastMonths, monthRange, summarize } from "../lib/money";
import { EXPENSE_CATS, INCOME_CATS, METHODS, type MemberTotals, type MoneyTx, type TxKind, type TxMethod } from "../lib/types";
import { errorText, fmtDate, money, monthLabel, parseMoney, todayCO } from "../lib/util";
import { Sheet } from "../components/Sheet";

const methodLabel = (m: TxMethod) => METHODS.find((x) => x.id === m)?.label ?? m;

/** Ingresos y gastos personales. Cada quien ve su detalle; de la casa solo ve los totales. */
export function Dinero({ onError }: { onError: (m: string) => void }) {
  const { household, userId } = useData();
  const txs = useTable<MoneyTx>("money_tx", household.id, "tx_date", false);
  const [month, setMonth] = useState(todayCO().slice(0, 7));
  const [edit, setEdit] = useState<MoneyTx | "new" | null>(null);
  const [house, setHouse] = useState<MemberTotals[]>([]);

  const mine = txs.rows.filter((t) => t.user_id === userId);
  const { start, end } = monthRange(month);
  const s = summarize(mine, start, end);
  const months = byMonth(mine, lastMonths(month, 6));
  const maxMonth = Math.max(1, ...months.flatMap((m) => [m.ingresos, m.gastos]));
  const list = mine.filter((t) => t.tx_date >= start && t.tx_date <= end);

  const loadHouse = useCallback(async () => {
    const { data, error } = await supabase.rpc("household_money", { p_household: household.id, p_from: start, p_to: end });
    if (error) return onError(errorText(error));
    setHouse((data ?? []) as MemberTotals[]);
  }, [household.id, start, end, onError]);

  // Los totales de la casa se recalculan cuando cambia el mes o mis movimientos.
  useEffect(() => {
    loadHouse();
  }, [loadHouse, txs.rows]);

  const shift = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const houseIn = house.reduce((a, h) => a + Number(h.ingresos), 0);
  const houseOut = house.reduce((a, h) => a + Number(h.gastos), 0);
  const name = new Date(`${start}T12:00:00`).toLocaleDateString("es-CO", { month: "long", year: "numeric" });

  return (
    <>
      {txs.error && <div className="banner">{txs.error}</div>}
      <div className="row spread">
        <button onClick={() => shift(-1)} aria-label="Mes anterior">‹</button>
        <h2 style={{ textTransform: "capitalize" }}>{name}</h2>
        <button onClick={() => shift(1)} aria-label="Mes siguiente" disabled={month >= todayCO().slice(0, 7)}>›</button>
      </div>

      <div className="card">
        <div className="row spread">
          <h2>Mis cuentas</h2>
          <button className="primary" onClick={() => setEdit("new")}>Anotar</button>
        </div>
        <div className="summary">
          <div className="tile"><b className="num">{money(s.ingresos)}</b><span>ingresos</span></div>
          <div className="tile"><b className="num">{money(s.gastos)}</b><span>gastos</span></div>
          <div className="tile"><b className="num" style={{ color: s.balance < 0 ? "var(--bad)" : undefined }}>{money(s.balance)}</b><span>balance</span></div>
        </div>
        {s.byCategory.length > 0 && (
          <div className="hbars">
            {s.byCategory.map((c) => (
              <div className="hbar" key={c.category}>
                <span>{c.category}</span>
                <span className="track"><i style={{ width: `${(c.total / s.gastos) * 100}%` }} /></span>
                <span className="v num">{money(c.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2>La casa</h2>
        <p className="muted small">Totales del mes de cada persona. El detalle es privado.</p>
        <table>
          <thead><tr><th>Persona</th><th className="r">Ingresos</th><th className="r">Gastos</th></tr></thead>
          <tbody>
            {house.map((h) => (
              <tr key={h.user_id}><td>{h.display_name}{h.user_id === userId ? " (tú)" : ""}</td><td className="r num">{money(h.ingresos)}</td><td className="r num">{money(h.gastos)}</td></tr>
            ))}
            <tr><td><b>Total</b></td><td className="r num"><b>{money(houseIn)}</b></td><td className="r num"><b>{money(houseOut)}</b></td></tr>
          </tbody>
        </table>
        <p className="small">Balance de la casa: <b className="num" style={{ color: houseIn - houseOut < 0 ? "var(--bad)" : undefined }}>{money(houseIn - houseOut)}</b></p>
      </div>

      <div className="card">
        <h2>Últimos 6 meses</h2>
        <div className="hbars">
          {months.map((m) => (
            <div key={m.key} className="mbar">
              <span className="small">{monthLabel(m.key)}</span>
              <span className="track in"><i style={{ width: `${(m.ingresos / maxMonth) * 100}%` }} /></span>
              <span className="v num small">{money(m.ingresos)}</span>
              <span />
              <span className="track out"><i style={{ width: `${(m.gastos / maxMonth) * 100}%` }} /></span>
              <span className="v num small">{money(m.gastos)}</span>
            </div>
          ))}
        </div>
        <p className="muted small">Barra verde: ingresos. Barra gris: gastos.</p>
      </div>

      <div className="card tight">
        <h3>Movimientos del mes</h3>
        {!list.length && <p className="muted">Sin movimientos. Los mercados guardados aparecen aquí solos.</p>}
        {list.map((t) => (
          <button key={t.id} className="txrow" onClick={() => setEdit(t)}>
            <span>
              <b>{t.category}</b>
              <span className="muted small"> · {fmtDate(t.tx_date)} · {methodLabel(t.method)}</span>
              {t.note && <span className="muted small"><br />{t.note}</span>}
            </span>
            <b className="num" style={{ color: t.kind === "ingreso" ? "var(--accent)" : undefined }}>
              {t.kind === "ingreso" ? "+" : "−"}{money(t.amount)}
            </b>
          </button>
        ))}
      </div>

      {edit && (
        <TxSheet tx={edit === "new" ? null : edit} householdId={household.id} onClose={() => setEdit(null)} onSaved={txs.reload} onError={onError} />
      )}
    </>
  );
}

function TxSheet({ tx, householdId, onClose, onSaved, onError }: {
  tx: MoneyTx | null; householdId: string; onClose: () => void; onSaved: () => Promise<void>; onError: (m: string) => void;
}) {
  const [kind, setKind] = useState<TxKind>(tx?.kind ?? "gasto");
  const [amount, setAmount] = useState(tx ? String(Math.round(Number(tx.amount))) : "");
  const [category, setCategory] = useState(tx?.category ?? "Mercado");
  const [method, setMethod] = useState<TxMethod>(tx?.method ?? "credito");
  const [date, setDate] = useState(tx?.tx_date ?? todayCO());
  const [note, setNote] = useState(tx?.note ?? "");
  const [busy, setBusy] = useState(false);
  const cats = kind === "gasto" ? EXPENSE_CATS : INCOME_CATS;
  const value = parseMoney(amount);

  const pickKind = (k: TxKind) => {
    setKind(k);
    setCategory(k === "gasto" ? "Mercado" : "Salario");
    if (k === "ingreso" && method === "credito") setMethod("transferencia");
  };

  const save = async () => {
    setBusy(true);
    const row = { kind, amount: value, category, method, tx_date: date, note: note.trim() };
    const { error } = tx
      ? await supabase.from("money_tx").update(row).eq("id", tx.id)
      : await supabase.from("money_tx").insert({ ...row, household_id: householdId });
    setBusy(false);
    if (error) return onError(errorText(error));
    await onSaved();
    onClose();
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("money_tx").delete().eq("id", tx!.id);
    setBusy(false);
    if (error) return onError(errorText(error));
    await onSaved();
    onClose();
  };

  return (
    <Sheet title={tx ? "Editar movimiento" : "Anotar movimiento"} onClose={onClose}>
      <div className="seg" role="group" aria-label="Tipo">
        <button aria-pressed={kind === "gasto"} onClick={() => pickKind("gasto")}>Gasto</button>
        <button aria-pressed={kind === "ingreso"} onClick={() => pickKind("ingreso")}>Ingreso</button>
      </div>
      <label>Valor<input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></label>
      <div className="grid2">
        <label>Categoría
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {cats.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label>Medio
          <select value={method} onChange={(e) => setMethod(e.target.value as TxMethod)}>
            {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <label>Fecha<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>Nota<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></label>
      {kind === "gasto" && method === "credito" && (
        <p className="muted small">Con tarjeta de crédito el gasto cuenta el día de la compra. El pago de la tarjeta no se anota como gasto, porque ya se contó.</p>
      )}
      {tx?.trip_id && <p className="muted small">Este gasto salió de un mercado guardado. Si lo borras, el mercado sigue en el historial.</p>}
      <div className="row spread">
        {tx ? <button className="danger" onClick={remove} disabled={busy}>Borrar</button> : <span />}
        <div className="row">
          <button onClick={onClose}>Cancelar</button>
          <button className="primary" onClick={save} disabled={busy || value <= 0 || !date}>Guardar</button>
        </div>
      </div>
    </Sheet>
  );
}
