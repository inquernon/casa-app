import { useEffect, useRef, type ReactNode } from "react";

/** Hoja modal que sube desde abajo en el celular y se centra en pantallas grandes. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  );
}

export function PlacesDatalist() {
  return (
    <datalist id="places">
      {["Makro", "D1", "PriceSmart", "Supermu", "Ara", "Éxito", "Olímpica"].map((p) => (
        <option key={p} value={p} />
      ))}
    </datalist>
  );
}
