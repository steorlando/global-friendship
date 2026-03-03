-- Guard rails for profile creation:
-- 1) disable automatic profile creation from auth.users triggers
-- 2) allow INSERT on public.profili only to admins (or service role)

do $$
declare
  trg record;
begin
  for trg in
    select t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal
      and lower(pg_get_functiondef(p.oid)) like '%insert into public.profili%'
  loop
    execute format('drop trigger if exists %I on auth.users', trg.trigger_name);
  end loop;
end $$;

alter table public.profili enable row level security;

drop policy if exists profili_insert_admin_only on public.profili;
create policy profili_insert_admin_only
on public.profili
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profili p
    where p.id = auth.uid()
      and p.ruolo = 'admin'
  )
);
