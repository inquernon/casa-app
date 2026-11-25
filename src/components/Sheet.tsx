import { useEffect, useRef, type ReactNode } from "react";
import { PLACES } from "../lib/types";

/** Hoja modal que sube desde abajo en el celular y se centra en pantallas grandes. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const openedAt = useRef(0);

  useEffect(() => {
    closeRef.current = onClose;
  });

  // Solo al abrir: así un refresco de datos no le quita el foco al campo que se está llenando.
  useEffect(() => {
    openedAt.current = Date.now();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // En pantallas táctiles el toque que abre la hoja puede generar un segundo clic sobre el fondo:
  // se ignoran los clics del fondo durante el primer medio segundo.
  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && Date.now() - openedAt.current > 500) closeRef.current();
  };

  return (
    <div className="overlay" onClick={onBackdrop}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="track" />
    </button>
  );
}

export function PlacesDatalist() {
  return (
    <datalist id="places">
      {PLACES.map((p) => (
        <option key={p} value={p} />
      ))}
    </datalist>
  );
}
