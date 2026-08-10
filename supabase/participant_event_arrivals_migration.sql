alter type public.ruolo_utente add value if not exists 'accoglienza';

create table if not exists public.participant_event_arrivals (
  participant_id uuid primary key references public.partecipanti(id) on delete cascade,
  qr_token uuid not null unique default gen_random_uuid(),
  arrived_at timestamptz,
  marked_by uuid references auth.users(id) on delete set null,
  marked_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_event_arrivals_marked_by_email_not_blank
    check (marked_by_email is null or btrim(marked_by_email) <> '')
);

create index if not exists participant_event_arrivals_arrived_at_idx
  on public.participant_event_arrivals (arrived_at desc)
  where arrived_at is not null;

insert into public.participant_event_arrivals (participant_id)
select id
from public.partecipanti
on conflict (participant_id) do nothing;

create or replace function public.ensure_participant_event_arrival()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.participant_event_arrivals (participant_id)
  values (new.id)
  on conflict (participant_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_participant_event_arrival on public.partecipanti;
create trigger trg_ensure_participant_event_arrival
after insert on public.partecipanti
for each row execute function public.ensure_participant_event_arrival();

create or replace function public.set_participant_event_arrivals_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_participant_event_arrivals_updated_at
  on public.participant_event_arrivals;
create trigger trg_participant_event_arrivals_updated_at
before update on public.participant_event_arrivals
for each row execute function public.set_participant_event_arrivals_updated_at();

alter table public.participant_event_arrivals enable row level security;

comment on table public.participant_event_arrivals is
  'Opaque participant QR identity and event-arrival status. Access is server-side only.';
comment on column public.participant_event_arrivals.qr_token is
  'Random opaque token encoded in the participant QR code; it is not an authentication secret.';
comment on column public.participant_event_arrivals.arrived_at is
  'Null until reception staff confirms that the participant has arrived at the event.';
