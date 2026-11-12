import { useState } from "react";
import { useData } from "../lib/data";
import { supabase } from "../lib/supabase";
import { GROUPS, type Cadence, type Item, type Unit } from "../lib/types";
import { errorText, fmtQty } from "../lib/util";
import { PlacesDatalist, Sheet } from "../components/Sheet";

export function Articulos({ onError }: { onError: (m: string | null) => void }) {
  const { household, items, members, userId } = useData();
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const me = members.find((m) => m.user_id === userId);
  const list = [...items].sort(
    (a, b) => GROUPS.indexOf(a.grp as (typeof GROUPS)[number]) - GROUPS.indexOf(b.grp as (typeof GROUPS)[number]) || a.sort - b.sort,
  );

  async function updateHousehold(patch: Record<string, unknown>) {
    const { error } = await supabase.from("households").update(patch).eq("id", household.id);
    onError(error ? errorText(error) : null);
  }
  async function toggle(i: Item) {
    const { error } = await supabase.from("items").update({ active: !i.active }).eq("id", i.id);
    onError(error ? errorText(error) : null);
  }

  return (
    <>
      <div className="card">
        <h2>Ajustes del hogar</h2>
        <div className="grid2">
          <label>
            Presupuesto por quincena (COP)
            <input type="number" inputMode="numeric" min={0} step={1000} defaultValue={household.budget_quincena}
              onBlur={(e) => Number(e.target.value) !== Number(household.budget_quincena) && updateHousehold({ budget_quincena: Number(e.target.value) })} />
          </label>
          <label>
            Inicio de la primera quincena
            <input type="date" defaultValue={household.quincena_start}
              onChange={(e) => e.target.value && updateHousehold({ quincena_start: e.target.value })} />
          </label>
        </div>
        <p className="muted small">
          Cada quincena dura 15 días desde esa fecha. Lo quincenal comprado sale de la lista hasta la siguiente quincena; lo semanal, hasta la siguiente semana.
        </p>
        <div className="row spread">
          <span>
            Código para invitar a la casa: <b className="code">{household.invite_code}</b>
            <br />
            <span className="muted small">Miembros: {members.map((m) => m.display_name).join(", ")}</span>
          </span>
        </div>
        {me && (
          <label>
            Tu nombre en la app
            <input defaultValue={me.display_name} onBlur={async (e) => {
              const v = e.target.value.trim();
              if (!v || v === me.display_name) return;
              const { error } = await supabase.from("household_members").update({ display_name: v })
                .eq("household_id", household.id).eq("user_id", userId);
              onError(error ? errorText(error) : null);
            }} />
          </label>
        )}
        <div className="row">
          <button onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </div>

      <div className="card">
        <div className="row spread">
          <h2>Artículos de la lista</h2>
          <button onClick={() => setEditing({ grp: "Despensa", unit: "unidad", cadence: "quincenal", buy_qty: 1, active: true })}>+ Nuevo</button>
        </div>
        {list.map((i) => (
          <div className="edit-row" key={i.id}>
            <div className="row spread">
              <b>{i.name}</b>
              <span className={`pill ${i.active ? "" : "warn"}`}>{!i.active ? "Pausado" : i.cadence === "semanal" ? "Semanal" : "Quincenal"}</span>
            </div>
            <span className="muted small">
              {i.grp} · {i.buy_label || fmtQty(i.buy_qty, i.unit)} ({fmtQty(i.buy_qty, i.unit)}){i.place ? ` · ${i.place}` : ""}
            </span>
            <div className="row">
              <button className="link" onClick={() => setEditing(i)}>Editar</button>
              <button className="link" onClick={() => toggle(i)}>{i.active ? "Pausar" : "Reactivar"}</button>
            </div>
          </div>
        ))}
      </div>
      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onError={onError} />}
    </>
  );
}

function ItemSheet({ item, onClose, onError }: { item: Partial<Item>; onClose: () => void; onError: (m: string | null) => void }) {
  const { household } = useData();
  const [f, setF] = useState({
    name: item.name ?? "",
    grp: item.grp ?? "Despensa",
    unit: (item.unit ?? "unidad") as Unit,
    buy_qty: String(item.buy_qty ?? ""),
    buy_label: item.buy_label ?? "",
    cadence: (item.cadence ?? "quincenal") as Cadence,
    place: item.place ?? "",
    note: item.note ?? "",
    min_stock: String(item.min_stock ?? 0),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    const row = { ...f, name: f.name.trim(), buy_qty: Number(f.buy_qty) || 0, min_stock: Number(f.min_stock) || 0 };
    const { error } = item.id
      ? await supabase.from("items").update(row).eq("id", item.id)
      : await supabase.from("items").insert({ ...row, household_id: household.id });
    onError(error ? errorText(error) : null);
    if (!error) onClose();
  }

  return (
    <Sheet title={item.id ? "Editar artículo" : "Nuevo artículo"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>Nombre<input required value={f.name} onChange={set("name")} /></label>
        <div className="grid2">
          <label>Grupo<select value={f.grp} onChange={set("grp")}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></label>
          <label>Frecuencia<select value={f.cadence} onChange={set("cadence")}><option value="quincenal">Quincenal</option><option value="semanal">Semanal</option></select></label>
        </div>
        <div className="grid2">
          <label>Unidad<select value={f.unit} onChange={set("unit")}><option value="g">Gramos</option><option value="ml">Mililitros</option><option value="unidad">Unidades</option></select></label>
          <label>Cantidad a comprar<input type="number" inputMode="decimal" min={0} step="any" value={f.buy_qty} onChange={set("buy_qty")} /></label>
        </div>
        <label>Cómo se pide en la tienda<input value={f.buy_label} placeholder="3 cubetas, bolsa de 2,5 kg…" onChange={set("buy_label")} /></label>
        <div className="grid2">
          <label>Dónde comprar<input list="places" value={f.place} onChange={set("place")} /></label>
          <label>Stock mínimo<input type="number" inputMode="decimal" min={0} step="any" value={f.min_stock} onChange={set("min_stock")} /></label>
        </div>
        <label>Nota<input value={f.note} onChange={set("note")} /></label>
        <div className="row">
          <button type="submit" className="primary">Guardar</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
      <PlacesDatalist />
    </Sheet>
  );
}
