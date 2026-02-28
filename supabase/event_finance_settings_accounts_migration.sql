begin;

alter table public.event_finance_settings
  add column if not exists accounts text[] not null default '{}'::text[];

update public.event_finance_settings
set accounts = '{}'::text[]
where accounts is null;

commit;
