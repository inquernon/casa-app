# Casa

App del hogar: lista de mercado dinámica, historial, análisis de gastos y (próximas fases) despensa, menú del día y recetas.

**Herramientas:** React + TypeScript + Vite (instalable en el celular como PWA) · Supabase (inicio de sesión, Postgres con RLS, tiempo real) · Netlify.

## Puesta en marcha (una sola vez)

### 1. Base de datos
1. Supabase → proyecto `casa-app` → **SQL Editor** → **New query**.
2. Pega todo `supabase/migrations/0001_init.sql` y dale **Run**.

### 2. Inicio de sesión
- **Authentication → Sign In / Providers → Email:** déjalo activo. Si no quieren confirmar el correo al registrarse, apaga **Confirm email**.
- **Authentication → URL Configuration:** en **Site URL** pon la dirección de Netlify (por ejemplo `https://casa-app.netlify.app`).

### 3. Netlify
1. **Add new site → Import from Git →** `inquernon/casa-app`. Netlify detecta `netlify.toml`.
2. **Site configuration → Environment variables:**
   - `VITE_SUPABASE_URL` = `https://yzfrfjeonyzwkicnyadp.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = la clave **anon / publishable** (Supabase → Project Settings → API Keys). Nunca la `service_role`.
3. **Deploy**.

### 4. Primer uso
1. Alex crea su cuenta → **Crear casa** (carga los 43 artículos iniciales).
2. En **Artículos → Ajustes** aparece el código de invitación.
3. Mariana crea su cuenta → **Unirme a una casa** con ese código.
4. En el celular: abrir la app en el navegador → **Agregar a pantalla de inicio**.

## Desarrollo local
```bash
cp .env.example .env.local   # pega la anon key
npm install
npm run dev
```

## Estructura
| Ruta | Qué hay |
|---|---|
| `supabase/migrations/` | Esquema, reglas de seguridad y funciones (`create_household`, `join_household`, `save_trip`) |
| `src/lib/` | Cliente de Supabase, tipos, utilidades de fechas y periodos, datos en tiempo real |
| `src/views/` | Pantallas: Lista, Historial, Análisis, Artículos, Auth |

La lógica de negocio vive en funciones de Postgres para que otros clientes (Claude, Alexa) puedan usarla sin duplicarla.

## Fases
1. (Hecha) Inicio de sesión, hogar compartido, artículos, lista dinámica, mercados, historial, análisis.
2. (Hecha) Despensa: stock por movimientos, conteo, consumo manual, stock mínimo. No requiere SQL nuevo.
3. Recetas, ciclo de menú de 14 días, pantalla **Hoy** con "Preparé".
4. Reporte para Claude y conexión por MCP.
