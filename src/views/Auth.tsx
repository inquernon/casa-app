import { useState } from "react";
import { supabase } from "../lib/supabase";
import { errorText } from "../lib/util";

export function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setMsg(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : errorText(error));
    if (mode === "up" && !data.session) setMsg("Te enviamos un correo para confirmar la cuenta. Ábrelo y luego inicia sesión.");
  }

  return (
    <div className="card auth">
      <h1>Casa</h1>
      <p className="muted">Mercado, despensa y menú de la casa.</p>
      <form className="form" onSubmit={submit}>
        <label>Correo<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>
          Contraseña
          <input type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {msg && <p className="banner">{msg}</p>}
        <button type="submit" className="primary" disabled={busy}>{mode === "in" ? "Entrar" : "Crear cuenta"}</button>
      </form>
      <button className="link" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "¿No tienes cuenta? Crear una" : "Ya tengo cuenta"}
      </button>
    </div>
  );
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: "create_household_v2" | "join_household") {
    if (!name.trim()) return setMsg("Escribe tu nombre.");
    if (fn === "join_household" && !code.trim()) return setMsg("Escribe el código de invitación.");
    setBusy(true);
    const args = fn === "create_household_v2" ? { p_name: "Casa", p_display_name: name.trim() } : { p_code: code.trim(), p_display_name: name.trim() };
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return setMsg(errorText(error));
    onDone();
  }

  return (
    <div className="card auth">
      <h1>Bienvenido</h1>
      <label>Tu nombre<input value={name} placeholder="Alex o Mariana" onChange={(e) => setName(e.target.value)} /></label>
      {msg && <p className="banner">{msg}</p>}
      <div className="card inset">
        <h2>Crear la casa</h2>
        <p className="muted small">Solo la primera persona. Se carga la lista de artículos inicial.</p>
        <button className="primary" disabled={busy} onClick={() => run("create_household_v2")}>Crear casa</button>
      </div>
      <div className="card inset">
        <h2>Unirme a una casa</h2>
        <p className="muted small">Pide el código a quien creó la casa (aparece en Artículos → Ajustes).</p>
        <label>Código<input value={code} autoCapitalize="none" onChange={(e) => setCode(e.target.value)} /></label>
        <button disabled={busy} onClick={() => run("join_household")}>Unirme</button>
      </div>
      <button className="link" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div>
  );
}
