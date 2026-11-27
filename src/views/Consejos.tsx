import { useData } from "../lib/store";
import { buildAdvice, type AdviceLevel } from "../lib/advice";
import { todayCO } from "../lib/util";
import { BudgetCard } from "../components/BudgetCard";

const LABEL: Record<AdviceLevel, string> = { alerta: "Atención", ahorro: "Ahorro", info: "Dato" };

/** Sugerencias calculadas con las compras, la despensa y el presupuesto del hogar. */
export function Consejos() {
  const { household, items, purchases, movements, stock } = useData();
  const advice = buildAdvice(household, items, purchases, movements, stock, todayCO());
  return (
    <>
      <BudgetCard />
      <div className="card">
        <h2>Sugerencias</h2>
        <p className="muted small">Salen de sus compras registradas. Mientras más mercados guarden, más precisas.</p>
        {!advice.length && <p className="muted">Todavía no hay datos suficientes. Aparecerán al guardar el primer mercado.</p>}
        {advice.map((a) => (
          <div className={`advice ${a.level}`} key={a.id}>
            <span className={`pill ${a.level === "alerta" ? "bad" : a.level === "ahorro" ? "" : "warn"}`}>{LABEL[a.level]}</span>
            <b>{a.title}</b>
            <p className="small">{a.detail}</p>
          </div>
        ))}
      </div>
    </>
  );
}
