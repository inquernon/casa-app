import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { configError, supabase } from "./lib/supabase";
import { DataProvider, useData } from "./lib/data";
import type { Household } from "./lib/types";
import { Login, Onboarding } from "./views/Auth";
import { Lista } from "./views/Lista";
import { Despensa } from "./views/Despensa";
import { Historial } from "./views/Historial";
import { Analisis } from "./views/Analisis";
import { Articulos } from "./views/Articulos";

const TABS = [
  { id: "lista", label: "Lista" },
  { id: "despensa", label: "Despensa" },
  { id: "historial", label: "Historial" },
  { id: "analisis", label: "Análisis" },
  { id: "articulos", label: "Artículos" },
] as const;
type Tab = (typeof TABS)[number]["id"];

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
  const initial = (window.location.hash.slice(1) as Tab) || "lista";
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.id === initial) ? initial : "lista");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (t: Tab) => {
    window.location.hash = t;
    setTab(t);
    window.scrollTo(0, 0);
  };

  return (
    <>
      <main>
        <header className="row spread">
          <h1>Casa</h1>
          <span className={`pill ${error ? "warn" : ""}`}>{error ? "Error" : loading ? "Cargando…" : "Al día"}</span>
        </header>
        {(msg || error) && (
          <div className="banner" role="alert" onClick={() => setMsg(null)}>{msg || error}</div>
        )}
        {tab === "lista" && <Lista onError={setMsg} />}
        {tab === "despensa" && <Despensa />}
        {tab === "historial" && <Historial />}
        {tab === "analisis" && <Analisis />}
        {tab === "articulos" && <Articulos onError={setMsg} />}
      </main>
      <nav className="tabs" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => go(t.id)}>{t.label}</button>
        ))}
      </nav>
    </>
  );
}
