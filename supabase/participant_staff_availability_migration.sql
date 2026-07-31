create table if not exists public.participant_staff_availability (
  participant_id uuid primary key references public.partecipanti (id) on delete cascade,
  areas text[] not null,
  band_role text null,
  band_instrument text null,
  social_media_tasks text[] not null default '{}'::text[],
  social_media_other text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participant_staff_availability_areas_not_empty
    check (cardinality(areas) > 0),
  constraint participant_staff_availability_areas_values
    check (areas <@ array['band', 'choir', 'social_media']::text[]),
  constraint participant_staff_availability_band_role
    check (band_role is null or band_role in ('vocals', 'instrument')),
  constraint participant_staff_availability_band_details
    check (
      case
        when 'band' = any(areas) then
          band_role is not null
          and (
            (band_role = 'vocals' and band_instrument is null)
            or (
              band_role = 'instrument'
              and band_instrument is not null
              and btrim(band_instrument) <> ''
            )
          )
        else band_role is null and band_instrument is null
      end
    ),
  constraint participant_staff_availability_social_values
    check (
      social_media_tasks <@ array[
        'capture',
        'post_production',
        'short_posts',
        'long_articles',
        'other'
      ]::text[]
    ),
  constraint participant_staff_availability_social_details
    check (
      case
        when 'social_media' = any(areas) then cardinality(social_media_tasks) > 0
        else cardinality(social_media_tasks) = 0 and social_media_other is null
      end
    ),
  constraint participant_staff_availability_social_other
    check (
      case
        when 'other' = any(social_media_tasks) then
          social_media_other is not null and btrim(social_media_other) <> ''
        else social_media_other is null
      end
    )
);

create index if not exists participant_staff_availability_updated_at_idx
  on public.participant_staff_availability (updated_at desc);

create or replace function public.set_participant_staff_availability_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_participant_staff_availability_updated_at
  on public.participant_staff_availability;

create trigger trg_participant_staff_availability_updated_at
before update on public.participant_staff_availability
for each row execute function public.set_participant_staff_availability_updated_at();

alter table public.participant_staff_availability enable row level security;
