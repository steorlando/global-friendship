-- Add a 100 EUR surcharge for operators who choose hotel accommodation.
-- The surcharge is applied after the standard participant fee is calculated.

create or replace function public.calculate_participant_total_fee(
  participant_alloggio_short text,
  participant_alloggio text,
  participant_city text,
  participant_arrival date,
  participant_departure date,
  event_host_city text,
  participant_registration_type text,
  participant_operator_accommodation_preference text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select (
    case
      when lower(btrim(coalesce(participant_alloggio_short, ''))) in ('autonomous', 'atonoumous')
        or lower(coalesce(participant_alloggio, '')) like '%own accommodation%'
        or lower(coalesce(participant_alloggio, '')) like '%alloggio autonomamente%'
        or (
          nullif(btrim(participant_city), '') is not null
          and lower(btrim(participant_city)) = lower(btrim(event_host_city))
        )
        then 100::numeric
      when participant_arrival = date '2026-08-27'
        and participant_departure = date '2026-08-31'
        then 235::numeric
      else 200::numeric
    end
  ) + (
    case
      when lower(btrim(coalesce(participant_registration_type, ''))) = 'operator - operatore'
        and lower(btrim(coalesce(participant_operator_accommodation_preference, ''))) = 'hotel'
        then 100::numeric
      else 0::numeric
    end
  );
$$;

create or replace function public.partecipanti_set_stay_and_fee()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  host_city_value text := 'Budapest';
  nights integer;
begin
  select settings.host_city
  into host_city_value
  from public.admin_event_settings settings
  where settings.id = true;

  host_city_value := coalesce(nullif(btrim(host_city_value), ''), 'Budapest');
  nights := new.data_partenza - new.data_arrivo;

  new.giorni_permanenza := case
    when nights is not null and nights > 0 then nights
    else null
  end;

  new.quota_totale := public.calculate_participant_total_fee(
    new.alloggio_short,
    new.alloggio,
    new."città",
    new.data_arrivo,
    new.data_partenza,
    host_city_value,
    new.tipo_iscrizione,
    new.preferenza_alloggio_operatore
  );

  return new;
end;
$$;

drop trigger if exists trg_partecipanti_set_stay_and_fee on public.partecipanti;
create trigger trg_partecipanti_set_stay_and_fee
before insert or update of
  data_arrivo,
  data_partenza,
  alloggio_short,
  alloggio,
  "città",
  tipo_iscrizione,
  preferenza_alloggio_operatore
on public.partecipanti
for each row
execute function public.partecipanti_set_stay_and_fee();

create or replace function public.recalculate_participant_fees_for_host_city()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.host_city is distinct from old.host_city then
    update public.partecipanti participant
    set quota_totale = public.calculate_participant_total_fee(
      participant.alloggio_short,
      participant.alloggio,
      participant."città",
      participant.data_arrivo,
      participant.data_partenza,
      new.host_city,
      participant.tipo_iscrizione,
      participant.preferenza_alloggio_operatore
    );
  end if;

  return new;
end;
$$;

update public.partecipanti participant
set quota_totale = public.calculate_participant_total_fee(
  participant.alloggio_short,
  participant.alloggio,
  participant."città",
  participant.data_arrivo,
  participant.data_partenza,
  (select settings.host_city from public.admin_event_settings settings where settings.id = true),
  participant.tipo_iscrizione,
  participant.preferenza_alloggio_operatore
);

drop function if exists public.calculate_participant_total_fee(
  text,
  text,
  text,
  date,
  date,
  text
);
