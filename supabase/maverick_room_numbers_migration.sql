-- Maps the physical Maverick room numbers supplied in
-- dati-check-in-maverick.xlsx to the existing capacity-based internal room IDs.
-- Within each capacity, the workbook's first-appearance order is paired with
-- the generated internal sequence A..Z, AA..AE.

select pg_advisory_xact_lock(hashtextextended('global-friendship:maverick-room-numbers', 0));

create temporary table maverick_room_number_map (
  codice_interno text primary key,
  capienza integer not null,
  numero_reale text not null unique
) on commit drop;

insert into maverick_room_number_map (codice_interno, capienza, numero_reale)
values
  ('MA-10-A', 10, '310'),
  ('MA-10-B', 10, '508'),
  ('MA-10-C', 10, '408'),
  ('MA-10-D', 10, '410'),
  ('MA-10-E', 10, '308'),
  ('MA-10-F', 10, '102'),
  ('MA-10-G', 10, '208'),
  ('MA-10-H', 10, '210'),
  ('MA-08-A', 8, '114'),
  ('MA-08-B', 8, '109'),
  ('MA-06-A', 6, '105'),
  ('MA-06-B', 6, '106'),
  ('MA-06-C', 6, '107'),
  ('MA-05-A', 5, '219'),
  ('MA-05-B', 5, '319'),
  ('MA-05-C', 5, '108'),
  ('MA-04-A', 4, '419'),
  ('MA-04-B', 4, '515'),
  ('MA-04-C', 4, '415'),
  ('MA-04-D', 4, '519'),
  ('MA-04-E', 4, '514'),
  ('MA-04-F', 4, '315'),
  ('MA-04-G', 4, '414'),
  ('MA-04-H', 4, '215'),
  ('MA-04-I', 4, '314'),
  ('MA-04-J', 4, '214'),
  ('MA-04-K', 4, '417'),
  ('MA-04-L', 4, '112'),
  ('MA-04-M', 4, '217'),
  ('MA-04-N', 4, '317'),
  ('MA-04-O', 4, '517'),
  ('MA-04-P', 4, '403'),
  ('MA-04-Q', 4, '503'),
  ('MA-04-R', 4, '303'),
  ('MA-04-S', 4, '501'),
  ('MA-04-T', 4, '401'),
  ('MA-04-U', 4, '301'),
  ('MA-04-V', 4, '201'),
  ('MA-04-W', 4, '203'),
  ('MA-04-X', 4, '409'),
  ('MA-04-Y', 4, '511'),
  ('MA-04-Z', 4, '509'),
  ('MA-04-AA', 4, '411'),
  ('MA-04-AB', 4, '311'),
  ('MA-04-AC', 4, '211'),
  ('MA-04-AD', 4, '309'),
  ('MA-04-AE', 4, '209'),
  ('MA-03-A', 3, '405'),
  ('MA-03-B', 3, '305'),
  ('MA-02-A', 2, '516'),
  ('MA-02-B', 2, '513'),
  ('MA-02-C', 2, '507'),
  ('MA-02-D', 2, '418'),
  ('MA-02-E', 2, '506'),
  ('MA-02-F', 2, '416'),
  ('MA-02-G', 2, '318'),
  ('MA-02-H', 2, '406'),
  ('MA-02-I', 2, '407'),
  ('MA-02-J', 2, '413'),
  ('MA-02-K', 2, '218'),
  ('MA-02-L', 2, '306'),
  ('MA-02-M', 2, '313'),
  ('MA-02-N', 2, '316'),
  ('MA-02-O', 2, '307'),
  ('MA-02-P', 2, '207'),
  ('MA-02-Q', 2, '213'),
  ('MA-02-R', 2, '216'),
  ('MA-02-S', 2, '205'),
  ('MA-02-T', 2, '206'),
  ('MA-02-U', 2, '113');

do $$
declare
  maverick_hotel_id uuid;
  mismatch_count integer;
begin
  select id into strict maverick_hotel_id
  from public.alberghi
  where nome = 'Maverick Atheneum';

  if (select count(*) from maverick_room_number_map) <> 70 then
    raise exception 'Expected 70 Maverick room mappings';
  end if;

  if (select count(*) from public.stanze where albergo_id = maverick_hotel_id) <> 70 then
    raise exception 'Live Maverick inventory no longer contains exactly 70 rooms';
  end if;

  select count(*) into mismatch_count
  from maverick_room_number_map mapping
  left join public.stanze room
    on room.albergo_id = maverick_hotel_id
   and room.codice_interno = mapping.codice_interno
   and room.capienza = mapping.capienza
  where room.id is null;

  if mismatch_count <> 0 then
    raise exception '% mapped Maverick rooms are missing or have a different capacity', mismatch_count;
  end if;

  select count(*) into mismatch_count
  from public.stanze room
  left join maverick_room_number_map mapping
    on mapping.codice_interno = room.codice_interno
   and mapping.capienza = room.capienza
  where room.albergo_id = maverick_hotel_id
    and mapping.codice_interno is null;

  if mismatch_count <> 0 then
    raise exception '% live Maverick rooms are not covered by the source mapping', mismatch_count;
  end if;

  if exists (
    select 1
    from public.stanze room
    join maverick_room_number_map mapping
      on lower(mapping.numero_reale) = lower(room.numero_reale)
    where room.albergo_id = maverick_hotel_id
      and room.codice_interno <> mapping.codice_interno
  ) then
    raise exception 'A supplied Maverick room number is already linked to another internal room';
  end if;
end
$$;

update public.stanze room
set
  numero_reale = mapping.numero_reale,
  updated_at = now()
from maverick_room_number_map mapping
join public.alberghi hotel on hotel.nome = 'Maverick Atheneum'
where room.albergo_id = hotel.id
  and room.codice_interno = mapping.codice_interno
  and room.capienza = mapping.capienza
  and room.numero_reale is distinct from mapping.numero_reale;

do $$
declare
  verified_count integer;
begin
  select count(*) into verified_count
  from public.stanze room
  join public.alberghi hotel
    on hotel.id = room.albergo_id
   and hotel.nome = 'Maverick Atheneum'
  join maverick_room_number_map mapping
    on mapping.codice_interno = room.codice_interno
   and mapping.capienza = room.capienza
   and mapping.numero_reale = room.numero_reale;

  if verified_count <> 70 then
    raise exception 'Postcondition failed: verified % of 70 Maverick room numbers', verified_count;
  end if;
end
$$;

select
  room.capienza,
  count(*) as rooms,
  count(*) filter (where room.numero_reale is not null) as with_room_number
from public.stanze room
join public.alberghi hotel on hotel.id = room.albergo_id
where hotel.nome = 'Maverick Atheneum'
group by room.capienza
order by room.capienza desc;
