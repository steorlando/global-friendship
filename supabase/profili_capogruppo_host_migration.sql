alter table public.profili
  add column if not exists capogruppo_host boolean not null default false;

update public.profili
set capogruppo_host = false
where capogruppo_host is null;
