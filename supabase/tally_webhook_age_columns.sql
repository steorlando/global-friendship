alter table public.partecipanti
  add column if not exists eta integer,
  add column if not exists is_minorenne boolean;
