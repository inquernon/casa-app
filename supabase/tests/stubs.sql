-- Imita lo mínimo de Supabase para probar las migraciones en un Postgres vacío.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create publication supabase_realtime; exception when duplicate_object then null; end $$;
