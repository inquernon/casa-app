-- 0003 · Dinero: ingresos y gastos personales.
-- Cada persona ve y edita solo sus movimientos. La casa ve únicamente los totales por persona
-- (función household_money). Cada mercado guardado se anota solo como gasto de quien lo guardó.
-- Se puede correr más de una vez sin duplicar nada.

create table if not exists public.money_tx (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ingreso', 'gasto')),
  amount numeric not null check (amount > 0),
  category text not null default 'Otro',
  method text not null default 'efectivo' check (method in ('efectivo', 'debito', 'credito', 'transferencia')),
  note text not null default '',
  tx_date date not null default public.today_co(),   -- con tarjeta de crédito: el día de la compra
  trip_id uuid unique references public.shopping_trips(id) on delete cascade,  -- solo los gastos de mercado automáticos
  created_at timestamptz not null default now()
);
create index if not exists money_tx_owner on public.money_tx (household_id, user_id, tx_date desc);

alter table public.money_tx enable row level security;
drop policy if exists money_tx_own on public.money_tx;
create policy money_tx_own on public.money_tx for all
  using (user_id = auth.uid() and public.is_member(household_id))
  with check (user_id = auth.uid() and public.is_member(household_id));

do $$ begin
  alter publication supabase_realtime add table public.money_tx;
exception when duplicate_object then null;
end $$;

-- Mercado guardado → gasto de quien lo guardó (lo puede editar o borrar en Dinero)
create or replace function public.trip_to_money() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and new.total > 0 then
    insert into money_tx (household_id, user_id, kind, amount, category, method, note, tx_date, trip_id)
    values (new.household_id, new.created_by, 'gasto', new.total, 'Mercado', 'credito',
            'Mercado ' || array_to_string(new.places, ', '), new.trip_date, new.id)
    on conflict (trip_id) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.trip_to_money() from public, authenticated;

drop trigger if exists trip_to_money on public.shopping_trips;
create trigger trip_to_money after insert on public.shopping_trips
  for each row execute function public.trip_to_money();

-- Mercados que ya estaban guardados
insert into public.money_tx (household_id, user_id, kind, amount, category, method, note, tx_date, trip_id)
select t.household_id, t.created_by, 'gasto', t.total, 'Mercado', 'credito',
       'Mercado ' || array_to_string(t.places, ', '), t.trip_date, t.id
from public.shopping_trips t
where t.created_by is not null and t.total > 0
on conflict (trip_id) do nothing;

-- Totales por persona en un rango de fechas. No expone ningún detalle.
create or replace function public.household_money(p_household uuid, p_from date, p_to date)
returns table (user_id uuid, display_name text, ingresos numeric, gastos numeric)
language sql stable security definer set search_path = public as $$
  select m.user_id, m.display_name,
         coalesce(sum(t.amount) filter (where t.kind = 'ingreso'), 0),
         coalesce(sum(t.amount) filter (where t.kind = 'gasto'), 0)
  from household_members m
  left join money_tx t on t.household_id = m.household_id and t.user_id = m.user_id
                      and t.tx_date between p_from and p_to
  where m.household_id = p_household and is_member(p_household)
  group by m.user_id, m.display_name
  order by m.display_name
$$;
revoke execute on function public.household_money(uuid, date, date) from public;
grant execute on function public.household_money(uuid, date, date) to authenticated;
