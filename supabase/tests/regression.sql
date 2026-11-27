-- Pruebas de regresión de la base de datos. Corren después de stubs.sql y de las migraciones.
-- Cada prueba que falla lanza una excepción y detiene el script (psql -v ON_ERROR_STOP=1).
\set ON_ERROR_STOP 1
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema auth to authenticated;
insert into auth.users values
  ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222'), ('33333333-3333-3333-3333-333333333333');

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FALLA: %', what; end if;
  raise notice 'ok: %', what;
end $$;

set role authenticated;

-- 1. Crear la casa carga el catálogo inicial
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select create_household('Casa', 'Alex') as hh \gset
select pg_temp.check((select count(*) from items) = 43, 'crear casa carga 43 artículos');
select pg_temp.check((select budget_quincena from households) = 425000, 'presupuesto por defecto 425.000');
select invite_code from households \gset
select set_config('test.hh', :'hh', false);

-- 2. Unirse con el código
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.check(join_household(:'invite_code', 'Mariana') = :'hh', 'Mariana se une con el código');
select pg_temp.check((select count(*) from household_members) = 2, 'la casa tiene 2 miembros');
do $$ begin
  perform join_household('codigo-malo', 'X');
  raise exception 'FALLA: aceptó un código inválido';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok: rechaza código inválido';
end $$;

-- 3. Un artículo solo se marca una vez por mercado abierto
insert into purchases (household_id, item_id, name, grp, qty, unit, price, place)
  select household_id, id, name, grp, 30, unit, 9000, 'D1' from items where name = 'Huevos';
do $$ begin
  insert into purchases (household_id, item_id, name, grp, qty, unit, price, place)
    select household_id, id, name, grp, 30, unit, 9000, 'D1' from items where name = 'Huevos';
  raise exception 'FALLA: permitió marcar dos veces el mismo artículo';
exception when unique_violation then raise notice 'ok: no permite marcar dos veces';
end $$;

-- 4. Guardar mercado: crea el mercado, asigna las compras y suma a la despensa
insert into purchases (household_id, item_id, name, grp, qty, unit, price, place)
  select household_id, id, name, grp, 2500, unit, 11500, 'D1' from items where name = 'Arroz';
insert into purchases (household_id, item_id, name, grp, qty, unit, price, place)
  values (:'hh', null, 'Detergente', 'Aseo', 1, 'unidad', 15000, 'Supermu');
select save_trip(:'hh') as trip \gset
select pg_temp.check((select total from shopping_trips where id = :'trip') = 35500, 'total del mercado 35.500');
select pg_temp.check((select item_count from shopping_trips where id = :'trip') = 3, 'el mercado tiene 3 artículos');
select pg_temp.check((select places from shopping_trips where id = :'trip') @> array['D1', 'Supermu'], 'el mercado guarda los lugares');
select pg_temp.check(not exists (select 1 from purchases where trip_id is null), 'no quedan compras sin guardar');
select pg_temp.check((select s.qty from stock s join items i on i.id = s.item_id where i.name = 'Huevos') = 30, 'despensa: 30 huevos');
select pg_temp.check((select s.qty from stock s join items i on i.id = s.item_id where i.name = 'Arroz') = 2500, 'despensa: 2500 g de arroz');
select pg_temp.check((select count(*) from stock_movements) = 2, 'el extra no crea movimiento de despensa');

-- 5. Guardar sin compras marcadas falla
do $$ begin
  perform save_trip((select id from households limit 1));
  raise exception 'FALLA: guardó un mercado vacío';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok: no guarda mercado vacío';
end $$;

-- 6. Consumo y conteo actualizan la despensa
insert into stock_movements (household_id, item_id, delta, reason)
  select household_id, id, -6, 'consumo' from items where name = 'Huevos';
insert into stock_movements (household_id, item_id, delta, reason)
  select household_id, id, 2000 - 2500, 'ajuste' from items where name = 'Arroz';
select pg_temp.check((select s.qty from stock s join items i on i.id = s.item_id where i.name = 'Huevos') = 24, 'consumo: quedan 24 huevos');
select pg_temp.check((select s.qty from stock s join items i on i.id = s.item_id where i.name = 'Arroz') = 2000, 'conteo: quedan 2000 g de arroz');

-- 7. Aislamiento: alguien de otra casa no ve ni escribe nada
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.check((select count(*) from items) = 0, 'otra persona no ve artículos');
select pg_temp.check((select count(*) from purchases) = 0, 'otra persona no ve compras');
select pg_temp.check((select count(*) from stock) = 0, 'otra persona no ve la despensa');
select pg_temp.check((select count(*) from households) = 0, 'otra persona no ve la casa');
do $$ begin
  insert into items (household_id, name) values (current_setting('test.hh')::uuid, 'intruso');
  raise exception 'FALLA: otra persona pudo escribir';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok: otra persona no puede escribir';
end $$;
do $$ begin
  perform save_trip(current_setting('test.hh')::uuid);
  raise exception 'FALLA: save_trip sin acceso';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok: save_trip exige ser miembro';
end $$;

-- 8. (0002) Casa nueva con catálogo completo, sin duplicados
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select create_household_v2('Casa 2', 'Mariana') as hh2 \gset
select pg_temp.check((select count(*) from items where household_id = :'hh2') > 100, 'casa nueva recibe el catálogo completo');
select pg_temp.check(not exists (
  select 1 from items where household_id = :'hh2' group by norm_name(name) having count(*) > 1), 'el catálogo no duplica artículos');
select pg_temp.check((select every_days from items where household_id = :'hh2' and name = 'Leche UHT') = 15, 'la leche se compra cada 15 días');
select pg_temp.check((select pocket from items where household_id = :'hh2' and name = 'Cuido perro Dogourmet') = 'mascotas', 'el cuido va al bolsillo de mascotas');
select pg_temp.check((select budget_food + budget_pets from households where id = :'hh2') = 970000, 'presupuesto mensual 850.000 + 120.000');

-- 9. (0002) "Se está acabando" se limpia al guardar el mercado
update items set running_low = true where household_id = :'hh2' and name = 'Huevos';
insert into purchases (household_id, item_id, name, grp, qty, unit, price, place)
  select household_id, id, name, grp, 30, unit, 15000, 'D1' from items where household_id = :'hh2' and name = 'Huevos';
select save_trip(:'hh2') is not null as saved2 \gset
select pg_temp.check((select not running_low from items where household_id = :'hh2' and name = 'Huevos'), 'guardar mercado limpia "se está acabando"');

-- 10. (0002) Las personas no pueden recargar el catálogo a mano
do $$ begin
  perform seed_catalog(current_setting('test.hh')::uuid);
  raise exception 'FALLA: seed_catalog quedó abierto';
exception when insufficient_privilege then raise notice 'ok: seed_catalog es interno';
end $$;

-- 11. (0003) Dinero: cada mercado guardado queda como gasto de quien lo guardó (aquí, Mariana)
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select amount from money_tx where trip_id = :'trip') = 35500, 'mercado guardado = gasto de quien lo guardó');
select pg_temp.check((select method from money_tx where trip_id = :'trip') = 'credito', 'el mercado se anota con tarjeta de crédito');
insert into money_tx (household_id, kind, amount, category, method) values (:'hh', 'gasto', 50000, 'Transporte', 'credito');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.check((select count(*) from money_tx) = 0, 'Alex no ve el detalle de Mariana');
insert into money_tx (household_id, kind, amount, category) values (:'hh', 'ingreso', 3000000, 'Salario');
do $$ begin
  insert into money_tx (household_id, user_id, kind, amount) values (current_setting('test.hh')::uuid, '22222222-2222-2222-2222-222222222222', 'gasto', 10);
  raise exception 'FALLA: anotó un gasto a nombre de otra persona';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok: nadie anota movimientos a nombre de otro';
end $$;
select pg_temp.check((select sum(ingresos) from household_money(:'hh', '2000-01-01', '2100-01-01')) = 3000000, 'la casa ve el total de ingresos');
select pg_temp.check((select gastos from household_money(:'hh', '2000-01-01', '2100-01-01') where display_name = 'Mariana') = 85500, 'la casa ve el total de gastos de cada persona');
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.check((select count(*) from household_money(:'hh', '2000-01-01', '2100-01-01')) = 0, 'alguien de afuera no ve los totales');

-- 12. (0004) Menú y "Preparé"
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.check((select count(*) from menu_plan where household_id = :'hh2') = 56, 'la casa nueva recibe el menú de 14 días');
select pg_temp.check(not exists (select 1 from items where household_id = :'hh2' group by norm_name(name) having count(*) > 1), 'cargar el menú no duplica artículos');
select id as rec from recipes where household_id = :'hh2' and name = 'Tostadas con aguacate y huevo revuelto' \gset
select prepare_meal(:'hh2', '2026-11-30', 'desayuno', :'rec', 'ambos') as log \gset
select pg_temp.check((select s.qty from stock s join items i on i.id = s.item_id where i.household_id = :'hh2' and i.name = 'Huevos') = 28, 'Preparé descuenta 2 huevos (Mariana + Alex)');
select pg_temp.check(not exists (select 1 from stock s join items i on i.id = s.item_id where i.household_id = :'hh2' and s.qty < 0), 'Preparé nunca deja la despensa en negativo');
do $$ begin
  perform prepare_meal((select household_id from recipes where name = 'Pera' limit 1), '2026-11-30', 'desayuno',
                       (select id from recipes where name = 'Pera' and household_id = (select household_id from recipes where name = 'Pera' limit 1)), 'ambos');
  raise exception 'FALLA: dejó preparar dos veces la misma comida';
exception when unique_violation then raise notice 'ok: una comida se marca una sola vez por día';
end $$;
select undo_meal(:'log');
select pg_temp.check((select s.qty from stock s join items i on i.id = s.item_id where i.household_id = :'hh2' and i.name = 'Huevos') = 30, 'deshacer devuelve lo descontado');
select prepare_meal(:'hh2', '2026-11-30', 'desayuno', :'rec', 'mariana') is not null as ok3 \gset
select pg_temp.check((select s.qty from stock s join items i on i.id = s.item_id where i.household_id = :'hh2' and i.name = 'Huevos') = 29, 'Preparé solo para Mariana descuenta su porción');
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform prepare_meal((select household_id from meal_logs limit 1), '2026-12-01', 'cena', (select recipe_id from meal_logs limit 1), 'ambos');
  raise exception 'FALLA: alguien de otra casa preparó';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok: Preparé exige ser de la casa';
end $$;

-- 13. (0005) Preparé otra cosa
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select id as huevo from items where household_id = :'hh2' and name = 'Huevos' \gset
select prepare_custom(:'hh2', '2026-11-30', 'cena', 'Calentado', jsonb_build_array(jsonb_build_object('item_id', :'huevo', 'qty', 3)), 'ambos', true) as log5 \gset
select pg_temp.check((select s.qty from stock s where s.item_id = :'huevo') = 26, 'Preparé otra cosa descuenta sus ingredientes');
select pg_temp.check((select title from meal_logs where id = :'log5') = 'Calentado', 'la comida queda con su nombre');
select pg_temp.check((select qty_m + qty_a from recipe_ingredients ri join recipes r on r.id = ri.recipe_id where r.household_id = :'hh2' and r.name = 'Calentado') = 3, 'se puede guardar como receta');
select undo_meal(:'log5');
select pg_temp.check((select s.qty from stock s where s.item_id = :'huevo') = 29, 'deshacer otra cosa devuelve lo descontado');
do $$ begin
  perform prepare_custom((select household_id from items where name = 'Huevos' and household_id <> (select household_id from items where id = (select item_id from recipe_ingredients limit 1)) limit 1),
                         '2026-11-30', 'cena', 'X', jsonb_build_array(jsonb_build_object('item_id', (select item_id from recipe_ingredients limit 1), 'qty', 1)));
  raise exception 'FALLA: aceptó un artículo de otra casa';
exception when others then
  if sqlerrm like 'FALLA%' then raise; end if;
  raise notice 'ok: no acepta artículos de otra casa';
end $$;

reset role;
\echo 'TODAS LAS PRUEBAS DE BASE DE DATOS PASARON'
