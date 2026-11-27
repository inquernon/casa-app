import { useState } from "react";
import { useData } from "../lib/store";
import { supabase } from "../lib/supabase";
import { GROUPS, groupIndex, pocketForGroup, type Item, type Purchase, type Unit } from "../lib/types";
import { buildList, REASON_LABEL } from "../lib/listLogic";
import { errorText, fmtDate, fmtQty, money, parseMoney, parseQty, todayCO, unitLabel } from "../lib/util";
import { PlacesDatalist, Sheet, Switch } from "../components/Sheet";
import { BudgetCard } from "../components/BudgetCard";
import { MoveSheet } from "../components/MoveSheet";

type BuyTarget = {
  item: Pick<Item, "id" | "name" | "grp" | "unit" | "buy_qty" | "place" | "pocket"> | null;
  extraName?: string;
  extraGrp?: string;
  extraUnit?: Unit;
  existing?: Purchase;
};
type GroupBy = "tienda" | "grupo";

export function Lista({ onError }: { onError: (msg: string | null) => void }) {
  const { items, purchases, stock, refresh, household } = useData();
  const [buy, setBuy] = useState<BuyTarget | null>(null);
  const [consume, setConsume] = useState<Item | null>(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupBy>(() => {
    try {
      return (localStorage.getItem("lista-agrupar") as GroupBy) || "tienda";
    } catch {
      return "tienda";
    }
  });

  const today = todayCO();
  const { pending, pendingByItem, extras, toBuy, reason, upToDate, whenOut, remaining, nextDue, lastBought, pendingTotal, lastPlace } =
    buildList(items, purchases, stock, today);

  function changeGroupBy(g: GroupBy) {
    setGroupBy(g);
    try {
      localStorage.setItem("lista-agrupar", g);
    } catch {
      /* sin almacenamiento local: solo dura esta visita */
    }
  }

  async function unmark(purchase: Purchase) {
    const { error } = await supabase.from("purchases").delete().eq("id", purchase.id);
    onError(error ? errorText(error) : null);
    await refresh();
  }

  async function setRunningLow(i: Item, on: boolean) {
    const { error } = await supabase.from("items").update({ running_low: on }).eq("id", i.id);
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

  const openBuy = (i: Item | null, pend?: Purchase) =>
    i ? setBuy({ item: i, existing: pend }) : pend && setBuy({ item: null, existing: pend, extraName: pend.name, extraGrp: pend.grp, extraUnit: pend.unit });

  /** Fila para comprar: interruptor, nombre, cantidad sugerida, motivo y lugar */
  const buyRow = (i: Item | null, pend: Purchase | undefined) => {
    const name = i?.name ?? pend?.name ?? "";
    const why = i ? reason(i) : null;
    const note = !i ? "extra" : why && why !== "marcado" ? REASON_LABEL[why] : i.every_days ? `cada ${i.every_days} días` : "";
    const place = pend ? pend.place : i?.place;
    return (
      <div className={`lrow ${pend ? "done" : ""}`} key={i?.id ?? pend?.id}>
        <Switch checked={!!pend} label={`Comprado: ${name}`} onChange={(on) => (on ? i && setBuy({ item: i }) : pend && unmark(pend))} />
        <button className="info" onClick={() => openBuy(i, pend)}>
          <span className="name">{name}</span>
          <br />
          <span className="qty">
            {pend ? fmtQty(pend.qty, pend.unit) : i ? i.buy_label || fmtQty(i.buy_qty, i.unit) : ""}
            {note ? ` · ${note}` : ""}
          </span>
        </button>
        <span className="price num">
          {pend ? <b>{money(pend.price)}</b> : null}
          {place ? <span className={`place ${pend ? "" : "suggested"}`}>{place}</span> : null}
        </span>
      </div>
    );
  };

  /** Fila de lo que no toca: cuándo toca, "se está acabando" y "Consumí" */
  const restRow = (i: Item) => {
    const next = nextDue(i);
    const last = lastBought(i);
    return (
      <div className="edit-row" key={i.id}>
        <div className="row spread">
          <b>{i.name}</b>
          <span className="muted small">{next ? `toca el ${fmtDate(next)}` : last ? `última: ${fmtDate(last.purchased_on)}` : "sin compras"}</span>
        </div>
        <div className="row">
          <button className="link" onClick={() => setRunningLow(i, true)}>Se está acabando</button>
          <button className="link" onClick={() => setConsume(i)}>Consumí</button>
          <button className="link" onClick={() => setBuy({ item: i })}>Comprar ya</button>
        </div>
      </div>
    );
  };

  // Secciones: por tienda sugerida (o lugar de compra si ya está marcado) o por grupo
  const sectionOf = (i: Item | null, pend?: Purchase) =>
    groupBy === "tienda" ? (pend?.place || i?.place || "Sin lugar") : (i?.grp ?? pend?.grp ?? "Otro");
  const rows: { key: string; i: Item | null; pend?: Purchase }[] = [
    ...toBuy.map((i) => ({ key: sectionOf(i, pendingByItem.get(i.id)), i, pend: pendingByItem.get(i.id) })),
    ...extras.map((x) => ({ key: sectionOf(null, x), i: null, pend: x })),
  ];
  const sections = [...new Set(rows.map((r) => r.key))].sort((a, b) =>
    groupBy === "grupo" ? groupIndex(a) - groupIndex(b) : a === "Sin lugar" ? 1 : b === "Sin lugar" ? -1 : a.localeCompare(b, "es"),
  );
  const sortRows = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    groupIndex(a.i?.grp ?? a.pend?.grp ?? "Otro") - groupIndex(b.i?.grp ?? b.pend?.grp ?? "Otro") || (a.i?.sort ?? 999) - (b.i?.sort ?? 999);

  return (
    <>
      <BudgetCard />

      <div className="row spread">
        <span className="muted small">{remaining} por comprar</span>
        <div className="row">
          <div className="seg" role="group" aria-label="Agrupar la lista">
            <button aria-pressed={groupBy === "tienda"} onClick={() => changeGroupBy("tienda")}>Por tienda</button>
            <button aria-pressed={groupBy === "grupo"} onClick={() => changeGroupBy("grupo")}>Por grupo</button>
          </div>
          <button onClick={() => setExtraOpen(true)}>+ Extra</button>
        </div>
      </div>

      {sections.map((sec) => (
        <div className="card tight" key={sec}>
          <h3>{sec}</h3>
          {rows.filter((r) => r.key === sec).sort(sortRows).map((r) => buyRow(r.i, r.pend))}
        </div>
      ))}
      {!rows.length && <div className="card"><p className="muted">No hay nada por comprar ahora.</p></div>}

      {upToDate.length > 0 && (
        <details className="card">
          <summary className="row spread"><b>Al día ({upToDate.length})</b><span className="muted small">Ver</span></summary>
          <p className="muted small">Vuelven solos a la lista cuando pasen sus días. Si algo se acaba antes, márquenlo.</p>
          {[...upToDate].sort((a, b) => (nextDue(a) ?? "").localeCompare(nextDue(b) ?? "")).map(restRow)}
        </details>
      )}

      {whenOut.length > 0 && (
        <details className="card">
          <summary className="row spread"><b>Cuando se acabe ({whenOut.length})</b><span className="muted small">Ver</span></summary>
          <p className="muted small">No tienen frecuencia fija. Toquen "Se está acabando" y entran a la lista.</p>
          {[...whenOut].sort((a, b) => groupIndex(a.grp) - groupIndex(b.grp) || a.name.localeCompare(b.name, "es")).map(restRow)}
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
      {consume && <MoveSheet item={consume} mode="consumo" current={stock.get(consume.id) ?? 0} onClose={() => setConsume(null)} />}
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
          <p className="muted small">Se guarda en el historial con fecha {fmtDate(today)} y lo comprado se suma a la despensa.</p>
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
          pocket: item?.pocket ?? pocketForGroup(target.extraGrp ?? ""),
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
        .insert({ household_id: household.id, name: name.trim(), grp, unit, buy_qty: 1, every_days: null, pocket: pocketForGroup(grp) })
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
