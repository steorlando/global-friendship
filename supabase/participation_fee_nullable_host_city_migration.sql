-- Host-city participants can attend without accommodation stay dates.
-- The fee trigger intentionally sets stay/fee fields to null when arrival/departure
-- are absent, so these columns must allow nulls.
alter table public.partecipanti
  alter column giorni_permanenza drop not null,
  alter column quota_totale drop not null;
