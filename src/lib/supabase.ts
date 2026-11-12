import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configError = !url || !anonKey
  ? "Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Configúralas en .env.local o en Netlify."
  : null;

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true },
});
