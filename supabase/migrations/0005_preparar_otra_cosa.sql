-- 0005 · "Preparé otra cosa": registrar una comida que no es la del menú, con sus propios ingredientes.
-- Opcionalmente queda guardada como receta para elegirla después. Se puede correr más de una vez.

alter table public.meal_logs add column if not exists title text not null default '';

-- p_items: [{"item_id": "...", "qty": 120}] en la unidad base del artículo, total para quienes comieron.
-- p_save: si es true, crea la receta (porción repartida según p_who) para usarla de nuevo.
create or replace function public.prepare_custom(p_household uuid, p_date date, p_meal text, p_title text,
                                                 p_items jsonb, p_who text default 'ambos', p_save boolean default false)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare lid uuid; rid uuid; t text := btrim(coalesce(p_title, ''));
begin
  if not is_member(p_household) then raise exception 'Sin acceso a este hogar'; end if;
  if t = '' then raise exception 'Escribe qué preparaste'; end if;
  if p_who not in ('ambos', 'mariana', 'alex') then raise exception 'Para quién: ambos, mariana o alex'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_items, '[]')) e
             where not exists (select 1 from items i where i.id = (e->>'item_id')::uuid and i.household_id = p_household)
                or coalesce((e->>'qty')::numeric, 0) <= 0) then
    raise exception 'Hay un ingrediente que no es de esta casa o sin cantidad';
  end if;

  if p_save then
    insert into recipes (household_id, name, meal, minutes, steps)
    values (p_household, t, case when p_meal in ('desayuno', 'media_manana', 'almuerzo', 'media_tarde', 'cena') then p_meal else 'almuerzo' end, 0, '')
    on conflict (household_id, name) do nothing
    returning id into rid;
    if rid is null then raise exception 'Ya existe una receta llamada "%"', t; end if;
    insert into recipe_ingredients (household_id, recipe_id, item_id, qty_m, qty_a)
    select p_household, rid, (e->>'item_id')::uuid,
           case p_who when 'mariana' then q when 'alex' then 0 else q / 2 end,
           case p_who when 'alex' then q when 'mariana' then 0 else q / 2 end
    from (select e, (e->>'qty')::numeric as q from jsonb_array_elements(p_items) e) x;
  end if;

  insert into meal_logs (household_id, log_date, meal, recipe_id, who, title)
  values (p_household, p_date, p_meal, rid, p_who, t)
  returning id into lid;

  insert into stock_movements (household_id, item_id, delta, reason, ref_id, note)
  select p_household, x.item_id, -least(greatest(coalesce(s.qty, 0), 0), x.q), 'preparacion', lid, t
  from (select (e->>'item_id')::uuid as item_id, sum((e->>'qty')::numeric) as q
        from jsonb_array_elements(coalesce(p_items, '[]')) e group by 1) x
  left join stock s on s.item_id = x.item_id
  where least(greatest(coalesce(s.qty, 0), 0), x.q) > 0;
  return lid;
end $$;
grant execute on function public.prepare_custom(uuid, date, text, text, jsonb, text, boolean) to authenticated;

-- prepare_meal también guarda el nombre, para el historial
create or replace function public.prepare_meal(p_household uuid, p_date date, p_meal text, p_recipe uuid, p_who text default 'ambos')
returns uuid
language plpgsql security invoker set search_path = public as $$
declare lid uuid; t text;
begin
  if not is_member(p_household) then raise exception 'Sin acceso a este hogar'; end if;
  select name into t from recipes where id = p_recipe and household_id = p_household;
  if t is null then raise exception 'La receta no es de esta casa'; end if;
  insert into meal_logs (household_id, log_date, meal, recipe_id, who, title)
  values (p_household, p_date, p_meal, p_recipe, p_who, t)
  returning id into lid;
  insert into stock_movements (household_id, item_id, delta, reason, ref_id, note)
  select p_household, x.item_id, -least(greatest(coalesce(s.qty, 0), 0), x.q), 'preparacion', lid, t
  from (select ri.item_id, sum(case p_who when 'mariana' then ri.qty_m when 'alex' then ri.qty_a else ri.qty_m + ri.qty_a end) as q
        from recipe_ingredients ri where ri.recipe_id = p_recipe group by ri.item_id) x
  left join stock s on s.item_id = x.item_id
  where least(greatest(coalesce(s.qty, 0), 0), x.q) > 0;
  return lid;
end $$;

update public.meal_logs l set title = r.name from public.recipes r where r.id = l.recipe_id and l.title = '';
