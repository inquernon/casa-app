-- 0004 · Menú de 14 días, recetas y "Preparé".
-- Carga el menú ajustado v4 (claude/menu-14-dias-ajustado.md) en cada casa, ciclo desde el lunes 30 nov 2026,
-- y ajusta las cantidades del catálogo al menú nuevo. Se puede correr más de una vez:
-- la carga del menú y los ajustes del catálogo solo pasan la primera vez.

create temp table _first_run_0004 as select to_regclass('public.recipes') is null as first;

-- ---------- Tablas de referencia (iguales para todas las casas) ----------
create table if not exists public.recipe_defaults (
  name text primary key,
  meal text not null,
  minutes int not null default 0,
  steps text not null default '',
  ingredients jsonb not null default '[]'   -- [{key, names[], grp, unit, m, a}] cantidades por persona
);
create table if not exists public.menu_defaults (
  day int not null check (day between 1 and 14),
  meal text not null,
  recipe_name text not null references public.recipe_defaults(name) on update cascade,
  primary key (day, meal)
);
alter table public.recipe_defaults enable row level security;
alter table public.menu_defaults enable row level security;
drop policy if exists "todos leen recetas base" on public.recipe_defaults;
create policy "todos leen recetas base" on public.recipe_defaults for select using (true);
drop policy if exists "todos leen menú base" on public.menu_defaults;
create policy "todos leen menú base" on public.menu_defaults for select using (true);

-- ---------- Tablas de cada casa ----------
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  meal text not null check (meal in ('desayuno', 'media_manana', 'almuerzo', 'media_tarde', 'cena', 'tanda')),
  minutes int not null default 0,
  steps text not null default '',
  created_at timestamptz not null default now(),
  unique (household_id, name)
);
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  qty_m numeric not null default 0 check (qty_m >= 0),   -- porción de Mariana, en la unidad base del artículo
  qty_a numeric not null default 0 check (qty_a >= 0)    -- porción de Alex
);
create index if not exists recipe_ingredients_recipe on public.recipe_ingredients (recipe_id);
create table if not exists public.menu_plan (
  household_id uuid not null references public.households(id) on delete cascade,
  day int not null check (day between 1 and 14),
  meal text not null check (meal in ('desayuno', 'media_manana', 'almuerzo', 'media_tarde', 'cena')),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  primary key (household_id, day, meal)
);
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  log_date date not null,
  meal text not null,
  recipe_id uuid references public.recipes(id) on delete set null,
  who text not null default 'ambos' check (who in ('ambos', 'mariana', 'alex')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (household_id, log_date, meal)
);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.menu_plan enable row level security;
alter table public.meal_logs enable row level security;
drop policy if exists "hogar: recetas" on public.recipes;
create policy "hogar: recetas" on public.recipes for all using (public.is_member(household_id)) with check (public.is_member(household_id));
drop policy if exists "hogar: ingredientes" on public.recipe_ingredients;
create policy "hogar: ingredientes" on public.recipe_ingredients for all using (public.is_member(household_id)) with check (public.is_member(household_id));
drop policy if exists "hogar: menú" on public.menu_plan;
create policy "hogar: menú" on public.menu_plan for all using (public.is_member(household_id)) with check (public.is_member(household_id));
drop policy if exists "hogar: comidas" on public.meal_logs;
create policy "hogar: comidas" on public.meal_logs for all using (public.is_member(household_id)) with check (public.is_member(household_id));

do $$
declare t text;
begin
  foreach t in array array['recipes', 'recipe_ingredients', 'menu_plan', 'meal_logs'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- Datos del menú v4 (generados) ----------
insert into public.recipe_defaults (name, meal, minutes, steps, ingredients) values
  ('Tostadas con aguacate y huevo revuelto', 'desayuno', 10, 'Huevo revuelto sin aceite extra. Aguapanela con leche.', '[{"key": "tostadas", "names": ["Tostadas integrales"], "grp": "Harina", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 1}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "panela", "names": ["Panela"], "grp": "Despensa", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "pera", "names": ["Pera"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Arepa con quesito', 'desayuno', 8, 'Arepa asada. Aguapanela con leche. Mariana: naranja; Alex: papaya.', '[{"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "panela", "names": ["Panela"], "grp": "Despensa", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "naranja", "names": ["Naranja"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 0}, {"key": "papaya", "names": ["Papaya"], "grp": "Fruta", "unit": "unidad", "m": 0, "a": 0.125}]'::jsonb),
  ('Arepa con huevo revuelto', 'desayuno', 10, 'Huevo revuelto con cebolla. Mariana: pericos con tomate.', '[{"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 1}, {"key": "cebolla", "names": ["Cebolla (cabezona o junca)"], "grp": "Verdura", "unit": "g", "m": 10, "a": 10}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "panela", "names": ["Panela"], "grp": "Despensa", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "naranja", "names": ["Naranja"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 0}, {"key": "papaya", "names": ["Papaya"], "grp": "Fruta", "unit": "unidad", "m": 0, "a": 0.125}]'::jsonb),
  ('Tostadas con aguacate y quesito', 'desayuno', 5, 'Leche con canela (Mariana: café con leche).', '[{"key": "tostadas", "names": ["Tostadas integrales"], "grp": "Harina", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "pera", "names": ["Pera"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Arepa con quesito y banano', 'desayuno', 8, 'Aguapanela con leche.', '[{"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "panela", "names": ["Panela"], "grp": "Despensa", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "banano", "names": ["Banano"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Avena en leche con manzana', 'desayuno', 8, 'Leche y avena a fuego bajo con canela; se puede dejar remojando la noche anterior. Mariana: + huevo duro.', '[{"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "manzana", "names": ["Manzana"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 0}]'::jsonb),
  ('Batido de avena y banano con mantequilla de maní', 'desayuno', 3, 'Licuar leche, avena, banano y canela. Mariana: + huevo duro.', '[{"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "banano", "names": ["Banano"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "mmani", "names": ["Mantequilla de maní"], "grp": "Despensa", "unit": "unidad", "m": 0.05, "a": 0.05}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 0}]'::jsonb),
  ('Kumis con avena y mango', 'desayuno', 3, 'Mariana: + huevo duro.', '[{"key": "kumis", "names": ["Kumis"], "grp": "Lácteo", "unit": "unidad", "m": 0.2, "a": 0.2}, {"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "mango", "names": ["Mango"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 0}]'::jsonb),
  ('Avena en leche con banano y maní', 'desayuno', 8, 'Mariana: + huevo revuelto.', '[{"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "banano", "names": ["Banano"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "mani", "names": ["Maní sin sal u otros frutos secos", "Frutos secos"], "grp": "Grasa", "unit": "g", "m": 15, "a": 15}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 0}]'::jsonb),
  ('Kumis con avena y manzana', 'desayuno', 3, 'Mariana: + huevo duro.', '[{"key": "kumis", "names": ["Kumis"], "grp": "Lácteo", "unit": "unidad", "m": 0.2, "a": 0.2}, {"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "manzana", "names": ["Manzana"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 0}]'::jsonb),
  ('Avena en leche con manzana y maní', 'desayuno', 8, 'Mariana: + huevo duro.', '[{"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "manzana", "names": ["Manzana"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "mani", "names": ["Maní sin sal u otros frutos secos", "Frutos secos"], "grp": "Grasa", "unit": "g", "m": 15, "a": 15}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 0}]'::jsonb),
  ('Avena en leche con papaya', 'desayuno', 8, 'Con canela. Mariana: + huevo revuelto.', '[{"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "papaya", "names": ["Papaya"], "grp": "Fruta", "unit": "unidad", "m": 0.125, "a": 0.125}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 0}]'::jsonb),
  ('Arepa con huevo revuelto y papaya', 'desayuno', 10, 'Aguapanela con leche. Mariana: naranja.', '[{"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 1}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 200, "a": 200}, {"key": "panela", "names": ["Panela"], "grp": "Despensa", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "naranja", "names": ["Naranja"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 0}, {"key": "papaya", "names": ["Papaya"], "grp": "Fruta", "unit": "unidad", "m": 0, "a": 0.125}]'::jsonb),
  ('Piña', 'media_manana', 1, '', '[{"key": "pina", "names": ["Piña"], "grp": "Fruta", "unit": "unidad", "m": 0.1, "a": 0.1}]'::jsonb),
  ('Pera', 'media_manana', 1, '', '[{"key": "pera", "names": ["Pera"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Mango', 'media_manana', 1, '', '[{"key": "mango", "names": ["Mango"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Papaya', 'media_manana', 1, '', '[{"key": "papaya", "names": ["Papaya"], "grp": "Fruta", "unit": "unidad", "m": 0.125, "a": 0.125}]'::jsonb),
  ('Banano', 'media_manana', 1, '', '[{"key": "banano", "names": ["Banano"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Fruta de la semana', 'media_manana', 1, '', '[{"key": "manzana", "names": ["Manzana"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Saltinas con leche', 'media_manana', 2, 'Mariana: café con leche si quiere.', '[{"key": "saltinas", "names": ["Tostadas o galletas saltinas"], "grp": "Harina", "unit": "unidad", "m": 0.08, "a": 0.08}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 150, "a": 150}]'::jsonb),
  ('Manzana y garbanzos tostados', 'media_manana', 1, '', '[{"key": "manzana", "names": ["Manzana"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "garbanzo_t", "names": ["Garbanzos tostados"], "grp": "Sustituto", "unit": "g", "m": 15, "a": 15}]'::jsonb),
  ('Carne molida guisada, maduro y sopa de papa', 'almuerzo', 35, 'Usar 2 cubos de sofrito base. Carne 5 min en el sofrito. Maduro en freidora 180 °C 15 min. Sopa con papa y zanahoria.', '[{"key": "molida", "names": ["Carne molida de res"], "grp": "Proteína", "unit": "g", "m": 120, "a": 140}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "maduro", "names": ["Plátano maduro"], "grp": "Harina", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 80, "a": 80}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Lentejas con carne molida', 'almuerzo', 30, 'Usar 2 cubos de sofrito base. Lentejas 8 min a presión (o porción congelada).', '[{"key": "leguminosa", "names": ["Fríjol, lenteja o garbanzo secos"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "molida", "names": ["Carne molida de res"], "grp": "Proteína", "unit": "g", "m": 120, "a": 140}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}]'::jsonb),
  ('Osobuco con puré de yuca y mazorca', 'almuerzo', 45, 'Usar 2 cubos de sofrito base. Osobuco 35 min a presión y 8 min en freidora. Yuca 10 min a presión, machacar con mantequilla y leche.', '[{"key": "osobuco", "names": ["Osobuco"], "grp": "Proteína", "unit": "g", "m": 257, "a": 300}, {"key": "yuca", "names": ["Yuca"], "grp": "Harina", "unit": "g", "m": 120, "a": 120}, {"key": "mantequilla", "names": ["Mantequilla"], "grp": "Grasa", "unit": "g", "m": 5, "a": 5}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 30, "a": 30}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "mazorca", "names": ["Mazorca"], "grp": "Verdura", "unit": "unidad", "m": 0.5, "a": 0.5}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}]'::jsonb),
  ('Pollo desmechado sofrito con papas y pimentón', 'almuerzo', 35, 'Usar 2 cubos de sofrito base. Pechuga 15 min a presión, desmechar y sofreír con cebolla. Papas en cubos con pimentón en freidora 18 min.', '[{"key": "pechuga", "names": ["Pechuga o contramuslo de pollo sin hueso"], "grp": "Proteína", "unit": "g", "m": 120, "a": 140}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 100, "a": 100}, {"key": "pimenton", "names": ["Pimentón"], "grp": "Verdura", "unit": "unidad", "m": 0.15, "a": 0.15}, {"key": "maduro", "names": ["Plátano maduro"], "grp": "Harina", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "cebolla", "names": ["Cebolla (cabezona o junca)"], "grp": "Verdura", "unit": "g", "m": 20, "a": 20}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Fríjol rojo con carne molida', 'almuerzo', 30, 'Usar 2 cubos de sofrito base. Fríjol remojado, 25–30 min a presión (o porción congelada).', '[{"key": "leguminosa", "names": ["Fríjol, lenteja o garbanzo secos"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "molida", "names": ["Carne molida de res"], "grp": "Proteína", "unit": "g", "m": 120, "a": 140}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "maduro", "names": ["Plátano maduro"], "grp": "Harina", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "mango", "names": ["Mango"], "grp": "Fruta", "unit": "unidad", "m": 0.5, "a": 0.5}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}]'::jsonb),
  ('Pasta boloñesa suave', 'almuerzo', 30, 'Carne molida guisada + tomate y zanahoria licuados, 15 min tapado.', '[{"key": "pasta", "names": ["Pasta"], "grp": "Harina", "unit": "g", "m": 55, "a": 55}, {"key": "molida", "names": ["Carne molida de res"], "grp": "Proteína", "unit": "g", "m": 120, "a": 140}, {"key": "tomate", "names": ["Tomate"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 80, "a": 80}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Sancocho de espinazo y pollo', 'almuerzo', 50, 'Espinazo 25 min a presión; agregar pollo, yuca, papa y mazorca, 10 min más. Cocinar doble el domingo de la semana 1.', '[{"key": "espinazo", "names": ["Espinazo de res"], "grp": "Proteína", "unit": "g", "m": 129, "a": 150}, {"key": "contramuslo", "names": ["Contramuslo de pollo con hueso"], "grp": "Proteína", "unit": "g", "m": 92, "a": 107}, {"key": "yuca", "names": ["Yuca"], "grp": "Harina", "unit": "g", "m": 80, "a": 80}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 100, "a": 100}, {"key": "mazorca", "names": ["Mazorca"], "grp": "Verdura", "unit": "unidad", "m": 0.5, "a": 0.5}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Sancocho de espinazo y pollo (doble, para el lunes)', 'almuerzo', 55, 'Igual que el sancocho, con el doble de todo. La mitad se guarda para el almuerzo del lunes.', '[{"key": "espinazo", "names": ["Espinazo de res"], "grp": "Proteína", "unit": "g", "m": 258, "a": 300}, {"key": "contramuslo", "names": ["Contramuslo de pollo con hueso"], "grp": "Proteína", "unit": "g", "m": 184, "a": 214}, {"key": "yuca", "names": ["Yuca"], "grp": "Harina", "unit": "g", "m": 160, "a": 160}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 200, "a": 200}, {"key": "mazorca", "names": ["Mazorca"], "grp": "Verdura", "unit": "unidad", "m": 1.0, "a": 1.0}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.5, "a": 0.5}]'::jsonb),
  ('Sancocho del domingo', 'almuerzo', 10, 'Calentar el sancocho guardado. Ya se descontó el domingo.', '[{"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 20, "a": 20}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Contramuslo en freidora con crema de espinaca', 'almuerzo', 30, 'Contramuslo sin piel adobado, 180 °C 22–25 min. Crema preparada la noche anterior.', '[{"key": "contramuslo", "names": ["Contramuslo de pollo con hueso"], "grp": "Proteína", "unit": "g", "m": 184, "a": 214}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "maduro", "names": ["Plátano maduro"], "grp": "Harina", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "espinaca", "names": ["Espinaca"], "grp": "Verdura", "unit": "g", "m": 60, "a": 60}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Garbanzos guisados con carne molida', 'almuerzo', 35, 'Usar 2 cubos de sofrito base. Garbanzo remojado, 30–35 min a presión (o porción congelada).', '[{"key": "leguminosa", "names": ["Fríjol, lenteja o garbanzo secos"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "molida", "names": ["Carne molida de res"], "grp": "Proteína", "unit": "g", "m": 120, "a": 140}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "maduro", "names": ["Plátano maduro"], "grp": "Harina", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}]'::jsonb),
  ('Pescado apanado en freidora con patacón', 'almuerzo', 25, 'Filete con huevo y avena molida, 200 °C 10–12 min. Patacón en freidora.', '[{"key": "pescado", "names": ["Filete de pescado blanco"], "grp": "Proteína", "unit": "g", "m": 112, "a": 131}, {"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 0.5, "a": 0.5}, {"key": "avena", "names": ["Avena en hojuelas"], "grp": "Harina", "unit": "g", "m": 10, "a": 10}, {"key": "arroz", "names": ["Arroz"], "grp": "Harina", "unit": "g", "m": 35, "a": 35}, {"key": "verde", "names": ["Plátano verde"], "grp": "Verdura", "unit": "unidad", "m": 0.5, "a": 0.5}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Pasta con champiñones y pollo', 'almuerzo', 30, 'Pollo en cubos sofrito con champiñones y un chorrito de leche.', '[{"key": "pasta", "names": ["Pasta"], "grp": "Harina", "unit": "g", "m": 55, "a": 55}, {"key": "pechuga", "names": ["Pechuga o contramuslo de pollo sin hueso"], "grp": "Proteína", "unit": "g", "m": 120, "a": 140}, {"key": "champi", "names": ["Champiñones"], "grp": "Verdura", "unit": "g", "m": 60, "a": 60}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 30, "a": 30}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 80, "a": 80}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Arepa con champiñones a la mantequilla y papa criolla', 'cena', 20, 'Champiñones salteados en mantequilla. Criolla en freidora 18 min. Mariana: + tomate.', '[{"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "champi", "names": ["Champiñones"], "grp": "Verdura", "unit": "g", "m": 80, "a": 80}, {"key": "mantequilla", "names": ["Mantequilla"], "grp": "Grasa", "unit": "g", "m": 5, "a": 5}, {"key": "criolla", "names": ["Papa criolla"], "grp": "Harina", "unit": "g", "m": 90, "a": 90}, {"key": "mango", "names": ["Mango"], "grp": "Fruta", "unit": "unidad", "m": 0.5, "a": 0.5}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "tomate", "names": ["Tomate"], "grp": "Verdura", "unit": "g", "m": 60, "a": 0}]'::jsonb),
  ('Tortilla de verduras al horno con arepa', 'cena', 20, '3 huevos para los dos con espinaca, champiñón y pimentón, 180 °C 15 min.', '[{"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1.5, "a": 1.5}, {"key": "espinaca", "names": ["Espinaca"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "champi", "names": ["Champiñones"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "pimenton", "names": ["Pimentón"], "grp": "Verdura", "unit": "unidad", "m": 0.15, "a": 0.15}, {"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "brocoli", "names": ["Brócoli"], "grp": "Verdura", "unit": "g", "m": 80, "a": 80}]'::jsonb),
  ('Crema de espinaca con sánduche de queso', 'cena', 20, 'Crema en caldo del osobuco; rinde para 2 días. Mariana: + tomate.', '[{"key": "espinaca", "names": ["Espinaca"], "grp": "Verdura", "unit": "g", "m": 60, "a": 60}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 50, "a": 50}, {"key": "pan", "names": ["Pan tajado"], "grp": "Harina", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}, {"key": "tomate", "names": ["Tomate"], "grp": "Verdura", "unit": "g", "m": 60, "a": 0}]'::jsonb),
  ('Sánduche de jamón de pavo y queso con papas', 'cena', 20, 'Papas en freidora 18 min. Máximo 1 vez por semana.', '[{"key": "pan", "names": ["Pan tajado"], "grp": "Harina", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "jamon", "names": ["Jamón de pavo o pollo"], "grp": "Sustituto", "unit": "g", "m": 40, "a": 40}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 100, "a": 100}, {"key": "mango", "names": ["Mango"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "tomate", "names": ["Tomate"], "grp": "Verdura", "unit": "g", "m": 60, "a": 0}]'::jsonb),
  ('Crema de verduras con tostadas y aguacate', 'cena', 20, 'Zanahoria, espinaca y apio en caldo; licuar con leche.', '[{"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 60, "a": 60}, {"key": "espinaca", "names": ["Espinaca"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "apio", "names": ["Apio"], "grp": "Verdura", "unit": "g", "m": 20, "a": 20}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 50, "a": 50}, {"key": "tostadas", "names": ["Tostadas integrales"], "grp": "Harina", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Arepa rellena de quesito con ensalada', 'cena', 15, 'Ensalada de pepino y zanahoria.', '[{"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "manzana", "names": ["Manzana"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}]'::jsonb),
  ('Huevos revueltos con espinaca y arepa', 'cena', 15, '2 huevos para los dos. Se adelanta la proteína del día siguiente.', '[{"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 1}, {"key": "espinaca", "names": ["Espinaca"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Tortilla de papa y huevo al horno', 'cena', 30, '3 huevos para los dos, papa en láminas, 180 °C 20 min. Mariana: + tomate.', '[{"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1.5, "a": 1.5}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 100, "a": 100}, {"key": "cebolla", "names": ["Cebolla (cabezona o junca)"], "grp": "Verdura", "unit": "g", "m": 20, "a": 20}, {"key": "mango", "names": ["Mango"], "grp": "Fruta", "unit": "unidad", "m": 0.5, "a": 0.5}, {"key": "tomate", "names": ["Tomate"], "grp": "Verdura", "unit": "g", "m": 60, "a": 0}]'::jsonb),
  ('Tortilla de champiñones al horno con arepa', 'cena', 20, '3 huevos para los dos.', '[{"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1.5, "a": 1.5}, {"key": "champi", "names": ["Champiñones"], "grp": "Verdura", "unit": "g", "m": 60, "a": 60}, {"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Crema de verduras con sánduche de queso', 'cena', 20, 'Zanahoria, espinaca y apio en caldo; licuar con leche.', '[{"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 60, "a": 60}, {"key": "espinaca", "names": ["Espinaca"], "grp": "Verdura", "unit": "g", "m": 30, "a": 30}, {"key": "apio", "names": ["Apio"], "grp": "Verdura", "unit": "g", "m": 20, "a": 20}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 50, "a": 50}, {"key": "pan", "names": ["Pan tajado"], "grp": "Harina", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}]'::jsonb),
  ('Crema de espinaca con tostadas y aguacate', 'cena', 20, 'Licuar con leche.', '[{"key": "espinaca", "names": ["Espinaca"], "grp": "Verdura", "unit": "g", "m": 60, "a": 60}, {"key": "papa", "names": ["Papa común"], "grp": "Harina", "unit": "g", "m": 40, "a": 40}, {"key": "leche", "names": ["Leche UHT"], "grp": "Lácteo", "unit": "ml", "m": 50, "a": 50}, {"key": "tostadas", "names": ["Tostadas integrales"], "grp": "Harina", "unit": "unidad", "m": 0.1, "a": 0.1}, {"key": "aguacate", "names": ["Aguacate"], "grp": "Grasa", "unit": "unidad", "m": 0.25, "a": 0.25}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Arepa con quesito y ensalada', 'cena', 10, '', '[{"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "queso", "names": ["Queso campesino, quesito o mozzarella"], "grp": "Sustituto", "unit": "g", "m": 30, "a": 30}, {"key": "manzana", "names": ["Manzana"], "grp": "Fruta", "unit": "unidad", "m": 1, "a": 1}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Huevos revueltos con champiñones y arepa', 'cena', 15, '2 huevos para los dos.', '[{"key": "huevo", "names": ["Huevos"], "grp": "Sustituto", "unit": "unidad", "m": 1, "a": 1}, {"key": "champi", "names": ["Champiñones"], "grp": "Verdura", "unit": "g", "m": 40, "a": 40}, {"key": "arepa", "names": ["Arepas delgadas"], "grp": "Harina", "unit": "unidad", "m": 1, "a": 1}, {"key": "repollo", "names": ["Repollo"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "zanahoria", "names": ["Zanahoria"], "grp": "Verdura", "unit": "g", "m": 50, "a": 50}, {"key": "pepino", "names": ["Pepino"], "grp": "Verdura", "unit": "unidad", "m": 0.25, "a": 0.25}]'::jsonb),
  ('Sofrito base (tanda para 15 días)', 'tanda', 25, 'Licuar cebolla, pimentón, ajo y cilantro con 2 cdas de aceite. Sofreír 10 min y congelar en cubetas.', '[{"key": "cebolla", "names": ["Cebolla (cabezona o junca)"], "grp": "Verdura", "unit": "g", "m": 300, "a": 0}, {"key": "pimenton", "names": ["Pimentón"], "grp": "Verdura", "unit": "unidad", "m": 2, "a": 0}]'::jsonb)
on conflict (name) do update set meal = excluded.meal, minutes = excluded.minutes, steps = excluded.steps, ingredients = excluded.ingredients;

insert into public.menu_defaults (day, meal, recipe_name) values
  (1, 'desayuno', 'Tostadas con aguacate y huevo revuelto'),
  (1, 'media_manana', 'Piña'),
  (1, 'almuerzo', 'Carne molida guisada, maduro y sopa de papa'),
  (1, 'cena', 'Arepa con champiñones a la mantequilla y papa criolla'),
  (2, 'desayuno', 'Avena en leche con manzana'),
  (2, 'media_manana', 'Saltinas con leche'),
  (2, 'almuerzo', 'Lentejas con carne molida'),
  (2, 'cena', 'Tortilla de verduras al horno con arepa'),
  (3, 'desayuno', 'Arepa con quesito'),
  (3, 'media_manana', 'Pera'),
  (3, 'almuerzo', 'Osobuco con puré de yuca y mazorca'),
  (3, 'cena', 'Crema de espinaca con sánduche de queso'),
  (4, 'desayuno', 'Batido de avena y banano con mantequilla de maní'),
  (4, 'media_manana', 'Mango'),
  (4, 'almuerzo', 'Pollo desmechado sofrito con papas y pimentón'),
  (4, 'cena', 'Sánduche de jamón de pavo y queso con papas'),
  (5, 'desayuno', 'Kumis con avena y mango'),
  (5, 'media_manana', 'Manzana y garbanzos tostados'),
  (5, 'almuerzo', 'Fríjol rojo con carne molida'),
  (5, 'cena', 'Crema de verduras con tostadas y aguacate'),
  (6, 'desayuno', 'Tostadas con aguacate y huevo revuelto'),
  (6, 'media_manana', 'Fruta de la semana'),
  (6, 'almuerzo', 'Pasta boloñesa suave'),
  (6, 'cena', 'Arepa rellena de quesito con ensalada'),
  (7, 'desayuno', 'Avena en leche con banano y maní'),
  (7, 'media_manana', 'Papaya'),
  (7, 'almuerzo', 'Sancocho de espinazo y pollo (doble, para el lunes)'),
  (7, 'cena', 'Huevos revueltos con espinaca y arepa'),
  (8, 'desayuno', 'Arepa con quesito y banano'),
  (8, 'media_manana', 'Saltinas con leche'),
  (8, 'almuerzo', 'Sancocho del domingo'),
  (8, 'cena', 'Tortilla de papa y huevo al horno'),
  (9, 'desayuno', 'Kumis con avena y manzana'),
  (9, 'media_manana', 'Pera'),
  (9, 'almuerzo', 'Contramuslo en freidora con crema de espinaca'),
  (9, 'cena', 'Tortilla de champiñones al horno con arepa'),
  (10, 'desayuno', 'Arepa con huevo revuelto y papaya'),
  (10, 'media_manana', 'Pera'),
  (10, 'almuerzo', 'Osobuco con puré de yuca y mazorca'),
  (10, 'cena', 'Crema de verduras con sánduche de queso'),
  (11, 'desayuno', 'Avena en leche con manzana y maní'),
  (11, 'media_manana', 'Saltinas con leche'),
  (11, 'almuerzo', 'Garbanzos guisados con carne molida'),
  (11, 'cena', 'Sánduche de jamón de pavo y queso con papas'),
  (12, 'desayuno', 'Batido de avena y banano con mantequilla de maní'),
  (12, 'media_manana', 'Manzana y garbanzos tostados'),
  (12, 'almuerzo', 'Pescado apanado en freidora con patacón'),
  (12, 'cena', 'Crema de espinaca con tostadas y aguacate'),
  (13, 'desayuno', 'Tostadas con aguacate y quesito'),
  (13, 'media_manana', 'Fruta de la semana'),
  (13, 'almuerzo', 'Pasta con champiñones y pollo'),
  (13, 'cena', 'Arepa con quesito y ensalada'),
  (14, 'desayuno', 'Avena en leche con papaya'),
  (14, 'media_manana', 'Papaya'),
  (14, 'almuerzo', 'Sancocho de espinazo y pollo'),
  (14, 'cena', 'Huevos revueltos con champiñones y arepa')
on conflict (day, meal) do update set recipe_name = excluded.recipe_name;

-- ---------- Carga del menú en una casa ----------
-- Busca cada ingrediente en el catálogo de la casa por nombre (sin tildes ni mayúsculas) o por los alias del
-- catálogo de referencia. Si no existe, lo crea como "cuando se acabe".
create or replace function public.seed_menu(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; ing jsonb; iid uuid; rid uuid;
begin
  for r in select * from recipe_defaults loop
    insert into recipes (household_id, name, meal, minutes, steps)
    values (p_household, r.name, r.meal, r.minutes, r.steps)
    on conflict (household_id, name) do nothing
    returning id into rid;
    continue when rid is null;   -- ya estaba: no se toca lo que la casa haya editado
    for ing in select * from jsonb_array_elements(r.ingredients) loop
      select i.id into iid from items i
      where i.household_id = p_household
        and (norm_name(i.name) in (select norm_name(n) from jsonb_array_elements_text(ing->'names') n)
             or exists (select 1 from catalog_defaults c, unnest(c.aliases) al
                        where norm_name(c.name) in (select norm_name(n) from jsonb_array_elements_text(ing->'names') n)
                          and norm_name(al) = norm_name(i.name)))
      order by i.active desc, i.sort
      limit 1;
      if iid is null then
        insert into items (household_id, name, grp, unit, buy_qty, every_days, pocket, place)
        values (p_household, ing->'names'->>0, ing->>'grp', ing->>'unit', 0, null, 'mercado', 'Supermu')
        returning id into iid;
      end if;
      insert into recipe_ingredients (household_id, recipe_id, item_id, qty_m, qty_a)
      values (p_household, rid, iid, (ing->>'m')::numeric, (ing->>'a')::numeric);
    end loop;
  end loop;
  insert into menu_plan (household_id, day, meal, recipe_id)
  select p_household, d.day, d.meal, rc.id
  from menu_defaults d join recipes rc on rc.household_id = p_household and rc.name = d.recipe_name
  on conflict (household_id, day, meal) do nothing;
end $$;
revoke execute on function public.seed_menu(uuid) from public, authenticated;

-- La casa nueva recibe catálogo y menú
create or replace function public.create_household_v2(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  hh := create_household(p_name, p_display_name);
  perform seed_catalog(hh);
  perform seed_menu(hh);
  return hh;
end $$;
grant execute on function public.create_household_v2(text, text) to authenticated;

-- ---------- Preparé / deshacer ----------
-- Descuenta los ingredientes de la despensa. Nunca deja un artículo en negativo: descuenta lo que haya.
create or replace function public.prepare_meal(p_household uuid, p_date date, p_meal text, p_recipe uuid, p_who text default 'ambos')
returns uuid
language plpgsql security invoker set search_path = public as $$
declare lid uuid;
begin
  if not is_member(p_household) then raise exception 'Sin acceso a este hogar'; end if;
  if not exists (select 1 from recipes where id = p_recipe and household_id = p_household) then
    raise exception 'La receta no es de esta casa';
  end if;
  insert into meal_logs (household_id, log_date, meal, recipe_id, who)
  values (p_household, p_date, p_meal, p_recipe, p_who)
  returning id into lid;
  insert into stock_movements (household_id, item_id, delta, reason, ref_id, note)
  select p_household, ri.item_id,
         -least(greatest(coalesce(s.qty, 0), 0),
                sum(case p_who when 'mariana' then ri.qty_m when 'alex' then ri.qty_a else ri.qty_m + ri.qty_a end)),
         'preparacion', lid, rc.name
  from recipe_ingredients ri
  join recipes rc on rc.id = ri.recipe_id
  left join stock s on s.item_id = ri.item_id
  where ri.recipe_id = p_recipe
  group by ri.item_id, s.qty, rc.name
  having least(greatest(coalesce(s.qty, 0), 0),
               sum(case p_who when 'mariana' then ri.qty_m when 'alex' then ri.qty_a else ri.qty_m + ri.qty_a end)) > 0;
  return lid;
end $$;
grant execute on function public.prepare_meal(uuid, date, text, uuid, text) to authenticated;

create or replace function public.undo_meal(p_log uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare hh uuid;
begin
  select household_id into hh from meal_logs where id = p_log;
  if hh is null or not is_member(hh) then raise exception 'No se encontró la comida'; end if;
  delete from stock_movements where ref_id = p_log and reason = 'preparacion' and household_id = hh;
  delete from meal_logs where id = p_log;
end $$;
grant execute on function public.undo_meal(uuid) to authenticated;

-- ---------- Primera vez: menú, inicio del ciclo y cantidades del catálogo ----------
do $$
begin
  if not (select first from _first_run_0004) then return; end if;
  perform public.seed_menu(id) from public.households;
  update public.households set menu_start = '2026-11-30';

  -- Cantidades del menú v4 (aprox.). Proteína cada 15 días por el congelador pequeño.
  update public.items i set buy_qty = v.qty, buy_label = v.label, every_days = v.days
  from (values
    ('huevos', 30, '1 canasta de 30', 15),
    ('queso campesino, quesito o mozzarella', 600, '600 g', 15),
    ('avena en hojuelas', 1400, '1,4 kg', 30),
    ('carne molida de res', 1400, '1,4 kg', 15),
    ('osobuco', 1200, '1,2 kg', 15),
    ('pechuga o contramuslo de pollo sin hueso', 560, '560 g', 15),
    ('contramuslo de pollo con hueso', 1100, '1,1 kg', 15),
    ('espinazo de res', 900, '900 g', 15),
    ('filete de pescado blanco', 520, '520 g', 30),
    ('banano', 4, '4 unidades', 7)
  ) as v(name, qty, label, days)
  where public.norm_name(i.name) = v.name;
  update public.items set note = 'Para el sancocho y el almuerzo en freidora. Sin piel' where name = 'Contramuslo de pollo con hueso' and note = '';
end $$;
