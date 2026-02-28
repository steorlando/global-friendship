-- Compute stay days and total fee directly in DB.
-- Rule:
-- - if alloggio_short is Autonomous/Atonoumous -> 100
-- - otherwise if nights >= 4 -> 235
-- - otherwise if nights between 1 and 3 -> 200
-- - otherwise null

create or replace function public.partecipanti_set_stay_and_fee()
returns trigger
language plpgsql
as $$
declare
  nights integer;
begin
  if new.data_arrivo is null or new.data_partenza is null then
    new.giorni_permanenza := null;
    if lower(coalesce(new.alloggio_short, '')) in ('autonomous', 'atonoumous') then
      new.quota_totale := 100;
    else
      new.quota_totale := null;
    end if;
    return new;
  end if;

  nights := (new.data_partenza - new.data_arrivo);
  if nights is null or nights <= 0 then
    new.giorni_permanenza := null;
    if lower(coalesce(new.alloggio_short, '')) in ('autonomous', 'atonoumous') then
      new.quota_totale := 100;
    else
      new.quota_totale := null;
    end if;
    return new;
  end if;

  new.giorni_permanenza := nights;
  if lower(coalesce(new.alloggio_short, '')) in ('autonomous', 'atonoumous') then
    new.quota_totale := 100;
  else
    new.quota_totale := case when nights >= 4 then 235 else 200 end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_partecipanti_set_stay_and_fee on public.partecipanti;
create trigger trg_partecipanti_set_stay_and_fee
before insert or update of data_arrivo, data_partenza, alloggio_short
on public.partecipanti
for each row
execute function public.partecipanti_set_stay_and_fee();

-- Backfill existing rows once so historical records match the DB rule.
update public.partecipanti p
set
  giorni_permanenza = case
    when p.data_arrivo is null or p.data_partenza is null then null
    when (p.data_partenza - p.data_arrivo) <= 0 then null
    else (p.data_partenza - p.data_arrivo)
  end,
  quota_totale = case
    when lower(coalesce(p.alloggio_short, '')) in ('autonomous', 'atonoumous') then 100
    when p.data_arrivo is null or p.data_partenza is null then null
    when (p.data_partenza - p.data_arrivo) <= 0 then null
    when (p.data_partenza - p.data_arrivo) >= 4 then 235
    else 200
  end;
