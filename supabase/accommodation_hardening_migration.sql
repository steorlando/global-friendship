-- Step 1B - Accommodation hardening
-- Completes the database foundation for the accommodation module by:
-- - aligning role helpers with the app's real roles (`admin`, `alloggi`, `capogruppo`)
-- - tightening room data constraints and indexes
-- - enabling and defining RLS on the new accommodation tables
-- - replacing legacy `room_manager` policies with policies based on profile roles
-- - attaching the missing validation / updated_at triggers

create extension if not exists pgcrypto;

create or replace function public.is_admin_user(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.profili p
      on lower(coalesce(p.email, '')) = lower(coalesce(u.email, ''))
    where u.id = user_id
      and p.ruolo = 'admin'
  );
$$;

create or replace function public.is_group_leader_for_group(user_id uuid, target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.profili p
      on lower(coalesce(p.email, '')) = lower(coalesce(u.email, ''))
    join public.profili_gruppi pg
      on pg.profilo_id = p.id
    where u.id = user_id
      and p.ruolo = 'capogruppo'
      and pg.gruppo_id = target_group_id
  );
$$;

create or replace function public.can_manage_accommodation(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user(user_id)
  or exists (
    select 1
    from auth.users u
    join public.profili p
      on lower(coalesce(p.email, '')) = lower(coalesce(u.email, ''))
    where u.id = user_id
      and p.ruolo = 'alloggi'
  );
$$;

create or replace function public.can_access_group_accommodation(user_id uuid, target_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_manage_accommodation(user_id)
  or public.is_group_leader_for_group(user_id, target_group_id);
$$;

grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.is_group_leader_for_group(uuid, text) to authenticated;
grant execute on function public.can_manage_accommodation(uuid) to authenticated;
grant execute on function public.can_access_group_accommodation(uuid, text) to authenticated;

update public.partecipanti
set
  alloggio_short = nullif(btrim(alloggio_short), ''),
  alloggio = nullif(btrim(alloggio), '');

update public.partecipanti
set alloggio_short = 'Provided by organization'
where lower(coalesce(alloggio_short, alloggio, '')) like '%provided by organization%'
   or lower(coalesce(alloggio_short, alloggio, '')) like '%provided by the organization%'
   or lower(coalesce(alloggio_short, alloggio, '')) like '%struttura fornita dall''organizzazione%'
   or lower(coalesce(alloggio_short, alloggio, '')) like '%struttura fornita dall’organizzazione%';

update public.partecipanti
set alloggio_short = 'Atonoumous'
where lower(coalesce(alloggio_short, alloggio, '')) like '%atonoumous%'
   or lower(coalesce(alloggio_short, alloggio, '')) like '%autonomous%'
   or lower(coalesce(alloggio_short, alloggio, '')) like '%arranged my own accommodation%'
   or lower(coalesce(alloggio_short, alloggio, '')) like '%alloggio autonomamente%';

update public.stanze
set
  codice_interno = nullif(btrim(codice_interno), ''),
  numero_reale = nullif(btrim(numero_reale), '');

update public.stanze
set codice_interno = concat('R-', upper(substr(replace(id::text, '-', ''), 1, 8)))
where codice_interno is null;

update public.stanze
set capienza = 1
where capienza is null or capienza < 1;

alter table public.stanze
  alter column codice_interno set not null;

alter table public.stanze
  drop constraint if exists stanze_capienza_positive;

alter table public.stanze
  add constraint stanze_capienza_positive
  check (capienza > 0);

alter table public.stanze
  drop constraint if exists stanze_codice_interno_not_blank;

alter table public.stanze
  add constraint stanze_codice_interno_not_blank
  check (length(btrim(codice_interno)) > 0);

alter table public.stanze
  drop constraint if exists stanze_numero_reale_not_blank;

alter table public.stanze
  add constraint stanze_numero_reale_not_blank
  check (numero_reale is null or length(btrim(numero_reale)) > 0);

alter table public.stanze
  drop constraint if exists stanze_available_range_chk;

alter table public.stanze
  add constraint stanze_available_range_chk
  check (
    available_from is null
    or available_to is null
    or available_to > available_from
  );

create index if not exists stanze_gruppi_gruppo_idx
  on public.stanze_gruppi (gruppo_id);

create index if not exists partecipanti_stanze_stanza_idx
  on public.partecipanti_stanze (stanza_id);

create index if not exists partecipanti_stanze_gruppo_stanza_idx
  on public.partecipanti_stanze (gruppo_id, stanza_id);

create index if not exists partecipanti_alloggio_provided_group_dates_idx
  on public.partecipanti (gruppo_id, data_arrivo, data_partenza)
  where lower(coalesce(alloggio_short, '')) = 'provided by organization';

drop trigger if exists trg_stanze_updated_at on public.stanze;
create trigger trg_stanze_updated_at
before update on public.stanze
for each row
execute function public.set_updated_at();

drop trigger if exists trg_partecipanti_stanze_updated_at on public.partecipanti_stanze;
create trigger trg_partecipanti_stanze_updated_at
before update on public.partecipanti_stanze
for each row
execute function public.set_updated_at();

drop trigger if exists trg_partecipanti_stanze_validate on public.partecipanti_stanze;
create trigger trg_partecipanti_stanze_validate
before insert or update on public.partecipanti_stanze
for each row
execute function public.validate_partecipanti_stanze();

alter table public.gruppi enable row level security;
alter table public.alberghi enable row level security;
alter table public.stanze enable row level security;
alter table public.stanze_gruppi enable row level security;
alter table public.partecipanti_stanze enable row level security;
alter table public.partecipanti enable row level security;

drop policy if exists admin_all_groups on public.gruppi;
drop policy if exists capogruppo_select_group_row on public.gruppi;
drop policy if exists groups_admin_manage on public.gruppi;
drop policy if exists groups_select_accessible on public.gruppi;

create policy groups_admin_manage
on public.gruppi
for all
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

create policy groups_select_accessible
on public.gruppi
for select
to authenticated
using (public.can_access_group_accommodation(auth.uid(), id));

drop policy if exists admin_all_hotels on public.alberghi;
drop policy if exists room_manager_select_hotels on public.alberghi;
drop policy if exists accommodation_hotels_manage on public.alberghi;
drop policy if exists accommodation_hotels_group_scope_select on public.alberghi;

create policy accommodation_hotels_manage
on public.alberghi
for all
to authenticated
using (public.can_manage_accommodation(auth.uid()))
with check (public.can_manage_accommodation(auth.uid()));

create policy accommodation_hotels_group_scope_select
on public.alberghi
for select
to authenticated
using (
  exists (
    select 1
    from public.stanze s
    join public.stanze_gruppi sg
      on sg.stanza_id = s.id
    where s.albergo_id = alberghi.id
      and public.can_access_group_accommodation(auth.uid(), sg.gruppo_id)
  )
);

drop policy if exists admin_all_rooms on public.stanze;
drop policy if exists room_manager_select_rooms on public.stanze;
drop policy if exists accommodation_rooms_manage on public.stanze;
drop policy if exists accommodation_rooms_group_scope_select on public.stanze;

create policy accommodation_rooms_manage
on public.stanze
for all
to authenticated
using (public.can_manage_accommodation(auth.uid()))
with check (public.can_manage_accommodation(auth.uid()));

create policy accommodation_rooms_group_scope_select
on public.stanze
for select
to authenticated
using (
  exists (
    select 1
    from public.stanze_gruppi sg
    where sg.stanza_id = stanze.id
      and public.can_access_group_accommodation(auth.uid(), sg.gruppo_id)
  )
);

drop policy if exists accommodation_room_groups_manage on public.stanze_gruppi;
drop policy if exists accommodation_room_groups_group_scope_select on public.stanze_gruppi;

create policy accommodation_room_groups_manage
on public.stanze_gruppi
for all
to authenticated
using (public.can_manage_accommodation(auth.uid()))
with check (public.can_manage_accommodation(auth.uid()));

create policy accommodation_room_groups_group_scope_select
on public.stanze_gruppi
for select
to authenticated
using (public.can_access_group_accommodation(auth.uid(), gruppo_id));

drop policy if exists accommodation_participant_room_assignments_manage on public.partecipanti_stanze;

create policy accommodation_participant_room_assignments_manage
on public.partecipanti_stanze
for all
to authenticated
using (public.can_access_group_accommodation(auth.uid(), gruppo_id))
with check (public.can_access_group_accommodation(auth.uid(), gruppo_id));

drop policy if exists admin_all_participants on public.partecipanti;
drop policy if exists capogruppo_select_group on public.partecipanti;
drop policy if exists capogruppo_update_group on public.partecipanti;
drop policy if exists room_manager_select_all on public.partecipanti;
drop policy if exists room_manager_update_rooms on public.partecipanti;
drop policy if exists participants_admin_manage on public.partecipanti;
drop policy if exists participants_group_leader_select on public.partecipanti;
drop policy if exists participants_group_leader_update on public.partecipanti;
drop policy if exists participants_accommodation_staff_select on public.partecipanti;

create policy participants_admin_manage
on public.partecipanti
for all
to authenticated
using (public.is_admin_user(auth.uid()))
with check (public.is_admin_user(auth.uid()));

create policy participants_group_leader_select
on public.partecipanti
for select
to authenticated
using (public.is_group_leader_for_group(auth.uid(), gruppo_id));

create policy participants_group_leader_update
on public.partecipanti
for update
to authenticated
using (public.is_group_leader_for_group(auth.uid(), gruppo_id))
with check (public.is_group_leader_for_group(auth.uid(), gruppo_id));

create policy participants_accommodation_staff_select
on public.partecipanti
for select
to authenticated
using (
  public.can_manage_accommodation(auth.uid())
  and lower(coalesce(alloggio_short, '')) = 'provided by organization'
);
