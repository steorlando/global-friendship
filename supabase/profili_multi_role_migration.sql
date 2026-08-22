-- Allow one Auth account to own multiple application profiles, one per role.
-- Existing profile ids are preserved so profili_gruppi and other foreign keys stay valid.

alter table public.profili
  add column if not exists auth_user_id uuid;

update public.profili p
set auth_user_id = u.id
from auth.users u
where p.auth_user_id is null
  and lower(btrim(p.email)) = lower(btrim(u.email));

do $$
begin
  if exists (
    select 1
    from public.profili
    where auth_user_id is null
  ) then
    raise exception 'Cannot enable multi-role profiles: at least one profile has no matching auth user';
  end if;
end $$;

alter table public.profili
  alter column auth_user_id set not null;

alter table public.profili
  drop constraint if exists profili_id_fkey;

alter table public.profili
  drop constraint if exists profili_email_key;

alter table public.profili
  drop constraint if exists profili_auth_user_id_fkey;

alter table public.profili
  add constraint profili_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users(id)
  on delete cascade;

create unique index if not exists profili_email_ruolo_key
  on public.profili (lower(btrim(email)), ruolo);

create or replace function public.set_profilo_auth_user_id()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.auth_user_id is null then
    select u.id
    into new.auth_user_id
    from auth.users u
    where lower(btrim(u.email)) = lower(btrim(new.email))
    limit 1;
  end if;

  if new.auth_user_id is null then
    raise exception 'No Auth user found for profile email %', new.email;
  end if;

  return new;
end;
$$;

drop trigger if exists profili_set_auth_user_id on public.profili;
create trigger profili_set_auth_user_id
before insert or update of email, auth_user_id
on public.profili
for each row
execute function public.set_profilo_auth_user_id();

alter table public.profili enable row level security;

drop policy if exists "Read own profile" on public.profili;
create policy "Read own profile"
on public.profili
for select
using (auth.uid() = auth_user_id);

drop policy if exists "Update own profile" on public.profili;
create policy "Update own profile"
on public.profili
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists profili_insert_admin_only on public.profili;
create policy profili_insert_admin_only
on public.profili
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profili p
    where p.auth_user_id = auth.uid()
      and p.ruolo = 'admin'
  )
);

comment on column public.profili.auth_user_id is
  'Shared Supabase Auth identity. One Auth user may have one profile row per application role.';
