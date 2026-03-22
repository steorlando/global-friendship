-- Accommodation hotels contact fields
-- Adds hotel address and Google Maps link so the accommodation inventory
-- can store the operational information needed for participant communications.

alter table public.alberghi
  add column if not exists indirizzo text,
  add column if not exists google_maps_url text;

update public.alberghi
set
  indirizzo = nullif(btrim(indirizzo), ''),
  google_maps_url = nullif(btrim(google_maps_url), '');

alter table public.alberghi
  drop constraint if exists alberghi_indirizzo_not_blank;

alter table public.alberghi
  add constraint alberghi_indirizzo_not_blank
  check (indirizzo is null or length(btrim(indirizzo)) > 0);

alter table public.alberghi
  drop constraint if exists alberghi_google_maps_url_not_blank;

alter table public.alberghi
  add constraint alberghi_google_maps_url_not_blank
  check (google_maps_url is null or length(btrim(google_maps_url)) > 0);

alter table public.alberghi
  drop constraint if exists alberghi_google_maps_url_http_chk;

alter table public.alberghi
  add constraint alberghi_google_maps_url_http_chk
  check (
    google_maps_url is null
    or google_maps_url ~* '^https?://'
  );
