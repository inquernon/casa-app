import { useData } from "../lib/store";
import { spentByPocket } from "../lib/listLogic";
import { money, monthOf, todayCO } from "../lib/util";

function Bar({ label, spent, budget }: { label: string; spent: number; budget: number }) {
  const over = budget > 0 && spent > budget;
  const pct = budget ? Math.min(100, (spent / budget) * 100) : 0;
  return (
    <div className="pocket">
      <div className="row spread small">
        <span>{label}</span>
        <span className="num">
          {money(spent)} / {money(budget)} ·{" "}
          <b style={{ color: over ? "var(--bad)" : undefined }}>{over ? `pasado ${money(spent - budget)}` : `quedan ${money(budget - spent)}`}</b>
        </span>
      </div>
      <div className={`bar ${over ? "over" : ""}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** Presupuesto del mes calendario: comida y aseo, mascotas y total. Incluye lo marcado sin guardar. */
export function BudgetCard() {
  const { household, purchases } = useData();
  const m = monthOf(todayCO());
  const spent = spentByPocket(purchases, m.start, m.end);
  const food = Number(household.budget_food) || 0;
  const pets = Number(household.budget_pets) || 0;
  const name = new Date(`${m.start}T12:00:00`).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return (
    <div className="card">
      <div className="row spread">
        <h2>Presupuesto</h2>
        <span className="muted small">{name} · día {m.day} de {m.days}</span>
      </div>
      <div className="summary">
        <div className="tile"><b className="num">{money(spent.mercado + spent.mascotas)}</b><span>gastado</span></div>
        <div className="tile"><b className="num">{money(food + pets)}</b><span>presupuesto</span></div>
        <div className="tile"><b className="num">{money(food + pets - spent.mercado - spent.mascotas)}</b><span>queda</span></div>
      </div>
      <Bar label="Comida y aseo" spent={spent.mercado} budget={food} />
      <Bar label="Mascotas" spent={spent.mascotas} budget={pets} />
    </div>
  );
}
