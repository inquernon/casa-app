-- Casa App · 0002: frecuencia por artículo, presupuesto mensual por bolsillo y catálogo completo.
-- Solo agrega columnas y filas. No borra ni reemplaza datos existentes.
-- Ejecutar UNA sola vez, completo, en Supabase → SQL Editor → New query → Run.

-- ---------- Presupuesto mensual por bolsillo ----------
alter table public.households
  add column if not exists budget_food numeric not null default 850000,
  add column if not exists budget_pets numeric not null default 120000;

-- ---------- Artículos: cada cuántos días, bolsillo y "se está acabando" ----------
alter table public.items
  add column if not exists every_days int check (every_days is null or every_days > 0), -- null = "cuando se acabe"
  add column if not exists pocket text not null default 'mercado' check (pocket in ('mercado', 'mascotas')),
  add column if not exists running_low boolean not null default false;

alter table public.purchases
  add column if not exists pocket text not null default 'mercado' check (pocket in ('mercado', 'mascotas'));

-- ¿Primera ejecución? (el catálogo de referencia aún no existe). Lo que sigue solo cambia datos la primera vez,
-- para que volver a correr el archivo no pise lo que ustedes editen después en la app.
create temp table if not exists _first_run as select to_regclass('public.catalog_defaults') is null as yes;

-- La frecuencia inicial sale de la cadencia anterior
update public.items set every_days = case cadence when 'semanal' then 7 else 15 end
where every_days is null and (select yes from _first_run);

-- ---------- Catálogo del hogar (lista de Mariana, 15 nov 2026) ----------
create or replace function public.norm_name(t text) returns text
language sql immutable as $$
  select regexp_replace(lower(translate(t, 'áéíóúüÁÉÍÓÚÜñÑ', 'aeiouuAEIOUUnN')), '\s+', ' ', 'g')
$$;

create table if not exists public.catalog_defaults (
  name text primary key,
  aliases text[] not null default '{}',
  grp text not null,
  unit text not null check (unit in ('g', 'ml', 'unidad')),
  buy_qty numeric not null,
  buy_label text not null default '',
  every_days int,
  place text not null default '',
  pocket text not null default 'mercado',
  note text not null default ''
);
alter table public.catalog_defaults enable row level security;
drop policy if exists "catálogo de referencia visible" on public.catalog_defaults;
create policy "catálogo de referencia visible" on public.catalog_defaults for select to authenticated using (true);

insert into public.catalog_defaults (name, aliases, grp, unit, buy_qty, buy_label, every_days, place, pocket, note) values
  -- Proteínas (30 días; fraccionar y congelar)
  ('Carne molida de res', '{carne molida}', 'Proteína', 'g', 2000, '2 kg', 30, 'Supermu', 'mercado', 'Congelar en porciones'),
  ('Osobuco', '{}', 'Proteína', 'g', 2000, '2 kg', 30, 'Supermu', 'mercado', 'Con hueso'),
  ('Res para bistec (tabla)', '{tabla,bistec,tabla de res}', 'Proteína', 'g', 1500, '1,5 kg', 30, 'Supermu', 'mercado', ''),
  ('Pechuga o contramuslo de pollo sin hueso', '{pechuga,pechuga de pollo,pollo,contramuslo}', 'Proteína', 'g', 2000, '2 kg', 30, 'Supermu', 'mercado', ''),
  ('Espinazo de res', '{espinazo}', 'Proteína', 'g', 1000, '1 kg', 30, 'Supermu', 'mercado', 'Límite por congelador'),
  ('Huevos', '{huevo}', 'Sustituto', 'unidad', 30, '1 cubeta', 30, 'D1', 'mercado', ''),
  ('Jamón de pavo o pollo', '{jamon}', 'Sustituto', 'g', 300, '250–300 g', 15, 'Supermu', 'mercado', 'No de cerdo'),
  ('Queso campesino, quesito o mozzarella', '{queso,queso tajado}', 'Sustituto', 'g', 200, '200 g', 15, 'Supermu', 'mercado', ''),
  ('Garbanzos tostados', '{}', 'Sustituto', 'g', 500, '1 libra', 30, 'D1', 'mercado', ''),
  -- Harinas (30 días)
  ('Arroz', '{}', 'Harina', 'g', 2500, '1 paquete de 2,5 kg', 30, 'D1', 'mercado', ''),
  ('Papa común', '{papa}', 'Harina', 'g', 5000, '5 kg (común y criolla)', 30, 'Supermu', 'mercado', 'Reponer si se acaba'),
  ('Yuca', '{}', 'Harina', 'g', 3000, '3 unidades grandes', 30, 'Supermu', 'mercado', 'Reponer si se acaba'),
  ('Plátano maduro', '{}', 'Harina', 'unidad', 6, '6 unidades', 30, 'Supermu', 'mercado', ''),
  ('Plátano verde', '{}', 'Verdura', 'unidad', 6, '6 unidades', 30, 'Supermu', 'mercado', ''),
  ('Mazorca', '{}', 'Verdura', 'unidad', 8, '2 bandejas de 4', 30, 'Supermu', 'mercado', ''),
  ('Avena en hojuelas', '{avena}', 'Harina', 'g', 1000, 'Bolsa de 1 kg', 30, 'D1', 'mercado', ''),
  ('Pasta', '{pasta corta,pasta larga}', 'Harina', 'g', 1500, '1 corta + 1 larga grande', 30, 'D1', 'mercado', ''),
  ('Arepas delgadas', '{arepas,arepa}', 'Harina', 'unidad', 30, '2 paquetes de 15', 30, 'Supermu', 'mercado', 'Congelar'),
  ('Tostadas integrales', '{tostadas}', 'Harina', 'unidad', 2, '2 paquetes', 30, 'D1', 'mercado', ''),
  ('Tostadas o galletas saltinas', '{saltinas,galletas saltinas,galletas saltines}', 'Harina', 'unidad', 3, '2–3 paquetes', 30, 'D1', 'mercado', ''),
  ('Pancitos', '{}', 'Harina', 'unidad', 20, '1–2 paquetes', 30, 'Supermu', 'mercado', 'Congelar'),
  ('Pan tajado', '{pan tajado integral}', 'Harina', 'unidad', 2, '2 paquetes', 30, 'D1', 'mercado', ''),
  ('Hojuelas de maíz', '{cereal,corn flakes}', 'Harina', 'unidad', 1, '1 paquete', 30, 'D1', 'mercado', ''),
  ('Fríjol, lenteja o garbanzo secos', '{frijol,lenteja,garbanzo}', 'Harina', 'g', 500, '500 g', null, 'D1', 'mercado', ''),
  -- Lácteos (15 días)
  ('Leche UHT', '{leche}', 'Lácteo', 'ml', 21000, '3–4 sixpacks', 15, 'D1', 'mercado', ''),
  ('Kumis', '{}', 'Lácteo', 'unidad', 1, '1 mediano', 15, 'D1', 'mercado', ''),
  ('Mantequilla', '{}', 'Grasa', 'g', 500, '500 g', 30, 'D1', 'mercado', 'Duración aprox.'),
  -- Frutas y verduras (semanal salvo nota)
  ('Zanahoria', '{}', 'Verdura', 'g', 2000, '2 kg', 7, 'Supermu', 'mercado', ''),
  ('Cebolla (cabezona o junca)', '{cebolla,cebolla morada}', 'Verdura', 'g', 700, '4 unidades', 30, 'Supermu', 'mercado', 'Dura el mes'),
  ('Repollo', '{}', 'Verdura', 'g', 900, '1 pequeño', 30, 'Supermu', 'mercado', 'Dura el mes'),
  ('Champiñones', '{}', 'Verdura', 'g', 250, '1 bandeja', 7, 'Supermu', 'mercado', ''),
  ('Pimentón', '{}', 'Verdura', 'unidad', 2, '2–3 unidades', null, 'Supermu', 'mercado', 'Hay congelado'),
  ('Brócoli', '{brocoli}', 'Verdura', 'g', 300, '1 pequeño', 14, 'Supermu', 'mercado', ''),
  ('Espinaca', '{}', 'Verdura', 'g', 400, '1 manojo', 7, 'Supermu', 'mercado', ''),
  ('Apio', '{}', 'Verdura', 'g', 450, '1 manojo', 7, 'Supermu', 'mercado', ''),
  ('Tomate', '{}', 'Verdura', 'g', 800, '4–5 unidades', 7, 'Supermu', 'mercado', 'Solo Mariana; para Alex, licuado'),
  ('Mix de verduras congeladas', '{mezcla verduras,verduras congeladas}', 'Verdura', 'unidad', 1, '1 paquete', null, 'Supermu', 'mercado', ''),
  ('Limón tahití', '{limon,limon tahiti}', 'Fruta', 'g', 700, '1 bolsa (6–8)', 7, 'Supermu', 'mercado', ''),
  ('Mango', '{}', 'Fruta', 'unidad', 5, '4–5 unidades', 7, 'Supermu', 'mercado', ''),
  ('Piña', '{pina}', 'Fruta', 'unidad', 1, '1 unidad', 10, 'Supermu', 'mercado', ''),
  ('Manzana', '{manzanas}', 'Fruta', 'unidad', 6, 'Bandeja de 6', 7, 'Supermu', 'mercado', ''),
  ('Pera', '{}', 'Fruta', 'unidad', 6, 'Bandeja de 6', 7, 'Supermu', 'mercado', ''),
  ('Banano', '{}', 'Fruta', 'unidad', 4, '3–4 unidades', 7, 'Supermu', 'mercado', ''),
  ('Naranja', '{}', 'Fruta', 'unidad', 6, '4–6 unidades', 7, 'Supermu', 'mercado', ''),
  ('Arándanos', '{arandanos}', 'Fruta', 'g', 250, '1 bandeja', null, 'Supermu', 'mercado', 'Si hay'),
  ('Aguacate', '{}', 'Grasa', 'unidad', 6, '5–6 unidades', 7, 'Supermu', 'mercado', 'Distinto punto de madurez'),
  -- Despensa
  ('Pulpas de fruta', '{pulpa,pulpas}', 'Despensa', 'unidad', 7, '7 unidades', 15, 'Supermu', 'mercado', ''),
  ('Panela', '{}', 'Despensa', 'unidad', 8, '1 paca', 30, 'Supermu', 'mercado', ''),
  ('Aceite de orujo de oliva', '{aceite}', 'Despensa', 'ml', 1000, '1 L', null, 'D1', 'mercado', ''),
  ('Aceite de oliva extra virgen', '{}', 'Despensa', 'ml', 250, '1 botella pequeña', null, 'D1', 'mercado', ''),
  ('Café', '{cafe}', 'Despensa', 'unidad', 1, '1 paquete', 15, 'D1', 'mercado', ''),
  ('Azúcar', '{azucar,azucar morena}', 'Despensa', 'g', 1000, '1 kg', 30, 'D1', 'mercado', ''),
  ('Sal', '{sal marina}', 'Despensa', 'g', 500, '1 lb', 30, 'D1', 'mercado', ''),
  ('Maíz pira', '{maiz pira,crispetas}', 'Despensa', 'g', 500, '1 lb', 30, 'D1', 'mercado', ''),
  ('Mayonesa', '{}', 'Despensa', 'g', 200, '1 bolsa pequeña', 30, 'D1', 'mercado', ''),
  ('Milo', '{}', 'Despensa', 'g', 400, '1 paquete', 45, 'D1', 'mercado', 'Contiene cacao: acidez de Alex'),
  ('Harina', '{harina de trigo}', 'Despensa', 'g', 500, '1 lb', 60, 'D1', 'mercado', ''),
  ('Mermelada', '{}', 'Despensa', 'unidad', 1, '1 paquete', 60, 'D1', 'mercado', ''),
  ('Mantequilla de maní', '{mantequilla de mani}', 'Despensa', 'unidad', 1, '1 tarro', 60, 'D1', 'mercado', ''),
  ('Maggi', '{maggie,caldo maggi}', 'Despensa', 'unidad', 12, 'Caja de 12', 60, 'D1', 'mercado', ''),
  ('Ajo', '{}', 'Despensa', 'unidad', 3, '3 cabezas', 60, 'Supermu', 'mercado', ''),
  ('Salsa de soya', '{}', 'Despensa', 'unidad', 1, '1 botella', null, 'D1', 'mercado', ''),
  ('Esencia de vainilla', '{vainilla}', 'Despensa', 'unidad', 1, '1 botella', null, 'D1', 'mercado', ''),
  ('Pasta para sopa', '{letras,conchitas,coditos}', 'Despensa', 'unidad', 2, '1 de letras + 1 de otra', null, 'D1', 'mercado', ''),
  ('Gelatina', '{}', 'Despensa', 'unidad', 4, 'Paquete de 3–4', null, 'D1', 'mercado', 'Mantener mínimo 2'),
  ('Miel', '{}', 'Despensa', 'unidad', 1, '1 botella', null, 'D1', 'mercado', ''),
  ('Frutos secos', '{mani sin sal u otros frutos secos}', 'Grasa', 'g', 300, 'Cuando se pueda', null, 'D1', 'mercado', ''),
  -- Aseo
  ('Lavatrastes', '{lavaloza}', 'Aseo', 'unidad', 1, '1 bolsa', 15, 'D1', 'mercado', ''),
  ('Jabón de manos', '{jabon de manos}', 'Aseo', 'ml', 1000, '1 L', 30, 'D1', 'mercado', ''),
  ('Shampoo caléndula', '{shampoo calendula}', 'Aseo', 'ml', 1000, '1 L', 30, 'D1', 'mercado', ''),
  ('Shampoo picazón', '{shampoo picazon}', 'Aseo', 'unidad', 1, '1 botella', 30, 'D1', 'mercado', ''),
  ('Shampoo Alex', '{shampoo masculino}', 'Aseo', 'unidad', 1, '1 botella', 30, 'D1', 'mercado', ''),
  ('Tratamiento para el cabello', '{}', 'Aseo', 'unidad', 1, '1 pote', 30, 'D1', 'mercado', ''),
  ('Crema para peinar Mariana', '{crema para peinar}', 'Aseo', 'unidad', 1, '1 pote', 60, 'D1', 'mercado', ''),
  ('Crema dental', '{}', 'Aseo', 'g', 90, '1 tubo', 30, 'D1', 'mercado', ''),
  ('Fabuloso', '{limpia pisos,limpiapisos}', 'Aseo', 'ml', 1500, '1 botella grande', 30, 'D1', 'mercado', ''),
  ('Esponjas lavatrastes', '{esponjas}', 'Aseo', 'unidad', 3, 'Pack de 3', 30, 'D1', 'mercado', ''),
  ('Jabón Rey', '{jabon rey}', 'Aseo', 'unidad', 1, '1 barra', 30, 'D1', 'mercado', ''),
  ('Bolsas de papelera', '{bolsas papelera}', 'Aseo', 'unidad', 2, '2 paquetes', 30, 'D1', 'mercado', 'Baño y orgánico'),
  ('Bolsas grandes de basura', '{bolsas de basura}', 'Aseo', 'unidad', 1, '1 rollo', 30, 'D1', 'mercado', ''),
  ('Toallas higiénicas', '{toallas higienicas}', 'Aseo', 'unidad', 30, '1 paquete grande', 30, 'D1', 'mercado', ''),
  ('Papel higiénico', '{papel higienico}', 'Aseo', 'unidad', 12, 'Paquete de 12', 60, 'D1', 'mercado', ''),
  ('Jabón de cuerpo', '{jabon de ducha,jabon de cuerpo}', 'Aseo', 'unidad', 6, 'Pack de 6', 60, 'D1', 'mercado', ''),
  ('Máquina de afeitar', '{maquina de afeitar}', 'Aseo', 'unidad', 1, '1 desechable', 60, 'D1', 'mercado', ''),
  ('Servilletas', '{}', 'Aseo', 'unidad', 1, '1 paquete', 60, 'D1', 'mercado', ''),
  ('Toallas de papel', '{rollos de toallas de papel}', 'Aseo', 'unidad', 3, 'Paquete de 3', 60, 'D1', 'mercado', ''),
  ('Papel aluminio', '{aluminio}', 'Aseo', 'unidad', 1, '1 rollo', 60, 'D1', 'mercado', ''),
  ('Vinipel', '{}', 'Aseo', 'unidad', 1, '1 rollo', 60, 'D1', 'mercado', ''),
  ('Vinagre', '{}', 'Aseo', 'ml', 3000, '3 L', 60, 'D1', 'mercado', ''),
  ('Jabón de ropa', '{fab,ariel,jabon de ropa ariel,detergente}', 'Aseo', 'g', 3500, '1 paquete', 75, 'D1', 'mercado', ''),
  ('Desodorantes', '{desodorante}', 'Aseo', 'unidad', 1, 'Cuando se acabe', null, 'D1', 'mercado', ''),
  ('Bicarbonato', '{}', 'Aseo', 'unidad', 1, '1 paquete', null, 'D1', 'mercado', ''),
  ('Alcohol', '{}', 'Aseo', 'unidad', 1, '1 botella', null, 'D1', 'mercado', ''),
  ('Enjuague bucal', '{}', 'Aseo', 'unidad', 1, 'Opcional', null, 'D1', 'mercado', ''),
  -- Mascotas (bolsillo propio)
  ('Cuido gatos Equilibrio Urinary', '{cuido gatos}', 'Mascotas', 'g', 2000, '2 kg', 15, '', 'mascotas', 'Próximo a cambiar'),
  ('Cuido perro Dogourmet', '{cuido perro,dogourmet}', 'Mascotas', 'g', 3000, '3 kg', 30, '', 'mascotas', ''),
  ('Collar Feliway', '{feliway}', 'Mascotas', 'unidad', 1, '1 collar', 30, '', 'mascotas', ''),
  ('Arena de gatos', '{arena}', 'Mascotas', 'g', 4000, '4 kg', 15, '', 'mascotas', ''),
  ('Bolsas de popó', '{bolsas de popo}', 'Mascotas', 'unidad', 1, '1 paquete surtido', 60, '', 'mascotas', '')
on conflict (name) do update set
  aliases = excluded.aliases, grp = excluded.grp, unit = excluded.unit, buy_qty = excluded.buy_qty,
  buy_label = excluded.buy_label, every_days = excluded.every_days, place = excluded.place,
  pocket = excluded.pocket, note = excluded.note;

-- Une el catálogo con los artículos del hogar sin duplicar: si un artículo ya existe (por nombre o alias),
-- solo completa frecuencia, bolsillo y lugar; si no existe, lo crea. Nunca borra ni cambia nombres ni unidades.
create or replace function public.seed_catalog(p_household uuid) returns int
language plpgsql security definer set search_path = public as $$
declare c record; existing uuid; added int := 0;
begin
  for c in select * from catalog_defaults loop
    select id into existing from items
    where household_id = p_household
      and (norm_name(name) = norm_name(c.name) or norm_name(name) = any (select norm_name(a) from unnest(c.aliases) a))
    order by created_at limit 1;
    if existing is null then
      insert into items (household_id, name, grp, unit, buy_qty, buy_label, cadence, place, note, every_days, pocket, sort)
      values (p_household, c.name, c.grp, c.unit, c.buy_qty, c.buy_label,
              case when c.every_days is not null and c.every_days <= 7 then 'semanal' else 'quincenal' end,
              c.place, c.note, c.every_days, c.pocket, 500);
      added := added + 1;
    else
      update items set
        every_days = c.every_days,
        pocket = c.pocket,
        place = case when place in ('', 'Makro', 'La Vaquita') then c.place else place end,
        buy_label = case when buy_label = '' then c.buy_label else buy_label end,
        grp = case when c.pocket = 'mascotas' then c.grp else grp end
      where id = existing;
    end if;
  end loop;
  return added;
end $$;

do $$ begin
  if not (select yes from _first_run) then return; end if;

  -- Artículos del catálogo anterior que no están en la lista de Mariana: pasan a "cuando se acabe"
  update public.items set every_days = null
  where norm_name(name) in ('pepino', 'habichuela', 'ahuyama', 'guayaba', 'papaya', 'mandarina', 'zucchini o berenjena',
                            'filete de pescado blanco', 'mani sin sal u otros frutos secos', 'uvas', 'frutos del bosque',
                            'paquete mama ines', 'tarrito rojo', 'panitos humedos');

  perform public.seed_catalog(id) from public.households;

  -- Makro y La Vaquita dejan de ser el lugar sugerido por defecto
  update public.items set place = 'Supermu' where place in ('Makro', 'La Vaquita');

  update public.purchases p set pocket = i.pocket from public.items i where p.item_id = i.id and p.pocket <> i.pocket;
end $$;

-- ---------- Guardar mercado: además limpia "se está acabando" de lo comprado ----------
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
  update items set running_low = false
  where household_id = p_household and id in (select item_id from purchases where household_id = p_household and trip_id is null);
  update purchases set trip_id = tid where household_id = p_household and trip_id is null;
  return tid;
end $$;

-- La casa nueva recibe el catálogo completo
create or replace function public.create_household_v2(p_name text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  hh := create_household(p_name, p_display_name);
  perform seed_catalog(hh);
  return hh;
end $$;
grant execute on function public.create_household_v2(text, text) to authenticated;
revoke execute on function public.seed_catalog(uuid) from public, authenticated;

-- ---------- Correcciones de datos acordadas el 25 nov 2026 ----------
-- No hay ahuyama: un ajuste lleva la despensa a 0 (queda el rastro del movimiento)
insert into public.stock_movements (household_id, item_id, delta, reason, note)
select s.household_id, s.item_id, -s.qty, 'ajuste', 'Corrección: no hay ahuyama'
from public.stock s join public.items i on i.id = s.item_id
where public.norm_name(i.name) = 'ahuyama' and s.qty <> 0;

-- Los arándanos son fruta
update public.items set grp = 'Fruta' where public.norm_name(name) = 'arandanos' and grp <> 'Fruta';
update public.purchases set grp = 'Fruta' where public.norm_name(name) = 'arandanos' and grp <> 'Fruta';
