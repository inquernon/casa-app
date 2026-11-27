import { SECTIONS, type Section } from "../lib/sections";

/** Menú principal: cuatro secciones en una matriz de 2×2. */
export function Home({ onOpen }: { onOpen: (s: Section) => void }) {
  return (
    <div className="home">
      {SECTIONS.map((s) => (
        <button key={s.id} className="tile-btn" onClick={() => onOpen(s.id)}>
          <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={s.icon} />
          </svg>
          <b>{s.label}</b>
          <span className="small muted">{s.hint}</span>
          {!s.ready && <span className="pill warn">Próximamente</span>}
        </button>
      ))}
    </div>
  );
}

const PLANNED: Record<"casa" | "calendario", string[]> = {
  calendario: [
    "Pagos que se repiten cada mes, con el día de vencimiento y el valor.",
    "Avisos en el celular (Android y iPhone).",
    "Sincronización con Google Calendar.",
    "Registro automático: mercado guardado, producto agotado o por acabarse, comida preparada.",
  ],
  casa: [
    "Focos y cámara VTA+.",
    "Lavadora con SmartThings.",
    "Enchufes y demás equipos que hoy maneja Alexa.",
    "Requiere Home Assistant en un equipo siempre encendido.",
  ],
};

export function Pronto({ section }: { section: "casa" | "calendario" }) {
  return (
    <div className="card">
      <h2>En construcción</h2>
      <p className="muted small">Esta sección viene después. Lo que va a tener:</p>
      <ul className="small">{PLANNED[section].map((p) => <li key={p}>{p}</li>)}</ul>
    </div>
  );
}
