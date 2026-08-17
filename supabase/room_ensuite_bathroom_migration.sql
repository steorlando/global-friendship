select pg_advisory_xact_lock(hashtext('global-friendship:room-ensuite-bathroom:v1'));

alter table public.stanze
  add column if not exists bagno_in_camera boolean;

comment on column public.stanze.bagno_in_camera is
  'TRUE: confirmed private ensuite bathroom; FALSE: confirmed no ensuite bathroom; NULL: hotel has not provided the information yet.';

create temporary table baroque_room_details_source (
  codice_interno text primary key,
  numero_reale text not null,
  bagno_in_camera boolean not null,
  capienza integer not null,
  available_from date not null,
  available_to date not null
) on commit drop;

insert into baroque_room_details_source (
  codice_interno,
  numero_reale,
  bagno_in_camera,
  capienza,
  available_from,
  available_to
)
values
  ('BA-02-A', 'Dble1', false, 2, date '2026-08-27', date '2026-08-31'),
  ('BA-02-B', 'Dble2', false, 2, date '2026-08-27', date '2026-08-31'),
  ('BA-02-C', 'UBdble', false, 2, date '2026-08-27', date '2026-08-31'),
  ('BA-02-D', 'single', false, 2, date '2026-08-27', date '2026-08-31'),
  ('BA-02-E', 'twin1', false, 2, date '2026-08-27', date '2026-08-31'),
  ('BA-02-F', 'twin2', false, 2, date '2026-08-27', date '2026-08-31'),
  ('BA-02-G', 'ubtwin', false, 2, date '2026-08-27', date '2026-08-31'),
  ('BA-03-A', 'retwin', false, 3, date '2026-08-27', date '2026-08-31'),
  ('BA-03-B', 're3', false, 3, date '2026-08-27', date '2026-08-31'),
  ('BA-03-C', 'retwin/2', false, 3, date '2026-08-27', date '2026-08-31'),
  ('BA-03-D', 'su3', false, 3, date '2026-08-27', date '2026-08-31'),
  ('BA-03-E', 'su4', false, 3, date '2026-08-27', date '2026-08-31'),
  ('BA-04-A', 'su2', false, 4, date '2026-08-27', date '2026-08-31'),
  ('BA-04-B', 'ob4', false, 4, date '2026-08-27', date '2026-08-31'),
  ('BA-04-C', 'ub4', false, 4, date '2026-08-27', date '2026-08-31'),
  ('BA-04-D', 'ub4/2', false, 4, date '2026-08-27', date '2026-08-31'),
  ('BA-04-E', 'studio', true, 4, date '2026-08-27', date '2026-08-31'),
  ('BA-05-A', 'ob5', false, 5, date '2026-08-27', date '2026-08-31'),
  ('BA-05-B', 're5', false, 5, date '2026-08-27', date '2026-08-31'),
  ('BA-08-A', 'ub7', false, 8, date '2026-08-27', date '2026-08-31'),
  ('BA-08-B', 'ob8', false, 8, date '2026-08-27', date '2026-08-31');

do $$
declare
  baroque_hotel_id uuid;
  hotel_count integer;
  room_count integer;
  matched_room_count integer;
  incompatible_room_count integer;
begin
  select count(*)
  into hotel_count
  from public.alberghi
  where nome = 'Baroque Hostel';

  if hotel_count <> 1 then
    raise exception 'Expected exactly one Baroque Hostel row, found %', hotel_count;
  end if;

  select id
  into baroque_hotel_id
  from public.alberghi
  where nome = 'Baroque Hostel';

  select count(*)
  into room_count
  from public.stanze
  where albergo_id = baroque_hotel_id;

  if room_count <> 21 then
    raise exception 'Expected 21 Baroque Hostel rooms, found %', room_count;
  end if;

  select count(*)
  into matched_room_count
  from public.stanze s
  join baroque_room_details_source source
    on source.codice_interno = s.codice_interno
  where s.albergo_id = baroque_hotel_id;

  if matched_room_count <> 21 then
    raise exception 'Only % of 21 Baroque source room codes match the live dataset', matched_room_count;
  end if;

  select count(*)
  into incompatible_room_count
  from public.stanze s
  join baroque_room_details_source source
    on source.codice_interno = s.codice_interno
  where s.albergo_id = baroque_hotel_id
    and (
      s.capienza is distinct from source.capienza
      or s.available_from is distinct from source.available_from
      or s.available_to is distinct from source.available_to
      or (s.numero_reale is not null and s.numero_reale is distinct from source.numero_reale)
      or (
        s.bagno_in_camera is not null
        and s.bagno_in_camera is distinct from source.bagno_in_camera
      )
    );

  if incompatible_room_count <> 0 then
    raise exception '% Baroque room rows conflict with the source workbook', incompatible_room_count;
  end if;
end
$$;

update public.stanze s
set
  numero_reale = source.numero_reale,
  bagno_in_camera = source.bagno_in_camera
from public.alberghi a,
  baroque_room_details_source source
where s.albergo_id = a.id
  and a.nome = 'Baroque Hostel'
  and s.codice_interno = source.codice_interno
  and (
    s.numero_reale is distinct from source.numero_reale
    or s.bagno_in_camera is distinct from source.bagno_in_camera
  );

do $$
declare
  verified_count integer;
begin
  select count(*)
  into verified_count
  from public.stanze s
  join public.alberghi a on a.id = s.albergo_id
  join baroque_room_details_source source
    on source.codice_interno = s.codice_interno
  where a.nome = 'Baroque Hostel'
    and s.numero_reale = source.numero_reale
    and s.bagno_in_camera = source.bagno_in_camera;

  if verified_count <> 21 then
    raise exception 'Postcondition failed: only % of 21 Baroque rooms were updated', verified_count;
  end if;
end
$$;

notify pgrst, 'reload schema';
