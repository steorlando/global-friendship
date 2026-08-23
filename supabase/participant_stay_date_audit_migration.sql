alter table public.partecipanti
  add column if not exists stay_dates_changed_at timestamptz null,
  add column if not exists stay_dates_changed_by uuid null references auth.users (id) on delete set null,
  add column if not exists stay_dates_changed_by_email text null,
  add column if not exists stay_dates_changed_by_role text null,
  add column if not exists previous_data_arrivo date null,
  add column if not exists previous_data_partenza date null;

create index if not exists partecipanti_stay_dates_changed_at_idx
  on public.partecipanti (stay_dates_changed_at desc)
  where stay_dates_changed_at is not null;
