alter table public.admin_event_settings
  add column if not exists hostel_check_in_enabled boolean not null default false;

create table if not exists public.participant_hostel_check_ins (
  participant_id uuid primary key references public.partecipanti (id) on delete cascade,
  identity_document_type text not null,
  identity_document_number text not null,
  identity_document_country text not null,
  identity_document_issuing_city text not null,
  identity_document_issue_date date not null,
  identity_document_expiration_date date not null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_hostel_check_ins_document_type
    check (identity_document_type in ('passport', 'driving_license', 'national_id')),
  constraint participant_hostel_check_ins_document_number_not_blank
    check (length(btrim(identity_document_number)) between 1 and 80),
  constraint participant_hostel_check_ins_document_country_not_blank
    check (length(btrim(identity_document_country)) between 1 and 100),
  constraint participant_hostel_check_ins_issuing_city_not_blank
    check (length(btrim(identity_document_issuing_city)) between 1 and 100),
  constraint participant_hostel_check_ins_document_date_order
    check (identity_document_expiration_date >= identity_document_issue_date)
);

create index if not exists participant_hostel_check_ins_completed_at_idx
  on public.participant_hostel_check_ins (completed_at desc);

create or replace function public.set_participant_hostel_check_ins_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_participant_hostel_check_ins_updated_at
  on public.participant_hostel_check_ins;

create trigger trg_participant_hostel_check_ins_updated_at
before update on public.participant_hostel_check_ins
for each row execute function public.set_participant_hostel_check_ins_updated_at();

alter table public.participant_hostel_check_ins enable row level security;

comment on table public.participant_hostel_check_ins is
  'Identity-document details submitted by hostel-assigned participants. Access is restricted to authenticated server-side workflows.';
