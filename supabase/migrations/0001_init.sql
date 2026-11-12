-- Casa App · esquema inicial (fase 1 + base de la despensa)
-- Ejecutar completo en Supabase → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- Fecha local de Medellín (la app registra fechas en hora de Colombia)
create or replace function public.today_co() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;

-- ---------- Hogar y miembros ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(gen_random_uuid()::text), 1, 8),
  budget_quincena numeric not null default 425000,
  quincena_start date not null default public.today_co(),
  menu_start date not null default public.today_co(),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create or replace function public.is_member(hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hh and user_id = auth.uid())
$$;

-- ---------- Catálogo ----------
create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  grp text not null default 'Otro',
  unit text not null default 'unidad' check (unit in ('g', 'ml', 'unidad')),
  buy_qty numeric not null default 0,       -- cantidad a comprar por periodo, en la unidad base
  buy_label text not null default '',       -- cómo se pide en la tienda: "3 cubetas", "bolsa de 2,5 kg"
  cadence text not null default 'quincenal' check (cadence in ('quincenal', 'semanal')),
  place text not null default '',
  note text not null default '',
  min_stock numeric not null default 0,
  sort int not null default 999,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.items (household_id);

-- ---------- Mercados y compras ----------
create table public.shopping_trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_date date not null default public.today_co(),
  total numeric not null default 0,
  item_count int not null default 0,
  places text[] not null default '{}',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.shopping_trips (household_id, trip_date desc);

-- trip_id null = marcado en la lista, aún sin "Guardar mercado"
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid references public.shopping_trips(id) on delete set null,
  item_id uuid references public.items(id) on delete set null,
  name text not null,
  grp text not null default 'Otro',
  qty numeric not null default 0,
  unit text not null default 'unidad' check (unit in ('g', 'ml', 'unidad')),
  price numeric not null check (price >= 0),
  place text not null default '',
  purchased_on date not null default public.today_co(),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.purchases (household_id, purchased_on desc);
create index on public.purchases (trip_id);
-- un artículo del catálogo solo puede estar marcado una vez en el mercado abierto
create unique index purchases_one_pending_per_item on public.purchases (household_id, item_id) where trip_id is null and item_id is not null;

-- ---------- Despensa (libro de movimientos) ----------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  delta numeric not null,
  reason text not null check (reason in ('compra', 'preparacion', 'consumo', 'ajuste')),
  ref_id uuid,
  note text not null default '',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (household_id, item_id);

create or replace view public.stock with (security_invoker = true) as
  select i.household_id, i.id as item_id, coalesce(sum(m.delta), 0) as qty
  from public.items i left join public.stock_movements m on m.item_id = i.id
  group by i.household_id, i.id;

-- ---------- Seguridad (RLS) ----------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.items enable row level security;
alter table public.shopping_trips enable row level security;
alter table public.purchases enable row level security;
alter table public.stock_movements enable row level security;

create policy "miembros leen su hogar" on public.households for select using (public.is_member(id));
create policy "miembros editan su hogar" on public.households for update using (public.is_member(id));
create policy "miembros ven miembros" on public.household_members for select using (public.is_member(household_id));
create policy "cada uno edita su nombre" on public.household_members for update using (user_id = auth.uid());

create policy "hogar: items" on public.items for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "hogar: mercados" on public.shopping_trips for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "hogar: compras" on public.purchases for all using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "hogar: movimientos" on public.stock_movements for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------- Funciones (la lógica vive aquí para que la usen la web, Claude o Alexa) ----------

-- Crea el hogar, agrega al usuario y carga el catálogo inicial
create or replace function public.create_household(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  insert into households (name) values (p_name) returning id into hh;
  insert into household_members (household_id, user_id, display_name) values (hh, auth.uid(), p_display_name);
  insert into items (household_id, name, grp, unit, buy_qty, buy_label, cadence, place, note, sort) values
    (hh, 'Carne molida de res', 'Proteína', 'g', 1000, '1 kg', 'quincenal', 'Makro', 'Congelar en porciones', 1),
    (hh, 'Pechuga o contramuslo de pollo sin hueso', 'Proteína', 'g', 1000, '1 kg', 'quincenal', 'Makro', '', 2),
    (hh, 'Res para bistec (tabla)', 'Proteína', 'g', 500, '0,5 kg', 'quincenal', 'Makro', '', 3),
    (hh, 'Osobuco', 'Proteína', 'g', 800, '0,8 kg', 'quincenal', 'Makro', 'Con hueso', 4),
    (hh, 'Filete de pescado blanco', 'Proteína', 'g', 500, '0,5 kg', 'quincenal', 'Makro', 'Tilapia o basa. Nada de mariscos', 5),
    (hh, 'Espinazo de res', 'Proteína', 'g', 500, '0,5 kg', 'quincenal', 'Makro', '', 6),
    (hh, 'Huevos', 'Sustituto', 'unidad', 90, '3 cubetas', 'quincenal', 'Makro', '', 1),
    (hh, 'Queso campesino, quesito o mozzarella', 'Sustituto', 'g', 1400, '1,4 kg', 'quincenal', 'Makro', '', 2),
    (hh, 'Jamón de pavo o pollo', 'Sustituto', 'g', 200, '1 paquete', 'quincenal', 'D1', 'No de cerdo', 3),
    (hh, 'Leche UHT', 'Lácteo', 'ml', 12000, '2 sixpacks de 1 L', 'quincenal', 'Makro', '', 1),
    (hh, 'Maní sin sal u otros frutos secos', 'Grasa', 'g', 300, '300 g', 'quincenal', 'D1', '', 1),
    (hh, 'Arroz', 'Harina', 'g', 2500, 'Bolsa de 2,5 kg', 'quincenal', 'D1', '', 1),
    (hh, 'Papa común', 'Harina', 'g', 6000, '6 kg', 'quincenal', 'Makro', 'Lugar oscuro y fresco', 2),
    (hh, 'Pasta', 'Harina', 'g', 1500, '3 paquetes de 500 g', 'quincenal', 'D1', '', 3),
    (hh, 'Avena en hojuelas', 'Harina', 'g', 1000, 'Bolsa de 1 kg', 'quincenal', 'D1', '', 4),
    (hh, 'Fríjol, lenteja o garbanzo secos', 'Harina', 'g', 1000, '2 bolsas de 500 g', 'quincenal', 'D1', '', 5),
    (hh, 'Arepas delgadas', 'Harina', 'unidad', 32, '32 unidades', 'quincenal', 'Supermu', 'Congelar', 6),
    (hh, 'Pan tajado', 'Harina', 'unidad', 26, '1 paquete grande (tajadas)', 'quincenal', 'D1', 'Congelar la mitad', 7),
    (hh, 'Tostadas o galletas saltinas', 'Harina', 'unidad', 24, '2 paquetes', 'quincenal', 'D1', '', 8),
    (hh, 'Pancitos', 'Harina', 'unidad', 10, '10 unidades', 'quincenal', 'Supermu', 'Congelar', 9),
    (hh, 'Plátano maduro', 'Harina', 'unidad', 2, '2 unidades', 'semanal', 'Supermu', '', 10),
    (hh, 'Yuca', 'Harina', 'g', 800, '0,8 kg', 'semanal', 'Supermu', '', 11),
    (hh, 'Zanahoria', 'Verdura', 'g', 4000, '4 kg', 'quincenal', 'Supermu', '', 1),
    (hh, 'Cebolla (cabezona o junca)', 'Verdura', 'g', 1000, '1 kg', 'quincenal', 'Supermu', '', 2),
    (hh, 'Mazorca', 'Verdura', 'unidad', 4, '4 unidades', 'semanal', 'Supermu', '', 3),
    (hh, 'Tomate', 'Verdura', 'g', 600, '0,6 kg', 'semanal', 'Supermu', 'Para Alex, licuado', 4),
    (hh, 'Repollo', 'Verdura', 'g', 1000, '1 pequeño', 'semanal', 'Supermu', '', 5),
    (hh, 'Pimentón', 'Verdura', 'unidad', 2, '2 unidades', 'semanal', 'Supermu', '', 6),
    (hh, 'Champiñones', 'Verdura', 'g', 250, '250 g', 'semanal', 'D1', '', 7),
    (hh, 'Espinaca', 'Verdura', 'g', 500, '2 atados', 'semanal', 'Supermu', '', 8),
    (hh, 'Brócoli', 'Verdura', 'g', 800, '2 unidades', 'semanal', 'Supermu', '', 9),
    (hh, 'Habichuela', 'Verdura', 'g', 500, '0,5 kg', 'semanal', 'Supermu', '', 10),
    (hh, 'Ahuyama', 'Verdura', 'g', 1000, '1 kg', 'semanal', 'Supermu', '', 11),
    (hh, 'Pepino', 'Verdura', 'unidad', 1, '1 unidad', 'semanal', 'Supermu', '', 12),
    (hh, 'Zucchini o berenjena', 'Verdura', 'g', 500, '2 unidades', 'semanal', 'Supermu', '', 13),
    (hh, 'Aguacate', 'Grasa', 'unidad', 4, '4 unidades', 'semanal', 'Supermu', 'Distinto punto de madurez', 2),
    (hh, 'Banano', 'Fruta', 'unidad', 7, '7 unidades', 'semanal', 'Supermu', '', 1),
    (hh, 'Manzana', 'Fruta', 'unidad', 6, '6 unidades', 'semanal', 'Supermu', '', 2),
    (hh, 'Mango', 'Fruta', 'unidad', 4, '4 pequeños', 'semanal', 'Supermu', '', 3),
    (hh, 'Pera', 'Fruta', 'unidad', 4, '4 unidades', 'semanal', 'Supermu', '', 4),
    (hh, 'Guayaba', 'Fruta', 'unidad', 4, '4 unidades', 'semanal', 'Supermu', '', 5),
    (hh, 'Papaya', 'Fruta', 'unidad', 1, '1 mediana', 'semanal', 'Supermu', '', 6),
    (hh, 'Mandarina', 'Fruta', 'unidad', 2, '2 unidades', 'semanal', 'Supermu', 'Para Mariana', 7);
  return hh;
end $$;

-- Une al usuario a un hogar existente con el código de invitación
create or replace function public.join_household(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select id into hh from households where invite_code = lower(trim(p_code));
  if hh is null then raise exception 'Código de invitación no válido'; end if;
  insert into household_members (household_id, user_id, display_name) values (hh, auth.uid(), p_display_name)
  on conflict do nothing;
  return hh;
end $$;

-- Cierra el mercado abierto: crea el mercado, le asigna las compras y suma a la despensa (todo o nada)
create or replace function public.save_trip(p_household uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare tid uuid;
begin
  if not is_member(p_household) then raise exception 'Sin acceso a este hogar'; end if;
  if not exists (select 1 from purchases where household_id = p_household and trip_id is null) then
    raise exception 'No hay compras marcadas';
  end if;
  insert into shopping_trips (household_id, trip_date, total, item_count, places)
  select p_household, today_co(), coalesce(sum(price), 0), count(*), coalesce(array_agg(distinct place) filter (where place <> ''), '{}')
  from purchases where household_id = p_household and trip_id is null
  returning id into tid;
  insert into stock_movements (household_id, item_id, delta, reason, ref_id)
  select p_household, item_id, qty, 'compra', tid
  from purchases where household_id = p_household and trip_id is null and item_id is not null and qty > 0;
  update purchases set trip_id = tid where household_id = p_household and trip_id is null;
  return tid;
end $$;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.save_trip(uuid) to authenticated;

-- ---------- Tiempo real ----------
alter publication supabase_realtime add table public.items, public.purchases, public.shopping_trips, public.stock_movements, public.households;
