import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useData } from "../lib/store";
import { cycleDay, cycleLabel, recipeFor, shortages, type Shortage } from "../lib/menu";
import { MEALS, type Meal, type MealLog, type Recipe, type Who } from "../lib/types";
import { addDays, errorText, fmtQty, todayCO } from "../lib/util";
import { Sheet } from "../components/Sheet";

const WHO_LABEL: Record<Who, string> = { ambos: "los dos", mariana: "Mariana", alex: "Alex" };
const MEDIA_TARDE = "Opcional, si hay hambre o la cena es tarde: kumis o yogur + 1 cda de maní · fruta + 1 stick de queso + 1 cda de maní · leche + 3 saltinas · garbanzos tostados + fruta.";

/** Menú del día según el ciclo de 14 días, con "Preparé" y lo que hay que adelantar. */
export function Hoy({ onError }: { onError: (m: string) => void }) {
  const { household, recipes, ingredients, plan, mealLogs, items, stock, refresh } = useData();
  const today = todayCO();
  const [date, setDate] = useState(today);
  const [prep, setPrep] = useState<{ meal: Meal; recipe: Recipe } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  if (!plan.length) {
    return (
      <div className="card">
        <h2>Menú</h2>
        <p className="muted">Todavía no hay menú cargado. Falta correr la actualización 0004 en Supabase.</p>
      </div>
    );
  }

  const day = cycleDay(household.menu_start, date);
  const tomorrow = cycleDay(household.menu_start, addDays(date, 1));
  const logOf = (meal: Meal) => mealLogs.find((l) => l.log_date === date && l.meal === meal);
  const nextRecipes = (["desayuno", "almuerzo", "cena"] as Meal[]).map((m) => recipeFor(plan, recipes, tomorrow, m)).filter((r): r is Recipe => !!r);
  // Lo que falta para lo que no se ha preparado hoy y para mañana
  const pendingToday = MEALS.filter((m) => !logOf(m.id)).map((m) => recipeFor(plan, recipes, day, m.id)).filter((r): r is Recipe => !!r);
  const missing = shortages([...pendingToday, ...nextRecipes].map((r) => r.id), ingredients, items, stock);

  const undo = async (log: MealLog) => {
    const { error } = await supabase.rpc("undo_meal", { p_log: log.id });
    if (error) return onError(errorText(error));
    await refresh();
  };

  const flag = async (list: Shortage[]) => {
    const ids = list.map((s) => s.item.id);
    const { error } = await supabase.from("items").update({ running_low: true }).in("id", ids);
    if (error) return onError(errorText(error));
    await refresh();
  };

  const label = new Date(`${date}T12:00:00`).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="row spread">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior">‹</button>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ textTransform: "capitalize" }}>{date === today ? "Hoy" : label}</h2>
          <span className="muted small">Día {day} · {cycleLabel(day)}</span>
        </div>
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente">›</button>
      </div>
      {date !== today && <button className="link" onClick={() => setDate(today)}>Volver a hoy</button>}

      {MEALS.map((m) => {
        if (m.id === "media_tarde") {
          return (
            <div className="card" key={m.id}>
              <h3>{m.label}</h3>
              <p className="small muted">{MEDIA_TARDE}</p>
            </div>
          );
        }
        const r = recipeFor(plan, recipes, day, m.id);
        if (!r) return null;
        const log = logOf(m.id);
        const ing = ingredients.filter((x) => x.recipe_id === r.id);
        const short = new Set(shortages([r.id], ingredients, items, stock).map((s) => s.item.id));
        const key = `${m.id}`;
        return (
          <div className={`card meal ${log ? "done" : ""}`} key={m.id}>
            <div className="row spread">
              <h3>{m.label}{r.minutes ? ` · ${r.minutes} min` : ""}</h3>
              {log ? <span className="pill">Preparado · {WHO_LABEL[log.who]}</span> : short.size > 0 && <span className="pill warn">Faltan {short.size}</span>}
            </div>
            <b>{r.name}</b>
            {r.steps && <p className="small muted">{r.steps}</p>}
            <button className="link" onClick={() => setOpen(open === key ? null : key)} aria-expanded={open === key}>
              {open === key ? "Ocultar ingredientes" : `Ingredientes (${ing.length})`}
            </button>
            {open === key && (
              <table>
                <thead><tr><th>Ingrediente</th><th className="r">Mariana</th><th className="r">Alex</th></tr></thead>
                <tbody>
                  {ing.map((x) => {
                    const it = items.find((i) => i.id === x.item_id);
                    if (!it) return null;
                    return (
                      <tr key={x.id}>
                        <td>{it.name}{short.has(it.id) && <span className="pill bad" style={{ marginLeft: 6 }}>falta</span>}</td>
                        <td className="r num">{Number(x.qty_m) ? fmtQty(Number(x.qty_m), it.unit) : "—"}</td>
                        <td className="r num">{Number(x.qty_a) ? fmtQty(Number(x.qty_a), it.unit) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div className="row">
              {log ? (
                <button onClick={() => undo(log)}>Deshacer</button>
              ) : (
                <button className="primary" onClick={() => setPrep({ meal: m.id, recipe: r })}>Preparé</button>
              )}
            </div>
          </div>
        );
      })}

      <div className="card">
        <h2>Para mañana</h2>
        <p className="small muted">Día {tomorrow} · {cycleLabel(tomorrow)}. Adelantar en el turno de hoy:</p>
        <ul className="small">
          {nextRecipes.map((r) => <li key={r.id}><b>{r.meal === "desayuno" ? "Desayuno" : r.meal === "almuerzo" ? "Almuerzo" : "Cena"}:</b> {r.name}</li>)}
        </ul>
      </div>

      <div className="card">
        <h2>Falta en la despensa</h2>
        {!missing.length && <p className="muted small">Alcanza para lo que queda de hoy y para mañana.</p>}
        {missing.length > 0 && (
          <>
            <p className="small muted">Para lo que falta de hoy y para mañana, según la despensa de la app.</p>
            <table>
              <thead><tr><th>Artículo</th><th className="r">Se necesita</th><th className="r">Hay</th></tr></thead>
              <tbody>
                {missing.map((s) => (
                  <tr key={s.item.id}>
                    <td>{s.item.name}{s.item.running_low && <span className="pill warn" style={{ marginLeft: 6 }}>en la lista</span>}</td>
                    <td className="r num">{fmtQty(Math.round(s.need * 100) / 100, s.item.unit)}</td>
                    <td className="r num">{fmtQty(Math.round(s.have * 100) / 100, s.item.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {missing.some((s) => !s.item.running_low) && (
              <button onClick={() => flag(missing.filter((s) => !s.item.running_low))}>Agregar a la lista de compras</button>
            )}
            <p className="small muted">Si en la casa sí hay, cuéntenlo en Despensa → Contar para que la app quede al día.</p>
          </>
        )}
      </div>

      {prep && (
        <PrepSheet
          meal={prep.meal}
          recipe={prep.recipe}
          date={date}
          onClose={() => setPrep(null)}
          onError={onError}
        />
      )}
    </>
  );
}

function PrepSheet({ meal, recipe, date, onClose, onError }: { meal: Meal; recipe: Recipe; date: string; onClose: () => void; onError: (m: string) => void }) {
  const { household, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const go = async (who: Who) => {
    setBusy(true);
    const { error } = await supabase.rpc("prepare_meal", { p_household: household.id, p_date: date, p_meal: meal, p_recipe: recipe.id, p_who: who });
    setBusy(false);
    if (error) return onError(errorText(error));
    await refresh();
    onClose();
  };
  return (
    <Sheet title={`Preparé: ${recipe.name}`} onClose={onClose}>
      <p className="small muted">Se descuentan los ingredientes de la despensa. Si algo no estaba registrado, se descuenta lo que haya.</p>
      <div className="grid3">
        <button className="primary" disabled={busy} onClick={() => go("ambos")}>Para los dos</button>
        <button disabled={busy} onClick={() => go("mariana")}>Solo Mariana</button>
        <button disabled={busy} onClick={() => go("alex")}>Solo Alex</button>
      </div>
      <button onClick={onClose}>Cancelar</button>
    </Sheet>
  );
}
