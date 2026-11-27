import { useState } from "react";
import { useData } from "../lib/store";
import { supabase } from "../lib/supabase";
import type { Item } from "../lib/types";
import { errorText, fmtQty, parseQty, unitLabel } from "../lib/util";
import { Sheet } from "./Sheet";

export type MoveMode = "consumo" | "ajuste";

/** Registrar consumo ("Consumí") o un conteo de despensa ("Contar"). */
export function MoveSheet({ item, mode, current, onClose }: { item: Item; mode: MoveMode; current: number; onClose: () => void }) {
  const { household, refresh } = useData();
  const [val, setVal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseQty(val);
    if (!Number.isFinite(n) || n < 0 || (mode === "consumo" && n === 0)) return setErr("Escribe una cantidad en números.");
    const delta = mode === "consumo" ? -n : n - current;
    if (delta === 0) return onClose();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("stock_movements").insert({ household_id: household.id, item_id: item.id, delta, reason: mode, note: note.trim() });
    setBusy(false);
    if (error) return setErr(errorText(error));
    await refresh();
    onClose();
  }

  return (
    <Sheet title={`${mode === "consumo" ? "Consumí" : "Contar"}: ${item.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="muted small">En la app hay: {fmtQty(Math.max(0, current), item.unit)}</p>
        <label>
          {mode === "consumo" ? "Cantidad consumida" : "Cantidad que hay ahora"} ({unitLabel(item.unit)})
          <input type="text" inputMode="decimal" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} />
        </label>
        {mode === "consumo" && current > 0 && (
          <div className="row">
            <button type="button" onClick={() => setVal(String(current))}>Se acabó todo</button>
            <button type="button" onClick={() => setVal(String(Math.round(current / 2)))}>La mitad</button>
          </div>
        )}
        <label>
          Nota (opcional)
          <input value={note} placeholder={mode === "consumo" ? "Se dañó, invitados…" : ""} onChange={(e) => setNote(e.target.value)} />
        </label>
        {err && <p className="banner" role="alert">{err}</p>}
        <div className="row">
          <button type="submit" className="primary" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button>
          <button type="button" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Sheet>
  );
}
