import { useState } from "react";
import { useData } from "../lib/store";
import { supabase } from "../lib/supabase";
import { GROUPS, type Item, type Purchase, type Unit } from "../lib/types";
import { buildList } from "../lib/listLogic";
import { errorText, fmtDate, fmtQty, money, parseMoney, parseQty, periods, todayCO, unitLabel } from "../lib/util";
import { PlacesDatalist, Sheet, Switch } from "../components/Sheet";

type BuyTarget = { item: Pick<Item, "id" | "name" | "grp" | "unit" | "buy_qty" | "place"> | null; extraName?: string; extraGrp?: string; extraUnit?: Unit; existing?: Purchase };

export function Lista({ onError }: { onError: (msg: string | null) => void }) {
  const { household, items, purchases, stock, refresh } = useData();
  const [buy, setBuy] = useState<BuyTarget | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const p = periods(household.quincena_start);
  const { pending, pendingByItem, extras, toBuy, already, remaining, boughtInPeriod, ranOut, spent, pendingTotal, lastPlace } = buildList(items, purchases, stock, p);
  const budget = Number(household.budget_quincena) || 0;
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  const over = budget > 0 && spent > budget;

  async function unmark(purchase: Purchase) {
    const { error } = await supabase.from("purchases").delete().eq("id", purchase.id);
    onError(error ? errorText(error) : null);
    await refresh();
  }

  async function saveTrip() {
    setSaving(true);
    const { error } = await supabase.rpc("save_trip", { p_household: household.id });
    setSaving(false);
    setConfirmSave(false);
    onError(error ? errorText(error) : null);
    await refresh();
  }

  /** Fila de la lista. `extra` = compra marcada que no está en el catálogo. */
  const row = (i: Item | null, pend: Purchase | undefined, note?: string) => {
    const name = i?.name ?? pend?.name ?? "";
    const open = () =>
      i ? setBuy({ item: i, existing: pend }) : pend && setBuy({ item: null, existing: pend, extraName: pend.name, extraGrp: pend.grp, extraUnit: pend.unit });
    return (
      <div className={`lrow ${pend ? "done" : ""}`} key={i?.id ?? pend?.id}>
        <Switch checked={!!pend} label={`Comprado: ${name}`} onChange={(on) => (on ? i && setBuy({ item: i }) : pend && unmark(pend))} />
        <button className="info" onClick={open}>
          <span className="name">{name}</span>
          <br />
          <span className="qty">
            {pend ? fmtQty(pend.qty, pend.unit) : i ? i.buy_label || fmtQty(i.buy_qty, i.unit) : ""}
            {note ? ` · ${note}` : i?.cadence === "semanal" ? " · semanal" : ""}
          </span>
        </button>
        <span className="price num">
          {pend ? (
            <>
              <b>{money(pend.price)}</b>
              {pend.place}
            </>
          ) : (
            <span className="muted">{i?.place}</span>
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
          {remaining} por comprar · semana desde {fmtDate(p.w)}
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
            {rows.map((i) => row(i, pendingByItem.get(i.id), !pendingByItem.has(i.id) && ranOut(i) ? "se acabó en la despensa" : undefined))}
            {ex.map((x) => row(null, x, "extra"))}
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
          {already.map((i) => row(i, undefined, `comprado ${fmtDate(boughtInPeriod(i)?.purchased_on)}`))}
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

      {buy && <BuySheet target={buy} lastPlace={lastPlace} onClose={() => setBuy(null)} />}
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

function BuySheet({ target, lastPlace, onClose }: { target: BuyTarget; lastPlace: string; onClose: () => void }) {
  const { household, refresh } = useData();
  const { item, existing } = target;
  const name = item?.name ?? target.extraName ?? "";
  const unit: Unit = existing?.unit ?? item?.unit ?? target.extraUnit ?? "unidad";
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [place, setPlace] = useState(existing?.place ?? (lastPlace || item?.place || ""));
  const [qty, setQty] = useState(String(existing?.qty ?? item?.buy_qty ?? ""));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceN = parseMoney(price);
    const qtyN = qty.trim() ? parseQty(qty) : 0;
    if (!Number.isFinite(priceN)) return setErr("Escribe el valor pagado, solo números.");
    if (!place.trim()) return setErr("Escribe el lugar donde lo compraste.");
    if (!Number.isFinite(qtyN) || qtyN < 0) return setErr("La cantidad debe ser un número.");
    setBusy(true);
    setErr(null);
    const row = { price: priceN, place: place.trim(), qty: qtyN, unit };
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
    if (error) return setErr(errorText(error));
    await refresh();
    onClose();
  }

  return (
    <Sheet title={name} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>
          Valor pagado (COP)
          <input type="text" inputMode="numeric" autoComplete="off" placeholder="12500" value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label>
          Lugar
          <input list="places" autoComplete="off" value={place} onChange={(e) => setPlace(e.target.value)} />
        </label>
        <label>
          Cantidad comprada ({unitLabel(unit)})
          <input type="text" inputMode="decimal" autoComplete="off" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
        <p className="muted small">Fecha: {fmtDate(existing?.purchased_on ?? todayCO())} (se guarda sola)</p>
        {err && <p className="banner" role="alert">{err}</p>}
        <div className="row">
          <button type="submit" className="primary" disabled={busy}>{busy ? "Guardando…" : existing ? "Guardar cambios" : "Marcar comprado"}</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
      <PlacesDatalist />
    </Sheet>
  );
}

function ExtraSheet({ onClose, onNext, onError }: { onClose: () => void; onNext: (t: BuyTarget) => void; onError: (m: string | null) => void }) {
  const { household, refresh } = useData();
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
      await refresh();
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
