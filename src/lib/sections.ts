export type Section = "dinero" | "casa" | "cocina" | "calendario";

export const SECTIONS: { id: Section; label: string; hint: string; ready: boolean; icon: string }[] = [
  { id: "dinero", label: "Dinero", hint: "Ingresos, gastos y totales de la casa", ready: true, icon: "M4 7h16v10H4zM4 10h16M8 14h3" },
  { id: "casa", label: "Casa", hint: "Luces, cámara, lavadora y enchufes", ready: false, icon: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5" },
  { id: "cocina", label: "Cocina", hint: "Lista, despensa, historial y consejos", ready: true, icon: "M6 3v8a3 3 0 0 0 6 0V3M9 3v18M17 3c-2 2-2 6 0 8v10" },
  { id: "calendario", label: "Calendario", hint: "Pagos, recordatorios y lo que pasa en casa", ready: false, icon: "M4 6h16v14H4zM4 10h16M8 3v5M16 3v5" },
];
