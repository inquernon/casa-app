import { useMemo, useState } from "react";
import { useData } from "../lib/data";
import { supabase } from "../lib/supabase";
import { GROUPS, type Item, type Purchase, type Unit } from "../lib/types";
import { errorText, fmtDate, fmtQty, money, periodStart, periods, todayCO, unitLabel } from "../lib/util";
import { PlacesDatalist, Sheet, Switch } from "../components/Sheet";

type BuyTarget = { item: Pick<Item, "id" | "name" | "grp" | "unit" | "buy_qty" | "place"> | null; extraName?: string; extraGrp?: string; extraUnit?: Unit; existing?: Purchase };

export function Lista({ onError }: { onError: (msg: string | null) => void }) {
  const { household, items, purchases } = useData();
  const [buy, setBuy] = useState<BuyTarget | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const p = periods(household.quincena_start);
  const pending = purchases.filter((x) => x.trip_id === null);
  const pendingByItem = new Map(pending.filter((x) => x.item_id).map((x) => [x.item_id as string, x]));

  const lastBought = useMemo(() => {
    const m = new Map<string, Purchase>();
    for (const x of purchases) {
      if (!x.trip_id || !x.item_id) continue;
      const prev = m.get(x.item_id);
      if (!prev || x.purchased_on > prev.purchased_on) m.set(x.item_id, x);
    }
    return m;
  }, [purchases]);

  const active = items.filter((i) => i.active);
  const boughtInPeriod = (i: Item) => {
    const last = lastBought.get(i.id);
    return last && last.purchased_on >= periodStart(i.cadence, p) ? last : null;
  };
  const toBuy = active.filter((i) => pendingByItem.has(i.id) || !boughtInPeriod(i));
  const already = active.filter((i) => !pendingByItem.has(i.id) && boughtInPeriod(i));
  const extras = pending.filter((x) => !x.item_id);

  const budget = Number(household.budget_quincena) || 0;
  const spent = purchases.filter((x) => x.purchased_on >= p.q).reduce((a, x) => a + Number(x.price), 0);
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const over = budget > 0 && spent > budget;
  const pendingTotal = pending.reduce((a, x) => a + Number(x.price), 0);
  const lastPlace = [...pending].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.place ?? "";

  async function unmark(purchase: Purchase) {
    const { error } = await supabase.from("purchases").delete().eq("id", purchase.id);
    onError(error ? errorText(error) : null);
  }

  async function saveTrip() {
    setSaving(true);
    const { error } = await supabase.rpc("save_trip", { p_household: household.id });
    setSaving(false);
    setConfirmSave(false);
    onError(error ? errorText(error) : null);
  }

  const row = (i: Item, note?: string) => {
    const pend = pendingByItem.get(i.id);
    return (
      <div className={`lrow ${pend ? "done" : ""}`} key={i.id}>
        <Switch
          checked={!!pend}
          label={`Comprado: ${i.name}`}
          onChange={(on) => (on ? setBuy({ item: i }) : pend && unmark(pend))}
        />
        <button className="info" onClick={() => setBuy({ item: i, existing: pend })}>
          <span className="name">{i.name}</span>
          <br />
          <span className="qty">
            {pend ? fmtQty(pend.qty, pend.unit) : i.buy_label || fmtQty(i.buy_qty, i.unit)}
            {note ? ` · ${note}` : i.cadence === "semanal" ? " · semanal" : ""}
          </span>
        </button>
        <span className="price num">
          {pend ? (
            <>
              <b>{money(pend.price)}</b>
              {pend.place}
            </>
          ) : (
            <span className="muted">{i.place}</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <>
      <div className="card">
        <div className="row spread">
          <h2>Quincena</h2>
          <span className="muted small">
            {fmtDate(p.q)} – {fmtDate(p.qEnd)}
          </span>
        </div>
        <div className="summary">
          <div className="tile"><b className="num">{money(spent)}</b><span>gastado</span></div>
          <div className="tile"><b className="num">{money(budget)}</b><span>presupuesto</span></div>
          <div className="tile">
            <b className="num" style={{ color: over ? "var(--bad)" : undefined }}>{money(budget - spent)}</b>
            <span>{over ? "pasado" : "queda"}</span>
          </div>
        </div>
        <div className={`bar ${over ? "over" : ""}`}><i style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="row spread">
        <span className="muted small">
          {toBuy.length - pendingByItem.size} por comprar · semana desde {fmtDate(p.w)}
        </span>
        <button onClick={() => setExtraOpen(true)}>+ Artículo extra</button>
      </div>

      {GROUPS.map((g) => {
        const rows = toBuy.filter((i) => (i.grp || "Otro") === g).sort((a, b) => a.sort - b.sort);
        const ex = extras.filter((x) => (x.grp || "Otro") === g);
        if (!rows.length && !ex.length) return null;
        return (
          <div className="card tight" key={g}>
            <h3>{g}</h3>
            {rows.map((i) => row(i))}
            {ex.map((x) => (
              <div className="lrow done" key={x.id}>
                <Switch checked label={`Comprado: ${x.name}`} onChange={(on) => !on && unmark(x)} />
                <button className="info" onClick={() => setBuy({ item: null, existing: x, extraName: x.name, extraGrp: x.grp, extraUnit: x.unit })}>
                  <span className="name">{x.name}</span>
                  <br />
                  <span className="qty">{fmtQty(x.qty, x.unit)} · extra</span>
                </button>
                <span className="price num"><b>{money(x.price)}</b>{x.place}</span>
              </div>
            ))}
          </div>
        );
      })}
      {!toBuy.length && !extras.length && (
        <div className="card"><p className="muted">No hay nada por comprar en este periodo.</p></div>
      )}

      {already.length > 0 && (
        <details className="card">
          <summary className="row spread">
            <b>Ya comprados en este periodo ({already.length})</b>
            <span className="muted small">Ver</span>
          </summary>
          <p className="muted small">Vuelven a la lista en la próxima quincena o semana. Actívalos si necesitas comprarlos otra vez.</p>
          {already.map((i) => row(i, `comprado ${fmtDate(boughtInPeriod(i)?.purchased_on)}`))}
        </details>
      )}

      {pending.length > 0 && (
        <div className="savebar">
          <div className="card row spread">
            <span>
              <b className="num">{money(pendingTotal)}</b>
              <br />
              <span className="muted small">{pending.length} artículo{pending.length === 1 ? "" : "s"} en este mercado</span>
            </span>
            <button className="primary" disabled={saving} onClick={() => setConfirmSave(true)}>
              {saving ? "Guardando…" : "Guardar mercado"}
            </button>
          </div>
        </div>
      )}

      {buy && <BuySheet target={buy} lastPlace={lastPlace} onClose={() => setBuy(null)} onError={onError} />}
      {extraOpen && (
        <ExtraSheet
          onClose={() => setExtraOpen(false)}
          onNext={(t) => {
            setExtraOpen(false);
            setBuy(t);
          }}
          onError={onError}
        />
      )}
      {confirmSave && (
        <Sheet title="Guardar mercado" onClose={() => setConfirmSave(false)}>
          <p>
            {pending.length} artículos · <b className="num">{money(pendingTotal)}</b>
            <br />
            <span className="muted small">{[...new Set(pending.map((x) => x.place).filter(Boolean))].join(", ")}</span>
          </p>
          <p className="muted small">Se guarda en el historial con fecha {fmtDate(todayCO())} y lo comprado se suma a la despensa.</p>
          <div className="row">
            <button className="primary" disabled={saving} onClick={saveTrip}>Guardar</button>
            <button onClick={() => setConfirmSave(false)}>Cancelar</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function BuySheet({ target, lastPlace, onClose, onError }: { target: BuyTarget; lastPlace: string; onClose: () => void; onError: (m: string | null) => void }) {
  const { household } = useData();
  const { item, existing } = target;
  const name = item?.name ?? target.extraName ?? "";
  const unit: Unit = existing?.unit ?? item?.unit ?? target.extraUnit ?? "unidad";
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [place, setPlace] = useState(existing?.place ?? (lastPlace || item?.place || ""));
  const [qty, setQty] = useState(String(existing?.qty ?? item?.buy_qty ?? ""));
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceN = Number(price);
    if (!(priceN >= 0) || !place.trim()) return;
    setBusy(true);
    const row = { price: priceN, place: place.trim(), qty: Number(qty) || 0, unit };
    const { error } = existing
      ? await supabase.from("purchases").update(row).eq("id", existing.id)
      : await supabase.from("purchases").insert({
          ...row,
          household_id: household.id,
          item_id: item?.id ?? null,
          name,
          grp: item?.grp ?? target.extraGrp ?? "Otro",
        });
    setBusy(false);
    onError(error ? errorText(error) : null);
    if (!error) onClose();
  }

  return (
    <Sheet title={name} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Valor pagado (COP)
          <input type="number" inputMode="numeric" min={0} step={50} required value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          Lugar
          <input list="places" required value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
        <label>
          Cantidad comprada ({unitLabel(unit)})
          <input type="number" inputMode="decimal" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <p className="muted small">Fecha: {fmtDate(existing?.purchased_on ?? todayCO())} (se guarda sola)</p>
        <div className="row">
          <button type="submit" className="primary" disabled={busy}>{existing ? "Guardar cambios" : "Marcar comprado"}</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
      <PlacesDatalist />
    </Sheet>
  );
}

function ExtraSheet({ onClose, onNext, onError }: { onClose: () => void; onNext: (t: BuyTarget) => void; onError: (m: string | null) => void }) {
  const { household } = useData();
  const [name, setName] = useState("");
  const [grp, setGrp] = useState("Despensa");
  const [unit, setUnit] = useState<Unit>("unidad");
  const [keep, setKeep] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (keep) {
      const { data, error } = await supabase
        .from("items")
        .insert({ household_id: household.id, name: name.trim(), grp, unit, buy_qty: 1, cadence: "quincenal" })
        .select()
        .single();
      if (error) return onError(errorText(error));
      onNext({ item: data as Item });
    } else {
      onNext({ item: null, extraName: name.trim(), extraGrp: grp, extraUnit: unit });
    }
  }

  return (
    <Sheet title="Artículo extra" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Nombre
          <input required value={name} placeholder="Aceite, detergente…" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="grid2">
          <label>
            Grupo
            <select value={grp} onChange={(e) => setGrp(e.target.value)}>
              {GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label>
            Unidad
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              <option value="unidad">Unidades</option>
              <option value="g">Gramos</option>
              <option value="ml">Mililitros</option>
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Guardarlo en Artículos para próximos mercados
        </label>
        <div className="row">
          <button type="submit" className="primary">Seguir</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Sheet>
  );
}
