-- Tours, participant bookings, and the 30-minute waitlist offer workflow.
-- All application access goes through authenticated server routes using the service role.

alter type public.ruolo_utente add value if not exists 'tour_manager';

create table if not exists public.tour_settings (
  id boolean primary key default true check (id),
  public_enabled boolean not null default false,
  participant_changes_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_by_email text null
);

insert into public.tour_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  description text not null check (length(btrim(description)) > 0),
  max_participants integer not null check (max_participants > 0),
  contact_name text null,
  contact_phone text null,
  contact_email text null,
  attachment_path text null,
  attachment_name text null,
  attachment_mime_type text null,
  attachment_size_bytes bigint null check (
    attachment_size_bytes is null or attachment_size_bytes between 1 and 10485760
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null
);

create table if not exists public.tour_bookings (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique references public.partecipanti(id) on delete cascade,
  tour_id uuid not null references public.tours(id) on delete restrict,
  booked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  updated_by_email text null,
  updated_by_role text null
);

create index if not exists tour_bookings_tour_id_idx
  on public.tour_bookings (tour_id);

create table if not exists public.tour_waitlist (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.partecipanti(id) on delete cascade,
  tour_id uuid not null references public.tours(id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'accepted', 'expired', 'cancelled')),
  joined_at timestamptz not null default now(),
  offered_at timestamptz null,
  offer_expires_at timestamptz null,
  offer_notification_sent_at timestamptz null,
  offer_notification_claimed_at timestamptz null,
  resolved_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.tour_waitlist
  add column if not exists offer_notification_claimed_at timestamptz null;

create unique index if not exists tour_waitlist_one_active_per_participant_idx
  on public.tour_waitlist (participant_id)
  where status in ('waiting', 'offered');

create index if not exists tour_waitlist_queue_idx
  on public.tour_waitlist (tour_id, status, joined_at, id);

create or replace function public.set_tour_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tours_updated_at on public.tours;
create trigger set_tours_updated_at
before update on public.tours
for each row execute function public.set_tour_updated_at();

drop trigger if exists set_tour_bookings_updated_at on public.tour_bookings;
create trigger set_tour_bookings_updated_at
before update on public.tour_bookings
for each row execute function public.set_tour_updated_at();

drop trigger if exists set_tour_waitlist_updated_at on public.tour_waitlist;
create trigger set_tour_waitlist_updated_at
before update on public.tour_waitlist
for each row execute function public.set_tour_updated_at();

create or replace function public.enforce_tour_capacity_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_occupied integer;
begin
  select
    (select count(*) from public.tour_bookings where tour_id = new.id)
    +
    (select count(*) from public.tour_waitlist
      where tour_id = new.id
        and status = 'offered'
        and offer_expires_at > now())
  into v_occupied;

  if new.max_participants < v_occupied then
    raise exception using message = 'TOUR_CAPACITY_BELOW_OCCUPANCY', errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_tour_capacity_update on public.tours;
create trigger enforce_tour_capacity_update
before update of max_participants on public.tours
for each row execute function public.enforce_tour_capacity_update();

create or replace function public.tour_update_settings(
  p_public_enabled boolean,
  p_participant_changes_enabled boolean,
  p_actor_user_id uuid,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(734928401);
  insert into public.tour_settings (
    id,
    public_enabled,
    participant_changes_enabled,
    updated_at,
    updated_by,
    updated_by_email
  ) values (
    true,
    p_public_enabled,
    p_participant_changes_enabled,
    now(),
    p_actor_user_id,
    nullif(btrim(p_actor_email), '')
  )
  on conflict (id) do update
  set public_enabled = excluded.public_enabled,
      participant_changes_enabled = excluded.participant_changes_enabled,
      updated_at = now(),
      updated_by = excluded.updated_by,
      updated_by_email = excluded.updated_by_email;
end;
$$;

create or replace function public.tour_set_booking(
  p_participant_id uuid,
  p_tour_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_actor_role text,
  p_enforce_participant_window boolean default true
)
returns table (previous_tour_id uuid, booked_tour_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.tour_settings%rowtype;
  v_tour public.tours%rowtype;
  v_previous_tour_id uuid;
  v_confirmed_count integer;
  v_offer_count integer;
  v_has_offer boolean;
begin
  perform pg_advisory_xact_lock(734928401);

  select * into v_settings from public.tour_settings where id = true;
  if p_enforce_participant_window and not coalesce(v_settings.public_enabled, false) then
    raise exception using message = 'TOUR_REGISTRATION_HIDDEN', errcode = 'P0001';
  end if;
  if p_enforce_participant_window and not coalesce(v_settings.participant_changes_enabled, false) then
    raise exception using message = 'TOUR_BOOKINGS_CLOSED', errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.partecipanti
    where id = p_participant_id and deleted_at is null
  ) then
    raise exception using message = 'PARTICIPANT_NOT_FOUND', errcode = 'P0001';
  end if;

  select * into v_tour
  from public.tours
  where id = p_tour_id and is_active = true
  for update;

  if not found then
    raise exception using message = 'TOUR_NOT_FOUND', errcode = 'P0001';
  end if;

  update public.tour_waitlist
  set status = 'expired', resolved_at = now()
  where status = 'offered' and offer_expires_at <= now();

  select tour_id into v_previous_tour_id
  from public.tour_bookings
  where participant_id = p_participant_id;

  select exists (
    select 1 from public.tour_waitlist
    where participant_id = p_participant_id
      and tour_id = p_tour_id
      and status = 'offered'
      and offer_expires_at > now()
  ) into v_has_offer;

  select count(*)::integer into v_confirmed_count
  from public.tour_bookings
  where tour_id = p_tour_id and participant_id <> p_participant_id;

  select count(*)::integer into v_offer_count
  from public.tour_waitlist
  where tour_id = p_tour_id
    and participant_id <> p_participant_id
    and status = 'offered'
    and offer_expires_at > now();

  if p_enforce_participant_window
    and not v_has_offer
    and exists (
      select 1
      from public.tour_waitlist
      where tour_id = p_tour_id and status = 'waiting'
    ) then
    raise exception using message = 'TOUR_RESERVED_FOR_WAITLIST', errcode = 'P0001';
  end if;

  if not v_has_offer and v_confirmed_count + v_offer_count >= v_tour.max_participants then
    raise exception using message = 'TOUR_FULL', errcode = 'P0001';
  end if;

  insert into public.tour_bookings (
    participant_id,
    tour_id,
    booked_at,
    updated_at,
    updated_by,
    updated_by_email,
    updated_by_role
  ) values (
    p_participant_id,
    p_tour_id,
    now(),
    now(),
    p_actor_user_id,
    nullif(btrim(p_actor_email), ''),
    nullif(btrim(p_actor_role), '')
  )
  on conflict (participant_id) do update
  set tour_id = excluded.tour_id,
      updated_at = now(),
      updated_by = excluded.updated_by,
      updated_by_email = excluded.updated_by_email,
      updated_by_role = excluded.updated_by_role;

  update public.tour_waitlist
  set status = 'accepted', resolved_at = now()
  where participant_id = p_participant_id
    and tour_id = p_tour_id
    and status = 'offered'
    and offer_expires_at > now();

  previous_tour_id := case
    when v_previous_tour_id is distinct from p_tour_id then v_previous_tour_id
    else null
  end;
  booked_tour_id := p_tour_id;
  return next;
end;
$$;

create or replace function public.tour_remove_booking(
  p_participant_id uuid,
  p_actor_user_id uuid,
  p_actor_email text,
  p_actor_role text,
  p_enforce_participant_window boolean default true
)
returns table (previous_tour_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.tour_settings%rowtype;
  v_previous_tour_id uuid;
begin
  perform pg_advisory_xact_lock(734928401);
  select * into v_settings from public.tour_settings where id = true;

  if p_enforce_participant_window and not coalesce(v_settings.public_enabled, false) then
    raise exception using message = 'TOUR_REGISTRATION_HIDDEN', errcode = 'P0001';
  end if;
  if p_enforce_participant_window and not coalesce(v_settings.participant_changes_enabled, false) then
    raise exception using message = 'TOUR_BOOKINGS_CLOSED', errcode = 'P0001';
  end if;

  delete from public.tour_bookings
  where participant_id = p_participant_id
  returning tour_id into v_previous_tour_id;

  previous_tour_id := v_previous_tour_id;
  return next;
end;
$$;

create or replace function public.tour_join_waitlist(
  p_participant_id uuid,
  p_tour_id uuid
)
returns table (waitlist_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.tour_settings%rowtype;
  v_tour public.tours%rowtype;
  v_confirmed_count integer;
  v_offer_count integer;
  v_existing_id uuid;
begin
  perform pg_advisory_xact_lock(734928401);
  select * into v_settings from public.tour_settings where id = true;
  if not coalesce(v_settings.public_enabled, false) then
    raise exception using message = 'TOUR_REGISTRATION_HIDDEN', errcode = 'P0001';
  end if;
  if not coalesce(v_settings.participant_changes_enabled, false) then
    raise exception using message = 'TOUR_BOOKINGS_CLOSED', errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.partecipanti
    where id = p_participant_id and deleted_at is null
  ) then
    raise exception using message = 'PARTICIPANT_NOT_FOUND', errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.tour_bookings
    where participant_id = p_participant_id and tour_id = p_tour_id
  ) then
    raise exception using message = 'TOUR_ALREADY_BOOKED', errcode = 'P0001';
  end if;

  select * into v_tour
  from public.tours
  where id = p_tour_id and is_active = true
  for update;
  if not found then
    raise exception using message = 'TOUR_NOT_FOUND', errcode = 'P0001';
  end if;

  update public.tour_waitlist
  set status = 'expired', resolved_at = now()
  where status = 'offered' and offer_expires_at <= now();

  select id into v_existing_id
  from public.tour_waitlist
  where participant_id = p_participant_id
    and tour_id = p_tour_id
    and status in ('waiting', 'offered')
  limit 1;
  if v_existing_id is not null then
    waitlist_id := v_existing_id;
    return next;
    return;
  end if;

  select count(*)::integer into v_confirmed_count
  from public.tour_bookings where tour_id = p_tour_id;
  select count(*)::integer into v_offer_count
  from public.tour_waitlist
  where tour_id = p_tour_id
    and status = 'offered'
    and offer_expires_at > now();

  if v_confirmed_count + v_offer_count < v_tour.max_participants then
    raise exception using message = 'TOUR_AVAILABLE', errcode = 'P0001';
  end if;

  update public.tour_waitlist
  set status = 'cancelled', resolved_at = now()
  where participant_id = p_participant_id
    and status in ('waiting', 'offered');

  insert into public.tour_waitlist (participant_id, tour_id, status)
  values (p_participant_id, p_tour_id, 'waiting')
  returning id into waitlist_id;
  return next;
end;
$$;

create or replace function public.tour_leave_waitlist(p_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.tour_settings%rowtype;
begin
  perform pg_advisory_xact_lock(734928401);
  select * into v_settings from public.tour_settings where id = true;
  if not coalesce(v_settings.public_enabled, false) then
    raise exception using message = 'TOUR_REGISTRATION_HIDDEN', errcode = 'P0001';
  end if;
  if not coalesce(v_settings.participant_changes_enabled, false) then
    raise exception using message = 'TOUR_BOOKINGS_CLOSED', errcode = 'P0001';
  end if;

  update public.tour_waitlist
  set status = 'cancelled', resolved_at = now()
  where participant_id = p_participant_id
    and status in ('waiting', 'offered');
end;
$$;

create or replace function public.tour_process_waitlist()
returns table (waitlist_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.tour_settings%rowtype;
  v_tour record;
  v_confirmed_count integer;
  v_offer_count integer;
  v_next_waitlist_id uuid;
begin
  perform pg_advisory_xact_lock(734928401);

  update public.tour_waitlist
  set status = 'expired', resolved_at = now()
  where status = 'offered' and offer_expires_at <= now();

  select * into v_settings from public.tour_settings where id = true;
  if not coalesce(v_settings.public_enabled, false)
    or not coalesce(v_settings.participant_changes_enabled, false) then
    return;
  end if;

  for v_tour in
    select id, max_participants
    from public.tours
    where is_active = true
    order by created_at, id
    for update
  loop
    select count(*)::integer into v_confirmed_count
    from public.tour_bookings where tour_id = v_tour.id;

    select count(*)::integer into v_offer_count
    from public.tour_waitlist
    where tour_id = v_tour.id
      and status = 'offered'
      and offer_expires_at > now();

    while v_confirmed_count + v_offer_count < v_tour.max_participants loop
      v_next_waitlist_id := null;
      select id into v_next_waitlist_id
      from public.tour_waitlist
      where tour_id = v_tour.id and status = 'waiting'
      order by joined_at, id
      for update skip locked
      limit 1;

      exit when v_next_waitlist_id is null;

      update public.tour_waitlist
      set status = 'offered',
          offered_at = now(),
          offer_expires_at = now() + interval '30 minutes',
          offer_notification_sent_at = null,
          offer_notification_claimed_at = null,
          resolved_at = null
      where id = v_next_waitlist_id;

      v_offer_count := v_offer_count + 1;
    end loop;
  end loop;

  return query
  select tw.id
  from public.tour_waitlist tw
  where tw.status = 'offered'
    and tw.offer_expires_at > now()
    and tw.offer_notification_sent_at is null
    and (
      tw.offer_notification_claimed_at is null
      or tw.offer_notification_claimed_at <= now() - interval '5 minutes'
    )
  order by tw.offered_at, tw.id;
end;
$$;

create or replace function public.tour_claim_waitlist_notifications(p_waitlist_ids uuid[])
returns table (
  id uuid,
  participant_id uuid,
  tour_id uuid,
  offer_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(array_length(p_waitlist_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  update public.tour_waitlist tw
  set offer_notification_claimed_at = now()
  where tw.id = any(p_waitlist_ids)
    and tw.status = 'offered'
    and tw.offer_expires_at > now()
    and tw.offer_notification_sent_at is null
    and (
      tw.offer_notification_claimed_at is null
      or tw.offer_notification_claimed_at <= now() - interval '5 minutes'
    )
  returning tw.id, tw.participant_id, tw.tour_id, tw.offer_expires_at;
end;
$$;

revoke all on function public.tour_set_booking(uuid, uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.tour_remove_booking(uuid, uuid, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.tour_join_waitlist(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.tour_leave_waitlist(uuid)
  from public, anon, authenticated;
revoke all on function public.tour_process_waitlist()
  from public, anon, authenticated;
revoke all on function public.tour_update_settings(boolean, boolean, uuid, text)
  from public, anon, authenticated;
revoke all on function public.tour_claim_waitlist_notifications(uuid[])
  from public, anon, authenticated;

grant execute on function public.tour_set_booking(uuid, uuid, uuid, text, text, boolean)
  to service_role;
grant execute on function public.tour_remove_booking(uuid, uuid, text, text, boolean)
  to service_role;
grant execute on function public.tour_join_waitlist(uuid, uuid)
  to service_role;
grant execute on function public.tour_leave_waitlist(uuid)
  to service_role;
grant execute on function public.tour_process_waitlist()
  to service_role;
grant execute on function public.tour_update_settings(boolean, boolean, uuid, text)
  to service_role;
grant execute on function public.tour_claim_waitlist_notifications(uuid[])
  to service_role;

alter table public.tour_settings enable row level security;
alter table public.tours enable row level security;
alter table public.tour_bookings enable row level security;
alter table public.tour_waitlist enable row level security;

revoke all on public.tour_settings, public.tours, public.tour_bookings, public.tour_waitlist
  from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tour-attachments',
  'tour-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
