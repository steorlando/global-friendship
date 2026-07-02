-- Human-friendly participant identifier used in communications.
-- Codes are exactly four digits and are identifiers only, not authentication secrets.

create sequence if not exists public.participant_personal_code_seq
  as integer
  start with 1000
  increment by 1
  minvalue 1000
  maxvalue 9999
  no cycle;

alter table public.partecipanti
  add column if not exists personal_code text;

alter table public.partecipanti
  alter column personal_code
  set default lpad(nextval('public.participant_personal_code_seq')::text, 4, '0');

update public.partecipanti
set personal_code = lpad(nextval('public.participant_personal_code_seq')::text, 4, '0')
where personal_code is null;

alter table public.partecipanti
  alter column personal_code set not null;

alter table public.partecipanti
  drop constraint if exists partecipanti_personal_code_format_check;

alter table public.partecipanti
  add constraint partecipanti_personal_code_format_check
  check (personal_code ~ '^[0-9]{4}$');

create unique index if not exists partecipanti_personal_code_key
  on public.partecipanti (personal_code);

alter sequence public.participant_personal_code_seq
  owned by public.partecipanti.personal_code;

grant usage, select on sequence public.participant_personal_code_seq
  to authenticated, service_role;
