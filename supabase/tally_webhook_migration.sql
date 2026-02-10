-- 1) Allow multiple participants with the same email
alter table public.partecipanti
  drop constraint if exists partecipanti_email_key;

-- 2) Normalized columns for key Tally fields
alter table public.partecipanti
  add column if not exists telefono text,
  add column if not exists paese_residenza text,
  add column if not exists tipo_iscrizione text,
  add column if not exists sesso text,
  add column if not exists data_nascita date,
  add column if not exists data_arrivo date,
  add column if not exists data_partenza date,
  add column if not exists alloggio text,
  add column if not exists allergie text,
  add column if not exists note text,
  add column if not exists privacy_accettata boolean,
  add column if not exists submitted_at_tally timestamptz,
  add column if not exists gruppo_label text;

-- 3) Webhook audit table
create table if not exists public.webhook_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  source text not null,
  event_type text not null,
  submission_id text null,
  respondent_id text null,
  email text null,
  status text not null,
  error_code text null,
  error_message text null,
  payload jsonb not null,
  normalized jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists webhook_events_source_created_at_idx
  on public.webhook_events (source, created_at desc);

create index if not exists webhook_events_submission_id_idx
  on public.webhook_events (submission_id);

create index if not exists webhook_events_email_idx
  on public.webhook_events (email);
