import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configError, supabase } from "./lib/supabase";
import { DataProvider } from "./lib/data";
import { useData } from "./lib/store";
import type { Household } from "./lib/types";
import { Login, Onboarding } from "./views/Auth";
import { Lista } from "./views/Lista";
import { Despensa } from "./views/Despensa";
import { Historial } from "./views/Historial";
import { Analisis } from "./views/Analisis";
import { Consejos } from "./views/Consejos";
import { Articulos } from "./views/Articulos";
import { Dinero } from "./views/Dinero";
import { Hoy } from "./views/Hoy";
import { Home, Pronto } from "./views/Home";
import { SECTIONS, type Section } from "./lib/sections";

const TABS = [
  { id: "hoy", label: "Hoy" },
  { id: "lista", label: "Lista" },
  { id: "despensa", label: "Despensa" },
  { id: "historial", label: "Historial" },
  { id: "analisis", label: "Análisis" },
  { id: "consejos", label: "Consejos" },
  { id: "articulos", label: "Artículos" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** Ruta en el hash: "#inicio", "#dinero", "#cocina/lista"… */
interface Route { section: Section | "inicio"; tab: Tab }
function parseRoute(hash: string): Route {
  const [a, b] = hash.replace(/^#/, "").split("/");
  // Enlaces viejos ("#lista") siguen abriendo la cocina
  if (TABS.some((t) => t.id === a)) return { section: "cocina", tab: a as Tab };
  const section = SECTIONS.some((s) => s.id === a) ? (a as Section) : "inicio";
  const tab = TABS.some((t) => t.id === b) ? (b as Tab) : "hoy";
  return { section, tab };
}
const toHash = (r: Route) => (r.section === "cocina" ? `cocina/${r.tab}` : r.section);

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);

  useEffect(() => {
    const apply = (s: Session | null) => {
      if (s) supabase.realtime.setAuth(s.access_token);
      setSession(s);
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => apply(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadHousehold = useCallback(async () => {
    if (!session) return setHousehold(undefined);
    const { data } = await supabase.from("household_members").select("household_id, households(*)").eq("user_id", session.user.id).limit(1);
    const row = data?.[0] as unknown as { households: Household } | undefined;
    setHousehold(row?.households ?? null);
  }, [session]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  if (configError) return <main><div className="banner">{configError}</div></main>;
  if (session === undefined) return <main><p className="muted">Cargando…</p></main>;
  if (!session) return <main><Login /></main>;
  if (household === undefined) return <main><p className="muted">Cargando la casa…</p></main>;
  if (!household) return <main><Onboarding onDone={loadHousehold} /></main>;

  return (
    <DataProvider userId={session.user.id} household={household}>
      <Shell />
    </DataProvider>
  );
}

function Shell() {
  const { loading, error } = useData();
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (r: Route) => {
    window.location.hash = toHash(r);
    setRoute(r);
    window.scrollTo(0, 0);
  };
  const { section, tab } = route;
  const title = section === "inicio" ? "Casa" : SECTIONS.find((s) => s.id === section)!.label;

  return (
    <>
      <main className={section === "cocina" ? "" : "nonav"}>
        <header className="row spread">
          <div className="row">
            {section !== "inicio" && <button className="link" onClick={() => go({ section: "inicio", tab })} aria-label="Volver al inicio">‹ Inicio</button>}
            <h1>{title}</h1>
          </div>
          <span className={`pill ${error ? "warn" : ""}`}>{error ? "Error" : loading ? "Cargando…" : "Al día"}</span>
        </header>
        {(msg || error) && (
          <div className="banner" role="alert" onClick={() => setMsg(null)}>{msg || error}</div>
        )}
        {section === "inicio" && <Home onOpen={(s) => go({ section: s, tab })} />}
        {section === "dinero" && <Dinero onError={setMsg} />}
        {(section === "casa" || section === "calendario") && <Pronto section={section} />}
        {section === "cocina" && (
          <>
            {tab === "hoy" && <Hoy onError={setMsg} />}
            {tab === "lista" && <Lista onError={setMsg} />}
            {tab === "despensa" && <Despensa />}
            {tab === "historial" && <Historial />}
            {tab === "analisis" && <Analisis />}
            {tab === "consejos" && <Consejos />}
            {tab === "articulos" && <Articulos onError={setMsg} />}
          </>
        )}
      </main>
      {section === "cocina" && (
        <nav className="tabs" aria-label="Secciones de la cocina">
          {TABS.map((t) => (
            <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => go({ section: "cocina", tab: t.id })}>{t.label}</button>
          ))}
        </nav>
      )}
    </>
  );
}
